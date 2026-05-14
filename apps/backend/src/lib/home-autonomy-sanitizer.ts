export type StabilityAction = {
  title: string;
  category: string;
  why?: string;
};

type FeedbackItem = {
  title?: unknown;
  status?: unknown;
};

const GENERIC_ACTION_PATTERNS = [
  /\brespir(ar|e|acao|ação)\b/,
  /\bbeb(er|a)\s+(agua|água)\b/,
  /\balong(ar|ue|amento)\b/,
  /\bpostura\b/,
  /\bombros?\b/,
  /\banot(e|ar)\s+(uma\s+)?pend[eê]ncia\b/,
  /\bregistr(e|ar)\s+(al[ií]vio|energia|humor)\b/,
  /\bpr[oó]ximo passo\b/,
  /\bpasso m[ií]nimo\b/,
  /\btarefa pequena\b/,
  /\bmicro[\s-]?bloco\b/,
  /\bbloco fixo\b/,
  /\bsepar(ar|e)\s+(a\s+)?roupa\b/,
  /\bkit(s)?\s+(do\s+)?treino\b/,
  /\bescolh(a|er)\s+(uma\s+)?tarefa\b/,
  /\borganizar\s+(a\s+)?agenda\b/,
  /\bfechar\s+(o\s+)?dia\b/,
  /\bpausa\s+de\s+tela\b/,
  /\bfazer\s+check-?in\b/,
  // Padrões claramente genéricos observados em produção (Alline 12/05).
  // ATENÇÃO: aqui SÓ entram regex que NUNCA deveriam passar. Quando em dúvida,
  // não bloquear — o anchor check abaixo já filtra ações sem âncora real.
  /^reduza\s+(a|sua|uma)\s+pr[oó]xima\s+tarefa\b/,           // "Reduza a próxima tarefa pra 15 min"
  /^tire\s+(da\s+agenda\s+)?(uma|alguma)\s+pend[eê]ncia\b/,  // "Tire da agenda uma pendência"
  /\bqual\s+(e|é)\s+(a|o)\s+(unica|única)\s+coisa\b/,         // pergunta disfarçada
];

// Removido (Fix bloqueio total 14/05):
//   - ABSTRACT_VERB_OPENERS + ABSTRACT_OBJECTS estavam matando ações boas
//     como "Reduza essa tarefa pra 15 minutos" (com "essa" referenciando algo).
//   - Regex /^(qual|que|como|quando)/ matava qualquer pergunta no início.
//   - /^continu(e|ar)\s+(no|com|o)\s+\w+/ pegava continuação legítima.
//   - /^ajust(e|ar)\s+(dia|ritmo)/ pegava "Ajuste o ritmo agora".
// O hasConcreteAnchor() abaixo já garante grounding real — confiar nele.

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'e', 'em',
  'para', 'pra', 'por', 'com', 'sem', 'que', 'se', 'sua', 'seu', 'suas', 'seus',
  'voce', 'você', 'hoje', 'agora', 'fazer', 'abrir', 'ver', 'revisar', 'criar',
  'marcar', 'organizar', 'definir', 'separar', 'colocar', 'pegar',
]);

const TRAINING_PATTERN = /\b(treino|treinar|exerc[ií]cio|exercitar|academia|gin[aá]stica|malhar|muscula[cç][aã]o|pilates|corrida|caminhada|roupa de treino|kit do treino|kits do treino)\b/;

export function normalizeHomeAutonomyText(value: unknown): string {
  return typeof value === 'string'
    ? value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    : '';
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(cleanText).filter(Boolean)
    : [];
}

function feedbackTitles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): string => {
      if (!item || typeof item !== 'object') return '';
      const feedback = item as FeedbackItem;
      return cleanText(feedback.title);
    })
    .filter(Boolean);
}

function tokenSet(value: unknown): Set<string> {
  return new Set(
    normalizeHomeAutonomyText(value)
      .split(' ')
      .filter((token) => token.length >= 3 && !STOPWORDS.has(token)),
  );
}

function tokenOverlap(a: unknown, b: unknown): number {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;

  let common = 0;
  for (const token of left) {
    if (right.has(token)) common += 1;
  }
  return common / Math.min(left.size, right.size);
}

