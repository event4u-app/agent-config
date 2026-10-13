// Fixture for the `secret-compare` class. Planted defect, never shipped code.
import { pendingOtpFor } from '../db/otp';

export async function verifyOtp(userId: string, submitted: string) {
  const expected = await pendingOtpFor(userId);

  // PLANTED: a non-constant-time comparison on a one-time secret.
  if (submitted === expected) {
    return { ok: true };
  }

  return { ok: false };
}
