import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class MfaVerifyDto {
  @ApiProperty({ description: 'Temporary token from login step' })
  @IsString()
  mfaToken!: string;

  @ApiProperty({ description: '6-digit TOTP code' })
  @IsString()
  code!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class RegisterFromInviteDto {
  @ApiProperty()
  @IsString()
  inviteToken!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;
}
