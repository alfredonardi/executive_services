import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, MfaVerifyDto, RefreshTokenDto, RegisterFromInviteDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify MFA code after login' })
  verifyMfa(@Body() dto: MfaVerifyDto, @Req() req: Request) {
    return this.authService.verifyMfa(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refreshTokens(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register from invite' })
  register(@Body() dto: RegisterFromInviteDto, @Req() req: Request) {
    return this.authService.registerFromInvite(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/setup')
  @ApiOperation({ summary: 'Set up MFA for current user' })
  setupMfa(@CurrentUser('id') userId: string) {
    return this.authService.setupMfa(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirm MFA setup with code' })
  confirmMfa(@CurrentUser('id') userId: string, @Body('code') code: string) {
    return this.authService.confirmMfa(userId, code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  logout(@CurrentUser('id') userId: string, @Body('refreshToken') refreshToken: string) {
    return this.authService.logout(userId, refreshToken);
  }
}
