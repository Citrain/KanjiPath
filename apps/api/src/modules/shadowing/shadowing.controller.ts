import {
  JAPANESE_SPEECH_SPEEDS,
  shadowingCompareSchema,
  shadowingSaveResultSchema,
  shadowingTargetsQuerySchema,
  shadowingTranscribeSchema,
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
import { ZodError, z } from 'zod';
import { CurrentUserId } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ShadowingService } from './shadowing.service';

const ttsSpeedSchema = z.object({
  speed: z.enum(JAPANESE_SPEECH_SPEEDS).optional(),
});

@Controller('shadowing')
@UseGuards(SessionAuthGuard)
export class ShadowingController {
  constructor(private readonly shadowing: ShadowingService) {}

  @Get('targets')
  targets(@Query() query: unknown) {
    return this.shadowing.targets(parse(query, shadowingTargetsQuerySchema));
  }

  @Get('targets/:id/tts')
  ttsAudio(@Param('id') id: string, @Query() query: unknown) {
    const { speed } = parse(query, ttsSpeedSchema);
    return this.shadowing.ttsAudio(id, speed);
  }

  @Post('transcribe')
  transcribe(@Body() body: unknown) {
    return this.shadowing.transcribe(parse(body, shadowingTranscribeSchema));
  }

  @Post('compare')
  compare(@Body() body: unknown) {
    const input = parse(body, shadowingCompareSchema);
    return this.shadowing.compare(input.sentenceId, input.transcript);
  }

  @Post('results')
  saveResult(@CurrentUserId() userId: string, @Body() body: unknown) {
    return this.shadowing.saveResult(userId, parse(body, shadowingSaveResultSchema));
  }

  @Get('results')
  results(@CurrentUserId() userId: string) {
    return this.shadowing.results(userId);
  }

  @Delete('results')
  @HttpCode(204)
  async clearResults(@CurrentUserId() userId: string): Promise<void> {
    await this.shadowing.clearResults(userId);
  }

  @Delete('results/:id')
  @HttpCode(204)
  async deleteResult(@CurrentUserId() userId: string, @Param('id') id: string): Promise<void> {
    await this.shadowing.deleteResult(userId, id);
  }
}

function parse<T>(body: unknown, schema: { parse(value: unknown): T }): T {
  try {
    return schema.parse(body ?? {});
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Données de shadowing invalides',
        details: error.issues,
      });
    }
    throw error;
  }
}
