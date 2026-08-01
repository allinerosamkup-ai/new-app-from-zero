import { normalizeObjectiveSubgoals, type ObjectiveSubgoal } from '../lib/objective-subgoals';

type ObjectiveRecoveryRow = {
  id: string;
  userId: string;
  title: string;
  progress: number;
  archived: boolean;
  subgoals: unknown;
  updatedAt?: Date | string | null;
};

type ObjectiveActionRecoveryPrisma = {
  objective: {
    findMany(args: unknown): Promise<ObjectiveRecoveryRow[]>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
};

export type GoalSubtasksSuggestionRequest = {
  type: 'goal-subtasks';
  context: {
    goalTitle: string;
    existingSubtasks: string[];
    locale: string;
  };
};

export type GoalSubtasksSuggestionGenerator = (
  request: GoalSubtasksSuggestionRequest,
) => Promise<unknown>;

export type ObjectiveActionRecoveryResult = {
  eligible: number;
  attempted: number;
  recovered: number;
  failed: number;
  deferred: number;
  retryAfterMs: number | null;
};

type RecoveryOutcome = {
  status: 'recovered' | 'failed' | 'deferred';
  attempted: boolean;
  retryAfterMs: number | null;
};

type ObjectiveActionRecoveryOptions = {
  maxPerRequest?: number;
  backoffMs?: number;
  now?: () => number;
};

const DEFAULT_MAX_PER_REQUEST = 3;
const DEFAULT_BACKOFF_MS = 60_000;

export function buildGoalSubtasksPrompt(input: {
  goalTitle: string;
  existingSubtasks: string[];
  userName?: string;
  locale?: string;
}): string {
  const existing = input.existingSubtasks.length > 0
    ? `\nSubtarefas já existentes: ${input.existingSubtasks.join(', ')}`
    : '';

  const languageInstruction = input.locale?.toLowerCase().startsWith('en')
    ? 'Respond in English while preserving the same JSON contract.'
    : 'Responda em português do Brasil preservando o mesmo contrato JSON.';

  return `${input.userName ?? 'A pessoa'} pode estar com energia baixa ou oscilante. Gere micro-passos sem carga cognitiva e sem abstrações.
${languageInstruction}

Meta: "${input.goalTitle}"${existing}

Gere 4-5 MICRO-AÇÕES físicas e hiper-específicas. Regras OBRIGATÓRIAS:
- Cada ação é executável em 2-10 minutos
- Comece com VERBO físico: Abrir, Separar, Mandar, Verificar, Ligar, Escrever, Pegar, Colocar, Escolher
- NUNCA use: "planejar", "organizar", "pesquisar sobre", "considerar", "preparar-se para", "pensar"
- Nomeie objetos reais, apps e locais específicos quando possível
- Cada ação = mínima unidade de esforço, zero carga cognitiva

Exemplos para "ir à praia": ["Abrir o calendário e marcar um dia nos próximos 7 dias", "Verificar a previsão do tempo no celular para esse dia", "Separar o biquíni/sunga e o protetor solar agora", "Mandar mensagem para alguém: 'Vamos à praia [dia]?'", "Abrir Google Maps e ver quanto tempo leva para chegar"]

- As ações não podem se repetir de forma disfarçada.
- A primeira ação deve ser a mais fácil de começar em menos de 2 minutos.
- Se já houver subtarefas parecidas, evite duplicar.

JSON APENAS: {"items":["micro-ação 1","micro-ação 2","micro-ação 3","micro-ação 4"]}`;
}

function suggestionItems(value: unknown): string[] {
  const payload = value && typeof value === 'object' && 'suggestion' in value
    ? (value as { suggestion?: unknown }).suggestion
    : value;
  const items = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: unknown[] }).items
      : [];

  const seen = new Set<string>();
  return items.flatMap((item) => {
    if (typeof item !== 'string') return [];
    const title = item.trim();
    const identity = title.toLocaleLowerCase('pt-BR');
    if (!title || seen.has(identity)) return [];
    seen.add(identity);
    return [title];
  });
}

function recoveredActions(objectiveId: string, titles: string[]): ObjectiveSubgoal[] {
  return normalizeObjectiveSubgoals(titles.map((title, index) => ({
    id: `recovered-${objectiveId}-${index + 1}`,
    title,
    done: false,
    order: index,
    aiGenerated: true,
  })));
}

export class ObjectiveActionRecoveryService {
  private readonly inFlight = new Map<string, Promise<RecoveryOutcome>>();
  private readonly retryNotBefore = new Map<string, number>();
  private readonly maxPerRequest: number;
  private readonly backoffMs: number;
  private readonly now: () => number;

