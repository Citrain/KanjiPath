import { z } from 'zod';
import { FURIGANA_MODES, JLPT_LEVELS } from '../enums';

export const immersionHelpLevelSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export const updateSettingsSchema = z
  .object({
    activeLevel: z.enum(JLPT_LEVELS).optional(),
    dailyNewLimit: z
      .number({ message: 'dailyNewLimit doit être un nombre' })
      .int('dailyNewLimit doit être un entier')
      .min(1, 'dailyNewLimit doit être entre 1 et 50')
      .max(50, 'dailyNewLimit doit être entre 1 et 50')
      .optional(),
    reviewLimit: z
      .number({ message: 'reviewLimit doit être un nombre' })
      .int('reviewLimit doit être un entier')
      .min(5, 'reviewLimit doit être entre 5 et 200')
      .max(200, 'reviewLimit doit être entre 5 et 200')
      .optional(),
    autoBalance: z.boolean().optional(),
    kanaInputEnabled: z.boolean().optional(),
    desiredRetention: z
      .number({ message: 'desiredRetention doit être un nombre' })
      .min(0.7, 'desiredRetention doit être entre 0.7 et 0.99')
      .max(0.99, 'desiredRetention doit être entre 0.7 et 0.99')
      .optional(),
    furiganaMode: z.enum(FURIGANA_MODES).optional(),
    romajiEnabled: z.boolean().optional(),
    timezone: z.string().min(1).max(64).optional(),
    theme: z.string().min(1).max(32).optional(),
    immersionEnabled: z.boolean().optional(),
    immersionHelpLevel: immersionHelpLevelSchema.nullable().optional(),
  })
  .strict();

export type ImmersionHelpLevelInput = z.infer<typeof immersionHelpLevelSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
