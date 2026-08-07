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
  desiredRetention: number;
  furiganaMode: 'always' | 'hover' | 'never';
  romajiEnabled: boolean;
  timezone: string;
  theme: string;
}

export interface CreateIssueRequest {
  subjectType: 'kanji' | 'vocabulary' | 'sentence';
  subjectRef: string;
  message: string;
}
