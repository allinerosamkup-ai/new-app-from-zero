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
});

export const ObjectiveSubgoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
  order: z.number().int().min(0),
  plannerBlockId: z.string().nullable().optional(),
  aiGenerated: z.boolean().optional().default(false),
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
      return ObjectiveSubgoalSchema.parse(normalized);
    })
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export const ObjectiveSubgoalsSchema = z.array(ObjectiveSubgoalInputSchema)
  .transform((subgoals) => normalizeObjectiveSubgoals(subgoals));

