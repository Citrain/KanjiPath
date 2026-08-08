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

export interface SettingsDto {
  activeLevel: JlptLevel;
  dailyNewLimit: number;
  reviewLimit: number;
  autoBalance: boolean;
  desiredRetention: number;
  furiganaMode: 'always' | 'hover' | 'never';
  romajiEnabled: boolean;
  timezone: string;
  theme: string;
}

export interface MiniTextTokenDto {
  surface: string;
  reading: string | null;
  romaji: string | null;
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
