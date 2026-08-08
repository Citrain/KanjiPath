import { z } from 'zod';
import { JLPT_LEVELS, SESSION_MODES, SKILLS } from '../enums';

export const studyTargetSchema = z
  .object({
    level: z.enum(JLPT_LEVELS).optional(),
    skill: z.enum(SKILLS).optional(),
    kanjiIds: z.array(z.string().min(1)).max(50).optional(),
  })
  .refine(
    (target) =>
      target.level !== undefined ||
      target.skill !== undefined ||
      (target.kanjiIds !== undefined && target.kanjiIds.length > 0),
    { message: 'Une révision ciblée demande au moins un filtre (niveau, compétence ou kanji).' },
  );

export const createSessionSchema = z.object({
  mode: z.enum(SESSION_MODES).default('daily'),
  target: studyTargetSchema.optional(),
});

export type StudyTargetInput = z.infer<typeof studyTargetSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
