import { normalizeObjectiveSubgoals, type ObjectiveSubgoal } from '../lib/objective-subgoals';

type ObjectiveRecoveryRow = {
  id: string;
  userId: string;
  title: string;
  progress: number;
  archived: boolean;
  subgoals: unknown;
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
  };
};

export type GoalSubtasksSuggestionGenerator = (
  request: GoalSubtasksSuggestionRequest,
) => Promise<unknown>;

export type ObjectiveActionRecoveryResult = {
  eligible: number;
  recovered: number;
  failed: number;
};

export function buildGoalSubtasksPrompt(input: {
  goalTitle: string;
  existingSubtasks: string[];
  userName?: string;
}): string {
  const existing = input.existingSubtasks.length > 0
    ? `\nSubtarefas já existentes: ${input.existingSubtasks.join(', ')}`
    : '';

  return `${input.userName ?? 'A pessoa'} pode estar com energia baixa ou oscilante. Gere micro-passos sem carga cognitiva e sem abstrações.

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
  constructor(
    private readonly prisma: ObjectiveActionRecoveryPrisma,
    private readonly generateGoalSubtasks: GoalSubtasksSuggestionGenerator,
  ) {}

  async recover(input: { userId: string }): Promise<ObjectiveActionRecoveryResult> {
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

    for (const objective of eligible) {
      try {
        const suggestion = await this.generateGoalSubtasks({
          type: 'goal-subtasks',
          context: {
            goalTitle: objective.title,
            existingSubtasks: [],
          },
        });
        const actions = recoveredActions(objective.id, suggestionItems(suggestion));
        if (actions.length === 0) {
          failed += 1;
          continue;
        }

        const updated = await this.prisma.objective.updateMany({
          where: {
            id: objective.id,
            userId: input.userId,
            archived: false,
            progress: { lt: 100 },
            subgoals: { equals: objective.subgoals },
          },
          data: { subgoals: actions as any },
        });
        if (updated.count === 1) recovered += 1;
      } catch (error) {
        failed += 1;
        console.warn(`[objective-action-recovery] objetivo ${objective.id} preservado após falha:`, error);
      }
    }

    return { eligible: eligible.length, recovered, failed };
  }
}
