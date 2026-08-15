import { z } from 'zod';
import { RATINGS } from '../enums';

const optionalText = (max: number) => z.string().trim().min(1).max(max).optional();

export const createPersonalVocabularyEntrySchema = z.union([
  z
    .object({
      origin: z.literal('published'),
      vocabularyId: z.string().uuid().or(z.string().min(1).max(191)),
      textId: z.string().uuid().or(z.string().min(1).max(191)).optional(),
      tokenId: z.string().uuid().or(z.string().min(1).max(191)).optional(),
    })
    .strict()
    .refine((value) => (value.textId === undefined) === (value.tokenId === undefined), {
      message: 'Un texte et son token doivent être fournis ensemble.',
    }),
  z
    .object({
      origin: z.literal('conversation'),
      conversationTurnId: z.string().uuid().or(z.string().min(1).max(191)),
      surface: z.string().trim().min(1).max(80),
      reading: optionalText(80),
      meaningFr: optionalText(300),
    })
    .strict(),
]);

export const answerPersonalVocabularySchema = z
  .object({
    sessionId: z.string().uuid().or(z.string().min(1).max(191)).optional(),
    sessionItemId: z.string().uuid().or(z.string().min(1).max(191)),
    answer: z.string().trim().max(120).optional(),
    rating: z.enum(RATINGS).optional(),
    responseTimeMs: z
      .number()
      .int()
      .min(0)
      .max(30 * 60 * 1000)
      .optional(),
  })
  .strict();

export type CreatePersonalVocabularyEntryInput = z.infer<
  typeof createPersonalVocabularyEntrySchema
>;
export type AnswerPersonalVocabularyInput = z.infer<typeof answerPersonalVocabularySchema>;
