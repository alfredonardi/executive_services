// Environment configuration with validation
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { plainToInstance, Transform } from 'class-transformer';
import { validateSync } from 'class-validator';

type Environment = 'development' | 'staging' | 'production' | 'test';

class EnvironmentVariables {
  @IsEnum(['development', 'staging', 'production', 'test'])
  NODE_ENV: Environment = 'development';

  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  PORT: number = 3000;

  // Database
  @IsUrl({ require_tld: false })
  DATABASE_URL!: string;

  // Redis
  @IsUrl({ require_tld: false })
  REDIS_URL!: string;

  // JWT
  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRY: string = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRY: string = '7d';

  // AI
  @IsString()
  @IsOptional()
  AI_PROVIDER: string = 'openai';

  @IsString()
  @IsOptional()
  OPENAI_API_KEY?: string;

  @IsString()
  @IsOptional()
  ANTHROPIC_API_KEY?: string;

  @IsString()
  @IsOptional()
  AI_MODEL: string = 'gpt-4o-mini';

  // Google Calendar
  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  GOOGLE_REDIRECT_URI?: string;

  // Microsoft Calendar
  @IsString()
  @IsOptional()
  MICROSOFT_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  MICROSOFT_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  MICROSOFT_REDIRECT_URI?: string;

  // App
  @IsString()
  @IsOptional()
  APP_URL: string = 'http://localhost:3000';

  @IsString()
  @IsOptional()
  CORS_ORIGINS: string = 'http://localhost:3001';

  // Encryption key for sensitive fields (32 bytes hex)
  @IsString()
  @IsOptional()
  FIELD_ENCRYPTION_KEY?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}

export default () => ({
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  database: {
    url: process.env['DATABASE_URL'],
  },
  redis: {
    url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  },
  jwt: {
    accessSecret: process.env['JWT_ACCESS_SECRET'],
    refreshSecret: process.env['JWT_REFRESH_SECRET'],
    accessExpiry: process.env['JWT_ACCESS_EXPIRY'] ?? '15m',
    refreshExpiry: process.env['JWT_REFRESH_EXPIRY'] ?? '7d',
  },
  ai: {
    provider: process.env['AI_PROVIDER'] ?? 'openai',
    openaiApiKey: process.env['OPENAI_API_KEY'],
    anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
    model: process.env['AI_MODEL'] ?? 'gpt-4o-mini',
  },
  google: {
    clientId: process.env['GOOGLE_CLIENT_ID'],
    clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
    redirectUri: process.env['GOOGLE_REDIRECT_URI'],
  },
  microsoft: {
    clientId: process.env['MICROSOFT_CLIENT_ID'],
    clientSecret: process.env['MICROSOFT_CLIENT_SECRET'],
    redirectUri: process.env['MICROSOFT_REDIRECT_URI'],
  },
  app: {
    url: process.env['APP_URL'] ?? 'http://localhost:3000',
    corsOrigins: (process.env['CORS_ORIGINS'] ?? 'http://localhost:3001').split(','),
  },
  encryption: {
    fieldKey: process.env['FIELD_ENCRYPTION_KEY'],
  },
});
