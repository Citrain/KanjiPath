import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ProgressService } from '../progress/progress.service';
import { CurriculaService } from './curricula.service';

@Controller('curricula')
@UseGuards(SessionAuthGuard)
export class CurriculaController {
  constructor(
    private readonly curricula: CurriculaService,
    private readonly progress: ProgressService,
  ) {}

  @Get()
  list() {
    return this.curricula.list();
  }

  @Get(':code/levels')
  levels(@Param('code') code: string) {
    return this.curricula.levels(code);
  }

  @Get(':code/levels/:level')
  level(@Param('code') code: string, @Param('level') level: string) {
    return this.curricula.level(code, level);
  }

  @Get(':code/levels/:level/progress')
  levelProgress(@CurrentUserId() userId: string, @Param('level') level: string) {
    return this.progress.levelProgress(userId, level);
  }
}
