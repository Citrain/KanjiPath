import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConversationModule } from '../conversation/conversation.module';
import { AiQuizController } from './ai-quiz.controller';
import { AiQuizOrchestrator } from './ai-quiz.orchestrator';

@Module({
  imports: [AuthModule, ConversationModule],
  controllers: [AiQuizController],
  providers: [AiQuizOrchestrator],
})
export class AiQuizModule {}
