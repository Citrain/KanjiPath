import type {
  AnswerWindowStat,
  DashboardResponse,
  HistoryResponse,
  LevelProgressResponse,
  LevelSummary,
  StatsResponse,
  WeakPointsResponse,
} from '@kanjipath/contracts';
import { FsrsReviewScheduler, type ReviewCard } from '@kanjipath/domain';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
const SKILLS = ['meaning', 'reading', 'vocabulary', 'context', 'stroke'] as const;

const scheduler = new FsrsReviewScheduler();

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(userId: string): Promise<DashboardResponse> {
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    const levels: LevelSummary[] = [];
    for (const level of LEVELS) {
      levels.push(await this.levelSummary(userId, level));
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const reviewsToday = await this.prisma.reviewLog.count({
      where: { reviewCard: { userId }, reviewedAt: { gte: startOfDay } },
    });
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const lastWeek = await this.prisma.reviewLog.findMany({
      where: { reviewCard: { userId }, reviewedAt: { gte: weekAgo } },
      select: { wasCorrect: true },
    });
    const accuracyLast7Days =
      lastWeek.length > 0
        ? lastWeek.filter((log) => log.wasCorrect).length / lastWeek.length
        : null;

    return {
      activeLevel: (settings?.activeLevel ?? 'N5') as DashboardResponse['activeLevel'],
      levels,
      reviewsToday,
      accuracyLast7Days,
    };
  }

  async levelProgress(userId: string, level: string): Promise<LevelProgressResponse> {
    if (!LEVELS.includes(level as (typeof LEVELS)[number])) {
      throw new NotFoundException('Niveau inconnu');
    }
    const summary = await this.levelSummary(userId, level);
    const curriculum = await this.prisma.curriculum.findFirst({ where: { status: 'published' } });
    if (!curriculum) {
      throw new NotFoundException('Aucun curriculum publié');
    }
    const entries = await this.prisma.curriculumKanji.findMany({
      where: { curriculumId: curriculum.id, level: level as never },
      orderBy: { order: 'asc' },
      include: { kanji: true },
    });
    const progressRows = await this.prisma.userKanjiProgress.findMany({ where: { userId } });
    const progressByKanji = new Map(progressRows.map((row) => [row.kanjiId, row]));
    const cards = await this.prisma.reviewCard.findMany({
      where: { userId, subjectType: 'kanji' },
      select: { subjectId: true, dueAt: true },
    });
    const nextDue = new Map<string, Date>();
    for (const card of cards) {
      const current = nextDue.get(card.subjectId);
      if (!current || card.dueAt < current) {
        nextDue.set(card.subjectId, card.dueAt);
      }
    }

    return {
      level: level as LevelProgressResponse['level'],
      summary,
      kanji: entries.map((entry) => {
        const progress = progressByKanji.get(entry.kanjiId);
        return {
          kanjiId: entry.kanjiId,
          literal: entry.kanji.literal,
          status: (progress?.status ?? 'new') as never,
          overallScore: progress?.overallScore ?? 0,
          scores: {
            meaning: progress?.meaningScore ?? 0,
            reading: progress?.readingScore ?? 0,
            vocabulary: progress?.vocabularyScore ?? 0,
            context: progress?.contextScore ?? 0,
            stroke: progress?.strokeScore ?? 0,
          },
          nextDueAt: nextDue.get(entry.kanjiId)?.toISOString() ?? null,
        };
      }),
    };
  }

  async weakPoints(userId: string): Promise<WeakPointsResponse> {
    const progressRows = await this.prisma.userKanjiProgress.findMany({
      where: { userId, status: { in: ['learning', 'reviewing'] } },
      include: { kanji: { select: { literal: true } } },
    });
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const failures = await this.prisma.reviewLog.groupBy({
      by: ['reviewCardId'],
      where: { reviewCard: { userId }, wasCorrect: false, reviewedAt: { gte: weekAgo } },
      _count: { _all: true },
    });
    const failureCountByCard = new Map(failures.map((f) => [f.reviewCardId, f._count._all]));
    const cards = await this.prisma.reviewCard.findMany({
      where: { userId, subjectType: 'kanji' },
      select: { id: true, subjectId: true },
    });
    const failureCountByKanji = new Map<string, number>();
    for (const card of cards) {
      const count = failureCountByCard.get(card.id) ?? 0;
      failureCountByKanji.set(
        card.subjectId,
        (failureCountByKanji.get(card.subjectId) ?? 0) + count,
      );
    }

    const weakPoints = progressRows
      .map((row) => {
        const skillEntries: Array<[string, number]> = [
          ['meaning', row.meaningScore],
          ['reading', row.readingScore],
          ['vocabulary', row.vocabularyScore],
          ['context', row.contextScore],
          ['stroke', row.strokeScore],
        ];
        const reviewedSkills = skillEntries.filter(([, score]) => score > 0);
        const pool = reviewedSkills.length > 0 ? reviewedSkills : skillEntries;
        let weakestSkill = pool[0]?.[0] ?? 'meaning';
        let score = pool[0]?.[1] ?? 0;
        for (const [skill, skillScore] of pool) {
          if (skillScore < score) {
            weakestSkill = skill;
            score = skillScore;
          }
        }
        return {
          kanjiId: row.kanjiId,
          literal: row.kanji.literal,
          weakestSkill: weakestSkill as never,
          score,
          recentFailures: failureCountByKanji.get(row.kanjiId) ?? 0,
          overall: row.overallScore,
        };
      })
      .sort((a, b) => a.score - b.score || b.recentFailures - a.recentFailures)
      .slice(0, 10);

    return {
      weakPoints: weakPoints.map(({ kanjiId, literal, weakestSkill, score, recentFailures }) => ({
        kanjiId,
        literal,
        weakestSkill,
        score,
        recentFailures,
      })),
    };
  }

  async history(userId: string): Promise<HistoryResponse> {
    const logs = await this.prisma.reviewLog.findMany({
      where: {
        reviewCard: { userId },
        reviewedAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
      },
      select: { wasCorrect: true, reviewedAt: true },
    });
    const byDay = new Map<string, { answered: number; correct: number }>();
    for (const log of logs) {
      const day = log.reviewedAt.toISOString().slice(0, 10);
      const entry = byDay.get(day) ?? { answered: 0, correct: 0 };
      entry.answered += 1;
      if (log.wasCorrect) {
        entry.correct += 1;
      }
      byDay.set(day, entry);
    }
    const days = [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, entry]) => ({ date, answered: entry.answered, correct: entry.correct }));
    return { days };
  }

  async stats(userId: string): Promise<StatsResponse> {
    const now = new Date();
    const logs = await this.prisma.reviewLog.findMany({
      where: { reviewCard: { userId } },
      select: {
        wasCorrect: true,
        reviewedAt: true,
        responseTimeMs: true,
        exerciseItem: { select: { skill: true, level: true } },
      },
    });

    const totalReviews = logs.length;
    const totalCorrect = logs.filter((log) => log.wasCorrect).length;
    const timed = logs.filter((log) => log.responseTimeMs !== null);
    const avgResponseTimeMs =
      timed.length > 0
        ? Math.round(timed.reduce((sum, log) => sum + (log.responseTimeMs ?? 0), 0) / timed.length)
        : null;

    const sessions = await this.prisma.studySession.aggregate({
      where: { userId, endedAt: { not: null } },
      _sum: { durationSeconds: true },
    });
    const sessionsCompleted = await this.prisma.studySession.count({
      where: { userId, endedAt: { not: null }, answeredCount: { gt: 0 } },
    });

    const windowStat = (days: number): AnswerWindowStat => {
      const threshold = new Date(now.getTime() - days * 24 * 3600 * 1000);
      const inWindow = logs.filter((log) => log.reviewedAt >= threshold);
      const correct = inWindow.filter((log) => log.wasCorrect).length;
      return {
        answered: inWindow.length,
        correct,
        accuracy: inWindow.length > 0 ? correct / inWindow.length : null,
      };
    };

    const bySkill = SKILLS.map((skill) => {
      const rows = logs.filter((log) => log.exerciseItem?.skill === skill);
      const correct = rows.filter((log) => log.wasCorrect).length;
      return {
        skill,
        answered: rows.length,
        correct,
        accuracy: rows.length > 0 ? correct / rows.length : null,
      };
    });

    const byLevel = LEVELS.map((level) => {
      const rows = logs.filter((log) => log.exerciseItem?.level === level);
      const correct = rows.filter((log) => log.wasCorrect).length;
      return {
        level,
        answered: rows.length,
        correct,
        accuracy: rows.length > 0 ? correct / rows.length : null,
      };
    }).filter((entry) => entry.answered > 0);

    const cards = await this.prisma.reviewCard.findMany({
      where: { userId, subjectType: 'kanji' },
      select: {
        state: true,
        dueAt: true,
        stability: true,
        difficulty: true,
        reps: true,
        lapses: true,
        elapsedDays: true,
        scheduledDays: true,
        learningSteps: true,
        lastReviewAt: true,
      },
    });

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const activeCards = cards.filter((card) => card.state !== 'Suspended');
    const learning = activeCards.filter((card) => card.state === 'Learning').length;
    const review = activeCards.filter((card) => card.state === 'Review').length;
    const relearning = activeCards.filter((card) => card.state === 'Relearning').length;
    const overdue = activeCards.filter((card) => card.dueAt < now).length;
    const dueToday = activeCards.filter((card) => card.dueAt <= endOfToday).length;

    const retentionValues = activeCards
      .filter((card) => card.stability > 0 && card.reps > 0)
      .map((card) => scheduler.retrievability(toDomainCard(card), now))
      .filter((value): value is number => value !== null);
    const estimatedRetention =
      retentionValues.length > 0
        ? retentionValues.reduce((sum, value) => sum + value, 0) / retentionValues.length
        : null;

    const forecast: StatsResponse['forecast'] = [];
    for (let day = 0; day < 7; day += 1) {
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() + day);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const count = activeCards.filter(
        (card) => card.dueAt >= dayStart && card.dueAt <= dayEnd,
      ).length;
      forecast.push({ date: dayStart.toISOString().slice(0, 10), count });
    }

    return {
      totals: {
        reviews: totalReviews,
        correct: totalCorrect,
        accuracy: totalReviews > 0 ? totalCorrect / totalReviews : null,
        sessionsCompleted,
        studyTimeMinutes: Math.round((sessions._sum.durationSeconds ?? 0) / 60),
        avgResponseTimeMs,
      },
      windows: {
        last7Days: windowStat(7),
        last30Days: windowStat(30),
        last90Days: windowStat(90),
      },
      bySkill,
      byLevel,
      cards: { learning, review, relearning, overdue, dueToday },
      estimatedRetention,
      forecast,
    };
  }

  private async levelSummary(userId: string, level: string): Promise<LevelSummary> {
    const curriculum = await this.prisma.curriculum.findFirst({ where: { status: 'published' } });
    if (!curriculum) {
      return {
        level: level as LevelSummary['level'],
        total: 0,
        newCount: 0,
        learningCount: 0,
        reviewingCount: 0,
        masteredCount: 0,
        weightedMastery: 0,
        dueToday: 0,
      };
    }
    const entries = await this.prisma.curriculumKanji.findMany({
      where: { curriculumId: curriculum.id, level: level as never },
      select: { kanjiId: true },
    });
    const kanjiIds = entries.map((entry) => entry.kanjiId);
    const progressRows = await this.prisma.userKanjiProgress.findMany({
      where: { userId, kanjiId: { in: kanjiIds } },
    });
    const counts = { new: 0, learning: 0, reviewing: 0, mastered: 0 };
    let weighted = 0;
    const progressByKanji = new Map(progressRows.map((row) => [row.kanjiId, row]));
    for (const kanjiId of kanjiIds) {
      const progress = progressByKanji.get(kanjiId);
      const status = progress?.status ?? 'new';
      counts[status as keyof typeof counts] += 1;
      weighted += progress?.overallScore ?? 0;
    }
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const dueToday = await this.prisma.reviewCard.count({
      where: {
        userId,
        subjectType: 'kanji',
        subjectId: { in: kanjiIds },
        dueAt: { lte: endOfToday },
        state: { not: 'Suspended' },
      },
    });
    return {
      level: level as LevelSummary['level'],
      total: kanjiIds.length,
      newCount: counts.new,
      learningCount: counts.learning,
      reviewingCount: counts.reviewing,
      masteredCount: counts.mastered,
      weightedMastery: kanjiIds.length > 0 ? weighted / kanjiIds.length : 0,
      dueToday,
    };
  }
}

function toDomainCard(card: {
  state: string;
  dueAt: Date;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  lastReviewAt: Date | null;
}): ReviewCard {
  return {
    state: card.state as ReviewCard['state'],
    due: card.dueAt,
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    elapsedDays: card.elapsedDays,
    scheduledDays: card.scheduledDays,
    learningSteps: card.learningSteps,
    lastReview: card.lastReviewAt,
  };
}
