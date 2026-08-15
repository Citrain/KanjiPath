import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PersonalVocabularyController } from './personal-vocabulary.controller';
import { PersonalVocabularyService } from './personal-vocabulary.service';

@Module({
  imports: [AuthModule],
  controllers: [PersonalVocabularyController],
  providers: [PersonalVocabularyService],
})
export class PersonalVocabularyModule {}
