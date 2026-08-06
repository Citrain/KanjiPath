import { JLPT_LEVELS } from '@kanjipath/contracts';
import { z } from 'zod';

export const vocabularyContentSchema = z.object({
  id: z.string().min(1),
  writtenForm: z.string().min(1),
  reading: z.string().min(1),
  meaningFr: z.string().min(1),
  partOfSpeech: z.string().min(1),
  frequencyRank: z.number().int().positive().optional(),
  estimatedLevel: z.enum(JLPT_LEVELS),
  kanji: z
    .array(
      z.object({
        kanjiId: z.string().min(1),
        position: z.number().int().min(0),
        readingInWord: z.string().min(1),
      }),
    )
    .min(1),
  sourceId: z.string().min(1),
  editorialStatus: z.enum(['draft', 'reviewed', 'published']).default('draft'),
});

export type VocabularyContent = z.infer<typeof vocabularyContentSchema>;
