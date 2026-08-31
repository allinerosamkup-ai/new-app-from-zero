import OpenAI from 'openai';
import { z } from 'zod';

import { extractJsonValue } from '../lib/extract-json';
import { normalizeObjectiveSubgoals } from '../lib/objective-subgoals';
import { validateConcreteAction } from '../lib/action-quality';
import { getOpenAiOutputLimit, openAiTemperature } from '../lib/openai-config';

type ChatClient = Pick<OpenAI, 'chat'>;

export type DailyPriorityObjective = {
  id: string;
  title: string;
  description?: string | null;
  resultDefinition?: string | null;
  currentReality?: string | null;
  deadline?: string | Date | null;
  progress: number;
  pathVersion: number;
  subgoals: unknown;
};

export type DailyPrioritiesInput = {
  localDate: string;
  objectives: DailyPriorityObjective[];
  manualPrimaryObjectiveId: string | null;
  contextStatements: string[];
};

const RankedItemSchema = z.object({
  objectiveId: z.string(),
  actionId: z.string(),
  reason: z.string().trim().min(1).max(320),
  urgency: z.enum(['low', 'medium', 'high']).optional().default('low'),
  importance: z.enum(['low', 'medium', 'high']).optional().default('medium'),
});

const CanWaitSchema = z.object({
  objectiveId: z.string(),
  actionId: z.string(),
  reason: z.string().trim().min(1).max(320),
});

const RankingSchema = z.object({
  focusObjectiveId: z.string().nullable(),
  focusReason: z.string().trim().max(320).nullable().optional().default(null),
  priorities: z.array(RankedItemSchema).max(6),
  canWait: z.array(CanWaitSchema).max(6),
  readingVersion: z.string().trim().min(1).max(80),
});

type CurrentCandidate = {
  objectiveId: string;
  objectiveTitle: string;
  actionId: string;
  actionTitle: string;
  scheduledFor: string | null;
  deadline: string | null;
  progress: number;
  pathVersion: number;
};

export type DailyPrioritiesResult = {
  status: 'ready' | 'retrying';
  localDate: string;
  focus: { objectiveId: string; source: 'manual' | 'airia'; reason: string | null } | null;
  priorities: Array<CurrentCandidate & { reason: string; urgency: 'low' | 'medium' | 'high'; importance: 'low' | 'medium' | 'high' }>;
  canWait: Array<CurrentCandidate & { reason: string }>;
  readingVersion: string | null;
};

