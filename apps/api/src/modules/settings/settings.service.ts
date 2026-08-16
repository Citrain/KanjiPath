import {
  type ImmersionHelpLevel,
  type SettingsDto,
  type UpdateSettingsInput,
  updateSettingsSchema,
} from '@kanjipath/contracts';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ZodError } from 'zod';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { recommendImmersionHelp } from './immersion';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<SettingsDto> {
    const [settings, discoveredKanji, masteredKanji] = await Promise.all([
      this.prisma.userSettings.upsert({
        where: { userId },
        create: { userId },
        update: {},
      }),
      this.prisma.userKanjiProgress.count({ where: { userId } }),
      this.prisma.userKanjiProgress.count({ where: { userId, status: 'mastered' } }),
    ]);
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
      immersionEnabled: settings.immersionEnabled,
      immersionHelpLevel: (settings.immersionHelpLevel as ImmersionHelpLevel | null) ?? null,
      immersionRecommendation: recommendImmersionHelp({
        romajiEnabled: settings.romajiEnabled,
        furiganaMode: settings.furiganaMode as SettingsDto['furiganaMode'],
        discoveredKanji,
        masteredKanji,
      }),
    };
  }

  async patch(userId: string, body: unknown): Promise<SettingsDto> {
    let patch: UpdateSettingsInput;
    try {
      patch = updateSettingsSchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.issues
          .map((issue) => `${issue.path.join('.') || 'body'} : ${issue.message}`)
          .join(' ; ');
        throw new BadRequestException(message);
      }
      throw error;
    }

    const data: Record<string, unknown> = {};
    if (patch.activeLevel !== undefined) {
      data.activeLevel = patch.activeLevel;
    }
    if (patch.dailyNewLimit !== undefined) {
      data.dailyNewLimit = patch.dailyNewLimit;
    }
    if (patch.reviewLimit !== undefined) {
      data.reviewLimit = patch.reviewLimit;
    }
    if (patch.autoBalance !== undefined) {
      data.autoBalance = patch.autoBalance;
    }
    if (patch.kanaInputEnabled !== undefined) {
      data.kanaInputEnabled = patch.kanaInputEnabled;
    }
    if (patch.desiredRetention !== undefined) {
      data.desiredRetention = patch.desiredRetention;
    }
    if (patch.furiganaMode !== undefined) {
      data.furiganaMode = patch.furiganaMode;
    }
    if (patch.romajiEnabled !== undefined) {
      data.romajiEnabled = patch.romajiEnabled;
    }
    if (patch.timezone !== undefined) {
      data.timezone = patch.timezone;
    }
    if (patch.theme !== undefined) {
      data.theme = patch.theme;
    }
    if (patch.immersionEnabled !== undefined) {
      data.immersionEnabled = patch.immersionEnabled;
    }
    if (patch.immersionHelpLevel !== undefined) {
      data.immersionHelpLevel = patch.immersionHelpLevel;
    }

    await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return this.get(userId);
  }
}
