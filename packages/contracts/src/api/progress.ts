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

export interface AnswerWindowStat {
  answered: number;
  correct: number;
  accuracy: number | null;
}

export interface SkillStat extends AnswerWindowStat {
  skill: Skill;
}

export interface LevelActivityStat extends AnswerWindowStat {
  level: JlptLevel;
}

export interface DueForecastDay {
  date: string;
  count: number;
}

export interface StatsResponse {
  totals: {
    reviews: number;
    correct: number;
    accuracy: number | null;
    sessionsCompleted: number;
    studyTimeMinutes: number;
    avgResponseTimeMs: number | null;
  };
  windows: {
    last7Days: AnswerWindowStat;
    last30Days: AnswerWindowStat;
    last90Days: AnswerWindowStat;
  };
  bySkill: SkillStat[];
  byLevel: LevelActivityStat[];
  cards: {
    learning: number;
    review: number;
    relearning: number;
    overdue: number;
    dueToday: number;
  };
  estimatedRetention: number | null;
  forecast: DueForecastDay[];
}
