import { z } from 'zod';
import {
  CONVERSATION_CORRECTION_MODES,
  CONVERSATION_DIFFICULTIES,
  CONVERSATION_SCENARIOS,
  JAPANESE_SPEECH_SPEEDS,
  JLPT_LEVELS,
} from '../enums';

export const createConversationSchema = z.object({
  level: z.enum(JLPT_LEVELS).optional(),
  scenario: z.enum(CONVERSATION_SCENARIOS),
  difficulty: z.enum(CONVERSATION_DIFFICULTIES).optional(),
  correctionMode: z.enum(CONVERSATION_CORRECTION_MODES).optional(),
  japaneseSpeechSpeed: z.enum(JAPANESE_SPEECH_SPEEDS).optional(),
  japaneseSpeakerId: z.number().int().positive().max(1_000_000).optional(),
  goals: z.array(z.string().trim().min(1).max(160)).max(5).optional(),
});

export const processConversationTurnSchema = z.object({
  transcript: z.string().trim().min(1).max(2_000),
  requestAudio: z.boolean().optional(),
});

const conversationCorrectionSchema = z
  .object({
    needed: z.boolean(),
    severity: z.enum(['important', 'minor']),
    original: z.string().trim().min(1).max(2_000),
    corrected: z.string().trim().min(1).max(300),
    explanationFr: z.string().trim().min(1).max(600),
  })
  .strict();

export const conversationModelOutputSchema = z
  .object({
    reply: z
      .object({
        ja: z
          .string()
          .trim()
          .min(1)
          .max(400)
          .regex(/[\u3040-\u30ff\u3400-\u9fff]/)
          .refine((value) => !/[A-Za-zÀ-ÿ]/.test(value), 'La réplique doit être en japonais'),
        reading: z
          .string()
          .trim()
          .min(1)
          .max(600)
          .regex(/^[\x20-\x7e]+$/),
      })
      .strict(),
    correction: conversationCorrectionSchema.nullable(),
    learning: z
      .object({
        grammarIds: z.array(z.string().min(1).max(120)).max(10),
        vocabularyIds: z.array(z.string().min(1).max(120)).max(10),
        newItems: z.array(z.string().min(1).max(160)).max(10),
      })
      .strict(),
    conversation: z
      .object({
        shouldContinue: z.boolean(),
        intent: z.string().trim().min(1).max(120),
      })
      .strict(),
  })
  .strict();

export const conversationGeneratedOutputSchema = conversationModelOutputSchema
  .omit({ learning: true })
  .safeExtend({
    correction: conversationCorrectionSchema
      .safeExtend({
        needed: z.literal(true),
        corrected: z
          .string()
          .trim()
          .min(1)
          .max(300)
          .regex(/^[\u3040-\u30ffー・、。！？!?…〜～\s]+$/),
      })
      .nullable(),
  });

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type ProcessConversationTurnInput = z.infer<typeof processConversationTurnSchema>;