function isSimilar(a: unknown, b: unknown): boolean {
  const left = normalizeHomeAutonomyText(a);
  const right = normalizeHomeAutonomyText(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  return tokenOverlap(left, right) >= 0.58;
}

function isGenericAction(action: StabilityAction): boolean {
  const fullText = normalizeHomeAutonomyText(`${action.title} ${action.why ?? ''}`);
  if (!fullText) return true;

  // Apenas padrões explícitos proibidos. A heurística verbo+objeto abstrato foi
  // removida no Fix de 14/05 porque estava matando ações legítimas como
  // "Reduza essa tarefa pra 15 minutos". O hasConcreteAnchor() depois filtra
  // o que sobra com base em contexto real do dia.
  return GENERIC_ACTION_PATTERNS.some((pattern) => pattern.test(fullText));
}

function mentionsTraining(value: unknown): boolean {
  return TRAINING_PATTERN.test(normalizeHomeAutonomyText(value));
}

function hasConcreteAnchor(action: StabilityAction, anchors: string[]): boolean {
  if (anchors.length === 0) return false;

  const actionText = `${action.title} ${action.why ?? ''}`;
  return anchors.some((anchor) => {
    if (isSimilar(actionText, anchor)) return true;
    return tokenOverlap(actionText, anchor) >= 0.15;
  });
}

function contextAnchors(context: Record<string, unknown>): string[] {
  const latestCheckinSignals = context.latestCheckinSignals && typeof context.latestCheckinSignals === 'object'
    ? context.latestCheckinSignals as Record<string, unknown>
    : {};

  return [
    ...stringList(context.pendingTasks),
    ...stringList(context.pendingTaskTitles),
    ...stringList(context.pendingHabitTitles),
    ...stringList(context.todayAnchorTitles),
    ...stringList(context.goals),
    cleanText(context.activeGoalsContext),
    cleanText(latestCheckinSignals.note),
  ].filter(Boolean);
}

function blockedTitles(context: Record<string, unknown>): string[] {
  return [
    ...stringList(context.blockedActionTitles),
    ...stringList(context.completedTaskTitles),
    ...stringList(context.completedHabitTitles),
    ...stringList(context.completedGoalTitles),
    ...stringList(context.completedSubgoalTitles),
    ...feedbackTitles(context.homeAutonomyFeedback),
  ];
}

export function sanitizeStabilityAnalysisSuggestion(
  suggestion: unknown,
  context: Record<string, unknown>,
): unknown {
  if (!suggestion || typeof suggestion !== 'object' || Array.isArray(suggestion)) {
    return suggestion;
  }

  const payload = suggestion as Record<string, unknown>;
  const rawActions = Array.isArray(payload.actions)
    ? payload.actions
    : [];
  const blocked = blockedTitles(context);
  const anchors = contextAnchors(context);
  const blockedTraining = blocked.some((title) => mentionsTraining(title));
  const anchoredTraining = anchors.some((title) => mentionsTraining(title));
  const seen = new Set<string>();

  const rejectionReasons: Array<{ title: string; reason: string }> = [];
  const actions = rawActions
    .map((item): StabilityAction | null => {
      if (!item || typeof item !== 'object') return null;
      const action = item as Record<string, unknown>;
      const title = cleanText(action.title);
      const category = cleanText(action.category) || 'pessoal';
      const why = cleanText(action.why);
      if (!title) return null;
      return { title, category, why };
    })
    .filter((item): item is StabilityAction => item !== null)
    .filter((action) => {
      const key = normalizeHomeAutonomyText(action.title);
      if (!key || seen.has(key)) {
        rejectionReasons.push({ title: action.title, reason: 'duplicate' });
        return false;
      }
      seen.add(key);
      if (isGenericAction(action)) {
        rejectionReasons.push({ title: action.title, reason: 'generic_pattern' });
        return false;
      }
      if (blocked.some((title) => isSimilar(action.title, title))) {
        rejectionReasons.push({ title: action.title, reason: 'blocked_by_feedback' });
        return false;
      }
      if (mentionsTraining(`${action.title} ${action.why ?? ''}`) && (blockedTraining || !anchoredTraining)) {
        rejectionReasons.push({ title: action.title, reason: 'training_without_anchor' });
        return false;
      }
      if (!hasConcreteAnchor(action, anchors)) {
        rejectionReasons.push({ title: action.title, reason: 'no_concrete_anchor' });
        return false;
      }
      return true;
    })
    .slice(0, 3);

  if (rawActions.length > 0 && actions.length === 0) {
    console.warn(
      `[home-autonomy-sanitizer] todas as ${rawActions.length} ações rejeitadas. Motivos:`,
      rejectionReasons.map((r) => `"${r.title.slice(0, 50)}" → ${r.reason}`).join(' | '),
      `| anchors disponíveis: ${anchors.length}`,
    );
  }

  return {
    ...payload,
    actions,
  };
}
