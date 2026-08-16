import fs from 'node:fs/promises';
import path from 'node:path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  JlptLevel,
  KanjiDetail,
  KanjiListResponse,
  KanjiMapLinkDto,
  KanjiMapResponse,
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
const KANJI_MAP_NODE_LIMIT = 24;

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
      where: { userId, subjectType: 'kanji', state: { not: 'Suspended' } },
      select: { subjectId: true, dueAt: true },
    });
    const nextDueByKanji = new Map<string, Date>();
    for (const card of cards) {
      const current = nextDueByKanji.get(card.subjectId);
      if (!current || card.dueAt < current) {
        nextDueByKanji.set(card.subjectId, card.dueAt);
      }
    }
    const audioResources = await this.prisma.audioResource.findMany({
      where: { editorialStatus: 'published' },
      select: {
        sentence: { select: { japanese: true } },
        vocabulary: { select: { kanjiLinks: { select: { kanjiId: true } } } },
      },
    });
    const audioKanjiIds = new Set<string>();
    for (const resource of audioResources) {
      for (const link of resource.vocabulary?.kanjiLinks ?? []) {
        audioKanjiIds.add(link.kanjiId);
      }
      if (resource.sentence) {
        for (const entry of entries) {
          if (resource.sentence.japanese.includes(entry.kanji.literal)) {
            audioKanjiIds.add(entry.kanjiId);
          }
        }
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
        hasAudio: audioKanjiIds.has(entry.kanjiId),
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
      where: { userId, subjectType: 'kanji', subjectId: kanji.id, state: { not: 'Suspended' } },
      orderBy: { dueAt: 'asc' },
    });
    const audio = await this.prisma.audioResource.findFirst({
      where: {
        editorialStatus: 'published',
        OR: [
          { sentence: { japanese: { contains: kanji.literal } } },
          { vocabulary: { kanjiLinks: { some: { kanjiId: kanji.id } } } },
        ],
      },
      select: { id: true },
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
      hasAudio: audio !== null,
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

  async kanjiMap(userId: string, literal: string): Promise<KanjiMapResponse> {
    const curriculum = await this.prisma.curriculum.findFirst({ where: { status: 'published' } });
    if (!curriculum) {
      throw new NotFoundException('Aucun curriculum publié');
    }
    const center = await this.prisma.kanji.findFirst({
      where: {
        literal,
        status: 'published',
        curriculumLinks: { some: { curriculumId: curriculum.id } },
      },
      include: {
        contentVersion: true,
        meanings: { where: { isPrimary: true }, take: 1 },
        notes: true,
        componentLinks: { include: { component: true } },
        curriculumLinks: { where: { curriculumId: curriculum.id }, take: 1 },
      },
    });
    if (!center) {
      throw new NotFoundException('Kanji introuvable');
    }
    const centerCurriculum = center.curriculumLinks[0];
    if (!centerCurriculum) {
      throw new NotFoundException('Kanji absent du curriculum publié');
    }

    const candidates: KanjiMapLinkDto[] = [];
    const componentIds = center.componentLinks.map((link) => link.componentId);
    if (componentIds.length > 0) {
      const shared = await this.prisma.kanjiComponent.findMany({
        where: {
          componentId: { in: componentIds },
          kanjiId: { not: center.id },
          kanji: {
            status: 'published',
            curriculumLinks: { some: { curriculumId: curriculum.id } },
          },
        },
        include: { component: true },
        orderBy: { kanjiId: 'asc' },
        take: KANJI_MAP_NODE_LIMIT * 4,
      });
      const labelsByKanji = new Map<string, { labels: string[]; sourceId: string | null }>();
      for (const link of shared) {
        const current = labelsByKanji.get(link.kanjiId) ?? { labels: [], sourceId: link.sourceId };
        current.labels.push(link.component.literal);
        labelsByKanji.set(link.kanjiId, current);
      }
      for (const [targetId, relation] of labelsByKanji) {
        candidates.push({
          sourceId: center.id,
          targetId,
          type: 'shared_component',
          label: `Composant partagé : ${relation.labels.join(', ')}`,
          provenance: { sourceId: relation.sourceId, contentVersion: center.contentVersion?.version ?? null },
        });
      }
    }

    const confusionLiterals =
      center.notes?.editorialStatus === 'published' && Array.isArray(center.notes.confusions)
      ? (center.notes.confusions as string[])
      : [];
    if (confusionLiterals.length > 0) {
      const confusions = await this.prisma.kanji.findMany({
        where: {
          literal: { in: confusionLiterals },
          status: 'published',
          curriculumLinks: { some: { curriculumId: curriculum.id } },
        },
        select: { id: true },
      });
      for (const confusion of confusions) {
        candidates.push({
          sourceId: center.id,
          targetId: confusion.id,
          type: 'visual_confusion',
          label: 'Confusion visuelle signalée',
          provenance: { sourceId: 'kanjipath_editorial', contentVersion: center.contentVersion?.version ?? null },
        });
      }
    }

    const sharedWords = await this.prisma.vocabularyKanji.findMany({
      where: { kanjiId: center.id, vocabulary: { editorialStatus: 'published' } },
      include: {
        vocabulary: {
          select: {
            writtenForm: true,
            sourceId: true,
            kanjiLinks: {
              where: {
                kanjiId: { not: center.id },
                kanji: {
                  status: 'published',
                  curriculumLinks: { some: { curriculumId: curriculum.id } },
                },
              },
              select: { kanjiId: true },
            },
          },
        },
      },
      orderBy: { vocabularyId: 'asc' },
      take: KANJI_MAP_NODE_LIMIT * 2,
    });
    const wordsByKanji = new Map<string, { labels: string[]; sourceId: string | null }>();
    for (const link of sharedWords) {
      for (const target of link.vocabulary.kanjiLinks) {
        const current = wordsByKanji.get(target.kanjiId) ?? { labels: [], sourceId: link.vocabulary.sourceId };
        current.labels.push(link.vocabulary.writtenForm);
        wordsByKanji.set(target.kanjiId, current);
      }
    }
    for (const [targetId, relation] of wordsByKanji) {
      candidates.push({
        sourceId: center.id,
        targetId,
        type: 'shared_word',
        label: `Mot partagé : ${relation.labels.slice(0, 3).join(', ')}`,
        provenance: { sourceId: relation.sourceId, contentVersion: center.contentVersion?.version ?? null },
      });
    }

    const neighbors = await this.prisma.curriculumKanji.findMany({
      where: {
        curriculumId: curriculum.id,
        level: centerCurriculum.level,
        order: { gte: Math.max(1, centerCurriculum.order - 2), lte: centerCurriculum.order + 2 },
        kanjiId: { not: center.id },
        kanji: { status: 'published' },
      },
      orderBy: { order: 'asc' },
    });
    for (const neighbor of neighbors) {
      candidates.push({
        sourceId: center.id,
        targetId: neighbor.kanjiId,
        type: 'curriculum_neighbor',
        label: 'Voisin dans le parcours',
        provenance: {
          sourceId: neighbor.sourceId ?? 'kanjipath_editorial',
          contentVersion: center.contentVersion?.version ?? null,
        },
      });
    }

    const links: KanjiMapLinkDto[] = [];
    const nodeIds = new Set<string>([center.id]);
    const seenLinks = new Set<string>();
    for (const candidate of candidates) {
      const key = `${candidate.targetId}:${candidate.type}`;
      if (seenLinks.has(key) || candidate.targetId === center.id) {
        continue;
      }
      if (!nodeIds.has(candidate.targetId) && nodeIds.size >= KANJI_MAP_NODE_LIMIT) {
        continue;
      }
      seenLinks.add(key);
      nodeIds.add(candidate.targetId);
      links.push(candidate);
    }

    const rows = await this.prisma.kanji.findMany({
      where: { id: { in: [...nodeIds] } },
      include: {
        meanings: { where: { isPrimary: true }, take: 1 },
        curriculumLinks: { where: { curriculumId: curriculum.id }, take: 1 },
      },
    });
    const progressRows = await this.prisma.userKanjiProgress.findMany({
      where: { userId, kanjiId: { in: [...nodeIds] } },
    });
    const progressByKanji = new Map(progressRows.map((progress) => [progress.kanjiId, progress]));
    const nodeById = new Map(
      rows.map((row) => {
        const progress = progressByKanji.get(row.id);
        return [
          row.id,
          {
            id: row.id,
            literal: row.literal,
            primaryMeaning: row.meanings[0]?.meaning ?? null,
            level: (row.curriculumLinks[0]?.level ?? 'N5') as KanjiMapResponse['nodes'][number]['level'],
            status: progress?.status ?? 'new',
            overallScore: progress?.overallScore ?? 0,
          },
        ];
      }),
    );

    return {
      centerId: center.id,
      limit: KANJI_MAP_NODE_LIMIT,
      nodes: [...nodeIds].flatMap((id) => {
        const node = nodeById.get(id);
        return node ? [node] : [];
      }),
      links: links.filter((link) => nodeById.has(link.targetId)),
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
      orderBy: [{ vocabulary: { writtenForm: 'asc' } }, { vocabularyId: 'asc' }, { position: 'asc' }],
      include: { vocabulary: { include: { audioResources: { where: { editorialStatus: 'published' } } } } },
    });
    const uniqueLinks = new Map<string, (typeof links)[number]>();
    for (const link of links) {
      if (!uniqueLinks.has(link.vocabularyId)) {
        uniqueLinks.set(link.vocabularyId, link);
      }
    }
    return [...uniqueLinks.values()].map((link) => ({
      id: link.vocabulary.id,
      writtenForm: link.vocabulary.writtenForm,
      reading: link.vocabulary.reading,
      romaji: link.vocabulary.romaji,
      meaningFr: link.vocabulary.meaningFr,
      partOfSpeech: link.vocabulary.partOfSpeech,
      readingInWord: link.readingInWord,
      audio: link.vocabulary.audioResources[0]
        ? {
            id: link.vocabulary.audioResources[0].id,
            url: `/audio/${link.vocabulary.audioResources[0].id}`,
            transcript: link.vocabulary.audioResources[0].transcript,
            attribution: link.vocabulary.audioResources[0].attributionText,
            license: link.vocabulary.audioResources[0].license,
          }
        : null,
    }));
  }

  async kanjiSentences(literal: string): Promise<KanjiSentenceDto[]> {
    const kanji = await this.prisma.kanji.findUnique({ where: { literal } });
    if (!kanji) {
      throw new NotFoundException('Kanji introuvable');
    }
    const audioSentences = await this.prisma.sentence.findMany({
      where: {
        japanese: { contains: kanji.literal },
        editorialStatus: 'published',
        audioResources: { some: { editorialStatus: 'published' } },
      },
      orderBy: { id: 'asc' },
      take: 20,
      include: {
        tokens: { orderBy: { startOffset: 'asc' } },
        audioResources: { where: { editorialStatus: 'published' } },
      },
    });
    const remaining = 20 - audioSentences.length;
    const sentences =
      remaining > 0
        ? [
            ...audioSentences,
            ...(await this.prisma.sentence.findMany({
              where: {
                japanese: { contains: kanji.literal },
                editorialStatus: 'published',
                audioResources: { none: { editorialStatus: 'published' } },
              },
              orderBy: { id: 'asc' },
              take: remaining,
              include: {
                tokens: { orderBy: { startOffset: 'asc' } },
                audioResources: { where: { editorialStatus: 'published' } },
              },
            })),
          ]
        : audioSentences;
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
      audio: sentence.audioResources[0]
        ? {
            id: sentence.audioResources[0].id,
            url: `/audio/${sentence.audioResources[0].id}`,
            transcript: sentence.audioResources[0].transcript,
            attribution: sentence.audioResources[0].attributionText,
            license: sentence.audioResources[0].license,
          }
        : null,
    }));
  }

  async audio(id: string): Promise<Buffer> {
    const resource = await this.prisma.audioResource.findFirst({
      where: { id, editorialStatus: 'published' },
    });
    if (!resource) {
      throw new NotFoundException('Audio introuvable');
    }
    const filePath = path.resolve(contentRoot(), 'generated', resource.filePath);
    const allowedRoot = path.resolve(contentRoot(), 'generated', 'audio');
    if (!filePath.startsWith(allowedRoot)) {
      throw new NotFoundException('Audio introuvable');
    }
    return fs.readFile(filePath).catch(() => {
      throw new NotFoundException('Fichier audio introuvable');
    });
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
    const audioResources = await this.prisma.audioResource.findMany({
      where: { editorialStatus: 'published' },
      select: {
        sentence: { select: { japanese: true } },
        vocabulary: { select: { kanjiLinks: { select: { kanjiId: true } } } },
      },
    });
    const audioKanjiIds = new Set<string>();
    for (const resource of audioResources) {
      for (const link of resource.vocabulary?.kanjiLinks ?? []) {
        audioKanjiIds.add(link.kanjiId);
      }
      if (resource.sentence) {
        for (const item of related) {
          if (resource.sentence.japanese.includes(item.literal)) {
            audioKanjiIds.add(item.id);
          }
        }
      }
    }
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
        hasAudio: audioKanjiIds.has(k.id),
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
        listening: progress?.listeningScore ?? 0,
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

  async markKanjiKnown(userId: string, literal: string): Promise<KanjiProgressDto> {
    const kanji = await this.prisma.kanji.findUnique({ where: { literal }, select: { id: true } });
    if (!kanji) {
      throw new NotFoundException('Kanji introuvable');
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.userKanjiProgress.upsert({
        where: { userId_kanjiId: { userId, kanjiId: kanji.id } },
        create: {
          userId,
          kanjiId: kanji.id,
          meaningScore: 1,
          readingScore: 1,
          vocabularyScore: 1,
          contextScore: 1,
          strokeScore: 1,
          listeningScore: 1,
          overallScore: 1,
          status: 'mastered',
          firstSeenAt: now,
          masteredAt: now,
        },
        update: {
          meaningScore: 1,
          readingScore: 1,
          vocabularyScore: 1,
          contextScore: 1,
          strokeScore: 1,
          listeningScore: 1,
          overallScore: 1,
          status: 'mastered',
          masteredAt: now,
        },
      });
      await tx.$executeRaw`
        UPDATE \`review_cards\`
        SET \`state_before_suspension\` = \`state\`, \`state\` = 'Suspended'
        WHERE \`user_id\` = ${userId}
          AND \`subject_type\` = 'kanji'
          AND \`subject_id\` = ${kanji.id}
          AND \`state\` <> 'Suspended'
      `;
      await tx.studySessionItem.updateMany({
        where: {
          status: 'pending',
          session: { userId, endedAt: null },
          exerciseItem: { kanjiId: kanji.id },
        },
        data: { status: 'skipped' },
      });
    });
    return this.kanjiProgress(userId, literal);
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
        id: token.id,
        surface: token.surface,
        reading: token.reading,
        romaji: token.romaji,
        startOffset: token.startOffset,
        endOffset: token.endOffset,
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
