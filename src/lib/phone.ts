export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function normalizeNullablePhone(
  value: string | null | undefined
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const digitsOnly = normalizePhoneDigits(value);
  return digitsOnly.length > 0 ? digitsOnly : null;
}
