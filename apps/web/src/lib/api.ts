import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';
import { getCurrentLanguage } from '../i18n';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/**
 * Retorna {currentHour, currentMinute} do relógio LOCAL do dispositivo.
 * Usado pra calibrar sugestões da Aura sem depender do relógio do servidor (pode estar em UTC).
 * Auto-injetado em todo POST/PATCH/PUT pelo helper api. Pra chamadas com fetch direto (SSE),
 * importe e adicione manualmente ao body.
 */
export function getClientTimeContext(): { currentHour: number; currentMinute: number; localDate: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const localDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return { currentHour: now.getHours(), currentMinute: now.getMinutes(), localDate };
}

/**
 * Snapshot adaptativo: fase atual + warningFlags + forecast 7d resumido + momentum semanal.
 * Páginas que computam cycleReport (home, planner, insights) chamam setAdaptiveSnapshot()
 * após compute. api.ts spreaduja no body de todo POST/PATCH/PUT pra Aura calibrar sugestões
 * por carga, buffer, pausa de hábitos e pre-queda.
 */
type AdaptiveSnapshot = {
  phase?: string | null;
  warningFlags?: string[] | null;
  forecast7dSummary?: string | null;
  taskMomentum7d?: number | null;
};
let _adaptiveSnapshot: AdaptiveSnapshot = {};

export function setAdaptiveSnapshot(snapshot: AdaptiveSnapshot) {
  _adaptiveSnapshot = { ..._adaptiveSnapshot, ...snapshot };
}

export function getAdaptiveSnapshot(): AdaptiveSnapshot {
  return _adaptiveSnapshot;
}

/**
 * Cabeçalhos da requisição, com o token quando existe sessão.
 *
 * `insistir` faz a diferença entre "não tem sessão, tudo bem" e "deveria ter".
 * Sem sessão em mãos, isto **renova antes de desistir** em vez de mandar a
 * requisição pelada.
 *
 * Por que importa: mandar sem `Authorization` para rota autenticada é gastar
 * uma ida ao servidor sabendo que vai voltar 401. Foi o que aconteceu em
 * produção — o app abriu e disparou seis chamadas sem token. O log não deixa
 * dúvida sobre qual dos dois 401 era: a resposta tinha 44 bytes, o tamanho
 * exato de `{"error":"Token de autenticação ausente."}`. Token inválido teria
 * 40. Ou seja, não era token recusado: era token que nunca foi.
 *
 * O efeito para quem usa é o pior possível: cada chamada do store tem `.catch()`
 * próprio, então o erro some e o app abre como se a conta não tivesse nada.
 */
async function readCurrentSession(): Promise<Session | null> {
  if (!_sessionReadInFlight) {
    _sessionReadInFlight = supabase.auth.getSession()
      .then(({ data }) => data.session)
      .finally(() => { _sessionReadInFlight = null; });
  }
  return _sessionReadInFlight;
}

async function getAuthHeaders(insistir = false): Promise<Record<string, string>> {
  const language = getCurrentLanguage();
  const base = {
    'Content-Type': 'application/json',
    'Accept-Language': language,
    'Content-Language': language,
  };

  let session = await readCurrentSession();

  if (!session && insistir) {
    // Pode ser corrida de inicialização: o SDK ainda está restaurando a sessão
    // do armazenamento, ou renovando um token vencido. Espera a renovação real
    // em vez de concluir que não há login.
    const renovada = await recoverSession();
    if (renovada) session = await readCurrentSession();
  }

  if (!session) return base;
  return { ...base, Authorization: `Bearer ${session.access_token}` };
}

function getLocaleContext() {
  const language = getCurrentLanguage();
  return {
    language,
    locale: language === 'en' ? 'en-US' : 'pt-BR',
  };
}

