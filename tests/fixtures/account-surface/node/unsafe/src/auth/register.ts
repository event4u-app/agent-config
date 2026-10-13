// Fixture for the `fast-hash` class. Planted defect, never shipped code.
import { createHash, randomBytes } from 'node:crypto';

import { users } from '../db/users';

export async function register(email: string, password: string) {
  const salt = randomBytes(16).toString('hex');

  // PLANTED: a general-purpose fast hash used for credential storage.
  const digest = createHash('sha256').update(salt + password).digest('hex');

  await users.insert({ email, salt, password: digest });
}
