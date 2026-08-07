import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(SessionAuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@CurrentUserId() userId: string) {
    return this.settings.get(userId);
  }

  @Patch()
  patch(@CurrentUserId() userId: string, @Body() body: unknown) {
    return this.settings.patch(userId, body);
  }
}
