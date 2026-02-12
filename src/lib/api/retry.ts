const PRISMA_SERIALIZATION_CONFLICT = 'P2034';

export function isSerializationConflictError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string' &&
    (error as { code: string }).code === PRISMA_SERIALIZATION_CONFLICT
  );
}

export function shouldRetrySerializableError(
  error: unknown,
  attempt: number,
  maxRetries: number
): boolean {
  return isSerializationConflictError(error) && attempt < maxRetries;
}
