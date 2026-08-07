import type {
  CurriculaResponse,
  CurriculumLevelResponse,
  DashboardResponse,
  HistoryResponse,
  KanjiDetail,
  KanjiListResponse,
  KanjiProgressDto,
  KanjiSentenceDto,
  KanjiVocabularyDto,
  LevelProgressResponse,
  SettingsDto,
  SourcesResponse,
  WeakPointsResponse,
} from '@kanjipath/contracts';
import { apiFetch } from '../../lib/api';

export function fetchKanjiList(level = 'N5'): Promise<KanjiListResponse> {
  return apiFetch<KanjiListResponse>(`/kanji?level=${level}`);
}

export function fetchKanjiDetail(literal: string): Promise<KanjiDetail> {
  return apiFetch<KanjiDetail>(`/kanji/${encodeURIComponent(literal)}`);
}

export function fetchKanjiVocabulary(literal: string): Promise<{ vocabulary: KanjiVocabularyDto[] }> {
  return apiFetch<{ vocabulary: KanjiVocabularyDto[] }>(`/kanji/${encodeURIComponent(literal)}/vocabulary`);
}

export function fetchKanjiSentences(literal: string): Promise<{ sentences: KanjiSentenceDto[] }> {
  return apiFetch<{ sentences: KanjiSentenceDto[] }>(`/kanji/${encodeURIComponent(literal)}/sentences`);
}

export function fetchKanjiProgress(literal: string): Promise<KanjiProgressDto> {
  return apiFetch<KanjiProgressDto>(`/kanji/${encodeURIComponent(literal)}/progress`);
}

export function kanjiSvgUrl(literal: string): string {
  return `/api/v1/kanji/${encodeURIComponent(literal)}/svg`;
}

export function fetchSources(): Promise<SourcesResponse> {
  return apiFetch<SourcesResponse>('/sources');
}

export function fetchCurricula(): Promise<CurriculaResponse> {
  return apiFetch<CurriculaResponse>('/curricula');
}

export function fetchCurriculumLevel(code: string, level: string): Promise<CurriculumLevelResponse> {
  return apiFetch<CurriculumLevelResponse>(`/curricula/${code}/levels/${level}`);
}

export function fetchDashboard(): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>('/progress/dashboard');
}

export function fetchLevelProgress(level: string): Promise<LevelProgressResponse> {
  return apiFetch<LevelProgressResponse>(`/progress/levels/${level}`);
}

export function fetchWeakPoints(): Promise<WeakPointsResponse> {
  return apiFetch<WeakPointsResponse>('/progress/weak-points');
}

export function fetchHistory(): Promise<HistoryResponse> {
  return apiFetch<HistoryResponse>('/progress/history');
}

export function fetchSettings(): Promise<SettingsDto> {
  return apiFetch<SettingsDto>('/settings');
}
