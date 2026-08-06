import {
  type ApiUser,
  changePasswordSchema,
  loginSchema,
  registerSchema,
} from '@kanjipath/contracts';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ZodError, type ZodType } from 'zod';
import { UsersService } from '../users/users.service';
import { hashPassword, verifyPassword } from './password';
import { SessionService } from './session.service';

export interface AuthResult {
  user: ApiUser;
  sessionToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionService,
  ) {}

  async register(input: unknown): Promise<AuthResult> {
    const data = parse(registerSchema, input);
    const passwordHash = await hashPassword(data.password);
    const user = await this.users.create(data.email, passwordHash, data.displayName);
    const session = await this.sessions.create(user.id, this.sessionTtlDays());
    return { user: toApiUser(user), sessionToken: session.token };
  }

  async login(input: unknown): Promise<AuthResult> {
    const data = parse(loginSchema, input);
    const user = await this.users.findByEmail(data.email);
    if (!user || !(await verifyPassword(user.passwordHash, data.password))) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
    await this.users.touchLogin(user.id);
    const session = await this.sessions.create(user.id, this.sessionTtlDays());
    return {
      user: toApiUser(user),
      sessionToken: session.token,
    };
  }

  async me(userId: string): Promise<ApiUser> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }
    return toApiUser(user);
  }

  async logout(token: string): Promise<void> {
    await this.sessions.revokeByToken(token);
  }

  async changePassword(userId: string, input: unknown): Promise<void> {
    const data = parse(changePasswordSchema, input);
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }
    if (!(await verifyPassword(user.passwordHash, data.currentPassword))) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }
    await this.users.updatePassword(userId, await hashPassword(data.newPassword));
  }

  private sessionTtlDays(): number {
    const parsed = Number(process.env.SESSION_TTL_DAYS ?? '30');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
  }
}

function parse<T extends ZodType>(schema: T, input: unknown): T['_output'] {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Données invalides',
        details: error.issues,
      });
    }
    throw error;
  }
}

function toApiUser(user: {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}): ApiUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  };
}
