import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const INSTRUCTOR_SESSION_COOKIE = 'wm_instructor_session';
export const INSTRUCTOR_NAME_COOKIE = 'wm_instructor_name';
export const INTERNAL_ROLE_COOKIE = 'wm_internal_role';
export const INSTRUCTOR_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type InternalUserRole = 'super_admin' | 'admin' | 'instructor';

export type InstructorSessionPayload = {
  userId: string;
  name: string;
  role: InternalUserRole;
  exp: number;
};

function getAuthSecret(): string {
  return (
    process.env.INSTRUCTOR_AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    'whyme-instructor-auth-dev-secret'
  );
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function isInternalUserRole(value: string): value is InternalUserRole {
  return value === 'super_admin' || value === 'admin' || value === 'instructor';
}

function signPayload(payload: string): string {
  return createHmac('sha256', getAuthSecret()).update(payload).digest('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export function getSessionExpiryDate(): Date {
  return new Date(Date.now() + INSTRUCTOR_SESSION_MAX_AGE_SECONDS * 1000);
}

export function getCookieValue(cookieHeader: string | null, key: string): string {
  if (!cookieHeader) return '';

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${key}=`));

  if (!cookie) return '';

  const value = cookie.slice(key.length + 1);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeInstructorName(value: string | null | undefined): string {
  return (value || '').trim();
}

function normalizedInstructorKey(value: string): string {
  return normalizeInstructorName(value).toLocaleLowerCase('ko-KR');
}

function parseCredentialMap(): Map<string, string> {
  const credentialMap = new Map<string, string>();
  const rawConfig = process.env.INSTRUCTOR_LOGIN_CODES?.trim() || '';

  if (!rawConfig) {
    return credentialMap;
  }

  try {
    const parsed = JSON.parse(rawConfig) as Record<string, unknown>;
    for (const [name, code] of Object.entries(parsed)) {
      const normalizedName = normalizeInstructorName(name);
      const normalizedCode = typeof code === 'string' ? code.trim() : '';
      if (!normalizedName || !normalizedCode) continue;
      credentialMap.set(normalizedInstructorKey(normalizedName), normalizedCode);
    }
    return credentialMap;
  } catch {
    const pairs = rawConfig.split(',');
    for (const pair of pairs) {
      const [name, code] = pair.split(':');
      const normalizedName = normalizeInstructorName(name);
      const normalizedCode = (code || '').trim();
      if (!normalizedName || !normalizedCode) continue;
      credentialMap.set(normalizedInstructorKey(normalizedName), normalizedCode);
    }
    return credentialMap;
  }
}

function getDefaultInstructorCode(): string {
  const configured = process.env.INSTRUCTOR_LOGIN_DEFAULT_CODE?.trim() || '';
  if (configured) return configured;

  if (process.env.NODE_ENV !== 'production') {
    return '0000';
  }

  return '';
}

function getExpectedInstructorCode(instructorName: string): string {
  const map = parseCredentialMap();
  const key = normalizedInstructorKey(instructorName);

  return map.get(key) || getDefaultInstructorCode();
}

export function hasConfiguredInstructorCode(instructorName: string): boolean {
  const map = parseCredentialMap();
  return map.has(normalizedInstructorKey(instructorName));
}

export function validateInstructorCode(instructorName: string, code: string): boolean {
  const normalizedName = normalizeInstructorName(instructorName);
  const normalizedCode = code.trim();
  if (!normalizedName || !normalizedCode) return false;

  const expectedCode = getExpectedInstructorCode(normalizedName);
  if (!expectedCode) return false;

  return normalizedCode === expectedCode;
}

export function createInstructorSessionToken(input: {
  userId: string;
  name: string;
  role: InternalUserRole;
}): string {
  const normalizedName = normalizeInstructorName(input.name);
  const payload: InstructorSessionPayload = {
    userId: input.userId.trim(),
    name: normalizedName,
    role: input.role,
    exp: Math.floor(Date.now() / 1000) + INSTRUCTOR_SESSION_MAX_AGE_SECONDS,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyInstructorSessionToken(token: string): InstructorSessionPayload | null {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<InstructorSessionPayload> & {
      role?: string;
      userId?: string;
    };
    const normalizedName = normalizeInstructorName(parsed.name);
    const normalizedUserId = (parsed.userId || '').trim();
    const normalizedRole = parsed.role && isInternalUserRole(parsed.role) ? parsed.role : 'instructor';
    if (!normalizedName || typeof parsed.exp !== 'number') {
      return null;
    }

    if (parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      userId: normalizedUserId,
      name: normalizedName,
      role: normalizedRole,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function getAuthenticatedSession(request: Request): InstructorSessionPayload | null {
  const cookieHeader = request.headers.get('cookie');
  const sessionToken = getCookieValue(cookieHeader, INSTRUCTOR_SESSION_COOKIE);
  if (!sessionToken) {
    return null;
  }

  return verifyInstructorSessionToken(sessionToken);
}

export function getAuthenticatedInstructorName(request: Request): string {
  const session = getAuthenticatedSession(request);
  return session?.name || '';
}
