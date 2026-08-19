/**
 * Validador server-side da resposta da Aura no diário.
 *
 * Por que existe: o prompt diz "máximo 1 pergunta a cada 3 respostas" e "use
 * pelo menos 1 elemento concreto da memória", mas o modelo IGNORA quando
 * essas regras não têm consequência. Este validador é a consequência: roda
 * depois da geração, e se a resposta cair em um anti-padrão crítico, devolve
 * `{ ok: false, reason }` para o caller decidir reescrever.
 *
 * Anti-padrões cobertos:
 *  - question_loop: 3 perguntas seguidas no histórico recente
 *  - no_concrete_anchor: havia âncora real no contexto e a resposta não cita nenhuma
 *  - echo_only: resposta é apenas reformulação da última fala da usuária
 */

import { validateVisibleConcreteAction } from './action-quality';

export type JournalValidationContext = {
  /** Últimas respostas DA AIRIA na sessão atual (mais antiga → mais recente). */
  lastAssistantReplies: string[];
  /** Últimas mensagens DA USUÁRIA na sessão atual (mais antiga → mais recente). */
  lastUserMessages: string[];
  /**
   * Títulos/conceitos do contexto de hoje que a Aura DEVE conseguir referenciar:
   * tarefas pendentes, hábitos do dia, metas ativas, memórias RAG aceitas.
   * Lista vazia desativa a checagem de "no_concrete_anchor".
   */
  anchorTitles: string[];
};

export type JournalValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'question_loop' | 'no_concrete_anchor' | 'echo_only' | 'analysis_missing' | 'visible_action_invalid';
      details: string;
    };

const STOPWORDS_PT = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas',
  'em', 'por', 'pra', 'para', 'com', 'sem',
  'que', 'se', 'sua', 'seu', 'suas', 'seus',
  'voce', 'você', 'eu', 'me', 'mim', 'tu', 'te',
  'hoje', 'agora', 'aqui', 'ali', 'isso', 'aquilo',
  'esta', 'estar', 'esse', 'essa', 'isso',
  'mas', 'porque', 'porém', 'entao', 'então',
  'e', 'ou', 'nem', 'mais', 'menos',
  'fazer', 'ter', 'ser', 'estar', 'ficar', 'ir',
]);

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantTokens(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(' ')
      .filter((token) => token.length >= 4 && !STOPWORDS_PT.has(token)),
  );
}

function endsWithQuestion(value: string): boolean {
  return /[?？]\s*$/.test(value.trim());
}

const QUESTION_LOOP_THRESHOLD = 3;
const VISIBLE_ACTION_LINE = /(?:^|\n)\s*(?:pr[oó]ximo passo|next step)\s*:\s*(.+)$/gim;
const IMPERATIVE_ACTION_START = /(?:^|[.!?]\s+)(?:abra|abre|anote|liste|envie|ligue|separe|fa[çc]a|escreva|marque|responda|organize|confira|pague)\b/i;

function visibleActionError(reply: string): string | null {
  const actionLines = [...reply.matchAll(VISIBLE_ACTION_LINE)]
    .map((match) => match[1]?.trim() ?? '')
    .filter(Boolean);
  if (actionLines.length > 0) {
    const invalid = actionLines.find((line) => !validateVisibleConcreteAction(line).ok);
    return invalid
      ? `Ação visível sem objeto específico ou término observável: "${invalid}".`
      : null;
  }
  if (IMPERATIVE_ACTION_START.test(reply)) {
    return 'A resposta contém uma sugestão imperativa, mas não a apresenta como “Próximo passo: … Pronto quando: …”.';
  }
  return null;
}