/**
 * A renovação em curso, compartilhada por quem chegar durante ela.
 *
 * Antes isto era um booleano com espera fixa de 400 ms: quem chegasse no meio
 * dormia 400 ms e devolvia `!_recoveringSession`. Como renovar sessão é uma ida
 * à rede — normalmente mais que 400 ms —, os concorrentes acordavam cedo, viam
 * a renovação ainda em curso e **desistiam**, devolvendo `false`, que o chamador
 * lê como "sessão morta".
 *
 * O efeito em produção: o app abre disparando seis chamadas de uma vez
 * (`refreshData`). Com o token vencido, as seis tomam 401, uma renova e as
 * outras cinco desistem. Cada uma tem `.catch()` próprio, então o erro some e a
 * tela abre **vazia, sem mensagem nenhuma** — como se a conta não tivesse
 * histórico. O log confirmava: `GET /checkins?days=90` 401 vinte e duas vezes
 * sem um único 200, enquanto chamadas isoladas depois disso passavam.
 *
 * Agora todo mundo espera a **mesma** promessa. Sem tempo arbitrário, e o
 * resultado é o real, não um palpite sobre quanto a rede demora.
 */
let _refreshInFlight: Promise<boolean> | null = null;
let _sessionReadInFlight: Promise<Session | null> | null = null;
const _getInFlight = new Map<string, Promise<Response>>();

/**
 * Renova a sessão e diz se a requisição pode ser refeita.
 *
 * Devolve `true` quando o refresh deu certo — aí a chamada original vale a pena
 * de novo. `false` quando a sessão morreu de vez (já deslogou e redirecionou).
 */
function recoverSession(): Promise<boolean> {
  if (!_refreshInFlight) {
    _refreshInFlight = doRecoverSession().finally(() => {
      _refreshInFlight = null;
    });
  }
  return _refreshInFlight;
}

async function doRecoverSession(): Promise<boolean> {
  /**
   * Nunca deslogar quem nunca esteve logado.
   *
   * Sem esta porta, uma chamada anônima — a splash é pública — dispararia
   * `refreshSession()`, que falha por não haver o que renovar, cairia no ramo de
   * "sessão morta" e **mandaria o visitante para /login**. Ausência de login não
   * é sessão expirada.
   */
  const { data: { session: existente } } = await supabase.auth.getSession();
  if (!existente) {
    const guardado = typeof window !== 'undefined'
      && Object.keys(window.localStorage).some((chave) => chave.startsWith('sb-'));
    if (!guardado) return false;
  }

  let sessionDead = false;
  try {
    // refreshSession() pode pendurar (token malformado / rede ruim). Nunca deixar a
    // recuperação travar: corre contra um timeout que, se vencer, trata como sessão morta.
    const timeout = new Promise<{ data: { session: null }; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null }, error: new Error('refresh timeout') }), 8000),
    );
    const { data, error } = await Promise.race([supabase.auth.refreshSession(), timeout]);
    sessionDead = Boolean(error) || !data?.session;
  } catch {
    sessionDead = true;
  }

  if (sessionDead) {
    // Sessão realmente morta: limpa e manda pro login. Redirect duro (não só signOut)
    // porque com a sessão já inválida no servidor o evento SIGNED_OUT pode não disparar,
    // deixando o app "logado-zumbi". O reload ainda zera o estado em memória.
    await supabase.auth.signOut().catch(() => {});
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.assign('/login');
    }
    return false;
  }

  return true;
}

/**
 * Faz a requisição e, num 401 recuperável, refaz UMA vez com o token novo.
 *
 * Por que existe: o access token do Supabase dura ~1h. Antes, a resposta 401
 * disparava o refresh mas a chamada original rejeitava mesmo assim — o app
 * ficava com sessão boa e a tela com erro. No onboarding guiado, que busca o
 * catálogo uma vez no mount, isso virava "Não consegui carregar as opções" numa
 * sessão perfeitamente válida, e só saía dali clicando em "Tentar de novo".
 *
 * Uma tentativa só: se o 401 persiste com token novo, o problema não é o token.
 */
