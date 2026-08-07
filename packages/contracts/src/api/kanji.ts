import type { JlptLevel, KanjiStatus, ReviewCardSkill, Skill } from '../enums';

export interface KanjiReadingDto {
  reading: string;
  type: 'onyomi' | 'kunyomi' | 'nanori';
  okurigana: string | null;
  commonness: 'common' | 'rare';
}

export interface KanjiMeaningDto {
  meaning: string;
  isPrimary: boolean;
}

export interface KanjiComponentDto {
  literal: string;
  nameFr: string | null;
  meaningFr: string | null;
  role: 'semantic' | 'phonetic' | 'unknown';
  isRadical: boolean;
}

export interface KanjiRadicalDto {
  literal: string;
  nameFr: string | null;
  meaningFr: string | null;
}

export interface KanjiNotesDto {
  mnemonicFr: string | null;
  etymologyFr: string | null;
  etymologySource: string | null;
  confusions: string[];
}

export interface KanjiSummary {
  id: string;
  literal: string;
  unicodeCodepoint: string;
  strokeCount: number;
  frequencyRank: number | null;
  schoolGrade: number | null;
  level: JlptLevel;
  order: number;
  primaryMeaning: string | null;
  status: KanjiStatus;
  overallScore: number;
  nextDueAt: string | null;
}

export interface KanjiDetail extends KanjiSummary {
  meanings: KanjiMeaningDto[];
  readings: KanjiReadingDto[];
  components: KanjiComponentDto[];
  radical: KanjiRadicalDto | null;
  notes: KanjiNotesDto | null;
  kanjivgUrl: string | null;
}

export interface KanjiListResponse {
  level: JlptLevel;
  kanji: KanjiSummary[];
}

export interface KanjiVocabularyDto {
  id: string;
  writtenForm: string;
  reading: string;
  meaningFr: string;
  partOfSpeech: string | null;
  readingInWord: string | null;
}

export interface KanjiSentenceDto {
  id: string;
  japanese: string;
  translationFr: string;
  author: string | null;
  license: string | null;
}

export interface KanjiProgressDto {
  kanjiId: string;
  literal: string;
  status: KanjiStatus;
  scores: Record<Skill, number>;
  overallScore: number;
  masteredAt: string | null;
  cards: Array<{ skill: ReviewCardSkill; state: string; dueAt: string }>;
}
