import type { JlptLevel } from '../enums';

export interface CurriculumInfo {
  code: string;
  name: string;
  version: string;
  status: string;
  publishedAt: string | null;
  levels: JlptLevel[];
}

export interface CurriculaResponse {
  curricula: CurriculumInfo[];
}

export interface CurriculumLevelEntry {
  kanjiId: string;
  literal: string;
  order: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface CurriculumLevelResponse {
  code: string;
  level: JlptLevel;
  displayName: string;
  entries: CurriculumLevelEntry[];
}

export interface SourceDto {
  id: string;
  name: string;
  url: string;
  license: string;
  attributionText: string | null;
  sourceVersion: string | null;
  importedAt: string;
}

export interface SourcesResponse {
  sources: SourceDto[];
  contentVersion: { version: string; publishedAt: string; notes: string | null } | null;
}

export const IMMERSION_HELP_LEVELS = [0, 1, 2, 3] as const;
export type ImmersionHelpLevel = (typeof IMMERSION_HELP_LEVELS)[number];

export const IMMERSION_AIDS = ['translation', 'romaji', 'furigana'] as const;
export type ImmersionAid = (typeof IMMERSION_AIDS)[number];

export interface ImmersionRecommendationDto {
  level: ImmersionHelpLevel;
  reasons: string[];
}

export interface SettingsDto {
  activeLevel: JlptLevel;
  dailyNewLimit: number;
  reviewLimit: number;
  autoBalance: boolean;
  kanaInputEnabled: boolean;
  desiredRetention: number;
  furiganaMode: 'always' | 'hover' | 'never';
  romajiEnabled: boolean;
  timezone: string;
  theme: string;
  immersionEnabled: boolean;
  immersionHelpLevel: ImmersionHelpLevel | null;
  immersionRecommendation: ImmersionRecommendationDto;
}

export interface MiniTextTokenDto {
  id: string;
  surface: string;
  reading: string | null;
  romaji: string | null;
  startOffset: number;
  endOffset: number;
}

export interface MiniTextSummaryDto {
  id: string;
  title: string;
  level: JlptLevel;
  excerpt: string;
}

export interface MiniTextListResponse {
  level: JlptLevel | null;
  texts: MiniTextSummaryDto[];
}

export interface MiniTextDetailDto {
  id: string;
  title: string;
  body: string;
  translationFr: string;
  level: JlptLevel;
  author: string | null;
  license: string | null;
  tokens: MiniTextTokenDto[];
}

export interface CreateIssueRequest {
  subjectType: 'kanji' | 'vocabulary' | 'sentence';
  subjectRef: string;
  message: string;
}

export interface WordLookupEntryDto {
  id: string;
  writtenForm: string;
  reading: string;
  romaji: string | null;
  meaningFr: string;
  partOfSpeech: string | null;
}

export interface WordLookupKanjiReadingDto {
  reading: string;
  romaji: string | null;
  type: 'onyomi' | 'kunyomi';
}

export interface WordLookupKanjiDto {
  literal: string;
  level: JlptLevel;
  primaryMeaning: string | null;
  readings: WordLookupKanjiReadingDto[];
}

export interface WordLookupResponse {
  surface: string;
  vocabulary: WordLookupEntryDto[];
  kanji: WordLookupKanjiDto[];
}
