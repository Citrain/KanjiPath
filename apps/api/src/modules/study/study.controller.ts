import { type CreateSessionInput, createSessionSchema } from '@kanjipath/contracts';
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
  try {
    return createSessionSchema.parse(body ?? {});
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
