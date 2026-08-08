export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
export type JlptLevel = (typeof JLPT_LEVELS)[number];

export const SKILLS = ['meaning', 'reading', 'vocabulary', 'context', 'stroke'] as const;
export type Skill = (typeof SKILLS)[number];

export const REVIEW_CARD_SKILLS = [
  'KANJI_MEANING_RECOGNITION',
  'MEANING_TO_KANJI',
  'KANJI_READING',
  'READING_TO_KANJI',
  'READING_TYPE',
  'VOCAB_READING',
  'VOCAB_MEANING',
  'CONTEXT_CLOZE',
  'RADICAL_RECOGNITION',
  'STROKE_ORDER',
  'KANJI_CONFUSION',
] as const;
export type ReviewCardSkill = (typeof REVIEW_CARD_SKILLS)[number];

export const CARD_STATES = ['NEW', 'LEARNING', 'REVIEW', 'MASTERED', 'SUSPENDED'] as const;
export type CardState = (typeof CARD_STATES)[number];

export const RATINGS = ['again', 'hard', 'good', 'easy'] as const;
export type Rating = (typeof RATINGS)[number];

export const KANJI_STATUSES = ['new', 'learning', 'reviewing', 'mastered'] as const;
export type KanjiStatus = (typeof KANJI_STATUSES)[number];

export const SESSION_MODES = ['daily', 'weak_points', 'free', 'targeted'] as const;
export type StudySessionMode = (typeof SESSION_MODES)[number];

export const FURIGANA_MODES = ['always', 'hover', 'never'] as const;
export type FuriganaMode = (typeof FURIGANA_MODES)[number];
