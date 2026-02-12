import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ApiStatusError } from '../src/lib/api/errors';
import {
  assertBookingSlotExists,
  assertInviteTokenClaimed,
  assertMemberUpdateApplied,
} from '../src/lib/api/guards';
import {
  isSerializationConflictError,
  shouldRetrySerializableError,
} from '../src/lib/api/retry';
import { isValidOptionalPhoneInput } from '../src/lib/phone-validation';

function expectApiStatusError(
  callback: () => void,
  expectedStatus: number,
  expectedMessage: string
): void {
  assert.throws(callback, (error) => {
    if (!(error instanceof ApiStatusError)) {
      return false;
    }

    return error.status === expectedStatus && error.message === expectedMessage;
  });
}

test('invite/submit: concurrent token claim loser maps to 409 conflict', () => {
  expectApiStatusError(
    () => assertInviteTokenClaimed(0),
    409,
    'Token already used'
  );
});

test('member/update: lock transition during update maps to 409 conflict', () => {
  expectApiStatusError(
    () => assertMemberUpdateApplied(0),
    409,
    'Roster is locked. Modifications are not allowed.'
  );
});

test('booking/create: invalid slotId maps to 404', () => {
  expectApiStatusError(
    () => assertBookingSlotExists(null),
    404,
    'Invalid slotId'
  );
});

test('optional phone validation accepts 10~11 digit normalized values', () => {
  assert.equal(isValidOptionalPhoneInput(''), true);
  assert.equal(isValidOptionalPhoneInput(undefined), true);
  assert.equal(isValidOptionalPhoneInput('010-1234-5678'), true);
  assert.equal(isValidOptionalPhoneInput('(010) 123 4567'), true);

  assert.equal(isValidOptionalPhoneInput('010-123-456'), false);
  assert.equal(isValidOptionalPhoneInput('010-1234-56789'), false);
  assert.equal(isValidOptionalPhoneInput('010-ABCD-5678'), false);
});

test('serialization conflict retry policy is deterministic', () => {
  const p2034LikeError = { code: 'P2034' };
  const otherError = { code: 'P9999' };

  assert.equal(isSerializationConflictError(p2034LikeError), true);
  assert.equal(isSerializationConflictError(otherError), false);

  assert.equal(shouldRetrySerializableError(p2034LikeError, 0, 2), true);
  assert.equal(shouldRetrySerializableError(p2034LikeError, 1, 2), true);
  assert.equal(shouldRetrySerializableError(p2034LikeError, 2, 2), false);
  assert.equal(shouldRetrySerializableError(otherError, 0, 2), false);
});
