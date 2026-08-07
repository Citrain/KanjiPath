import type { CurriculaResponse, CurriculumLevelResponse } from '@kanjipath/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const LEVEL_NAMES: Record<string, string> = {
  N5: 'Parcours aligné sur le JLPT — N5 (débutant)',
  N4: 'Parcours aligné sur le JLPT — N4',
  N3: 'Parcours aligné sur le JLPT — N3',
  N2: 'Parcours aligné sur le JLPT — N2',
  N1: 'Parcours aligné sur le JLPT — N1',
};

@Injectable()
export class CurriculaService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<CurriculaResponse> {
    const curricula = await this.prisma.curriculum.findMany({
      orderBy: { version: 'asc' },
      include: { kanjiLinks: { select: { level: true }, distinct: ['level'] } },
    });
    return {
      curricula: curricula.map((curriculum) => ({
        code: curriculum.code,
        name: curriculum.name,
        version: curriculum.version,
        status: curriculum.status,
        publishedAt: curriculum.publishedAt?.toISOString() ?? null,
        levels: curriculum.kanjiLinks.map(
          (link) => link.level,
        ) as CurriculaResponse['curricula'][number]['levels'],
      })),
    };
  }

  async levels(code: string) {
    const curriculum = await this.prisma.curriculum.findUnique({ where: { code } });
    if (!curriculum) {
      throw new NotFoundException('Curriculum introuvable');
    }
    const links = await this.prisma.curriculumKanji.groupBy({
      by: ['level'],
      where: { curriculumId: curriculum.id },
      _count: { _all: true },
    });
    return {
      code: curriculum.code,
      name: curriculum.name,
      levels: links.map((link) => ({ level: link.level, kanjiCount: link._count._all })),
    };
  }

  async level(code: string, level: string): Promise<CurriculumLevelResponse> {
    const curriculum = await this.prisma.curriculum.findUnique({ where: { code } });
    if (!curriculum) {
      throw new NotFoundException('Curriculum introuvable');
    }
    const entries = await this.prisma.curriculumKanji.findMany({
      where: { curriculumId: curriculum.id, level: level as never },
      orderBy: { order: 'asc' },
      include: { kanji: { select: { id: true, literal: true } } },
    });
    return {
      code: curriculum.code,
      level: level as CurriculumLevelResponse['level'],
      displayName: LEVEL_NAMES[level] ?? `Parcours aligné sur le JLPT — ${level}`,
      entries: entries.map((entry) => ({
        kanjiId: entry.kanjiId,
        literal: entry.kanji.literal,
        order: entry.order,
        confidence: entry.confidence,
      })),
    };
  }
}
