// Safe twin of the `secret-compare` fixture. A detector must stay silent here.
import { timingSafeEqual } from 'node:crypto';

import { pendingOtpFor } from '../db/otp';

export async function verifyOtp(userId: string, submitted: string) {
  const expected = await pendingOtpFor(userId);

  const a = Buffer.from(submitted, 'utf8');
  const b = Buffer.from(expected, 'utf8');

  if (a.length === b.length && timingSafeEqual(a, b)) {
    return { ok: true };
  }

  return { ok: false };
}
