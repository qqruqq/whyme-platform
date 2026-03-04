import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const HASH_PREFIX = 'scrypt';
const KEYLEN = 64;

export function hashLoginCode(rawCode: string): string {
  const normalizedCode = rawCode.trim();
  const salt = randomBytes(16).toString('base64url');
  const derived = scryptSync(normalizedCode, salt, KEYLEN).toString('base64url');
  return `${HASH_PREFIX}$${salt}$${derived}`;
}

export function verifyLoginCode(rawCode: string, storedHash: string | null | undefined): boolean {
  const normalizedCode = rawCode.trim();
  if (!normalizedCode || !storedHash) return false;

  const [prefix, salt, derived] = storedHash.split('$');
  if (prefix !== HASH_PREFIX || !salt || !derived) return false;

  const calculated = scryptSync(normalizedCode, salt, KEYLEN).toString('base64url');
  const calculatedBuffer = Buffer.from(calculated);
  const storedBuffer = Buffer.from(derived);
  if (calculatedBuffer.length !== storedBuffer.length) return false;
  return timingSafeEqual(calculatedBuffer, storedBuffer);
}
