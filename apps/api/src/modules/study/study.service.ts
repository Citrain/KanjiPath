import type {
  AnswerResult,
  CreateSessionInput,
  CreateSessionResponse,
  DailyMissionDto,
  DailyMissionResponse,
  DailyMissionStep,
  ResumeResponse,
  ReviewCardSkill,
  StudyQueueItem,
  StudySessionDto,
  StudyTarget,
  UpdateDailyMissionStepInput,
} from '@kanjipath/contracts';
import {
  computeOverallScore,
  FsrsReviewScheduler,
  isMastered,
  type ReviewCard,
} from '@kanjipath/domain';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  CARD_SKILL_TO_TEMPLATES,
  gradeAnswer,
  requiresKanaInput,
  TEMPLATE_TO_CARD_SKILL,
} from './grader';

const scheduler = new FsrsReviewScheduler();

const TARGETED_QUEUE_SIZE = 20;
const DAILY_MISSION_REVIEW_LIMIT = 6;

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

export interface NewKanjiCountInput {
  mode: string;
  dailyNewLimit: number;
  reviewLimit: number;
  autoBalance: boolean;
  dueCount: number;
}

export function computeNewKanjiCount(input: NewKanjiCountInput): number {
  const base = input.mode === 'free' ? input.dailyNewLimit : Math.min(input.dailyNewLimit, 5);
  if (input.mode === 'free' || !input.autoBalance) {
    return base;
  }
  const room = Math.max(0, input.reviewLimit - input.dueCount);
  return Math.min(base, room);
}

@Injectable()
export class StudyService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: string, input: CreateSessionInput): Promise<CreateSessionResponse> {
    const sessionMode = input.mode;
    const target = input.target;
    if (sessionMode === 'targeted' && !target) {
      throw new BadRequestException(
        'Une révision ciblée demande au moins un filtre (niveau, compétence ou kanji)',
      );
    }
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    const dailyNewLimit = settings?.dailyNewLimit ?? 10;
    const reviewLimit = settings?.reviewLimit ?? 40;
    const autoBalance = settings?.autoBalance ?? true;
    const kanaInputEnabled = settings?.kanaInputEnabled ?? true;

    const exercises = await this.loadExercises(kanaInputEnabled);
    const queue =
      sessionMode === 'targeted' && target
        ? await this.buildTargetedQueue(userId, target, exercises)
        : await this.buildQueue(
            userId,
            sessionMode,
            dailyNewLimit,
            reviewLimit,
            autoBalance,
            exercises,
          );
    if (queue.length === 0) {
      throw new BadRequestException('Aucun exercice disponible pour cette session');
    }

