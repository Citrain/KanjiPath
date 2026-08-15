import { z } from 'zod';

export const updateDailyMissionStepSchema = z.object({
  status: z.enum(['completed', 'skipped']),
});

export type UpdateDailyMissionStepInput = z.infer<typeof updateDailyMissionStepSchema>;
