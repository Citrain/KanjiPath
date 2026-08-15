import { createConversationSchema, processConversationTurnSchema } from '@kanjipath/contracts';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { CurrentUserId } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ConversationConfig } from './conversation.config';
import { ConversationOrchestrator } from './conversation.orchestrator';
import {
  JAPANESE_TTS_PROVIDER,
  type JapaneseTtsProvider,
  LLM_PROVIDER,
  type LlmProvider,
  type SpeechToTextProvider,
  STT_PROVIDER,
} from './conversation.providers';

const TOPICS = [
  {
    id: 'free',
    label: 'Libre',
    description: 'Laisser la situation se construire ou la préciser dans votre objectif.',
  },
  {
    id: 'introduction',
    label: 'Se présenter',
    description: 'Dire qui vous êtes et faire connaissance.',
  },
  {
    id: 'restaurant',
    label: 'Restaurant',
    description: 'Commander et échanger avec le personnel.',
  },
  { id: 'shop', label: 'Magasin', description: 'Demander un produit et payer.' },
  { id: 'travel', label: 'Voyage', description: 'Se déplacer et demander son chemin.' },
  { id: 'work', label: 'Travail', description: 'Échanger dans un contexte professionnel.' },
  { id: 'leisure', label: 'Loisirs', description: 'Parler de ses activités.' },
  { id: 'video_games', label: 'Jeux vidéo', description: 'Discuter de jeux et de préférences.' },
  { id: 'family', label: 'Famille', description: 'Présenter sa famille.' },
] as const;

@Controller()
@UseGuards(SessionAuthGuard)
export class ConversationController {
  constructor(
    private readonly orchestrator: ConversationOrchestrator,
    private readonly config: ConversationConfig,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    @Inject(STT_PROVIDER) private readonly stt: SpeechToTextProvider,
    @Inject(JAPANESE_TTS_PROVIDER) private readonly japaneseTts: JapaneseTtsProvider,
  ) {}

  @Post('conversations')
  create(@CurrentUserId() userId: string, @Body() body: unknown) {
    return this.orchestrator.createSession(userId, parse(body, createConversationSchema));
  }

  @Get('conversations/:id')
  get(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.orchestrator.getSession(userId, id);
  }

  @Get('conversations')
  history(@CurrentUserId() userId: string) {
    return this.orchestrator.history(userId);
  }

  @Post('conversations/:id/turns')
  turn(@CurrentUserId() userId: string, @Param('id') id: string, @Body() body: unknown) {
    return this.orchestrator.processTextTurn(
      userId,
      id,
      parse(body, processConversationTurnSchema),
    );
  }

  @Post('conversations/:id/end')
  @HttpCode(204)
  async end(@CurrentUserId() userId: string, @Param('id') id: string): Promise<void> {
    await this.orchestrator.endSession(userId, id);
  }

  @Post('conversations/:id/reopen')
  reopen(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.orchestrator.reopenSession(userId, id);
  }

  @Get('conversation-topics')
  topics() {
    return { topics: TOPICS };
  }

  @Get('conversation-settings')
  settings() {
    const values = this.config.values;
    return {
      enabled: values.enabled,
      defaultLevel: values.defaultLevel,
      defaultDifficulty: values.defaultDifficulty,
      defaultCorrectionMode: values.defaultCorrectionMode,
      maxTurnSeconds: values.maxTurnSeconds,
    };
  }

  @Get('conversation-progress')
  progress(@CurrentUserId() userId: string) {
    return this.orchestrator.progress(userId);
  }

  @Get('voices/ja')
  async voices() {
    return { voices: await this.japaneseTts.voices().catch(() => []) };
  }

  @Get('local-ai/health')
  async health() {
    const [ollama, stt, japaneseTts] = await Promise.all([
      this.llm.health(),
      this.stt.health(),
      this.japaneseTts.health(),
    ]);
    return { enabled: this.config.values.enabled, ollama, stt, japaneseTts };
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
