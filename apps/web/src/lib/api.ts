import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

/**
 * Retorna {currentHour, currentMinute} do relógio LOCAL do dispositivo.
 * Usado pra calibrar sugestões da Aura sem depender do relógio do servidor (pode estar em UTC).
 * Auto-injetado em todo POST/PATCH/PUT pelo helper api. Pra chamadas com fetch direto (SSE),
 * importe e adicione manualmente ao body.
 */
export function getClientTimeContext(): { currentHour: number; currentMinute: number } {
  const now = new Date();
  return { currentHour: now.getHours(), currentMinute: now.getMinutes() };
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

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return {};
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function handleResponse(response: Response) {
  if (response.ok) return response.status === 204 ? null : response.json();

  if (response.status === 401) {
    // Não deslogamos mais automaticamente para evitar "kick outs" agressivos.
    // O getSession() no getAuthHeaders tentará renovar o token na próxima chamada.
    throw new Error('Sessão expirada ou inválida. Se o erro persistir, tente sair e entrar novamente.');
  }

  let message = `Erro ${response.status}`;
  try {
    const body = await response.json();
    if (body?.error) message = body.error;
    else if (body?.message) message = body.message;
  } catch {
    message = `Erro ${response.status}: ${response.statusText}`;
  }
  throw new Error(message);
}

export const api = {
  async get(endpoint: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}${endpoint}`, { headers });
    return handleResponse(response);
  },

  async post(endpoint: string, body: unknown) {
    const headers = await getAuthHeaders();
    // Injeta horário do cliente em qualquer POST com body objeto.
    // Backend usa pra calibrar sugestões; rotas que não precisam ignoram silenciosamente.
    const enrichedBody = body && typeof body === 'object' && !Array.isArray(body)
      ? { ...getClientTimeContext(), ...getAdaptiveSnapshot(), ...(body as Record<string, unknown>) }
      : body;
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(enrichedBody),
    });
    return handleResponse(response);
  },

  async patch(endpoint: string, body: unknown) {
    const headers = await getAuthHeaders();
    const enrichedBody = body && typeof body === 'object' && !Array.isArray(body)
      ? { ...getClientTimeContext(), ...getAdaptiveSnapshot(), ...(body as Record<string, unknown>) }
      : body;
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(enrichedBody),
    });
    return handleResponse(response);
  },

  async put(endpoint: string, body: unknown) {
    const headers = await getAuthHeaders();
    const enrichedBody = body && typeof body === 'object' && !Array.isArray(body)
      ? { ...getClientTimeContext(), ...getAdaptiveSnapshot(), ...(body as Record<string, unknown>) }
      : body;
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(enrichedBody),
    });
    return handleResponse(response);
  },

  async delete(endpoint: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers,
    });
    return handleResponse(response);
  },
};
