import { ApiStatusError } from './errors';

export function assertInviteTokenClaimed(claimedCount: number): void {
  if (claimedCount === 0) {
    throw new ApiStatusError(409, 'Token already used');
  }
}

export function assertMemberUpdateApplied(updatedCount: number): void {
  if (updatedCount === 0) {
    throw new ApiStatusError(409, 'Roster is locked. Modifications are not allowed.');
  }
}

export function assertBookingSlotExists(slot: unknown): void {
  if (!slot) {
    throw new ApiStatusError(404, 'Invalid slotId');
  }
}