export function validateJournalReply(
  reply: string,
  context: JournalValidationContext,
): JournalValidationResult {
  const trimmed = reply.trim();
  if (!trimmed) {
    return { ok: true };
  }

  const actionError = visibleActionError(trimmed);
  if (actionError) {
    return { ok: false, reason: 'visible_action_invalid', details: actionError };
  }

  // 1. Anti-loop de pergunta: se as últimas N-1 respostas terminaram em "?"
  //    E esta também termina, são N perguntas seguidas — bloqueia.
  if (endsWithQuestion(trimmed)) {
    const previousReplies = context.lastAssistantReplies.slice(-(QUESTION_LOOP_THRESHOLD - 1));
    const previousAllQuestion = previousReplies.length === QUESTION_LOOP_THRESHOLD - 1
      && previousReplies.every(endsWithQuestion);
    if (previousAllQuestion) {
      return {
        ok: false,
        reason: 'question_loop',
        details: `${QUESTION_LOOP_THRESHOLD} perguntas seguidas no diário. Esta resposta deve trazer leitura+ação, não pergunta.`,
      };
    }
  }

  // 2. Anti-eco: se a resposta é apenas reformulação da última fala da usuária.
  //    Heurística: se >= 75% dos tokens significativos da resposta vêm da última msg
  //    do usuário E a resposta não cita nada concreto novo, é eco.
  const lastUserMsg = context.lastUserMessages[context.lastUserMessages.length - 1] ?? '';
  if (lastUserMsg) {
    const replyTokens = significantTokens(trimmed);
    if (replyTokens.size >= 4) {
      const userTokens = significantTokens(lastUserMsg);
      let overlap = 0;
      for (const token of replyTokens) {
        if (userTokens.has(token)) overlap += 1;
      }
      const overlapRatio = overlap / replyTokens.size;
      if (overlapRatio >= 0.75) {
        return {
          ok: false,
          reason: 'echo_only',
          details: `Resposta é eco de ${Math.round(overlapRatio * 100)}% das palavras da usuária. Acrescente leitura nova.`,
        };
      }
    }
  }

  // 3. Citação obrigatória de âncora concreta quando há contexto.
  if (context.anchorTitles.length > 0) {
    const replyNormalized = normalizeText(trimmed);
    const cited = context.anchorTitles.some((anchor) => {
      const tokens = significantTokens(anchor);
      for (const token of tokens) {
        if (replyNormalized.includes(token)) return true;
      }
      return false;
    });
    if (!cited) {
      return {
        ok: false,
        reason: 'no_concrete_anchor',
        details: `Nenhum elemento concreto do histórico/RAG/planner citado. Âncoras disponíveis: ${context.anchorTitles.slice(0, 5).join(' | ')}.`,
      };
    }
  }

  // 4. ANÁLISE PRONTA OBRIGATÓRIA — resposta longa com 2+ sentenças, mas TODAS
  //    são perguntas (interrogatório). Caso clássico do print da Alline: 3-5
  //    perguntas seguidas sem nenhuma frase declarativa entregando leitura.
  //    Pergunta única curta NÃO é interrogatório — é coleta de dado essencial.
  if (trimmed.length >= 60) {
    const sentenceCandidates = trimmed
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 10);
    const declarativeSentences = sentenceCandidates.filter((s) => !/[?？]/.test(s));
    // Só reprova se há 2+ sentenças e nenhuma é declarativa
    if (sentenceCandidates.length >= 2 && declarativeSentences.length === 0) {
      return {
        ok: false,
        reason: 'analysis_missing',
        details: `Resposta tem ${sentenceCandidates.length} perguntas em sequência, sem nenhuma frase declarativa entregando análise pronta.`,
      };
    }
  }

  return { ok: true };
}

export type JournalValidationFailureReason =
  | 'question_loop'
  | 'no_concrete_anchor'
  | 'echo_only'
  | 'analysis_missing'
  | 'visible_action_invalid';

/**
 * Constrói a mensagem de reforço pra reescrita quando a validação falha.
 * Retorna texto curto e direto pra anexar ao prompt da segunda chamada.
 */
export function buildRevisionInstruction(reason: JournalValidationFailureReason, details: string): string {
  switch (reason) {
    case 'question_loop':
      return `REESCREVA a resposta — você está em loop de perguntas (${details}). Esta resposta NÃO PODE terminar com "?". Cruze 2 fatos do histórico e proponha UMA ação concreta com objeto que ela mencionou (verbo + objeto + tamanho). Cale após a ação.`;
    case 'no_concrete_anchor':
      return `REESCREVA a resposta — você não citou nenhum elemento concreto do contexto. ${details} Use pelo menos UM desses na sua resposta.`;
    case 'echo_only':
      return `REESCREVA a resposta — você só reformulou o que a usuária disse com sinônimos. ${details} Acrescente leitura nova: cruze fato do dia anterior, identifique o que está se repetindo, ou proponha ação concreta.`;
    case 'analysis_missing':
      return `REESCREVA a resposta — ${details} A pessoa NÃO conhece a metodologia. Quem precisa ver primeiro é VOCÊ, e mostrar pronto. Estrutura obrigatória: (1) 1-3 frases DECLARATIVAS dizendo o que você está lendo no contexto cruzando fatos; (2) 1-2 frases direcionando o próximo passo concreto com objeto que ela citou + tamanho; (3) opcional, UMA pergunta curta de até 12 palavras no fim. NUNCA devolva só perguntas — entregue a análise pronta.`;
    case 'visible_action_invalid':
      return `REESCREVA a resposta — ${details} Preserve a análise e, se houver ação, termine com UMA linha no formato exato: "Próximo passo: <verbo + objeto específico>. Pronto quando: <evidência observável>." Não invente objeto, não use Planner ou Hábitos e não deixe outra ação imperativa solta no texto.`;
    default:
      return 'REESCREVA a resposta seguindo as regras do diário.';
  }
}
