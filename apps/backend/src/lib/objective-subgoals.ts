import { z } from 'zod';

const ObjectiveSubgoalInputSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean().optional(),
  // Registros anteriores usavam `completed`. A leitura os migra para `done`;
  // nenhuma escrita nova devolve esse campo legado.
  completed: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  plannerBlockId: z.string().nullable().optional(),
  aiGenerated: z.boolean().optional().default(false),
  milestoneId: z.string().trim().min(1).nullable().optional(),
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  doneWhen: z.string().trim().min(1).max(500).nullable().optional(),
  effortSize: z.enum(['small', 'medium', 'large']).nullable().optional(),
  basedOn: z.enum(['stated', 'inferred']).optional(),
  evidenceRefs: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  patternBasis: z.array(z.object({
    pattern: z.string().trim().min(1).max(240),
    evidenceCount: z.number().int().nonnegative(),
    distinctDays: z.number().int().nonnegative(),
    windowDays: z.number().int().positive(),
    confidence: z.number().min(0).max(1),
    limitation: z.string().trim().min(1).max(240),
    impact: z.string().trim().min(1).max(240),
  })).max(4).optional(),
  userEdited: z.boolean().optional(),
  status: z.enum(['pending', 'done', 'rejected', 'deferred']).optional(),
  rejectedAt: z.string().datetime().nullable().optional(),
  deferredAt: z.string().datetime().nullable().optional(),
});

export const ObjectiveSubgoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
  order: z.number().int().min(0),
  plannerBlockId: z.string().nullable().optional(),
  aiGenerated: z.boolean().optional().default(false),
  milestoneId: z.string().nullable().optional(),
  scheduledFor: z.string().nullable().optional(),
  doneWhen: z.string().nullable().optional(),
  effortSize: z.enum(['small', 'medium', 'large']).nullable().optional(),
  basedOn: z.enum(['stated', 'inferred']).optional(),
  evidenceRefs: z.array(z.string()).optional(),
  patternBasis: z.array(z.object({
    pattern: z.string(),
    evidenceCount: z.number().int().nonnegative(),
    distinctDays: z.number().int().nonnegative(),
    windowDays: z.number().int().positive(),
    confidence: z.number().min(0).max(1),
    limitation: z.string(),
    impact: z.string(),
  })).optional(),
  userEdited: z.boolean().optional(),
  status: z.enum(['pending', 'done', 'rejected', 'deferred']).optional(),
  rejectedAt: z.string().nullable().optional(),
  deferredAt: z.string().nullable().optional(),
});

export type ObjectiveSubgoalInput = z.input<typeof ObjectiveSubgoalInputSchema>;
export type ObjectiveSubgoal = z.output<typeof ObjectiveSubgoalSchema>;

export function normalizeObjectiveSubgoals(subgoals: unknown): ObjectiveSubgoal[] {
  if (!Array.isArray(subgoals)) return [];

  const parsedSubgoals = subgoals.flatMap((value) => {
      const parsed = ObjectiveSubgoalInputSchema.safeParse(value);
      if (!parsed.success) return [];
      return [parsed.data];
    });

  return parsedSubgoals
    .map((subgoal, index) => {
      const normalized: Record<string, unknown> = {
        id: subgoal.id,
        title: subgoal.title,
        done: subgoal.done ?? subgoal.completed ?? false,
        order: subgoal.order ?? index,
        aiGenerated: subgoal.aiGenerated,
      };
      if (subgoal.plannerBlockId !== undefined) normalized.plannerBlockId = subgoal.plannerBlockId;
      if (subgoal.milestoneId !== undefined) normalized.milestoneId = subgoal.milestoneId;
      if (subgoal.scheduledFor !== undefined) normalized.scheduledFor = subgoal.scheduledFor;
      if (subgoal.doneWhen !== undefined) normalized.doneWhen = subgoal.doneWhen;
      if (subgoal.effortSize !== undefined) normalized.effortSize = subgoal.effortSize;
      if (subgoal.basedOn !== undefined) normalized.basedOn = subgoal.basedOn;
      if (subgoal.evidenceRefs !== undefined) normalized.evidenceRefs = subgoal.evidenceRefs;
      if (subgoal.patternBasis !== undefined) normalized.patternBasis = subgoal.patternBasis;
      if (subgoal.userEdited !== undefined) normalized.userEdited = subgoal.userEdited;
      if (subgoal.status !== undefined) normalized.status = subgoal.status;
      if (subgoal.rejectedAt !== undefined) normalized.rejectedAt = subgoal.rejectedAt;
      if (subgoal.deferredAt !== undefined) normalized.deferredAt = subgoal.deferredAt;
      return ObjectiveSubgoalSchema.parse(normalized);
    })
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export const ObjectiveSubgoalsSchema = z.array(ObjectiveSubgoalInputSchema)
  .transform((subgoals) => normalizeObjectiveSubgoals(subgoals));

