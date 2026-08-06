import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { SessionService } from './session.service';

export const SESSION_COOKIE_NAME = 'kp_session';

export interface AuthenticatedRequest extends FastifyRequest {
  authUserId?: string;
  authSessionId?: string;
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[SESSION_COOKIE_NAME];
    if (!token) {
      throw new UnauthorizedException('Authentification requise');
    }
    const session = await this.sessions.resolve(token);
    if (!session) {
      throw new UnauthorizedException('Session invalide ou expirée');
    }
    request.authUserId = session.userId;
    request.authSessionId = session.sessionId;
    return true;
  }
}