    const session = await this.prisma.studySession.create({
      data: {
        userId,
        mode: sessionMode as never,
        targetJson: target ? (target as Prisma.InputJsonValue) : undefined,
      },
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
        target: extractTarget(session.targetJson),
        startedAt: session.startedAt.toISOString(),
        answeredCount: 0,
        correctCount: 0,
        totalItems: items.length,
      },
      items,
    };
  }

  async getSession(userId: string, sessionId: string): Promise<ResumeResponse> {
    const session = await this.prisma.studySession.findFirst({ where: { id: sessionId, userId } });
    if (!session) {
      throw new NotFoundException('Session introuvable');
    }
    const items = await this.queueItems(session.id);
    return { session: this.sessionDto(session, items.length), items };
  }

  async dailyMission(userId: string): Promise<DailyMissionResponse> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    const localDate = localDateKey(new Date(), settings?.timezone ?? 'Europe/Paris');
    const mission = await this.prisma.dailyMission.findUnique({
      where: { userId_localDate: { userId, localDate } },
    });
    return { mission: mission ? await this.dailyMissionDto(mission.id) : null };
  }

  async createDailyMission(userId: string): Promise<DailyMissionResponse> {
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    const localDate = localDateKey(new Date(), settings?.timezone ?? 'Europe/Paris');
    const existing = await this.prisma.dailyMission.findUnique({
      where: { userId_localDate: { userId, localDate } },
    });
    if (existing) {
      return { mission: await this.dailyMissionDto(existing.id) };
    }

    const queue = await this.buildDailyMissionQueue(userId, {
      activeLevel: settings?.activeLevel ?? 'N5',
      autoBalance: settings?.autoBalance ?? true,
      dailyNewLimit: settings?.dailyNewLimit ?? 10,
      kanaInputEnabled: settings?.kanaInputEnabled ?? true,
      reviewLimit: settings?.reviewLimit ?? 40,
    });
    const [vocabulary, text, contentVersion] = await Promise.all([
      this.prisma.vocabulary.findFirst({
        where: {
          editorialStatus: 'published',
          estimatedLevel: (settings?.activeLevel ?? 'N5') as never,
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.miniText.findFirst({
        where: {
          editorialStatus: 'published',
          level: (settings?.activeLevel ?? 'N5') as never,
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.contentVersion.findFirst({ orderBy: { publishedAt: 'desc' } }),
    ]);

    if (queue.length === 0 && !vocabulary && !text) {
      throw new BadRequestException('Aucun contenu disponible pour la mission du jour');
    }

    try {
      const mission = await this.prisma.$transaction(async (tx) => {
        const studySession =
          queue.length > 0
            ? await tx.studySession.create({ data: { userId, mode: 'daily' } })
            : null;
        if (studySession) {
          await tx.studySessionItem.createMany({
            data: queue.map((exercise, position) => ({
              sessionId: studySession.id,
              position,
              exerciseItemId: exercise.id,
            })),
          });
        }

        const steps = [
          studySession ? { type: 'study' as const, referenceId: studySession.id } : null,
          vocabulary ? { type: 'vocabulary' as const, referenceId: vocabulary.id } : null,
          text ? { type: 'text' as const, referenceId: text.id } : null,
        ].filter(
          (step): step is { type: 'study' | 'vocabulary' | 'text'; referenceId: string } =>
            step !== null,
        );
        return tx.dailyMission.create({
          data: {
            userId,
            localDate,
            contentVersion: contentVersion?.version,
            studySessionId: studySession?.id,
            steps: {
              create: steps.map((step, position) => ({ ...step, position })),
            },
          },
        });
      });
      return { mission: await this.dailyMissionDto(mission.id) };
    } catch (error) {
      if (!isUniqueConstraint(error)) {
        throw error;
      }
      const mission = await this.prisma.dailyMission.findUnique({
        where: { userId_localDate: { userId, localDate } },
      });
      if (!mission) {
        throw error;
      }
      return { mission: await this.dailyMissionDto(mission.id) };
    }
  }

  async updateDailyMissionStep(
    userId: string,
    missionId: string,
    stepId: string,
    input: UpdateDailyMissionStepInput,
  ): Promise<DailyMissionResponse> {
    const step = await this.prisma.dailyMissionStep.findFirst({
      where: { id: stepId, missionId, mission: { userId } },
      include: { mission: true },
    });
    if (!step) {
      throw new NotFoundException('Etape de mission introuvable');
    }
    if (step.mission.status === 'completed') {
      throw new BadRequestException('Cette mission est deja terminee');
    }
    if (step.type === 'study') {
      if (input.status !== 'skipped') {
        throw new BadRequestException("L'etape d'etude se termine avec sa session");
      }
      if (step.mission.studySessionId) {
        await this.abandon(userId, step.mission.studySessionId);
      }
      await this.prisma.dailyMissionStep.update({
        where: { id: step.id },
        data: { status: 'skipped' },
      });
    } else {
      await this.prisma.dailyMissionStep.update({ where: { id: step.id }, data: input });
    }
    await this.completeDailyMissionIfReady(missionId);
    return { mission: await this.dailyMissionDto(missionId) };
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
    return { session: this.sessionDto(session, items.length), items };
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
    const sessionId = body.sessionId;
    const exerciseItemId = body.exerciseItemId;
    const answer = body.answer;
    if (!exerciseItemId || typeof answer !== 'string') {
      throw new BadRequestException('Réponse incomplète');
    }

    const session = await this.prisma.studySession.findFirst({
      where: {
        userId,
        ...(sessionId ? { id: sessionId } : {}),
        endedAt: null,
        items: { some: { exerciseItemId, status: 'pending' } },
      },
      orderBy: { startedAt: 'desc' },
    });
    if (!session) {
      throw new NotFoundException('Aucune session active pour cet exercice');
    }
    const sessionItem = await this.prisma.studySessionItem.findFirst({
      where: { sessionId: session.id, exerciseItemId, status: 'pending' },
    });
    const exercise = await this.prisma.exerciseItem.findUnique({
      where: { id: exerciseItemId },
      include: {
        kanji: {
          include: {
            readings: {
              where: { commonness: 'common' },
              orderBy: { reading: 'asc' },
            },
          },
        },
        template: true,
      },
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
      readings: exercise.kanji.readings.map((reading) => ({
        reading: reading.reading,
        romaji: reading.romaji,
      })),
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
    await this.completeMissionForStudySession(session.id, 'completed');
  }

  async abandon(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.studySession.findFirst({ where: { id: sessionId, userId } });
    if (!session) {
      throw new NotFoundException('Session introuvable');
    }
    if (session.endedAt) {
      return;
    }
    const durationSeconds = Math.max(
      0,
      Math.round((Date.now() - session.startedAt.getTime()) / 1000),
    );
    await this.prisma.studySessionItem.updateMany({
      where: { sessionId, status: 'pending' },
      data: { status: 'skipped' },
    });
    await this.prisma.studySession.update({
      where: { id: sessionId },
      data: { endedAt: new Date(), durationSeconds },
    });
    await this.completeMissionForStudySession(session.id, 'skipped');
  }

  private sessionDto(
    session: {
      id: string;
      mode: string;
      targetJson: Prisma.JsonValue | null;
      startedAt: Date;
      answeredCount: number;
      correctCount: number;
    },
    totalItems: number,
  ): StudySessionDto {
    return {
      id: session.id,
      mode: session.mode as StudySessionDto['mode'],
      target: extractTarget(session.targetJson),
      startedAt: session.startedAt.toISOString(),
      answeredCount: session.answeredCount,
      correctCount: session.correctCount,
      totalItems,
    };
  }

  private async dailyMissionDto(missionId: string): Promise<DailyMissionDto> {
    const mission = await this.prisma.dailyMission.findUnique({
      where: { id: missionId },
      include: {
        steps: { orderBy: { position: 'asc' } },
        studySession: true,
      },
    });
    if (!mission) {
      throw new NotFoundException('Mission introuvable');
    }
    const vocabularyIds = mission.steps.flatMap((step) =>
      step.type === 'vocabulary' && step.referenceId ? [step.referenceId] : [],
    );
    const textIds = mission.steps.flatMap((step) =>
      step.type === 'text' && step.referenceId ? [step.referenceId] : [],
    );
    const [vocabulary, texts, studyItems] = await Promise.all([
      this.prisma.vocabulary.findMany({ where: { id: { in: vocabularyIds } } }),
      this.prisma.miniText.findMany({ where: { id: { in: textIds } } }),
      mission.studySession ? this.queueItems(mission.studySession.id, false) : [],
    ]);
    const vocabularyById = new Map(vocabulary.map((entry) => [entry.id, entry]));
    const textById = new Map(texts.map((entry) => [entry.id, entry]));
    const steps: DailyMissionStep[] = [];
    for (const step of mission.steps) {
      if (step.type === 'study' && mission.studySession) {
        steps.push({
          id: step.id,
          position: step.position,
          status: step.status,
          type: 'study',
          session: this.sessionDto(mission.studySession, studyItems.length),
          items: studyItems,
        });
        continue;
      }
      if (step.type === 'vocabulary' && step.referenceId) {
        const entry = vocabularyById.get(step.referenceId);
        if (entry) {
          steps.push({
            id: step.id,
            position: step.position,
            status: step.status,
            type: 'vocabulary',
            vocabulary: {
              id: entry.id,
              writtenForm: entry.writtenForm,
              reading: entry.reading,
              romaji: entry.romaji,
              meaningFr: entry.meaningFr,
            },
          });
        }
        continue;
      }
      if (step.type === 'text' && step.referenceId) {
        const entry = textById.get(step.referenceId);
        if (entry) {
          steps.push({
            id: step.id,
            position: step.position,
            status: step.status,
            type: 'text',
            text: { id: entry.id, title: entry.title, level: entry.level },
          });
        }
      }
    }
    return {
      id: mission.id,
      localDate: mission.localDate,
      status: mission.status,
      startedAt: mission.startedAt.toISOString(),
      completedAt: mission.completedAt?.toISOString() ?? null,
      steps,
    };
  }

  private async completeMissionForStudySession(
    studySessionId: string,
    status: 'completed' | 'skipped',
  ): Promise<void> {
    const mission = await this.prisma.dailyMission.findUnique({ where: { studySessionId } });
    if (!mission) {
      return;
    }
    await this.prisma.dailyMissionStep.updateMany({
      where: { missionId: mission.id, type: 'study', status: 'pending' },
      data: { status },
    });
    await this.completeDailyMissionIfReady(mission.id);
  }

  private async completeDailyMissionIfReady(missionId: string): Promise<void> {
    const mission = await this.prisma.dailyMission.findUnique({
      where: { id: missionId },
      include: { steps: true },
    });
    if (
      !mission ||
      mission.status === 'completed' ||
      mission.steps.some((step) => step.status === 'pending')
    ) {
      return;
    }
    await this.prisma.dailyMission.update({
      where: { id: mission.id },
      data: { status: 'completed', completedAt: new Date() },
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
    let listeningScore = existing?.listeningScore ?? 0;
    const key = skill as keyof typeof scores;
    if (key in scores) {
      scores[key] = correct
        ? Math.min(1, scores[key] + 0.25 * (1 - scores[key]))
        : Math.max(0, scores[key] - 0.3);
    }
    if (skill === 'listening') {
      listeningScore = correct
        ? Math.min(1, listeningScore + 0.25 * (1 - listeningScore))
        : Math.max(0, listeningScore - 0.3);
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
        listeningScore,
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
        listeningScore,
        overallScore: overall,
        status: status as never,
        masteredAt: mastered ? now : (existing?.masteredAt ?? now),
      },
    });
  }

  private async loadExercises(kanaInputEnabled: boolean): Promise<Map<string, ExerciseRow[]>> {
    const items = await this.prisma.exerciseItem.findMany({
      where: { editorialStatus: 'published' },
      orderBy: { id: 'asc' },
      include: { kanji: { select: { literal: true } }, template: true },
    });
    const byTemplateKanji = new Map<string, ExerciseRow[]>();
    for (const item of items) {
      if (!item.kanjiId || (!kanaInputEnabled && requiresKanaInput(item.template.type))) {
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

  private async buildDailyMissionQueue(
    userId: string,
    settings: {
      activeLevel: string;
      autoBalance: boolean;
      dailyNewLimit: number;
      kanaInputEnabled: boolean;
      reviewLimit: number;
    },
  ): Promise<ExerciseRow[]> {
    const exercises = await this.loadExercises(settings.kanaInputEnabled);
    const used = new Set<string>();
    const queue: ExerciseRow[] = [];
    const pushFromCard = (subjectId: string, skill: string): void => {
      if (queue.length >= DAILY_MISSION_REVIEW_LIMIT) {
        return;
      }
      for (const template of CARD_SKILL_TO_TEMPLATES[skill as ReviewCardSkill] ?? []) {
        const exercise = this.pickExercise(exercises, template, subjectId, used);
        if (exercise) {
          used.add(exercise.id);
          queue.push(exercise);
          return;
        }
      }
    };

    const now = new Date();
    const dueWhere: Prisma.ReviewCardWhereInput = {
      userId,
      subjectType: 'kanji',
      dueAt: { lte: now },
      state: { not: 'Suspended' },
    };
    const dueCount = await this.prisma.reviewCard.count({ where: dueWhere });
    const dueCards = await this.prisma.reviewCard.findMany({
      where: dueWhere,
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
      take: Math.min(settings.reviewLimit, DAILY_MISSION_REVIEW_LIMIT),
    });
    for (const card of dueCards) {
      pushFromCard(card.subjectId, card.skill);
    }

    if (queue.length < DAILY_MISSION_REVIEW_LIMIT) {
      const failures = await this.prisma.reviewLog.findMany({
        where: {
          wasCorrect: false,
          reviewedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
          reviewCard: { userId, state: { not: 'Suspended' } },
        },
        include: { reviewCard: true },
        orderBy: [{ reviewedAt: 'desc' }, { id: 'asc' }],
        take: 4,
      });
      const seen = new Set<string>();
      for (const failure of failures) {
        const key = `${failure.reviewCard.subjectId}:${failure.reviewCard.skill}`;
        if (!seen.has(key)) {
          seen.add(key);
          pushFromCard(failure.reviewCard.subjectId, failure.reviewCard.skill);
        }
      }
    }

    const newCount = computeNewKanjiCount({
      mode: 'daily',
      dailyNewLimit: settings.dailyNewLimit,
      reviewLimit: settings.reviewLimit,
      autoBalance: settings.autoBalance,
      dueCount,
    });
    if (queue.length < DAILY_MISSION_REVIEW_LIMIT && newCount > 0) {
      const [discovered, knownKanji, curriculum] = await Promise.all([
        this.prisma.reviewCard.findMany({
          where: { userId, subjectType: 'kanji' },
          select: { subjectId: true },
          distinct: ['subjectId'],
        }),
        this.prisma.userKanjiProgress.findMany({ where: { userId }, select: { kanjiId: true } }),
        this.prisma.curriculum.findFirst({ where: { status: 'published' } }),
      ]);
      if (curriculum) {
        const discoveredIds = new Set([
          ...discovered.map((card) => card.subjectId),
          ...knownKanji.map((progress) => progress.kanjiId),
        ]);
        const entries = await this.prisma.curriculumKanji.findMany({
          where: {
            curriculumId: curriculum.id,
            level: settings.activeLevel as never,
            kanjiId: { notIn: [...discoveredIds] },
          },
          orderBy: [{ order: 'asc' }, { kanjiId: 'asc' }],
          take: Math.min(newCount, 2),
        });
        for (const entry of entries) {
          pushFromCard(entry.kanjiId, 'KANJI_MEANING_RECOGNITION');
        }
      }
    }

    if (queue.length < DAILY_MISSION_REVIEW_LIMIT) {
      const learning = await this.prisma.userKanjiProgress.findMany({
        where: { userId, status: { in: ['learning', 'reviewing'] } },
        orderBy: [{ updatedAt: 'desc' }, { kanjiId: 'asc' }],
        take: 2,
      });
      for (const progress of learning) {
        if (queue.length >= DAILY_MISSION_REVIEW_LIMIT) {
          break;
        }
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
    return queue;
  }

  private async buildQueue(
    userId: string,
    mode: string,
    dailyNewLimit: number,
    reviewLimit: number,
    autoBalance: boolean,
    exercises: Map<string, ExerciseRow[]>,
  ): Promise<ExerciseRow[]> {
    const used = new Set<string>();
    const queue: ExerciseRow[] = [];
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const dueWhere = {
      userId,
      subjectType: 'kanji' as const,
      dueAt: { lte: endOfToday },
      state: { not: 'Suspended' as const },
    };
    const dueCount = await this.prisma.reviewCard.count({ where: dueWhere });
    const dueCards = await this.prisma.reviewCard.findMany({
      where: dueWhere,
      orderBy: { dueAt: 'asc' },
      take: reviewLimit,
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
    const knownKanji = await this.prisma.userKanjiProgress.findMany({
      where: { userId },
      select: { kanjiId: true },
    });
    const discoveredIds = new Set([
      ...discovered.map((card) => card.subjectId),
      ...knownKanji.map((progress) => progress.kanjiId),
    ]);
    const curriculum = await this.prisma.curriculum.findFirst({ where: { status: 'published' } });
    if (curriculum) {
      const takeNew = computeNewKanjiCount({
        mode,
        dailyNewLimit,
        reviewLimit,
        autoBalance,
        dueCount,
      });
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

  private async buildTargetedQueue(
    userId: string,
    target: StudyTarget,
    exercises: Map<string, ExerciseRow[]>,
  ): Promise<ExerciseRow[]> {
    const used = new Set<string>();
    const queue: ExerciseRow[] = [];
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const kanjiFilter =
      target.kanjiIds && target.kanjiIds.length > 0 ? new Set(target.kanjiIds) : null;

    const matchesTarget = (row: ExerciseRow): boolean => {
      if (target.level && row.level !== target.level) {
        return false;
      }
      if (target.skill && row.skill !== target.skill) {
        return false;
      }
      if (kanjiFilter && (!row.kanjiId || !kanjiFilter.has(row.kanjiId))) {
        return false;
      }
      return true;
    };

    const pushFromCard = (subjectId: string, skill: string): void => {
      const templates = CARD_SKILL_TO_TEMPLATES[skill as ReviewCardSkill] ?? [];
      for (const template of templates) {
        const exercise = this.pickExercise(exercises, template, subjectId, used);
        if (exercise && matchesTarget(exercise)) {
          used.add(exercise.id);
          queue.push(exercise);
          return;
        }
      }
    };

    const dueWhere: Prisma.ReviewCardWhereInput = {
      userId,
      subjectType: 'kanji',
      dueAt: { lte: endOfToday },
      state: { not: 'Suspended' },
    };
    if (kanjiFilter) {
      dueWhere.subjectId = { in: [...kanjiFilter] };
    }
    const dueCards = await this.prisma.reviewCard.findMany({
      where: dueWhere,
      orderBy: { dueAt: 'asc' },
      take: TARGETED_QUEUE_SIZE * 3,
    });
    for (const card of dueCards) {
      if (queue.length >= TARGETED_QUEUE_SIZE) {
        break;
      }
      pushFromCard(card.subjectId, card.skill);
    }

    if (queue.length < TARGETED_QUEUE_SIZE) {
      const failureCards: Prisma.ReviewCardWhereInput = { userId };
      if (kanjiFilter) {
        failureCards.subjectId = { in: [...kanjiFilter] };
      }
      const recentFailures = await this.prisma.reviewLog.findMany({
        where: {
          reviewCard: failureCards,
          wasCorrect: false,
          reviewedAt: { gte: new Date(now.getTime() - 7 * 24 * 3600 * 1000) },
        },
        include: { reviewCard: true },
        orderBy: { reviewedAt: 'desc' },
        take: 60,
      });
      const seen = new Set<string>();
      for (const failure of recentFailures) {
        if (queue.length >= TARGETED_QUEUE_SIZE) {
          break;
        }
        const card = failure.reviewCard;
        const key = `${card.subjectId}:${card.skill}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        pushFromCard(card.subjectId, card.skill);
      }
    }

    if (queue.length < TARGETED_QUEUE_SIZE) {
      const pool: ExerciseRow[] = [];
      for (const rows of exercises.values()) {
        for (const row of rows) {
          if (matchesTarget(row)) {
            pool.push(row);
          }
        }
      }
      pool.sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id));
      const seenKanjiSkill = new Set<string>();
      for (const exercise of pool) {
        if (queue.length >= TARGETED_QUEUE_SIZE) {
          break;
        }
        if (used.has(exercise.id)) {
          continue;
        }
        const key = `${exercise.kanjiId}:${exercise.skill}`;
        if (seenKanjiSkill.has(key)) {
          continue;
        }
        seenKanjiSkill.add(key);
        used.add(exercise.id);
        queue.push(exercise);
      }
      for (const exercise of pool) {
        if (queue.length >= TARGETED_QUEUE_SIZE) {
          break;
        }
        if (used.has(exercise.id)) {
          continue;
        }
        used.add(exercise.id);
        queue.push(exercise);
      }
    }

    return shuffle(queue);
  }

  private async queueItems(sessionId: string, shuffleOptions = true): Promise<StudyQueueItem[]> {
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
        options: isInput
          ? []
          : shuffleOptions
            ? shuffle([...answers, ...distractors])
            : [...answers, ...distractors].sort((a, b) => a.localeCompare(b, 'ja')),
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

function extractTarget(targetJson: Prisma.JsonValue | null): StudyTarget | null {
  if (!targetJson || typeof targetJson !== 'object') {
    return null;
  }
  const value = targetJson as Partial<StudyTarget>;
  const target: StudyTarget = {};
  if (typeof value.level === 'string') {
    target.level = value.level as StudyTarget['level'];
  }
  if (typeof value.skill === 'string') {
    target.skill = value.skill as StudyTarget['skill'];
  }
  if (Array.isArray(value.kanjiIds)) {
    target.kanjiIds = value.kanjiIds.filter((entry): entry is string => typeof entry === 'string');
  }
  if (!target.level && !target.skill && (!target.kanjiIds || target.kanjiIds.length === 0)) {
    return null;
  }
  return target;
}

export function localDateKey(now: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
