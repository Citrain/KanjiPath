import type { ApiHealth } from '@kanjipath/contracts';
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class AppController {
  @Get()
  health(): ApiHealth {
    return { status: 'ok', service: 'kanjipath-api', timestamp: new Date().toISOString() };
  }
}