async function requestWithAuth(
  build: (headers: Record<string, string>) => Promise<Response> | Response,
  // `any` de propósito: mantém o contrato que `handleResponse` já tinha
  // (response.json()), senão toda chamada do app precisaria de cast novo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // `insistir`: na primeira tentativa, sessão ausente é motivo para renovar,
  // não para mandar a requisição sem token e colher um 401 previsível.
  const response = await build(await getAuthHeaders(true));
  if (response.status !== 401) return handleResponse(response);

  const recovered = await recoverSession();
  if (!recovered) {
    throw new ApiRequestError(401, 'Sessão expirada ou inválida. Se o erro persistir, tente sair e entrar novamente.');
  }

  // Token novo em mãos: refaz a chamada que falhou.
  return handleResponse(await build(await getAuthHeaders(true)));
}

async function handleResponse(response: Response) {
  if (response.ok) return response.status === 204 ? null : response.json();

  if (response.status === 401) {
    // Chegou aqui já tendo passado por requestWithAuth: o token foi renovado e
    // a chamada refeita, e ainda assim voltou 401. Não é mais problema de token.
    await recoverSession();
    throw new ApiRequestError(401, 'Sessão expirada ou inválida. Se o erro persistir, tente sair e entrar novamente.');
  }

  let message = `Erro ${response.status}`;
  try {
    const body = await response.json();
    if (body?.message) {
      const firstDetail = Array.isArray(body.details) && typeof body.details[0]?.message === 'string'
        ? ` ${body.details[0].message}`
        : '';
      message = `${body.message}${firstDetail}`.trim();
    } else if (body?.error) message = body.error;
  } catch {
    message = `Erro ${response.status}: ${response.statusText}`;
  }
  throw new ApiRequestError(response.status, message);
}

function uploadContentType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const extension = file.name.toLowerCase().split('.').pop();
  const byExtension: Record<string, string> = {
    txt: 'text/plain',
    md: 'text/markdown',
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return (extension && byExtension[extension]) || 'application/octet-stream';
}

function enrichWriteBody(endpoint: string, body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;

  // Objetivos possuem contratos versionados e estritos. O contexto relevante
  // é recuperado no backend a partir de Diário, Check-in, Aura e memória; o
  // envelope global do cliente não pertence a essas mutações.
  if (endpoint === '/objectives' || endpoint.startsWith('/objectives/')) return body;

  return { ...getClientTimeContext(), ...getAdaptiveSnapshot(), ...getLocaleContext(), ...(body as Record<string, unknown>) };
}

export const api = {
  async get(endpoint: string) {
    const pending = _getInFlight.get(endpoint);
    if (pending) return pending;
    const request = requestWithAuth((headers) => fetch(`${API_URL}${endpoint}`, { headers }))
      .finally(() => { _getInFlight.delete(endpoint); });
    _getInFlight.set(endpoint, request);
    return request;
  },

  async post(endpoint: string, body: unknown) {
    const enrichedBody = enrichWriteBody(endpoint, body);
    return requestWithAuth((headers) => fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(enrichedBody),
    }));
  },

  async patch(endpoint: string, body: unknown) {
    const enrichedBody = enrichWriteBody(endpoint, body);
    return requestWithAuth((headers) => fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(enrichedBody),
    }));
  },

  async put(endpoint: string, body: unknown) {
    const enrichedBody = enrichWriteBody(endpoint, body);
    return requestWithAuth((headers) => fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(enrichedBody),
    }));
  },

  async delete(endpoint: string) {
    return requestWithAuth((headers) => fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers,
    }));
  },

  async upload(endpoint: string, file: File) {
    return requestWithAuth((headers) => {
      delete headers['Content-Type'];
      headers['Content-Type'] = uploadContentType(file);
      headers['X-File-Name'] = encodeURIComponent(file.name);
      return fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: file,
      });
    });
  },
};