function dateOnly(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function candidates(input: DailyPrioritiesInput): CurrentCandidate[] {
  return input.objectives.flatMap((objective) => {
    const pending = normalizeObjectiveSubgoals(objective.subgoals).filter((action) => (
      !action.done && action.status !== 'rejected' && action.status !== 'deferred'
      && !(action.scheduledFor && action.scheduledFor > input.localDate)
      && Boolean(action.title?.trim())
    ));
    const current = pending.find((action) => validateConcreteAction(action).ok) ?? pending[0];
    if (!current) return [];
    return [{
      objectiveId: objective.id,
      objectiveTitle: objective.title,
      actionId: current.id,
      actionTitle: current.title,
      scheduledFor: current.scheduledFor ?? null,
      deadline: dateOnly(objective.deadline),
      progress: objective.progress,
      pathVersion: objective.pathVersion,
    }];
  });
}

export function buildDailyPrioritiesPrompt(input: DailyPrioritiesInput): string {
  const current = candidates(input);
  const objectiveContext = input.objectives.map((objective) => ({
    id: objective.id,
    title: objective.title,
    description: objective.description ?? null,
    resultDefinition: objective.resultDefinition ?? null,
    currentReality: objective.currentReality ?? null,
    deadline: dateOnly(objective.deadline),
    progress: objective.progress,
    currentAction: current.find((item) => item.objectiveId === objective.id) ?? null,
  }));
  return `Você decide prioridades reais do dia sem confundir urgente com importante.\n\nDATA LOCAL: ${input.localDate}\nOBJETIVO FIXADO PELA PESSOA: ${input.manualPrimaryObjectiveId ?? '(nenhum)'}\nCONTEXTO ATUAL DO DIÁRIO, CHECK-IN E AURA:\n${input.contextStatements.length > 0 ? input.contextStatements.map((item) => `- ${item}`).join('\n') : '(nenhum contexto adicional)'}\n\nOBJETIVOS E ÚNICAS AÇÕES CANDIDATAS:\n${JSON.stringify(objectiveContext)}\n\nREGRAS:\n- A estrela humana sempre define o foco; não tente substituí-la.\n- Sem estrela, sugira como foco o objetivo mais relevante pelo significado declarado,\n  consequências, recorrência, continuidade, progresso, prazo e data — nesta ordem de\n  leitura, sem transformar data no único critério.\n- Importante é o que sustenta direção e consequência. Urgente é o que perde valor ou\n  causa consequência concreta se não acontecer logo. Uma urgência de outro objetivo\n  pode liderar o dia sem apagar o objetivo em foco.\n- Use somente a ação candidata atual de cada objetivo. Nunca invente ação e nunca use\n  etapa futura.\n- Data não é permissão para antecipar nem adiar. Aqui você só ordena e recomenda.\n- Se o dia estiver cheio, mova o que pode esperar para canWait e explique.\n\nJSON APENAS:\n{"focusObjectiveId":"id|null","focusReason":"...","priorities":[{"objectiveId":"...","actionId":"...","reason":"...","urgency":"low|medium|high","importance":"low|medium|high"}],"canWait":[{"objectiveId":"...","actionId":"...","reason":"..."}],"readingVersion":"contexto-data-versoes"}`;
}

let openai: OpenAI | null = null;
function defaultClient(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing' });
  return openai;
}

export class DailyPrioritiesService {
  static async prioritize(input: DailyPrioritiesInput, client?: ChatClient): Promise<DailyPrioritiesResult> {
    const current = candidates(input);
    const byIdentity = new Map(current.map((item) => [`${item.objectiveId}:${item.actionId}`, item]));
    const objectiveIds = new Set(input.objectives.map((item) => item.id));
    const manual = input.manualPrimaryObjectiveId && objectiveIds.has(input.manualPrimaryObjectiveId)
      ? input.manualPrimaryObjectiveId
      : null;
    const retrying = (): DailyPrioritiesResult => ({
      status: 'retrying',
      localDate: input.localDate,
      focus: manual ? { objectiveId: manual, source: 'manual', reason: 'Escolhido por você' } : null,
      priorities: [],
      canWait: [],
      readingVersion: null,
    });

    const fromStore = (reason: string): DailyPrioritiesResult => {
      const ordered = [...current].sort((left, right) => {
        const leftPrimary = manual && left.objectiveId === manual ? 0 : 1;
        const rightPrimary = manual && right.objectiveId === manual ? 0 : 1;
        if (leftPrimary !== rightPrimary) return leftPrimary - rightPrimary;
        return left.pathVersion - right.pathVersion;
      });
      const focusId = manual ?? ordered[0]?.objectiveId ?? null;
      return {
        status: 'ready',
        localDate: input.localDate,
        focus: focusId ? {
          objectiveId: focusId,
          source: manual ? 'manual' : 'airia',
          reason: manual ? 'Escolhido por você' : reason,
        } : null,
        priorities: ordered.map((item) => ({
          ...item,
          reason,
          urgency: item.deadline === input.localDate ? 'high' as const : 'low' as const,
          importance: manual && item.objectiveId === manual ? 'high' as const : 'medium' as const,
        })),
        canWait: [],
        readingVersion: `store:${input.localDate}:${ordered.map((item) => item.pathVersion).join('-')}`,
      };
    };

    if (current.length === 0) return retrying();
    if (!client && !process.env.OPENAI_API_KEY) return fromStore('Próximo passo já definido no objetivo');
    const chat = client ?? defaultClient();
    const models = [
      process.env.OPENAI_PRIORITIES_MODEL?.trim() || 'claude-sonnet-4-6',
      process.env.OPENAI_PRIORITIES_FALLBACK_MODEL?.trim() || 'gpt-5-mini',
    ];

    for (const model of models) {
      try {
        const response = await chat.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'Você prioriza o dia usando apenas fatos e ações fornecidos. Responde só JSON.' },
            { role: 'user', content: buildDailyPrioritiesPrompt(input) },
          ],
          response_format: { type: 'json_object' },
          ...getOpenAiOutputLimit(model, 900),
          ...openAiTemperature(model, 0.2),
        } as any);
        const content = response.choices?.[0]?.message?.content;
        const parsed = RankingSchema.safeParse(content ? extractJsonValue(content) : null);
        if (!parsed.success) continue;
        const ranking = parsed.data;
        if (ranking.focusObjectiveId && !objectiveIds.has(ranking.focusObjectiveId)) continue;
        const identities = [...ranking.priorities, ...ranking.canWait].map((item) => `${item.objectiveId}:${item.actionId}`);
        if (identities.some((identity) => !byIdentity.has(identity)) || new Set(identities).size !== identities.length) continue;

        const focusId = manual ?? ranking.focusObjectiveId;
        return {
          status: 'ready',
          localDate: input.localDate,
          focus: focusId ? {
            objectiveId: focusId,
            source: manual ? 'manual' : 'airia',
            reason: manual ? 'Escolhido por você' : ranking.focusReason,
          } : null,
          priorities: ranking.priorities.map((item) => ({ ...byIdentity.get(`${item.objectiveId}:${item.actionId}`)!, ...item })),
          canWait: ranking.canWait.map((item) => ({ ...byIdentity.get(`${item.objectiveId}:${item.actionId}`)!, ...item })),
          readingVersion: ranking.readingVersion,
        };
      } catch (error) {
        console.warn(`[daily-priorities] modelo ${model} falhou:`, error);
      }
    }
    return fromStore('Próximo passo já definido no objetivo');
  }
}
