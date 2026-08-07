import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProgressModule } from '../progress/progress.module';
import { CurriculaController } from './curricula.controller';
import { CurriculaService } from './curricula.service';

@Module({
  imports: [AuthModule, ProgressModule],
  controllers: [CurriculaController],
  providers: [CurriculaService],
})
export class CurriculaModule {}
