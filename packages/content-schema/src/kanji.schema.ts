import { JLPT_LEVELS } from '@kanjipath/contracts';
import { z } from 'zod';

export const readingTypeSchema = z.enum(['onyomi', 'kunyomi', 'nanori']);

export const kanjiReadingSchema = z.object({
  reading: z.string().min(1),
  type: readingTypeSchema,
  okurigana: z.string().optional(),
  commonness: z.enum(['common', 'rare']).default('common'),
  romaji: z.string().optional(),
});

export const kanjiMeaningSchema = z.object({
  language: z.literal('fr'),
  meaning: z.string().min(1),
  isPrimary: z.boolean().default(false),
});

export const kanjiRadicalSchema = z.object({
  literal: z.string().min(1),
  nameFr: z.string().optional(),
  meaningFr: z.string().optional(),
  strokeCount: z.number().int().positive().optional(),
});

export const kanjiComponentSchema = z.object({
  literal: z.string().min(1),
  nameFr: z.string().optional(),
  meaningFr: z.string().optional(),
  role: z.enum(['semantic', 'phonetic', 'unknown']).default('unknown'),
  position: z.number().int().min(0).default(0),
});

export const kanjiContentSchema = z.object({
  id: z.string().min(1),
  literal: z.string().length(1),
  unicodeCodepoint: z.string().regex(/^U\+[0-9A-F]{4,6}$/i),
  strokeCount: z.number().int().positive(),
  frequencyRank: z.number().int().positive().optional(),
  schoolGrade: z.number().int().positive().optional(),
  meanings: z.array(kanjiMeaningSchema).min(1),
  readings: z.array(kanjiReadingSchema).min(1),
  radical: kanjiRadicalSchema.optional(),
  components: z.array(kanjiComponentSchema).default([]),
  confusions: z.array(z.string().length(1)).default([]),
  mnemonicFr: z.string().optional(),
  etymologyFr: z.string().optional(),
  etymologySource: z.string().optional(),
  level: z.enum(JLPT_LEVELS),
  order: z.number().int().positive(),
  kanjivgPath: z.string().optional(),
  sourceId: z.string().min(1),
  editorialStatus: z.enum(['draft', 'reviewed', 'published']).default('draft'),
});

export type KanjiContent = z.infer<typeof kanjiContentSchema>;
