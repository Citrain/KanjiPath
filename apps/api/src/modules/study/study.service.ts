import type {
  AnswerResult,
  CreateSessionResponse,
  ResumeResponse,
  StudyQueueItem,
} from '@kanjipath/contracts';
import {
  computeOverallScore,
  FsrsReviewScheduler,
  isMastered,
  type ReviewCard,
} from '@kanjipath/domain';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CARD_SKILL_TO_TEMPLATES, gradeAnswer, TEMPLATE_TO_CARD_SKILL } from './grader';

const scheduler = new FsrsReviewScheduler();

interface ExerciseRow {
  id: string;
  templateId: string;
  level: string;
  skill: string;
  kanjiId: string | null;
  vocabularyId: string | null;
  sentenceId: string | null;
  promptJson: Prisma.JsonValue;
  answerJson: Prisma.JsonValue;
  explanationJson: Prisma.JsonValue | null;
  difficulty: number;
  kanjiLiteral?: string;
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

@Injectable()
export class StudyService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: string, mode: string): Promise<CreateSessionResponse> {
    const sessionMode = mode === 'weak_points' || mode === 'free' ? mode : 'daily';
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    const dailyNewLimit = settings?.dailyNewLimit ?? 10;

    const exercises = await this.loadExercises();
    const queue = await this.buildQueue(userId, sessionMode, dailyNewLimit, exercises);
    if (queue.length === 0) {
      throw new BadRequestException('Aucun exercice disponible pour cette session');
    }

    const session = await this.prisma.studySession.create({
      data: { userId, mode: sessionMode as never },
    });
    await this.prisma.studySessionItem.createMany({
      data: queue.map((exercise, position) => ({
        sessionId: session.id,
        position,
        exerciseItemId: exercise.id,
      })),
    });

