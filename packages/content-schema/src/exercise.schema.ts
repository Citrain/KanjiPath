import { JLPT_LEVELS, SKILLS } from '@kanjipath/contracts';
import { z } from 'zod';

export const exerciseTemplateSchema = z.enum([
  'kanji_to_meaning_qcm',
  'meaning_to_kanji_qcm',
  'kanji_to_reading_qcm',
  'reading_input_kana',
  'reading_type_qcm',
  'vocab_reading_qcm',
  'vocab_meaning_qcm',
  'sentence_cloze_kanji',
  'sentence_cloze_reading',
  'sentence_translation_qcm',
  'radical_recognition_qcm',
  'stroke_count_qcm',
  'component_selection_qcm',
  'component_search_qcm',
  'stroke_order_qcm',
  'confusion_pair_qcm',
]);

export type ExerciseTemplate = z.infer<typeof exerciseTemplateSchema>;

export const exerciseContentSchema = z.object({
  id: z.string().min(1),
  template: exerciseTemplateSchema,
  skill: z.enum(SKILLS),
  level: z.enum(JLPT_LEVELS),
  targetKanjiId: z.string().min(1),
  vocabularyId: z.string().optional(),
  sentenceId: z.string().optional(),
  prompt: z.record(z.string(), z.unknown()),
  acceptedAnswers: z.array(z.string()).min(1),
  distractors: z.array(z.string()).default([]),
  explanation: z.string().min(1),
  difficulty: z.number().int().min(1).max(5).default(1),
  sourceId: z.string().min(1),
  contentVersionId: z.string().optional(),
  editorialStatus: z.enum(['draft', 'reviewed', 'published']).default('draft'),
});

export type ExerciseContent = z.infer<typeof exerciseContentSchema>;
