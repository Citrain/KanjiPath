import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';
import { hashToken } from './session.service';

describe('password', () => {
  it('hashes with argon2id and verifies', async () => {
    const hash = await hashPassword('mot-de-passe-solide');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, 'mot-de-passe-solide')).toBe(true);
    expect(await verifyPassword(hash, 'mauvais-mot-de-passe')).toBe(false);
  });
});

describe('hashToken', () => {
  it('produces a stable sha256 hex digest', () => {
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
