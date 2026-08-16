import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConversationConfig } from './conversation.config';
import { ConversationController } from './conversation.controller';
import { ConversationLiveGateway } from './conversation.live-gateway';
import { ConversationOrchestrator } from './conversation.orchestrator';
import {
  BrowserFrenchTtsProvider,
  FasterWhisperProvider,
  FRENCH_TTS_PROVIDER,
  JAPANESE_TTS_PROVIDER,
  LLM_PROVIDER,
  OllamaProvider,
  STT_PROVIDER,
  VoicevoxProvider,
} from './conversation.providers';

@Module({
  imports: [AuthModule],
  controllers: [ConversationController],
  providers: [
    ConversationConfig,
    ConversationOrchestrator,
    ConversationLiveGateway,
    OllamaProvider,
    FasterWhisperProvider,
    VoicevoxProvider,
    BrowserFrenchTtsProvider,
    { provide: LLM_PROVIDER, useExisting: OllamaProvider },
    { provide: STT_PROVIDER, useExisting: FasterWhisperProvider },
    { provide: JAPANESE_TTS_PROVIDER, useExisting: VoicevoxProvider },
    { provide: FRENCH_TTS_PROVIDER, useExisting: BrowserFrenchTtsProvider },
  ],
  exports: [
    ConversationConfig,
    ConversationOrchestrator,
    LLM_PROVIDER,
    STT_PROVIDER,
    JAPANESE_TTS_PROVIDER,
  ],
})
export class ConversationModule {}
