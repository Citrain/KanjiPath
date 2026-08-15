import {
  answerPersonalVocabularySchema,
  createPersonalVocabularyEntrySchema,
} from '@kanjipath/contracts';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { CurrentUserId } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PersonalVocabularyService } from './personal-vocabulary.service';

@Controller('personal-vocabulary')
@UseGuards(SessionAuthGuard)
export class PersonalVocabularyController {
  constructor(private readonly personalVocabulary: PersonalVocabularyService) {}

  @Get()
  list(@CurrentUserId() userId: string, @Query('archived') archived?: string) {
    return this.personalVocabulary.list(userId, archived === 'true' ? 'archived' : 'active');
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() body: unknown) {
    return this.personalVocabulary.create(userId, parse(body, createPersonalVocabularyEntrySchema));
  }

  @Post(':id/archive')
  archive(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.personalVocabulary.archive(userId, id);
  }

  @Post(':id/restore')
  restore(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.personalVocabulary.restore(userId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    await this.personalVocabulary.remove(userId, id);
  }

  @Post('sessions')
  createSession(@CurrentUserId() userId: string) {
    return this.personalVocabulary.createSession(userId);
  }

  @Get('resume')
  resume(@CurrentUserId() userId: string) {
    return this.personalVocabulary.resume(userId);
  }

  @Post('answers')
  answer(@CurrentUserId() userId: string, @Body() body: unknown) {
    return this.personalVocabulary.answer(userId, parse(body, answerPersonalVocabularySchema));
  }

  @Post('sessions/:id/finish')
  @HttpCode(204)
  async finish(@CurrentUserId() userId: string, @Param('id') id: string) {
    await this.personalVocabulary.finish(userId, id);
  }

  @Post('sessions/:id/abandon')
  @HttpCode(204)
  async abandon(@CurrentUserId() userId: string, @Param('id') id: string) {
    await this.personalVocabulary.abandon(userId, id);
  }
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