    const items = await this.queueItems(session.id);
    return {
      session: {
        id: session.id,
        mode: session.mode,
        startedAt: session.startedAt.toISOString(),
        answeredCount: 0,
        correctCount: 0,
        totalItems: items.length,
      },
      items,
    };
  }

  async resume(userId: string): Promise<ResumeResponse> {
    const session = await this.prisma.studySession.findFirst({
      where: { userId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (!session) {
      return { session: null, items: [] };
    }
    const items = await this.queueItems(session.id);
    return {
      session: {
        id: session.id,
        mode: session.mode,
        startedAt: session.startedAt.toISOString(),
        answeredCount: session.answeredCount,
        correctCount: session.correctCount,
        totalItems: items.length,
      },
      items,
    };
  }

  async answer(
    userId: string,
    body: {
      sessionId?: string;
      exerciseItemId?: string;
      answer?: string;
      responseTimeMs?: number;
      rating?: string;
    },
  ): Promise<AnswerResult> {
    const exerciseItemId = body.exerciseItemId;
    const answer = body.answer;
    if (!exerciseItemId || typeof answer !== 'string') {
      throw new BadRequestException('Réponse incomplète');
    }

    const session = await this.prisma.studySession.findFirst({
      where: { userId, endedAt: null, items: { some: { exerciseItemId } } },
      orderBy: { startedAt: 'desc' },
    });
    if (!session) {
      throw new NotFoundException('Aucune session active pour cet exercice');
    }
    const sessionItem = await this.prisma.studySessionItem.findFirst({
      where: { sessionId: session.id, exerciseItemId },
    });
    const exercise = await this.prisma.exerciseItem.findUnique({
      where: { id: exerciseItemId },
      include: { kanji: true, template: true },
    });
    if (!exercise?.kanji) {
      throw new NotFoundException('Exercice introuvable');
    }
    const kanjiId = exercise.kanji.id;

    const acceptedAnswers = extractAnswers(exercise.answerJson);
    const correct = gradeAnswer(exercise.template.type, answer, acceptedAnswers);
    const rating =
      body.rating === 'hard' || body.rating === 'easy' ? body.rating : correct ? 'good' : 'again';

    const cardSkill = TEMPLATE_TO_CARD_SKILL[exercise.template.type] ?? 'KANJI_MEANING_RECOGNITION';
    const now = new Date();
    const { card: updatedCard, log } = await this.applyReview(
      userId,
      kanjiId,
      cardSkill,
      rating,
      now,
    );

    await this.prisma.reviewLog.create({
      data: {
        reviewCardId: await this.cardId(userId, kanjiId, cardSkill),
        exerciseItemId: exercise.id,
        rating: rating as never,
        wasCorrect: correct,
        responseTimeMs: body.responseTimeMs ?? null,
        answerPayload: { answer },
        stateBefore: log.stateBefore as never,
        stateAfter: log.stateAfter as never,
        dueAfter: log.due,
        stabilityAfter: updatedCard.stability,
      },
    });

    await this.updateKanjiProgress(userId, kanjiId, exercise.skill, correct, now);

    if (sessionItem) {
      await this.prisma.studySessionItem.update({
        where: { id: sessionItem.id },
        data: { status: 'answered', wasCorrect: correct },
      });
    }
    await this.prisma.studySession.update({
      where: { id: session.id },
      data: {
        answeredCount: { increment: 1 },
        correctCount: correct ? { increment: 1 } : undefined,
      },
    });

    return {
      correct,
      acceptedAnswers,
      explanation: extractExplanation(exercise.explanationJson),
      rating,
      nextDueAt: updatedCard.due.toISOString(),
    };
  }

  async finish(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.studySession.findFirst({ where: { id: sessionId, userId } });
    if (!session) {
      throw new NotFoundException('Session introuvable');
    }
    const durationSeconds = Math.max(
      0,
      Math.round((Date.now() - session.startedAt.getTime()) / 1000),
    );
    await this.prisma.studySession.update({
      where: { id: sessionId },
      data: { endedAt: new Date(), durationSeconds },
    });
  }

  private async cardId(userId: string, kanjiId: string, skill: string): Promise<string> {
    const card = await this.prisma.reviewCard.findUnique({
      where: {
        userId_subjectType_subjectId_skill: {
          userId,
          subjectType: 'kanji',
          subjectId: kanjiId,
          skill: skill as never,
        },
      },
    });
    if (!card) {
      throw new NotFoundException('Carte de révision introuvable');
    }
    return card.id;
  }

  private async applyReview(
    userId: string,
    kanjiId: string,
    skill: string,
    rating: string,
    now: Date,
  ) {
    const uniqueWhere = {
      userId_subjectType_subjectId_skill: {
        userId,
        subjectType: 'kanji' as const,
        subjectId: kanjiId,
        skill: skill as never,
      },
    };
    const existing = await this.prisma.reviewCard.findUnique({ where: uniqueWhere });
    const before: ReviewCard = existing
      ? {
          state: existing.state as ReviewCard['state'],
          due: existing.dueAt,
          stability: existing.stability,
          difficulty: existing.difficulty,
          reps: existing.reps,
          lapses: existing.lapses,
          elapsedDays: existing.elapsedDays,
          scheduledDays: existing.scheduledDays,
          learningSteps: existing.learningSteps,
          lastReview: existing.lastReviewAt,
        }
      : scheduler.createEmptyCard(now);

    const result = scheduler.review(before, rating as never, now);

    await this.prisma.reviewCard.upsert({
      where: uniqueWhere,
      create: {
        userId,
        subjectType: 'kanji',
        subjectId: kanjiId,
        skill: skill as never,
        state: result.card.state as never,
        dueAt: result.card.due,
        stability: result.card.stability,
        difficulty: result.card.difficulty,
        reps: result.card.reps,
        lapses: result.card.lapses,
        elapsedDays: result.card.elapsedDays,
        scheduledDays: result.card.scheduledDays,
        learningSteps: result.card.learningSteps,
        lastReviewAt: result.card.lastReview ?? now,
      },
      update: {
        state: result.card.state as never,
        dueAt: result.card.due,
        stability: result.card.stability,
        difficulty: result.card.difficulty,
        reps: result.card.reps,
        lapses: result.card.lapses,
        elapsedDays: result.card.elapsedDays,
        scheduledDays: result.card.scheduledDays,
        learningSteps: result.card.learningSteps,
        lastReviewAt: result.card.lastReview ?? now,
      },
    });

    return { card: result.card, log: result.log };
  }

  private async updateKanjiProgress(
    userId: string,
    kanjiId: string,
    skill: string,
    correct: boolean,
    now: Date,
  ) {
    const existing = await this.prisma.userKanjiProgress.findUnique({
      where: { userId_kanjiId: { userId, kanjiId } },
    });
    const scores = {
      meaning: existing?.meaningScore ?? 0,
      reading: existing?.readingScore ?? 0,
      vocabulary: existing?.vocabularyScore ?? 0,
      context: existing?.contextScore ?? 0,
      stroke: existing?.strokeScore ?? 0,
    };
    const key = skill as keyof typeof scores;
    if (key in scores) {
      scores[key] = correct
        ? Math.min(1, scores[key] + 0.25 * (1 - scores[key]))
        : Math.max(0, scores[key] - 0.3);
    }
    const overall = computeOverallScore(scores);

    const logs = await this.prisma.reviewLog.findMany({
      where: { reviewCard: { userId, subjectId: kanjiId } },
      select: { wasCorrect: true, reviewedAt: true },
    });
    const successfulReviews = logs.filter((log) => log.wasCorrect).length;
    const distinctDays = new Set(logs.map((log) => log.reviewedAt.toISOString().slice(0, 10))).size;
    const recentFailure = logs.some(
      (log) => !log.wasCorrect && now.getTime() - log.reviewedAt.getTime() < 3 * 24 * 3600 * 1000,
    );
    const mastered = isMastered({
      scores,
      successfulReviews,
      distinctReviewDays: distinctDays,
      hasRecentFailure: recentFailure,
    });

    let status: string;
    if (mastered) {
      status = 'mastered';
    } else if (overall >= 0.6) {
      status = 'reviewing';
    } else if (existing || logs.length > 0) {
      status = 'learning';
    } else {
      status = 'new';
    }

    await this.prisma.userKanjiProgress.upsert({
      where: { userId_kanjiId: { userId, kanjiId } },
      create: {
        userId,
        kanjiId,
        meaningScore: scores.meaning,
        readingScore: scores.reading,
        vocabularyScore: scores.vocabulary,
        contextScore: scores.context,
        strokeScore: scores.stroke,
        overallScore: overall,
        status: status as never,
        firstSeenAt: existing?.firstSeenAt ?? now,
        masteredAt: mastered ? now : null,
      },
      update: {
        meaningScore: scores.meaning,
        readingScore: scores.reading,
        vocabularyScore: scores.vocabulary,
        contextScore: scores.context,
        strokeScore: scores.stroke,
        overallScore: overall,
        status: status as never,
        masteredAt: mastered ? now : (existing?.masteredAt ?? now),
      },
    });
  }

  private async loadExercises(): Promise<Map<string, ExerciseRow[]>> {
    const items = await this.prisma.exerciseItem.findMany({
      where: { editorialStatus: 'published' },
      include: { kanji: { select: { literal: true } }, template: true },
    });
    const byTemplateKanji = new Map<string, ExerciseRow[]>();
    for (const item of items) {
      if (!item.kanjiId) {
        continue;
      }
      const key = `${item.template.type}:${item.kanjiId}`;
      if (!byTemplateKanji.has(key)) {
        byTemplateKanji.set(key, []);
      }
      byTemplateKanji.get(key)?.push({
        id: item.id,
        templateId: item.templateId,
        level: item.level,
        skill: item.skill,
        kanjiId: item.kanjiId,
        vocabularyId: item.vocabularyId,
        sentenceId: item.sentenceId,
        promptJson: item.promptJson,
        answerJson: item.answerJson,
        explanationJson: item.explanationJson,
        difficulty: item.difficulty,
        kanjiLiteral: item.kanji?.literal,
      });
    }
    return byTemplateKanji;
  }

  private pickExercise(
    exercises: Map<string, ExerciseRow[]>,
    template: string,
    kanjiId: string,
    used: Set<string>,
  ): ExerciseRow | null {
    const candidates = exercises.get(`${template}:${kanjiId}`) ?? [];
    for (const candidate of candidates) {
      if (!used.has(candidate.id)) {
        return candidate;
      }
    }
    return candidates.find((candidate) => !used.has(candidate.id)) ?? candidates[0] ?? null;
  }

  private async buildQueue(
    userId: string,
    mode: string,
    dailyNewLimit: number,
    exercises: Map<string, ExerciseRow[]>,
  ): Promise<ExerciseRow[]> {
    const used = new Set<string>();
    const queue: ExerciseRow[] = [];
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const dueCards = await this.prisma.reviewCard.findMany({
      where: {
        userId,
        subjectType: 'kanji',
        dueAt: { lte: endOfToday },
        state: { not: 'Suspended' },
      },
      orderBy: { dueAt: 'asc' },
      take: 40,
    });
    for (const card of dueCards) {
      const templates = CARD_SKILL_TO_TEMPLATES[card.skill] ?? [];
      for (const template of templates) {
        const exercise = this.pickExercise(exercises, template, card.subjectId, used);
        if (exercise) {
          used.add(exercise.id);
          queue.push(exercise);
          break;
        }
      }
    }

    if (mode === 'weak_points' || mode === 'daily') {
      const recentFailures = await this.prisma.reviewLog.findMany({
        where: {
          reviewCard: { userId },
          wasCorrect: false,
          reviewedAt: { gte: new Date(now.getTime() - 7 * 24 * 3600 * 1000) },
        },
        include: { reviewCard: true },
        orderBy: { reviewedAt: 'desc' },
        take: 16,
      });
      const seen = new Set<string>();
      for (const failure of recentFailures) {
        const card = failure.reviewCard;
        const key = `${card.subjectId}:${card.skill}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        const templates = CARD_SKILL_TO_TEMPLATES[card.skill] ?? [];
        for (const template of templates) {
          const exercise = this.pickExercise(exercises, template, card.subjectId, used);
          if (exercise) {
            used.add(exercise.id);
            queue.push(exercise);
            break;
          }
        }
      }
    }

    const discovered = await this.prisma.reviewCard.findMany({
      where: { userId, subjectType: 'kanji' },
      select: { subjectId: true },
      distinct: ['subjectId'],
    });
    const discoveredIds = new Set(discovered.map((card) => card.subjectId));
    const curriculum = await this.prisma.curriculum.findFirst({ where: { status: 'published' } });
    if (curriculum) {
      const takeNew = mode === 'free' ? dailyNewLimit : Math.min(dailyNewLimit, 5);
      const newKanji: { kanjiId: string }[] = [];
      for (const level of ['N5', 'N4', 'N3', 'N2', 'N1'] as const) {
        if (newKanji.length >= takeNew) {
          break;
        }
        const entries = await this.prisma.curriculumKanji.findMany({
          where: { curriculumId: curriculum.id, level, kanjiId: { notIn: [...discoveredIds] } },
          orderBy: { order: 'asc' },
          take: takeNew - newKanji.length,
        });
        newKanji.push(...entries);
      }
      for (const entry of newKanji) {
        const intro = this.pickExercise(exercises, 'kanji_to_meaning_qcm', entry.kanjiId, used);
        if (intro) {
          used.add(intro.id);
          queue.push(intro);
        }
        const reading = this.pickExercise(exercises, 'kanji_to_reading_qcm', entry.kanjiId, used);
        const fallback =
          reading ?? this.pickExercise(exercises, 'vocab_reading_qcm', entry.kanjiId, used);
        if (fallback) {
          used.add(fallback.id);
          queue.push(fallback);
        }
      }
    }

    if (mode === 'daily' && queue.length < 10) {
      const learning = await this.prisma.userKanjiProgress.findMany({
        where: { userId, status: { in: ['learning', 'reviewing'] } },
        orderBy: { updatedAt: 'desc' },
        take: 4,
      });
      for (const progress of learning) {
        const exercise = this.pickExercise(
          exercises,
          'sentence_cloze_kanji',
          progress.kanjiId,
          used,
        );
        if (exercise) {
          used.add(exercise.id);
          queue.push(exercise);
        }
      }
    }

    return shuffle(queue);
  }

  private async queueItems(sessionId: string): Promise<StudyQueueItem[]> {
    const items = await this.prisma.studySessionItem.findMany({
      where: { sessionId },
      orderBy: { position: 'asc' },
      include: {
        exerciseItem: { include: { kanji: { select: { literal: true } }, template: true } },
      },
    });
    return items.map((item) => {
      const exercise = item.exerciseItem;
      const answers = extractAnswers(exercise.answerJson);
      const distractors = extractDistractors(exercise.answerJson);
      const isInput = exercise.template.type === 'reading_input_kana';
      return {
        sessionItemId: item.id,
        position: item.position,
        exerciseItemId: exercise.id,
        template: exercise.template.type,
        skill: exercise.skill as StudyQueueItem['skill'],
        cardSkill: TEMPLATE_TO_CARD_SKILL[exercise.template.type] ?? 'KANJI_MEANING_RECOGNITION',
        kanjiLiteral: exercise.kanji?.literal ?? '',
        prompt: (exercise.promptJson ?? {}) as StudyQueueItem['prompt'],
        options: isInput ? [] : shuffle([...answers, ...distractors]),
        status: item.status,
        wasCorrect: item.wasCorrect,
      };
    });
  }
}

function extractAnswers(answerJson: Prisma.JsonValue): string[] {
  const value = answerJson as { acceptedAnswers?: unknown };
  if (Array.isArray(value?.acceptedAnswers)) {
    return value.acceptedAnswers.filter((entry): entry is string => typeof entry === 'string');
  }
  return [];
}

function extractDistractors(answerJson: Prisma.JsonValue): string[] {
  const value = answerJson as { distractors?: unknown };
  if (Array.isArray(value?.distractors)) {
    return value.distractors.filter((entry): entry is string => typeof entry === 'string');
  }
  return [];
}

function extractExplanation(explanationJson: Prisma.JsonValue | null): string | null {
  const value = explanationJson as { explanation?: unknown } | null;
  return typeof value?.explanation === 'string' ? value.explanation : null;
}
