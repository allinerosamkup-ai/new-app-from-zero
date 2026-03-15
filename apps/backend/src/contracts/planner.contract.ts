import { z } from 'zod';

import { TimelineBlockSchema } from '../services/planner.service';

export const PlannerSyncSchema = z.object({
  userId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  forceSave: z.boolean().default(false),
  blocks: z.array(TimelineBlockSchema),
});

export type PlannerSyncInput = z.infer<typeof PlannerSyncSchema>;
