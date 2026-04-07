import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import type { JwtModuleOptions } from '@nestjs/jwt';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('jwt.accessSecret'),
        signOptions: {
          expiresIn: (config.get<string>('jwt.accessExpiry') ?? '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
