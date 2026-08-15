import type {
  CreateIssueRequest,
  CurriculaResponse,
  CurriculumLevelResponse,
  DashboardResponse,
  HistoryResponse,
  KanjiDetail,
  KanjiListResponse,
  KanjiMapResponse,
  KanjiProgressDto,
  KanjiSentenceDto,
  KanjiVocabularyDto,
  LevelProgressResponse,
  MiniTextDetailDto,
  MiniTextListResponse,
  SettingsDto,
  SourcesResponse,
  StatsResponse,
  WeakPointsResponse,
  WordLookupResponse,
} from '@kanjipath/contracts';
import { apiFetch } from '../../lib/api';

export function fetchKanjiList(level = 'N5'): Promise<KanjiListResponse> {
  return apiFetch<KanjiListResponse>(`/kanji?level=${level}`);
}

export function fetchKanjiDetail(literal: string): Promise<KanjiDetail> {
  return apiFetch<KanjiDetail>(`/kanji/${encodeURIComponent(literal)}`);
}

export function fetchKanjiMap(literal: string): Promise<KanjiMapResponse> {
  return apiFetch<KanjiMapResponse>(`/kanji/${encodeURIComponent(literal)}/map`);
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

export function markKanjiKnown(literal: string): Promise<KanjiProgressDto> {
  return apiFetch<KanjiProgressDto>(`/kanji/${encodeURIComponent(literal)}/known`, {
    method: 'POST',
  });
}

export function kanjiSvgUrl(literal: string): string {
  return `/api/v1/kanji/${encodeURIComponent(literal)}/svg`;
}

export function fetchSources(): Promise<SourcesResponse> {
  return apiFetch<SourcesResponse>('/sources');
}

export function fetchTexts(level?: string): Promise<MiniTextListResponse> {
  const query = level ? `?level=${level}` : '';
  return apiFetch<MiniTextListResponse>(`/texts${query}`);
}

export function fetchTextDetail(id: string): Promise<MiniTextDetailDto> {
  return apiFetch<MiniTextDetailDto>(`/texts/${encodeURIComponent(id)}`);
}

export function fetchWordLookup(surface: string): Promise<WordLookupResponse> {
  return apiFetch<WordLookupResponse>(`/words/${encodeURIComponent(surface)}`);
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

export function fetchStats(): Promise<StatsResponse> {
  return apiFetch<StatsResponse>('/progress/stats');
}

export function fetchSettings(): Promise<SettingsDto> {
  return apiFetch<SettingsDto>('/settings');
}

export function createIssue(payload: CreateIssueRequest): Promise<void> {
  return apiFetch<void>('/content/issues', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
