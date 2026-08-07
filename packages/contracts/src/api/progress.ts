import type { JlptLevel, KanjiStatus, Skill } from '../enums';

export interface LevelSummary {
  level: JlptLevel;
  total: number;
  newCount: number;
  learningCount: number;
  reviewingCount: number;
  masteredCount: number;
  weightedMastery: number;
  dueToday: number;
}

export interface DashboardResponse {
  activeLevel: JlptLevel;
  levels: LevelSummary[];
  reviewsToday: number;
  accuracyLast7Days: number | null;
}

export interface KanjiProgressRow {
  kanjiId: string;
  literal: string;
  status: KanjiStatus;
  overallScore: number;
  scores: Record<Skill, number>;
  nextDueAt: string | null;
}

export interface LevelProgressResponse {
  level: JlptLevel;
  summary: LevelSummary;
  kanji: KanjiProgressRow[];
}

export interface WeakPoint {
  kanjiId: string;
  literal: string;
  weakestSkill: Skill;
  score: number;
  recentFailures: number;
}

export interface WeakPointsResponse {
  weakPoints: WeakPoint[];
}

export interface HistoryDay {
  date: string;
  answered: number;
  correct: number;
}

export interface HistoryResponse {
  days: HistoryDay[];
}
