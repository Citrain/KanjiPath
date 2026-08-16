import { z } from 'zod';
import { JLPT_LEVELS, SHADOWING_SOURCES } from '../enums';

export const SHADOWING_MAX_DURATION_MS = 20_000;
export const SHADOWING_MAX_AUDIO_BYTES = 655_360;
export const SHADOWING_MAX_AUDIO_BASE64 = Math.ceil(SHADOWING_MAX_AUDIO_BYTES / 3) * 4;
export const SHADOWING_MAX_TRANSCRIPT_LENGTH = 1_000;
export const SHADOWING_MAX_RESULTS = 50;

export const shadowingTargetsQuerySchema = z.object({
  level: z.enum(JLPT_LEVELS).optional(),
  source: z.enum(SHADOWING_SOURCES).optional(),
  limit: z.coerce.number().int().min(1).max(24).optional(),
});

export const shadowingTranscribeSchema = z.object({
  audioBase64: z.string().min(4).max(SHADOWING_MAX_AUDIO_BASE64),
  encoding: z.literal('pcm_s16le'),
  sampleRate: z.literal(16_000),
  durationMs: z.number().int().positive().max(SHADOWING_MAX_DURATION_MS),
});

export const shadowingCompareSchema = z.object({
  sentenceId: z.string().trim().min(1).max(64),
  transcript: z.string().trim().min(1).max(SHADOWING_MAX_TRANSCRIPT_LENGTH),
});

export const shadowingSaveResultSchema = z.object({
  sentenceId: z.string().trim().min(1).max(64),
  source: z.enum(SHADOWING_SOURCES),
  transcript: z.string().trim().min(1).max(SHADOWING_MAX_TRANSCRIPT_LENGTH),
});

export type ShadowingTargetsQuery = z.infer<typeof shadowingTargetsQuerySchema>;
export type ShadowingTranscribeInput = z.infer<typeof shadowingTranscribeSchema>;
export type ShadowingCompareInput = z.infer<typeof shadowingCompareSchema>;
export type ShadowingSaveResultInput = z.infer<typeof shadowingSaveResultSchema>;
