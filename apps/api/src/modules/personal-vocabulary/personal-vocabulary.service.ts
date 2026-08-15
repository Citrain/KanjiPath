import type {
  AnswerPersonalVocabularyInput,
  CreatePersonalVocabularyEntryInput,
  PersonalVocabularyAnswerResult,
  PersonalVocabularyCardKind,
  PersonalVocabularyEntryDto,
  PersonalVocabularyListResponse,
  PersonalVocabularySessionDto,
  PersonalVocabularySessionResponse,
  Rating,
} from '@kanjipath/contracts';
import { FsrsReviewScheduler, type ReviewCard } from '@kanjipath/domain';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const scheduler = new FsrsReviewScheduler();
const SESSION_SIZE = 20;

interface ResolvedEntry {
  surface: string;
  reading: string | null;
  meaningFr: string | null;
  excerpt: string | null;
  dedupeKey: string;
  cardKinds: PersonalVocabularyCardKind[];
  source: {
    origin: 'published_vocabulary' | 'published_text' | 'conversation';
    reference: string | null;
    contentVersion: string | null;
    sourceName: string | null;
    sourceUrl: string | null;
    sourceVersion: string | null;
    attributionText: string | null;
    license: string | null;
  };
}

@Injectable()
export class PersonalVocabularyService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    state: 'active' | 'archived',
  ): Promise<PersonalVocabularyListResponse> {
    const [entries, dueCount] = await Promise.all([
      this.prisma.personalVocabularyEntry.findMany({
        where: { userId, archivedAt: state === 'active' ? null : { not: null } },
        include: { source: true, cards: { orderBy: { kind: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.personalVocabularyReviewCard.count({
        where: {
          dueAt: { lte: new Date() },
          state: { not: 'Suspended' },
          entry: { userId, archivedAt: null },
        },
      }),
    ]);
    return { entries: entries.map((entry) => toEntryDto(entry)), dueCount };
  }

  async create(
    userId: string,
    input: CreatePersonalVocabularyEntryInput,
  ): Promise<PersonalVocabularyEntryDto> {
    const resolved =
      input.origin === 'published'
        ? await this.resolvePublishedEntry(input)
        : await this.resolveConversationEntry(userId, input);
    const existing = await this.prisma.personalVocabularyEntry.findUnique({
      where: { userId_dedupeKey: { userId, dedupeKey: resolved.dedupeKey } },
      include: { source: true, cards: { orderBy: { kind: 'asc' } } },
    });
    if (existing) {
      return toEntryDto(existing);
    }

    try {
      const created = await this.prisma.personalVocabularyEntry.create({
        data: {
          userId,
          surface: resolved.surface,
          reading: resolved.reading,
          meaningFr: resolved.meaningFr,
          excerpt: resolved.excerpt,
          dedupeKey: resolved.dedupeKey,
          source: { create: resolved.source },
          cards: { create: resolved.cardKinds.map((kind) => ({ kind })) },
        },
        include: { source: true, cards: { orderBy: { kind: 'asc' } } },
      });
      return toEntryDto(created);
    } catch (error) {
      if (!isUniqueConstraint(error)) {
        throw error;
      }
      const concurrent = await this.prisma.personalVocabularyEntry.findUnique({
        where: { userId_dedupeKey: { userId, dedupeKey: resolved.dedupeKey } },
        include: { source: true, cards: { orderBy: { kind: 'asc' } } },
      });
      if (!concurrent) {
        throw error;
      }
      return toEntryDto(concurrent);
    }
  }

  async archive(userId: string, id: string): Promise<PersonalVocabularyEntryDto> {
    return this.setArchived(userId, id, new Date());
  }

  async restore(userId: string, id: string): Promise<PersonalVocabularyEntryDto> {
    return this.setArchived(userId, id, null);
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.prisma.personalVocabularyEntry.deleteMany({ where: { id, userId } });
    if (result.count === 0) {
      throw new NotFoundException('Entrée du carnet introuvable');
    }
  }

  async createSession(userId: string): Promise<PersonalVocabularySessionResponse> {
    const existing = await this.prisma.personalVocabularySession.findFirst({
      where: { userId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (existing) {
      return this.sessionResponse(existing.id);
    }
    const cards = await this.prisma.personalVocabularyReviewCard.findMany({
      where: {
        dueAt: { lte: new Date() },
        state: { not: 'Suspended' },
        entry: { userId, archivedAt: null },
      },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
      take: SESSION_SIZE,
    });
    if (cards.length === 0) {
      throw new BadRequestException('Aucun mot du carnet n’est à réviser');
    }
    const session = await this.prisma.personalVocabularySession.create({ data: { userId } });
    await this.prisma.personalVocabularySessionItem.createMany({
      data: cards.map((card, position) => ({
        sessionId: session.id,
        reviewCardId: card.id,
        position,
      })),
    });
    return this.sessionResponse(session.id);
  }

  async resume(userId: string): Promise<PersonalVocabularySessionResponse> {
    const session = await this.prisma.personalVocabularySession.findFirst({
      where: { userId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (!session) {
      return { session: null, items: [] };
    }
    return this.sessionResponse(session.id);
  }

  async answer(
    userId: string,
    input: AnswerPersonalVocabularyInput,
  ): Promise<PersonalVocabularyAnswerResult> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.personalVocabularySession.findFirst({
        where: {
          userId,
          endedAt: null,
          ...(input.sessionId ? { id: input.sessionId } : {}),
          items: { some: { id: input.sessionItemId, status: 'pending' } },
        },
      });
      if (!session) {
        throw new NotFoundException('Aucune session active pour cette révision');
      }
      const item = await tx.personalVocabularySessionItem.findFirst({
        where: { id: input.sessionItemId, sessionId: session.id, status: 'pending' },
        include: { reviewCard: { include: { entry: true } } },
      });
      if (!item) {
        throw new NotFoundException('Révision introuvable');
      }
      const card = item.reviewCard;
      const expectedAnswer = card.kind === 'reading' ? card.entry.reading : card.entry.meaningFr;
      const correct =
        card.kind === 'reading'
          ? expectedAnswer !== null &&
            input.answer !== undefined &&
            sameReading(input.answer, expectedAnswer)
          : input.rating !== 'again';
      if (card.kind === 'reading' && input.answer === undefined) {
        throw new BadRequestException('La lecture est requise');
      }
      if (card.kind !== 'reading' && input.rating === undefined) {
        throw new BadRequestException('L’auto-évaluation est requise');
      }
      const rating: Rating =
        card.kind === 'reading' && correct && (input.rating === 'hard' || input.rating === 'easy')
          ? input.rating
          : correct
            ? 'good'
            : 'again';
      const now = new Date();
      const result = scheduler.review(toDomainCard(card), rating, now);
      await tx.personalVocabularyReviewCard.update({
        where: { id: card.id },
        data: {
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
      await tx.personalVocabularyReviewLog.create({
        data: {
          reviewCardId: card.id,
          rating,
          wasCorrect: correct,
          responseTimeMs: input.responseTimeMs ?? null,
          answerPayload: input.answer ? { answer: input.answer } : undefined,
          stateBefore: result.log.stateBefore as never,
          stateAfter: result.log.stateAfter as never,
          dueAfter: result.log.due,
          stabilityAfter: result.card.stability,
        },
      });
      await tx.personalVocabularySessionItem.update({
        where: { id: item.id },
        data: { status: 'answered', wasCorrect: correct },
      });
      await tx.personalVocabularySession.update({
        where: { id: session.id },
        data: {
          answeredCount: { increment: 1 },
          correctCount: correct ? { increment: 1 } : undefined,
        },
      });
      return { correct, expectedAnswer, rating, nextDueAt: result.card.due.toISOString() };
    });
  }

  async finish(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.personalVocabularySession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException('Session du carnet introuvable');
    }
    await this.prisma.personalVocabularySession.update({
      where: { id: session.id },
      data: {
        endedAt: new Date(),
        durationSeconds: Math.max(0, Math.round((Date.now() - session.startedAt.getTime()) / 1000)),
      },
    });
  }

  async abandon(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.personalVocabularySession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException('Session du carnet introuvable');
    }
    await this.prisma.$transaction([
      this.prisma.personalVocabularySessionItem.updateMany({
        where: { sessionId: session.id, status: 'pending' },
        data: { status: 'skipped' },
      }),
      this.prisma.personalVocabularySession.update({
        where: { id: session.id },
        data: {
          endedAt: new Date(),
          durationSeconds: Math.max(
            0,
            Math.round((Date.now() - session.startedAt.getTime()) / 1000),
          ),
        },
      }),
    ]);
  }

  private async setArchived(
    userId: string,
    id: string,
    archivedAt: Date | null,
  ): Promise<PersonalVocabularyEntryDto> {
    const found = await this.prisma.personalVocabularyEntry.findFirst({ where: { id, userId } });
    if (!found) {
      throw new NotFoundException('Entrée du carnet introuvable');
    }
    const entry = await this.prisma.personalVocabularyEntry.update({
      where: { id },
      data: { archivedAt },
      include: { source: true, cards: { orderBy: { kind: 'asc' } } },
    });
    return toEntryDto(entry);
  }

  private async sessionResponse(sessionId: string): Promise<PersonalVocabularySessionResponse> {
    const session = await this.prisma.personalVocabularySession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Session du carnet introuvable');
    }
    const items = await this.prisma.personalVocabularySessionItem.findMany({
      where: { sessionId },
      orderBy: { position: 'asc' },
      include: { reviewCard: { include: { entry: true } } },
    });
    return {
      session: toSessionDto(session, items.length),
      items: items.map((item) => ({
        sessionItemId: item.id,
        position: item.position,
        kind: item.reviewCard.kind,
        surface: item.reviewCard.entry.surface,
        reading: item.reviewCard.entry.reading,
        meaningFr: item.reviewCard.entry.meaningFr,
        excerpt: item.reviewCard.entry.excerpt,
        status: item.status,
        wasCorrect: item.wasCorrect,
      })),
    };
  }

  private async resolvePublishedEntry(
    input: Extract<CreatePersonalVocabularyEntryInput, { origin: 'published' }>,
  ): Promise<ResolvedEntry> {
    const [vocabulary, contentVersion] = await Promise.all([
      this.prisma.vocabulary.findFirst({
        where: { id: input.vocabularyId, editorialStatus: 'published' },
        include: { source: true },
      }),
      this.prisma.contentVersion.findFirst({ orderBy: { publishedAt: 'desc' } }),
    ]);
    if (!vocabulary) {
      throw new NotFoundException('Mot publié introuvable');
    }
    const text = input.textId
      ? await this.prisma.miniText.findFirst({
          where: { id: input.textId, editorialStatus: 'published' },
          include: { source: true, tokens: { where: { id: input.tokenId } } },
        })
      : null;
    if (input.textId && text?.tokens.length !== 1) {
      throw new NotFoundException('Contexte publié introuvable');
    }
    if (text && !text.body.includes(vocabulary.writtenForm)) {
      throw new BadRequestException('Le mot ne figure pas dans ce contexte publié');
    }
    const token = text?.tokens[0] ?? null;
    const source = text?.source ?? vocabulary.source;
    const origin = text ? 'published_text' : 'published_vocabulary';
    return {
      surface: vocabulary.writtenForm,
      reading: vocabulary.reading,
      meaningFr: vocabulary.meaningFr,
      excerpt: text && token ? excerptAround(text.body, token.startOffset, token.endOffset) : null,
      dedupeKey: `${origin}:${vocabulary.id}:${text?.id ?? ''}:${token?.id ?? ''}`,
      cardKinds: cardKinds(vocabulary.reading, vocabulary.meaningFr),
      source: {
        origin,
        reference:
          text && token
            ? `text:${text.id}:token:${token.id}:vocabulary:${vocabulary.id}`
            : `vocabulary:${vocabulary.id}`,
        contentVersion: contentVersion?.version ?? null,
        sourceName: source?.name ?? null,
        sourceUrl: source?.url ?? null,
        sourceVersion: source?.sourceVersion ?? null,
        attributionText: text?.author ?? source?.attributionText ?? null,
        license: text?.license ?? source?.license ?? null,
      },
    };
  }

  private async resolveConversationEntry(
    userId: string,
    input: Extract<CreatePersonalVocabularyEntryInput, { origin: 'conversation' }>,
  ): Promise<ResolvedEntry> {
    const turn = await this.prisma.conversationTurn.findFirst({
      where: { id: input.conversationTurnId, session: { userId } },
    });
    if (!turn) {
      throw new NotFoundException('Tour de conversation introuvable');
    }
    const reply = replyJapanese(turn.replyJson);
    const context = turn.transcript.includes(input.surface) ? turn.transcript : reply;
    if (!context.includes(input.surface)) {
      throw new BadRequestException('Le mot doit appartenir à votre tour de conversation');
    }
    return {
      surface: input.surface.normalize('NFC'),
      reading: input.reading?.normalize('NFC') ?? null,
      meaningFr: input.meaningFr ?? null,
      excerpt: excerptAround(
        context,
        context.indexOf(input.surface),
        context.indexOf(input.surface) + input.surface.length,
      ),
      dedupeKey: `conversation:${turn.id}:${input.surface.normalize('NFC').toLocaleLowerCase('ja')}`,
      cardKinds: cardKinds(input.reading, input.meaningFr),
      source: {
        origin: 'conversation',
        reference: `conversation_turn:${turn.id}`,
        contentVersion: null,
        sourceName: null,
        sourceUrl: null,
        sourceVersion: null,
        attributionText: null,
        license: null,
      },
    };
  }
}

function toEntryDto(entry: {
  id: string;
  surface: string;
  reading: string | null;
  meaningFr: string | null;
  excerpt: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  source: {
    origin: string;
    reference: string | null;
    contentVersion: string | null;
    sourceName: string | null;
    sourceUrl: string | null;
    sourceVersion: string | null;
    attributionText: string | null;
    license: string | null;
  } | null;
  cards: Array<{ kind: string; state: string; dueAt: Date }>;
}): PersonalVocabularyEntryDto {
  if (!entry.source) {
    throw new NotFoundException('Provenance du carnet introuvable');
  }
  return {
    id: entry.id,
    surface: entry.surface,
    reading: entry.reading,
    meaningFr: entry.meaningFr,
    excerpt: entry.excerpt,
    archivedAt: entry.archivedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    source: {
      origin: entry.source.origin as PersonalVocabularyEntryDto['source']['origin'],
      reference: entry.source.reference,
      contentVersion: entry.source.contentVersion,
      sourceName: entry.source.sourceName,
      sourceUrl: entry.source.sourceUrl,
      sourceVersion: entry.source.sourceVersion,
      attributionText: entry.source.attributionText,
      license: entry.source.license,
    },
    cards: entry.cards.map((card) => ({
      kind: card.kind as PersonalVocabularyCardKind,
      state: card.state,
      dueAt: card.dueAt.toISOString(),
    })),
  };
}

function toSessionDto(
  session: { id: string; startedAt: Date; answeredCount: number; correctCount: number },
  totalItems: number,
): PersonalVocabularySessionDto {
  return {
    id: session.id,
    startedAt: session.startedAt.toISOString(),
    answeredCount: session.answeredCount,
    correctCount: session.correctCount,
    totalItems,
  };
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

function cardKinds(
  reading: string | null | undefined,
  meaning: string | null | undefined,
): PersonalVocabularyCardKind[] {
  const kinds: PersonalVocabularyCardKind[] = [];
  if (meaning) kinds.push('meaning');
  if (reading) kinds.push('reading');
  return kinds.length > 0 ? kinds : ['self'];
}

function excerptAround(text: string, start: number, end: number): string {
  const characters = Array.from(text);
  const from = Math.max(0, start - 36);
  const to = Math.min(characters.length, end + 36);
  return `${from > 0 ? '…' : ''}${characters.slice(from, to).join('')}${to < characters.length ? '…' : ''}`;
}

function replyJapanese(value: unknown): string {
  if (typeof value !== 'object' || value === null || !('ja' in value)) return '';
  const ja = (value as { ja?: unknown }).ja;
  return typeof ja === 'string' ? ja : '';
}

function sameReading(left: string, right: string): boolean {
  return (
    toHiragana(left)
      .normalize('NFKC')
      .replace(/[\s\p{P}]/gu, '') ===
    toHiragana(right)
      .normalize('NFKC')
      .replace(/[\s\p{P}]/gu, '')
  );
}

function toHiragana(value: string): string {
  return value.replace(/[ァ-ヶ]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0x60),
  );
}

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
