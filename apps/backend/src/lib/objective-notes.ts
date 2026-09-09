import { z } from 'zod';

export const ObjectiveNoteSchema = z.object({
  id: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(4000),
  createdAt: z.string().datetime(),
  source: z.enum(['manual', 'journal', 'origin']).optional().default('manual'),
  sourceNoteId: z.string().trim().min(1).max(120).optional(),
});

export type ObjectiveNote = z.output<typeof ObjectiveNoteSchema>;

export function normalizeObjectiveNotes(value: unknown): ObjectiveNote[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    const parsed = ObjectiveNoteSchema.safeParse({
      ...(typeof item === 'object' && item ? item : {}),
      id: typeof (item as { id?: unknown })?.id === 'string'
        ? (item as { id: string }).id
        : `note-${index + 1}`,
      createdAt: typeof (item as { createdAt?: unknown })?.createdAt === 'string'
        ? (item as { createdAt: string }).createdAt
        : new Date(0).toISOString(),
    });
    return parsed.success ? [parsed.data] : [];
  });
}
