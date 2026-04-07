import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';

/**
 * EncryptionService
 *
 * Provides AES-256-GCM authenticated encryption for sensitive fields stored in
 * the database (e.g. OAuth access/refresh tokens).
 *
 * Format: base64(iv):base64(authTag):base64(ciphertext)
 *
 * Key material is sourced from FIELD_ENCRYPTION_KEY (32-byte hex string).
 * Rotating the key requires re-encrypting all existing values — this is a
 * planned operation that must be performed as a migration.
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 12; // 96-bit IV for GCM
  private readonly AUTH_TAG_LENGTH = 16;
  private key!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const hexKey = this.config.get<string>('encryption.fieldKey');
    if (!hexKey || hexKey.length !== 64) {
      throw new Error(
        'FIELD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
          'Generate with: openssl rand -hex 32',
      );
    }
    this.key = Buffer.from(hexKey, 'hex');
    this.logger.log('EncryptionService initialized');
  }

  /**
   * Encrypts a plaintext string and returns a portable ciphertext string.
   * A fresh random IV is generated for every call (mandatory for GCM).
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.key, iv, {
      authTagLength: this.AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  /**
   * Decrypts a ciphertext string produced by encrypt().
   * Throws if the ciphertext is malformed or authentication fails (tampered data).
   */
  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted value format');
    }

    const ivB64 = parts[0] as string;
    const authTagB64 = parts[1] as string;
    const encryptedB64 = parts[2] as string;

    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');

    const decipher = crypto.createDecipheriv(this.ALGORITHM, this.key, iv, {
      authTagLength: this.AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  /**
   * Returns true if a value looks like an encrypted token (has the correct format).
   * Used for defensive checks before attempting decryption.
   */
  isEncrypted(value: string): boolean {
    return value.split(':').length === 3;
  }
}