  constructor(
    private readonly prisma: ObjectiveActionRecoveryPrisma,
    private readonly generateGoalSubtasks: GoalSubtasksSuggestionGenerator,
    options: ObjectiveActionRecoveryOptions = {},
  ) {
    this.maxPerRequest = Math.max(1, options.maxPerRequest ?? DEFAULT_MAX_PER_REQUEST);
    this.backoffMs = Math.max(1, options.backoffMs ?? DEFAULT_BACKOFF_MS);
    this.now = options.now ?? Date.now;
  }

  async recover(input: { userId: string; locale?: string }): Promise<ObjectiveActionRecoveryResult> {
    const rows = await this.prisma.objective.findMany({
      where: {
        userId: input.userId,
        archived: false,
        progress: { lt: 100 },
      },
      select: {
        id: true,
        userId: true,
        title: true,
        progress: true,
        archived: true,
        subgoals: true,
        updatedAt: true,
      },
    });
    const eligible = rows.filter((objective) => (
      objective.userId === input.userId
      && objective.archived === false
      && objective.progress < 100
      && normalizeObjectiveSubgoals(objective.subgoals).length === 0
    ));

    let recovered = 0;
    let failed = 0;
    let deferred = 0;
    let attempted = 0;
    let started = 0;
    const retryDelays: number[] = [];

    for (const objective of eligible) {
      const key = `${input.userId}:${objective.id}`;
      const shared = this.inFlight.get(key);
      const waitMs = Math.max(0, (this.retryNotBefore.get(key) ?? 0) - this.now());
      let outcome: RecoveryOutcome;

      if (shared) {
        outcome = await shared;
      } else if (waitMs > 0) {
        outcome = { status: 'deferred', attempted: false, retryAfterMs: waitMs };
      } else if (started >= this.maxPerRequest) {
        outcome = { status: 'deferred', attempted: false, retryAfterMs: 0 };
      } else {
        started += 1;
        const operation = this.recoverObjective({
          objective,
          userId: input.userId,
          locale: input.locale ?? 'pt-BR',
          key,
        });
        this.inFlight.set(key, operation);
        outcome = await operation.finally(() => {
          if (this.inFlight.get(key) === operation) this.inFlight.delete(key);
        });
      }

      if (outcome.attempted) attempted += 1;
      if (outcome.status === 'recovered') recovered += 1;
      if (outcome.status === 'failed') failed += 1;
      if (outcome.status === 'deferred') deferred += 1;
      if (outcome.retryAfterMs !== null) retryDelays.push(outcome.retryAfterMs);
    }

    return {
      eligible: eligible.length,
      attempted,
      recovered,
      failed,
      deferred,
      retryAfterMs: retryDelays.length > 0 ? Math.min(...retryDelays) : null,
    };
  }

  private async recoverObjective(input: {
    objective: ObjectiveRecoveryRow;
    userId: string;
    locale: string;
    key: string;
  }): Promise<RecoveryOutcome> {
    const titleSnapshot = input.objective.title;
    const updatedAtSnapshot = input.objective.updatedAt instanceof Date
      ? new Date(input.objective.updatedAt)
      : input.objective.updatedAt;
    const subgoalsSnapshot = input.objective.subgoals === undefined
      ? undefined
      : JSON.parse(JSON.stringify(input.objective.subgoals));
    try {
      const suggestion = await this.generateGoalSubtasks({
        type: 'goal-subtasks',
        context: {
          goalTitle: titleSnapshot,
          existingSubtasks: [],
          locale: input.locale,
        },
      });
      const actions = recoveredActions(input.objective.id, suggestionItems(suggestion));
      if (actions.length === 0) {
        this.retryNotBefore.set(input.key, this.now() + this.backoffMs);
        return { status: 'failed', attempted: true, retryAfterMs: this.backoffMs };
      }

      const updated = await this.prisma.objective.updateMany({
        where: {
          id: input.objective.id,
          userId: input.userId,
          title: titleSnapshot,
          archived: false,
          progress: { lt: 100 },
          subgoals: { equals: subgoalsSnapshot },
          ...(updatedAtSnapshot !== undefined
            ? { updatedAt: updatedAtSnapshot }
            : {}),
        },
        data: { subgoals: actions as any },
      });
      if (updated.count !== 1) {
        return { status: 'deferred', attempted: true, retryAfterMs: 0 };
      }
      this.retryNotBefore.delete(input.key);
      return { status: 'recovered', attempted: true, retryAfterMs: null };
    } catch (error) {
      this.retryNotBefore.set(input.key, this.now() + this.backoffMs);
      console.warn(`[objective-action-recovery] objetivo ${input.objective.id} preservado após falha:`, error);
      return { status: 'failed', attempted: true, retryAfterMs: this.backoffMs };
    }
  }
}
