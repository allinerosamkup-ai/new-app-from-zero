import { z } from 'zod';

export const ObjectiveSubgoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
  aiGenerated: z.boolean().optional().default(false),
});

export const ObjectiveSubgoalsSchema = z.array(ObjectiveSubgoalSchema);

export type ObjectiveSubgoalInput = z.input<typeof ObjectiveSubgoalSchema>;
export type ObjectiveSubgoal = z.output<typeof ObjectiveSubgoalSchema>;

export function normalizeObjectiveSubgoals(subgoals: ObjectiveSubgoalInput[]): ObjectiveSubgoal[] {
  return ObjectiveSubgoalsSchema.parse(subgoals);
}
