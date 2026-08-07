import { Controller, Get, Header, HttpCode, Param, Post, Body, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { ContentService } from './content.service';

@Controller()
@UseGuards(SessionAuthGuard)
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('kanji')
  kanjiList(@CurrentUserId() userId: string, @Query('level') level?: string) {
    return this.content.kanjiList(userId, level ?? 'N5');
  }

  @Get('kanji/:literal')
  kanjiDetail(@CurrentUserId() userId: string, @Param('literal') literal: string) {
    return this.content.kanjiDetail(userId, literal);
  }

  @Get('kanji/:literal/svg')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @Header('X-Content-Type-Options', 'nosniff')
  async kanjiSvg(@Param('literal') literal: string) {
    const { svg } = await this.content.kanjiSvg(literal);
    return svg;
  }

  @Get('kanji/:literal/vocabulary')
  async kanjiVocabulary(@Param('literal') literal: string) {
    return { vocabulary: await this.content.kanjiVocabulary(literal) };
  }

  @Get('kanji/:literal/sentences')
  async kanjiSentences(@Param('literal') literal: string) {
    return { sentences: await this.content.kanjiSentences(literal) };
  }

  @Get('kanji/:literal/related')
  async kanjiRelated(@Param('literal') literal: string) {
    return { related: await this.content.kanjiRelated(literal) };
  }

  @Get('kanji/:literal/progress')
  kanjiProgress(@CurrentUserId() userId: string, @Param('literal') literal: string) {
    return this.content.kanjiProgress(userId, literal);
  }

  @Get('sources')
  sources() {
    return this.content.sources();
  }

  @Post('content/issues')
  @HttpCode(204)
  async createIssue(@CurrentUserId() userId: string, @Body() body: unknown) {
    await this.content.createIssue(userId, body);
  }
}
