import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';

/**
 * Global module — EncryptionService is available everywhere without re-importing.
 * Sensitive field encryption is a cross-cutting concern used in calendar, auth, and
 * any future module that stores secrets in the database.
 */
@Global()
@Module({
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class EncryptionModule {}
