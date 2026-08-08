import { JLPT_LEVELS } from '@kanjipath/contracts';
import { z } from 'zod';

export const miniTextTokenSchema = z.object({
  surface: z.string().min(1),
  reading: z.string().optional(),
  romaji: z.string().optional(),
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(0),
});

export const miniTextContentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  translationFr: z.string().min(1),
  level: z.enum(JLPT_LEVELS),
  tokens: z.array(miniTextTokenSchema).default([]),
  sourceId: z.string().min(1),
  externalId: z.string().optional(),
  author: z.string().optional(),
  license: z.string().min(1),
  editorialStatus: z.enum(['draft', 'reviewed', 'published']).default('draft'),
});

export type MiniTextContent = z.infer<typeof miniTextContentSchema>;
