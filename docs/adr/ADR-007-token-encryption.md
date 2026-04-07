# ADR-007: Token Encryption Strategy

**Date:** 2026-04-07  
**Status:** Accepted  
**Deciders:** Tech Lead

---

## Context

OAuth access tokens and refresh tokens for calendar providers are stored in the database. These are high-value credentials that grant access to users' calendar data. If the database is compromised, unencrypted tokens would allow an attacker to access user calendars. Encryption at rest mitigates this risk.

## Decision

**AES-256-GCM authenticated encryption for all OAuth tokens stored in the database, with the key sourced from `FIELD_ENCRYPTION_KEY` environment variable.**

### Implementation

`EncryptionService` (global singleton) provides `encrypt(plaintext)` and `decrypt(ciphertext)` methods.

**Format**: `BASE64(iv):BASE64(authTag):BASE64(ciphertext)`

- **Algorithm**: AES-256-GCM (authenticated encryption with associated data)
- **Key size**: 256 bits (32 bytes), provided as a 64-character hex string
- **IV**: 96 bits (12 bytes), randomly generated per encryption call
- **Auth tag**: 128 bits (16 bytes), stored alongside ciphertext
- **Encoding**: Base64, separated by colons for portability

### Why AES-256-GCM

- Provides confidentiality (encryption) AND integrity (authentication tag)
- The auth tag prevents silent tampering with stored tokens
- GCM with random IV ensures ciphertext uniqueness even for identical plaintexts
- FIPS 140-2 approved; industry standard for database field encryption

### Key Management

- `FIELD_ENCRYPTION_KEY` is a 32-byte random key stored as 64 hex characters
- Generate with: `openssl rand -hex 32`
- Never committed to source control
- In production: sourced from a secrets manager (AWS Secrets Manager, Vault, etc.)
- Key rotation requires a migration job to re-encrypt all `access_token` and `refresh_token` fields — this must be planned and executed atomically

### Fields Encrypted

| Table | Field |
|-------|-------|
| `calendar_connections` | `access_token` |
| `calendar_connections` | `refresh_token` |

### Fields NOT Encrypted (by design)

| Field | Reason |
|-------|--------|
| `email` | Used for display; low sensitivity; searchable |
| `tenant_id` | Non-secret identifier |
| `scopes` | Non-secret permission list |
| `sync_cursor` | Non-secret opaque token |

## Rationale

- Database-level TDE (Transparent Data Encryption) encrypts the entire database but does not protect against a DBA or application-level breach with DB credentials
- Field-level encryption with app-controlled keys means DB access alone is insufficient — the attacker also needs the encryption key
- AES-256-GCM is more appropriate than AES-CBC (which requires padding and provides no integrity guarantee)
- Envelope encryption (encrypting the data key with a KMS) is deferred to Phase 3 — adds operational complexity not justified for MVP

## Alternatives Considered

- **No encryption, rely on DB TDE**: insufficient — doesn't protect against credential theft at the application or infrastructure level
- **Envelope encryption via KMS**: stronger but complex; adds latency and an external dependency. Deferred.
- **Using bcrypt/argon2 (one-way hash)**: tokens must be decryptable to use them — one-way hashing is inappropriate here
- **pgcrypto (DB-side encryption)**: key management is harder (key in DB connection string), no app-level control

## Consequences

- `EncryptionService` is a global NestJS module — available everywhere without explicit import
- `FIELD_ENCRYPTION_KEY` must be set and valid before the application starts (enforced in `onModuleInit`)
- Token decryption happens in memory only, for the duration of an API call or sync operation
- Logs must never print decrypted token values — enforced by code convention
- Key rotation is a maintenance operation requiring a dedicated migration script
