import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  const validHexKey = 'a'.repeat(64); // 32 bytes as 64 hex chars

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(validHexKey),
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
    service.onModuleInit(); // initialize the key
  });

  describe('encrypt / decrypt round-trip', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'ya29.google-access-token-abc123';
      const ciphertext = service.encrypt(plaintext);
      const decrypted = service.decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', () => {
      const plaintext = 'oauth-refresh-token';
      const c1 = service.encrypt(plaintext);
      const c2 = service.encrypt(plaintext);
      expect(c1).not.toBe(c2);
      // But both must decrypt correctly
      expect(service.decrypt(c1)).toBe(plaintext);
      expect(service.decrypt(c2)).toBe(plaintext);
    });

    it('should handle Unicode strings', () => {
      const plaintext = 'token-with-unicode-São Paulo 🇧🇷';
      const ciphertext = service.encrypt(plaintext);
      expect(service.decrypt(ciphertext)).toBe(plaintext);
    });

    it('should handle very long tokens', () => {
      const plaintext = 'eyJhbGciOiJSUzI1NiJ9.' + 'x'.repeat(2000);
      const ciphertext = service.encrypt(plaintext);
      expect(service.decrypt(ciphertext)).toBe(plaintext);
    });

    it('should produce output in iv:authTag:ciphertext format', () => {
      const ciphertext = service.encrypt('test-token');
      const parts = ciphertext.split(':');
      expect(parts).toHaveLength(3);
      // Each part should be non-empty base64
      expect(parts[0]!.length).toBeGreaterThan(0);
      expect(parts[1]!.length).toBeGreaterThan(0);
      expect(parts[2]!.length).toBeGreaterThan(0);
    });
  });

  describe('decrypt — failure cases', () => {
    it('should throw on malformed ciphertext (wrong format)', () => {
      expect(() => service.decrypt('not-a-valid-ciphertext')).toThrow();
    });

    it('should throw on tampered auth tag (GCM authentication failure)', () => {
      const ciphertext = service.encrypt('sensitive-token');
      const parts = ciphertext.split(':');
      // Tamper with the auth tag
      parts[1] = 'AAAAAAAAAAAAAAAAAAAAAA==';
      const tampered = parts.join(':');
      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('should throw on tampered ciphertext body', () => {
      const ciphertext = service.encrypt('sensitive-token');
      const parts = ciphertext.split(':');
      // Tamper with the ciphertext
      parts[2] = Buffer.from('tampered-data').toString('base64');
      const tampered = parts.join(':');
      expect(() => service.decrypt(tampered)).toThrow();
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted values', () => {
      const ciphertext = service.encrypt('some-token');
      expect(service.isEncrypted(ciphertext)).toBe(true);
    });

    it('should return false for plain strings', () => {
      expect(service.isEncrypted('plain-oauth-token')).toBe(false);
    });
  });

  describe('initialization', () => {
    it('should throw if FIELD_ENCRYPTION_KEY is missing', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
        ],
      }).compile();

      const badService = module.get<EncryptionService>(EncryptionService);
      expect(() => badService.onModuleInit()).toThrow(/FIELD_ENCRYPTION_KEY/);
    });

    it('should throw if FIELD_ENCRYPTION_KEY is too short', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue('abc123') },
          },
        ],
      }).compile();

      const badService = module.get<EncryptionService>(EncryptionService);
      expect(() => badService.onModuleInit()).toThrow(/FIELD_ENCRYPTION_KEY/);
    });
  });
});
