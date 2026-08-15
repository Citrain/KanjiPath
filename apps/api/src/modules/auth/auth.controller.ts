import type { ApiAuthResponse } from '@kanjipath/contracts';
import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { CurrentUserId } from './current-user.decorator';
import { SESSION_COOKIE_NAME, SessionAuthGuard } from './session-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.register(body);
    setSessionCookie(reply, result.sessionToken);
    const response: ApiAuthResponse = { user: result.user };
    return response;
  }

  @Post('login')
  async login(@Body() body: unknown, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.login(body);
    setSessionCookie(reply, result.sessionToken);
    const response: ApiAuthResponse = { user: result.user };
    return response;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const token = request.cookies?.[SESSION_COOKIE_NAME];
    if (typeof token === 'string') {
      await this.auth.logout(token);
    }
    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  async me(@CurrentUserId() userId: string) {
    const user = await this.auth.me(userId);
    const response: ApiAuthResponse = { user };
    return response;
  }

  @Post('password/change')
  @UseGuards(SessionAuthGuard)
  @HttpCode(204)
  async changePassword(@CurrentUserId() userId: string, @Body() body: unknown) {
    await this.auth.changePassword(userId, body);
  }

  @Get('csrf')
  csrf() {
    return { ok: true };
  }
}

function setSessionCookie(reply: FastifyReply, token: string): void {
  const ttlDays = Number(process.env.SESSION_TTL_DAYS ?? '30') || 30;
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: ttlDays * 24 * 60 * 60,
  });
}
