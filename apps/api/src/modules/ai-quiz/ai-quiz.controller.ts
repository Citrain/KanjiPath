import { createAiQuizSchema, submitAiQuizAnswerSchema } from '@kanjipath/contracts';
import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ZodError } from 'zod';
import { CurrentUserId } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AiQuizOrchestrator } from './ai-quiz.orchestrator';

@Controller('ai-quizzes')
@UseGuards(SessionAuthGuard)
export class AiQuizController {
  constructor(private readonly orchestrator: AiQuizOrchestrator) {}

  @Post()
  create(@CurrentUserId() userId: string, @Body() body: unknown) {
    return this.orchestrator.create(userId, parse(body, createAiQuizSchema));
  }

  @Get()
  history(@CurrentUserId() userId: string) {
    return this.orchestrator.history(userId);
  }

  @Get(':id')
  get(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.orchestrator.get(userId, id);
  }

  @Post(':id/answers')
  answer(@CurrentUserId() userId: string, @Param('id') id: string, @Body() body: unknown) {
    return this.orchestrator.answer(userId, id, parse(body, submitAiQuizAnswerSchema));
  }

  @Post(':id/finish')
  finish(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.orchestrator.finish(userId, id);
  }

  @Get(':id/questions/:key/audio')
  audio(@CurrentUserId() userId: string, @Param('id') id: string, @Param('key') key: string) {
    return this.orchestrator.audio(userId, id, key);
  }
}

function parse<T>(body: unknown, schema: { parse(value: unknown): T }): T {
  try {
    return schema.parse(body ?? {});
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Données de quiz invalides',
        details: error.issues,
      });
    }
    throw error;
  }
}
