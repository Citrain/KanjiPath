import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { CsrfGuard } from './infrastructure/security/csrf.guard';
import { AiQuizModule } from './modules/ai-quiz/ai-quiz.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContentModule } from './modules/content/content.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { CurriculaModule } from './modules/curricula/curricula.module';
import { PersonalVocabularyModule } from './modules/personal-vocabulary/personal-vocabulary.module';
import { ProgressModule } from './modules/progress/progress.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ShadowingModule } from './modules/shadowing/shadowing.module';
import { StudyModule } from './modules/study/study.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 15 * 60 * 1000, limit: 300 }]),
    PrismaModule,
    AuthModule,
    AiQuizModule,
    ContentModule,
    ConversationModule,
    CurriculaModule,
    StudyModule,
    ProgressModule,
    PersonalVocabularyModule,
    SettingsModule,
    ShadowingModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
