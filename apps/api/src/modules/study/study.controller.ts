import {
  type CreateSessionInput,
  createSessionSchema,
  updateDailyMissionStepSchema,
} from '@kanjipath/contracts';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { CurrentUserId } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { StudyService } from './study.service';

@Controller('study')
@UseGuards(SessionAuthGuard)
export class StudyController {
  constructor(private readonly study: StudyService) {}

  @Post('sessions')
  createSession(@CurrentUserId() userId: string, @Body() body: unknown) {
    return this.study.createSession(userId, parseCreateSession(body));
  }

  @Get('resume')
  resume(@CurrentUserId() userId: string) {
    return this.study.resume(userId);
  }

  @Get('sessions/:id')
  session(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.study.getSession(userId, id);
  }

  @Get('missions/today')
  dailyMission(@CurrentUserId() userId: string) {
    return this.study.dailyMission(userId);
  }

  @Post('missions/today')
  createDailyMission(@CurrentUserId() userId: string) {
    return this.study.createDailyMission(userId);
  }

  @Post('missions/:missionId/steps/:stepId')
  updateDailyMissionStep(
    @CurrentUserId() userId: string,
    @Param('missionId') missionId: string,
    @Param('stepId') stepId: string,
    @Body() body: unknown,
  ) {
    return this.study.updateDailyMissionStep(
      userId,
      missionId,
      stepId,
      parse(body, updateDailyMissionStepSchema),
    );
  }

  @Get('queue')
  queue(@CurrentUserId() userId: string) {
    return this.study.resume(userId);
  }

  @Post('answers')
  answer(@CurrentUserId() userId: string, @Body() body: never) {
    return this.study.answer(userId, body);
  }

  @Post('sessions/:id/finish')
  @HttpCode(204)
  async finish(@CurrentUserId() userId: string, @Param('id') id: string) {
    await this.study.finish(userId, id);
  }

  @Post('sessions/:id/abandon')
  @HttpCode(204)
  async abandon(@CurrentUserId() userId: string, @Param('id') id: string) {
    await this.study.abandon(userId, id);
  }
}

function parseCreateSession(body: unknown): CreateSessionInput {
  return parse(body, createSessionSchema);
}

function parse<T>(body: unknown, schema: { parse(value: unknown): T }): T {
  try {
    return schema.parse(body ?? {});
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Données invalides',
        details: error.issues,
      });
    }
    throw error;
  }
}
