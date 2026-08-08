import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ProgressService } from './progress.service';

@Controller('progress')
@UseGuards(SessionAuthGuard)
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('dashboard')
  dashboard(@CurrentUserId() userId: string) {
    return this.progress.dashboard(userId);
  }

  @Get('levels/:level')
  levelProgress(@CurrentUserId() userId: string, @Param('level') level: string) {
    return this.progress.levelProgress(userId, level);
  }

  @Get('weak-points')
  weakPoints(@CurrentUserId() userId: string) {
    return this.progress.weakPoints(userId);
  }

  @Get('history')
  history(@CurrentUserId() userId: string) {
    return this.progress.history(userId);
  }

  @Get('stats')
  stats(@CurrentUserId() userId: string) {
    return this.progress.stats(userId);
  }
}
