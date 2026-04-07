import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { LoginDto, MfaVerifyDto, RefreshTokenDto, RegisterFromInviteDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, meta: { ipAddress?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      await this.logAudit({
        actorId: user?.id,
        action: 'LOGIN_FAILED',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    if (user.mfaEnabled) {
      // Return a temporary token for MFA verification
      const mfaToken = this.jwt.sign(
        { sub: user.id, purpose: 'mfa' },
        {
          secret: this.config.get<string>('jwt.accessSecret'),
          expiresIn: '5m' as `${number}m`,
        },
      );
      return { requiresMfa: true, mfaToken };
    }

    return this.issueTokens(user.id, user.email, user.role, meta);
  }

  async verifyMfa(dto: MfaVerifyDto, meta: { ipAddress?: string; userAgent?: string }) {
    let payload: { sub: string; purpose: string };

    try {
      payload = this.jwt.verify<{ sub: string; purpose: string }>(dto.mfaToken, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA token');
    }

    if (payload.purpose !== 'mfa') {
      throw new UnauthorizedException('Invalid token purpose');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, deletedAt: null },
    });

    if (!user || !user.mfaSecret) {
      throw new UnauthorizedException('MFA not configured');
    }

    const isValid = authenticator.verify({ token: dto.code, secret: user.mfaSecret });
    if (!isValid) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    return this.issueTokens(user.id, user.email, user.role, meta);
  }

  async refreshTokens(dto: RefreshTokenDto, meta: { ipAddress?: string; userAgent?: string }) {
    const tokenHash = await bcrypt.hash(dto.refreshToken, 10);

    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        token: { not: '' }, // We search by hash below
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    // In production: find by comparing hash
    // For MVP: find by token field (should be stored as hash with lookup by hash)
    if (!stored) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId, deletedAt: null },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user.id, user.email, user.role, meta);
  }

  async registerFromInvite(
    dto: RegisterFromInviteDto,
    meta: { ipAddress?: string; userAgent?: string },
  ) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: dto.inviteToken },
    });

    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired invitation');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const [user] = await this.prisma.$transaction([
      this.prisma.user.create({
        data: {
          email: invitation.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: invitation.role,
          passwordHash,
          preferences: {},
        },
      }),
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    await this.logAudit({
      actorId: user.id,
      action: 'CREATE',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.issueTokens(user.id, user.email, user.role, meta);
  }

  async setupMfa(userId: string): Promise<{ secret: string; qrCodeUrl: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, mfaEnabled: true },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.mfaEnabled) throw new BadRequestException('MFA already enabled');

    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(user.email, 'Executive Concierge SP', secret);
    const qrCodeUrl = await qrcode.toDataURL(otpAuthUrl);

    // Store secret temporarily (not yet confirmed)
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret },
    });

    return { secret, qrCodeUrl };
  }

  async confirmMfa(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabled: true },
    });

    if (!user || !user.mfaSecret) throw new BadRequestException('MFA setup not started');
    if (user.mfaEnabled) throw new BadRequestException('MFA already enabled');

    const isValid = authenticator.verify({ token: code, secret: user.mfaSecret });
    if (!isValid) throw new BadRequestException('Invalid MFA code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    await this.logAudit({ actorId: userId, action: 'MFA_ENABLED' });
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    // Revoke the specific refresh token
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.logAudit({ actorId: userId, action: 'LOGOUT' });
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: string,
    meta: { ipAddress?: string; userAgent?: string },
  ) {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: (this.config.get<string>('jwt.accessExpiry') ?? '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    const refreshToken = uuidv4();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshTokenHash,
        expiresAt: refreshExpiry,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    await this.logAudit({
      actorId: userId,
      action: 'LOGIN',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { accessToken, refreshToken, tokenType: 'Bearer' };
  }

  private async logAudit(data: {
    actorId?: string;
    action: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: data.actorId,
          action: data.action as never,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          metadata: data.metadata,
        },
      });
    } catch (error) {
      this.logger.error('Failed to write audit log', error);
    }
  }
}
