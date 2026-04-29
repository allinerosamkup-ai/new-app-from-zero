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
  /\bescolh(a|er)\s+(uma\s+)?tarefa\b/,
  /\borganizar\s+(a\s+)?agenda\b/,
  /\bfechar\s+(o\s+)?dia\b/,
  /\bpausa\s+de\s+tela\b/,
  /\bfazer\s+check-?in\b/,
];

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'e', 'em',
  'para', 'pra', 'por', 'com', 'sem', 'que', 'se', 'sua', 'seu', 'suas', 'seus',
  'voce', 'você', 'hoje', 'agora', 'fazer', 'abrir', 'ver', 'revisar', 'criar',
  'marcar', 'organizar', 'definir', 'separar', 'colocar', 'pegar',
]);

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
  const text = normalizeHomeAutonomyText(`${action.title} ${action.why ?? ''}`);
  if (!text) return true;
  return GENERIC_ACTION_PATTERNS.some((pattern) => pattern.test(text));
}

function hasConcreteAnchor(action: StabilityAction, anchors: string[]): boolean {
  if (anchors.length === 0) return true;

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
    ...stringList(context.goals),
    cleanText(context.activeGoalsContext),
    cleanText(context.moodCycleContext),
    cleanText(context.longTermMemory),
    cleanText(context.ragContext),
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
  const seen = new Set<string>();

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
      if (!key || seen.has(key)) return false;
      seen.add(key);
      if (isGenericAction(action)) return false;
      if (blocked.some((title) => isSimilar(action.title, title))) return false;
      return hasConcreteAnchor(action, anchors);
    })
    .slice(0, 3);

  return {
    ...payload,
    actions,
  };
}
