import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { StudyService } from './study.service';

@Controller('study')
@UseGuards(SessionAuthGuard)
export class StudyController {
  constructor(private readonly study: StudyService) {}

  @Post('sessions')
  createSession(@CurrentUserId() userId: string, @Body() body: { mode?: string }) {
    return this.study.createSession(userId, body?.mode ?? 'daily');
  }

  @Get('resume')
  resume(@CurrentUserId() userId: string) {
    return this.study.resume(userId);
  }

  @Get('queue')
  queue(@CurrentUserId() userId: string) {
    return this.study.resume(userId);
  }

  @Post('answers')
  answer(@CurrentUserId() userId: string, @Body() body: never) {
    return this.study.answer(userId, body);
  }

  @Post('sessions/:id/finish')
  @HttpCode(204)
  async finish(@CurrentUserId() userId: string, @Param('id') id: string) {
    await this.study.finish(userId, id);
  }
}
