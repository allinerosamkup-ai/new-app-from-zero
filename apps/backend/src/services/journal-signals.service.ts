/**
 * Sinais estruturados que o diário emite.
 *
 * O diário é onde a pessoa conta como está sem preencher formulário nenhum.
 * Este serviço aproveita isso de duas formas:
 *
 *  - o estado que ela descreveu vira um check-in proposto;
 *  - a intenção que ela revelou vira uma meta proposta.
 *
 * "Proposto" é a palavra que manda: **o diário nunca aplica sozinho.** É
 * superfície confessional — gravar coisa sem pedir transformaria desabafo em
 * formulário e a pessoa passaria a se policiar para não gerar registro.
 *
 * A extração é toda determinística. O modelo só emite um bloco JSON com o que
 * observou; quem decide se aquilo vira check-in é `CheckinUnderstandingService`,
 * que já valida sinal contra léxico e devolve `status: 'ready'` só quando dá
 * para ler humor e energia de verdade.
 */

export type JournalCheckinSignal = {
  moodScore?: number;
  energyScore?: number;
  emotions?: string[];
  factors?: string[];
};

export type JournalGoalSignal = {
  title: string;
  subgoals: string[];
};

export type JournalSignals = {
  checkin: JournalCheckinSignal | null;
  goal: JournalGoalSignal | null;
};

const EMPTY: JournalSignals = { checkin: null, goal: null };

/** Limites de sanidade: o que passar disso é ruído, não sinal. */
const MAX_SUBGOALS = 5;
const MIN_SUBGOALS = 2;
const MAX_TITLE = 200;

function asScore(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  if (n < 0 || n > 10) return undefined;
  return Math.round(n * 10) / 10;
}

function asStringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 120))
    .slice(0, max);
}

/**
 * Acha o bloco `{"journalSignals": ...}` na resposta do modelo.
 *
 * Varre de trás para frente porque a instrução manda emitir no fim; e conta
 * chaves em vez de usar regex ganancioso, senão um `}` dentro de texto quebra o
 * recorte. Qualquer falha devolve vazio — sinal ilegível é ausência de sinal,
 * nunca um chute.
 */
export function extractJournalSignals(reply: string): JournalSignals {
  if (!reply || !reply.includes('journalSignals')) return EMPTY;

  const marker = reply.lastIndexOf('"journalSignals"');
  if (marker < 0) return EMPTY;

  // Recua até a chave de abertura do objeto que contém o marcador.
  let start = reply.lastIndexOf('{', marker);
  if (start < 0) return EMPTY;

  let depth = 0;
  let end = -1;
  for (let i = start; i < reply.length; i++) {
    if (reply[i] === '{') depth++;
    else if (reply[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) return EMPTY;

  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.slice(start, end + 1));
  } catch {
    return EMPTY;
  }

  const signals = (parsed as { journalSignals?: unknown } | null)?.journalSignals;
  if (!signals || typeof signals !== 'object') return EMPTY;

  const raw = signals as { checkin?: unknown; goal?: unknown };

  let checkin: JournalCheckinSignal | null = null;
  if (raw.checkin && typeof raw.checkin === 'object') {
    const c = raw.checkin as Record<string, unknown>;
    const moodScore = asScore(c.moodScore ?? c.humor);
    const energyScore = asScore(c.energyScore ?? c.energia);
    // Sem os dois não é check-in. Metade do par vira registro torto no histórico
    // e contamina baseline, tendência e todas as leituras de padrão.
    if (moodScore !== undefined && energyScore !== undefined) {
      checkin = {
        moodScore,
        energyScore,
        emotions: asStringList(c.emotions, 3),
        factors: asStringList(c.factors, 12),
      };
    }
  }

  let goal: JournalGoalSignal | null = null;
  if (raw.goal && typeof raw.goal === 'object') {
    const g = raw.goal as Record<string, unknown>;
    const title = typeof g.title === 'string' ? g.title.trim().slice(0, MAX_TITLE) : '';
    const subgoals = asStringList(g.subgoals, MAX_SUBGOALS);
    // Meta com um passo só é tarefa, não objetivo — e vira ruído na tela.
    if (title.length >= 3 && subgoals.length >= MIN_SUBGOALS) {
      goal = { title, subgoals };
    }
  }

  return { checkin, goal };
}

/**
 * Tira o bloco JSON do texto que a pessoa lê.
 *
 * O sinal é conversa entre o modelo e o app; mostrar JSON no diário seria
 * vazamento de mecânica na cara de quem está desabafando.
 */
export function stripJournalSignals(reply: string): string {
  if (!reply || !reply.includes('journalSignals')) return reply;

  const marker = reply.lastIndexOf('"journalSignals"');
  const start = reply.lastIndexOf('{', marker);
  if (start < 0) return reply;

  let depth = 0;
  let end = -1;
  for (let i = start; i < reply.length; i++) {
    if (reply[i] === '{') depth++;
    else if (reply[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) return reply;

  return (reply.slice(0, start) + reply.slice(end + 1)).trim();
}
