import { z } from 'zod';

import { CheckinSlotSchema } from './checkin.contract';

export type CheckinSlot = z.infer<typeof CheckinSlotSchema>;

export function deriveCheckinSlot(date: Date): CheckinSlot {
  const hour = date.getHours();

  if (hour < 12) {
    return 'morning';
  }

  if (hour < 18) {
    return 'midday';
  }

  return 'evening';
}
