import { FURIGANA_MODES, JLPT_LEVELS, type SettingsDto } from '@kanjipath/contracts';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<SettingsDto> {
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return {
      activeLevel: settings.activeLevel as SettingsDto['activeLevel'],
      dailyNewLimit: settings.dailyNewLimit,
      reviewLimit: settings.reviewLimit,
      autoBalance: settings.autoBalance,
      kanaInputEnabled: settings.kanaInputEnabled,
      desiredRetention: settings.desiredRetention,
      furiganaMode: settings.furiganaMode as SettingsDto['furiganaMode'],
      romajiEnabled: settings.romajiEnabled,
      timezone: settings.timezone,
      theme: settings.theme,
    };
  }

  async patch(userId: string, body: unknown): Promise<SettingsDto> {
    const patch = body as Partial<SettingsDto>;
    const data: Record<string, unknown> = {};
    if (patch.activeLevel !== undefined) {
      if (!JLPT_LEVELS.includes(patch.activeLevel)) {
        throw new BadRequestException('Niveau invalide');
      }
      data.activeLevel = patch.activeLevel;
    }
    if (patch.dailyNewLimit !== undefined) {
      if (
        !Number.isInteger(patch.dailyNewLimit) ||
        patch.dailyNewLimit < 1 ||
        patch.dailyNewLimit > 50
      ) {
        throw new BadRequestException('dailyNewLimit doit être entre 1 et 50');
      }
      data.dailyNewLimit = patch.dailyNewLimit;
    }
    if (patch.reviewLimit !== undefined) {
      if (
        !Number.isInteger(patch.reviewLimit) ||
        patch.reviewLimit < 5 ||
        patch.reviewLimit > 200
      ) {
        throw new BadRequestException('reviewLimit doit être entre 5 et 200');
      }
      data.reviewLimit = patch.reviewLimit;
    }
    if (patch.autoBalance !== undefined) {
      data.autoBalance = Boolean(patch.autoBalance);
    }
    if (patch.kanaInputEnabled !== undefined) {
      if (typeof patch.kanaInputEnabled !== 'boolean') {
        throw new BadRequestException('kanaInputEnabled doit être un booléen');
      }
      data.kanaInputEnabled = patch.kanaInputEnabled;
    }
    if (patch.desiredRetention !== undefined) {
      if (patch.desiredRetention < 0.7 || patch.desiredRetention > 0.99) {
        throw new BadRequestException('desiredRetention doit être entre 0.7 et 0.99');
      }
      data.desiredRetention = patch.desiredRetention;
    }
    if (patch.furiganaMode !== undefined) {
      if (!FURIGANA_MODES.includes(patch.furiganaMode)) {
        throw new BadRequestException('furiganaMode invalide');
      }
      data.furiganaMode = patch.furiganaMode;
    }
    if (patch.romajiEnabled !== undefined) {
      data.romajiEnabled = Boolean(patch.romajiEnabled);
    }
    if (patch.timezone !== undefined && typeof patch.timezone === 'string') {
      data.timezone = patch.timezone;
    }
    if (patch.theme !== undefined && typeof patch.theme === 'string') {
      data.theme = patch.theme;
    }
    await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return this.get(userId);
  }
}
