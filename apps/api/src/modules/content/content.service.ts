import fs from 'node:fs/promises';
import path from 'node:path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  JlptLevel,
  KanjiDetail,
  KanjiListResponse,
  KanjiProgressDto,
  KanjiSentenceDto,
  KanjiSummary,
  KanjiVocabularyDto,
  MiniTextDetailDto,
  MiniTextListResponse,
  SourcesResponse,
  WordLookupResponse,
} from '@kanjipath/contracts';
import { JLPT_LEVELS } from '@kanjipath/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export function contentRoot(): string {
  return process.env.CONTENT_DIR ?? path.resolve(process.cwd(), '..', '..', 'content');
}

const PROGRESS_STATUS_ORDER = ['new', 'learning', 'reviewing', 'mastered'] as const;

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async kanjiList(userId: string, level: string): Promise<KanjiListResponse> {
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
    const nextDueByKanji = new Map<string, Date>();
    for (const card of cards) {
      const current = nextDueByKanji.get(card.subjectId);
      if (!current || card.dueAt < current) {
        nextDueByKanji.set(card.subjectId, card.dueAt);
      }
    }

    const kanji: KanjiSummary[] = entries.map((entry) => {
      const progress = progressByKanji.get(entry.kanjiId);
      return {
        id: entry.kanji.id,
        literal: entry.kanji.literal,
        unicodeCodepoint: entry.kanji.unicodeCodepoint,
        strokeCount: entry.kanji.strokeCount,
        frequencyRank: entry.kanji.frequencyRank,
        schoolGrade: entry.kanji.schoolGrade,
        level: entry.level as KanjiSummary['level'],
        order: entry.order,
        primaryMeaning: null,
        status: progress?.status ?? 'new',
        overallScore: progress?.overallScore ?? 0,
        nextDueAt: nextDueByKanji.get(entry.kanjiId)?.toISOString() ?? null,
      };
    });

    const meanings = await this.prisma.kanjiMeaning.findMany({
      where: { kanjiId: { in: entries.map((e) => e.kanjiId) }, isPrimary: true },
    });
    const meaningByKanji = new Map(meanings.map((m) => [m.kanjiId, m.meaning]));
    for (const item of kanji) {
      item.primaryMeaning = meaningByKanji.get(item.id) ?? null;
    }

    return { level: level as KanjiListResponse['level'], kanji };
  }

  async kanjiDetail(userId: string, literal: string): Promise<KanjiDetail> {
    const kanji = await this.prisma.kanji.findUnique({
      where: { literal },
      include: {
        meanings: true,
        readings: true,
        notes: true,
        primaryRadical: true,
        componentLinks: { orderBy: { position: 'asc' }, include: { component: true } },
      },
    });
    if (!kanji) {
      throw new NotFoundException('Kanji introuvable');
    }
    const curriculumLink = await this.prisma.curriculumKanji.findFirst({
      where: { kanjiId: kanji.id },
      orderBy: { order: 'asc' },
    });
    const progress = await this.prisma.userKanjiProgress.findUnique({
      where: { userId_kanjiId: { userId, kanjiId: kanji.id } },
    });
    const nextDue = await this.prisma.reviewCard.findFirst({
      where: { userId, subjectType: 'kanji', subjectId: kanji.id },
      orderBy: { dueAt: 'asc' },
    });

    const rawConfusions = Array.isArray(kanji.notes?.confusions)
      ? (kanji.notes?.confusions as string[])
      : [];
    const publishedConfusions =
      rawConfusions.length > 0
        ? await this.prisma.kanji.findMany({
            where: { literal: { in: rawConfusions } },
            select: { literal: true },
          })
        : [];
    const confusions = rawConfusions.filter((literal) =>
      publishedConfusions.some((k) => k.literal === literal),
    );

    const base: KanjiSummary = {
      id: kanji.id,
      literal: kanji.literal,
      unicodeCodepoint: kanji.unicodeCodepoint,
      strokeCount: kanji.strokeCount,
      frequencyRank: kanji.frequencyRank,
      schoolGrade: kanji.schoolGrade,
      level: (curriculumLink?.level ?? 'N5') as KanjiSummary['level'],
      order: curriculumLink?.order ?? 0,
      primaryMeaning: kanji.meanings.find((m) => m.isPrimary)?.meaning ?? kanji.meanings[0]?.meaning ?? null,
      status: progress?.status ?? 'new',
      overallScore: progress?.overallScore ?? 0,
      nextDueAt: nextDue?.dueAt.toISOString() ?? null,
    };

    return {
      ...base,
      meanings: kanji.meanings.map((m) => ({ meaning: m.meaning, isPrimary: m.isPrimary })),
      readings: kanji.readings.map((r) => ({
        reading: r.reading,
        romaji: r.romaji,
        type: r.readingType,
        okurigana: r.okurigana,
        commonness: r.commonness,
      })),
      components: kanji.componentLinks.map((link) => ({
        literal: link.component.literal,
        nameFr: link.component.nameFr,
        meaningFr: link.component.meaningFr,
        role: link.role,
        isRadical: link.isRadical,
      })),
      radical: kanji.primaryRadical
        ? {
            literal: kanji.primaryRadical.literal,
            nameFr: kanji.primaryRadical.nameFr,
            meaningFr: kanji.primaryRadical.meaningFr,
          }
        : null,
      notes: kanji.notes
        ? {
            mnemonicFr: kanji.notes.mnemonicFr,
            etymologyFr: kanji.notes.etymologyFr,
            etymologySource: kanji.notes.etymologySource,
            confusions,
          }
        : null,
      kanjivgUrl: kanji.kanjivgPath ? `/kanji/${encodeURIComponent(literal)}/svg` : null,
    };
  }

  async kanjiSvg(literal: string): Promise<{ svg: string; cacheControl: string }> {
    const kanji = await this.prisma.kanji.findUnique({ where: { literal } });
    if (!kanji?.kanjivgPath) {
      throw new NotFoundException('SVG introuvable pour ce kanji');
    }
    const filePath = path.join(contentRoot(), 'generated', kanji.kanjivgPath);
    const resolved = path.resolve(filePath);
    const allowedRoot = path.resolve(path.join(contentRoot(), 'generated', 'kanjivg'));
    if (!resolved.startsWith(allowedRoot)) {
      throw new NotFoundException('SVG introuvable');
    }
    const svg = await fs.readFile(resolved, 'utf8').catch(() => {
      throw new NotFoundException('SVG introuvable');
    });
    return { svg, cacheControl: 'public, max-age=86400' };
  }

  async kanjiVocabulary(literal: string): Promise<KanjiVocabularyDto[]> {
    const kanji = await this.prisma.kanji.findUnique({ where: { literal } });
    if (!kanji) {
      throw new NotFoundException('Kanji introuvable');
    }
    const links = await this.prisma.vocabularyKanji.findMany({
      where: { kanjiId: kanji.id },
      include: { vocabulary: true },
    });
    return links.map((link) => ({
      id: link.vocabulary.id,
      writtenForm: link.vocabulary.writtenForm,
      reading: link.vocabulary.reading,
      romaji: link.vocabulary.romaji,
      meaningFr: link.vocabulary.meaningFr,
      partOfSpeech: link.vocabulary.partOfSpeech,
      readingInWord: link.readingInWord,
    }));
  }

  async kanjiSentences(literal: string): Promise<KanjiSentenceDto[]> {
    const kanji = await this.prisma.kanji.findUnique({ where: { literal } });
    if (!kanji) {
      throw new NotFoundException('Kanji introuvable');
    }
    const sentences = await this.prisma.sentence.findMany({
      where: { japanese: { contains: kanji.literal }, editorialStatus: 'published' },
      orderBy: { id: 'asc' },
      take: 20,
      include: { tokens: { orderBy: { startOffset: 'asc' } } },
    });
    return sentences.map((sentence) => ({
      id: sentence.id,
      japanese: sentence.japanese,
      translationFr: sentence.translationFr,
      author: sentence.author,
      license: sentence.license,
      tokens: sentence.tokens.map((token) => ({
        surface: token.surface,
        reading: token.reading,
        romaji: token.romaji,
      })),
    }));
  }

  async vocabularyLookup(surface: string): Promise<WordLookupResponse> {
    const clean = surface.normalize('NFC').trim();
    if (clean.length === 0 || [...clean].length > 12) {
      throw new BadRequestException('Surface invalide');
    }
    let words = await this.prisma.vocabulary.findMany({
      where: { writtenForm: clean, editorialStatus: 'published' },
      orderBy: { id: 'asc' },
      take: 6,
    });
    if (words.length === 0) {
      words = await this.prisma.vocabulary.findMany({
        where: { writtenForm: { contains: clean }, editorialStatus: 'published' },
        orderBy: { id: 'asc' },
        take: 6,
      });
    }
    const literals = [...new Set([...clean].filter((ch) => /[\u3400-\u9fff\uf900-\ufaff]/.test(ch)))];
    const kanjiRows =
      literals.length > 0
        ? await this.prisma.kanji.findMany({
            where: { literal: { in: literals }, status: 'published' },
            include: {
              meanings: { where: { isPrimary: true }, take: 1 },
              readings: true,
              curriculumLinks: { orderBy: { order: 'asc' }, take: 1 },
            },
          })
        : [];
    return {
      surface: clean,
      vocabulary: words.map((word) => ({
        id: word.id,
        writtenForm: word.writtenForm,
        reading: word.reading,
        romaji: word.romaji,
        meaningFr: word.meaningFr,
        partOfSpeech: word.partOfSpeech,
      })),
      kanji: kanjiRows.map((k) => ({
        literal: k.literal,
        level: (k.curriculumLinks[0]?.level ?? 'N5') as WordLookupResponse['kanji'][number]['level'],
        primaryMeaning: k.meanings[0]?.meaning ?? null,
        readings: [
          ...k.readings.filter((r) => r.readingType === 'onyomi').slice(0, 3),
          ...k.readings.filter((r) => r.readingType === 'kunyomi').slice(0, 3),
        ].map((r) => ({
          reading: r.reading,
          romaji: r.romaji,
          type: r.readingType as 'onyomi' | 'kunyomi',
        })),
      })),
    };
  }

  async kanjiRelated(literal: string): Promise<KanjiSummary[]> {
    const kanji = await this.prisma.kanji.findUnique({
      where: { literal },
      include: { notes: true, componentLinks: true },
    });
    if (!kanji) {
      throw new NotFoundException('Kanji introuvable');
    }
    const confusions = Array.isArray(kanji.notes?.confusions) ? (kanji.notes?.confusions as string[]) : [];
    const componentIds = kanji.componentLinks.map((link) => link.componentId);
    const shared =
      componentIds.length > 0
        ? await this.prisma.kanjiComponent.findMany({
            where: { componentId: { in: componentIds }, kanjiId: { not: kanji.id } },
            include: { kanji: true },
            distinct: ['kanjiId'],
            take: 10,
          })
        : [];
    const relatedLiterals = new Set(confusions);
    for (const link of shared) {
      relatedLiterals.add(link.kanji.literal);
    }
    const related = await this.prisma.kanji.findMany({
      where: { literal: { in: [...relatedLiterals] } },
      include: { curriculumLinks: { orderBy: { order: 'asc' }, take: 1 } },
    });
    return related.map((k) => {
      const link = k.curriculumLinks[0];
      return {
        id: k.id,
        literal: k.literal,
        unicodeCodepoint: k.unicodeCodepoint,
        strokeCount: k.strokeCount,
        frequencyRank: k.frequencyRank,
        schoolGrade: k.schoolGrade,
        level: (link?.level ?? 'N5') as KanjiSummary['level'],
        order: link?.order ?? 0,
        primaryMeaning: null,
        status: 'new' as const,
        overallScore: 0,
        nextDueAt: null,
      };
    });
  }

  async kanjiProgress(userId: string, literal: string): Promise<KanjiProgressDto> {
    const kanji = await this.prisma.kanji.findUnique({ where: { literal } });
    if (!kanji) {
      throw new NotFoundException('Kanji introuvable');
    }
    const progress = await this.prisma.userKanjiProgress.findUnique({
      where: { userId_kanjiId: { userId, kanjiId: kanji.id } },
    });
    const cards = await this.prisma.reviewCard.findMany({
      where: { userId, subjectType: 'kanji', subjectId: kanji.id },
    });
    return {
      kanjiId: kanji.id,
      literal: kanji.literal,
      status: progress?.status ?? 'new',
      scores: {
        meaning: progress?.meaningScore ?? 0,
        reading: progress?.readingScore ?? 0,
        vocabulary: progress?.vocabularyScore ?? 0,
        context: progress?.contextScore ?? 0,
        stroke: progress?.strokeScore ?? 0,
      },
      overallScore: progress?.overallScore ?? 0,
      masteredAt: progress?.masteredAt?.toISOString() ?? null,
      cards: cards.map((card) => ({
        skill: card.skill,
        state: card.state,
        dueAt: card.dueAt.toISOString(),
      })),
    };
  }

  async sources(): Promise<SourcesResponse> {
    const [sources, version] = await Promise.all([
      this.prisma.contentSource.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.contentVersion.findFirst({ orderBy: { publishedAt: 'desc' } }),
    ]);
    return {
      sources: sources.map((source) => ({
        id: source.id,
        name: source.name,
        url: source.url,
        license: source.license,
        attributionText: source.attributionText,
        sourceVersion: source.sourceVersion,
        importedAt: source.importedAt.toISOString(),
      })),
      contentVersion: version
        ? { version: version.version, publishedAt: version.publishedAt.toISOString(), notes: version.notes }
        : null,
    };
  }

  async textList(level?: string): Promise<MiniTextListResponse> {
    let filter: JlptLevel | null = null;
    if (level !== undefined && level !== null && level !== '') {
      if (!JLPT_LEVELS.includes(level as JlptLevel)) {
        throw new BadRequestException('Niveau invalide');
      }
      filter = level as JlptLevel;
    }
    const texts = await this.prisma.miniText.findMany({
      where: { editorialStatus: 'published', ...(filter ? { level: filter } : {}) },
      orderBy: [{ level: 'asc' }, { title: 'asc' }],
    });
    return {
      level: filter,
      texts: texts.map((text) => ({
        id: text.id,
        title: text.title,
        level: text.level,
        excerpt: `${Array.from(text.body).slice(0, 32).join('')}…`,
      })),
    };
  }

  async textDetail(id: string): Promise<MiniTextDetailDto> {
    const text = await this.prisma.miniText.findFirst({
      where: { id, editorialStatus: 'published' },
      include: { tokens: { orderBy: { startOffset: 'asc' } } },
    });
    if (!text) {
      throw new NotFoundException('Mini-texte introuvable');
    }
    return {
      id: text.id,
      title: text.title,
      body: text.body,
      translationFr: text.translationFr,
      level: text.level,
      author: text.author,
      license: text.license,
      tokens: text.tokens.map((token) => ({
        surface: token.surface,
        reading: token.reading,
        romaji: token.romaji,
      })),
    };
  }

  async createIssue(userId: string, body: unknown): Promise<void> {
    const parsed = body as { subjectType?: string; subjectRef?: string; message?: string };
    const allowed = ['kanji', 'vocabulary', 'sentence'];
    if (!parsed?.subjectType || !allowed.includes(parsed.subjectType) || !parsed?.subjectRef || !parsed?.message) {
      throw new BadRequestException('Signalement incomplet');
    }
    await this.prisma.contentIssue.create({
      data: {
        userId,
        subjectType: parsed.subjectType as never,
        subjectRef: parsed.subjectRef,
        message: parsed.message,
      },
    });
  }
}

export { PROGRESS_STATUS_ORDER };
