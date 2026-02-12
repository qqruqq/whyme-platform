import { normalizePhoneDigits } from './phone';

export function isValidOptionalPhoneInput(value: string | undefined): boolean {
  if (value === undefined || value === '') {
    return true;
  }

  if (!/^[0-9\s\-()+]+$/.test(value)) {
    return false;
  }

  const digits = normalizePhoneDigits(value);
  return digits.length >= 10 && digits.length <= 11;
}
