import { JLPT_LEVELS } from '@kanjipath/contracts';
import { z } from 'zod';

export const sentenceTokenSchema = z.object({
  surface: z.string().min(1),
  reading: z.string().optional(),
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(0),
  vocabularyId: z.string().optional(),
});

export const sentenceContentSchema = z.object({
  id: z.string().min(1),
  japanese: z.string().min(1),
  translationFr: z.string().min(1),
  difficulty: z.enum(JLPT_LEVELS),
  targetKanjiIds: z.array(z.string().min(1)).min(1),
  tokens: z.array(sentenceTokenSchema).default([]),
  sourceId: z.string().min(1),
  externalId: z.string().optional(),
  author: z.string().optional(),
  license: z.string().min(1),
  editorialStatus: z.enum(['draft', 'reviewed', 'published']).default('draft'),
});

export type SentenceContent = z.infer<typeof sentenceContentSchema>;
