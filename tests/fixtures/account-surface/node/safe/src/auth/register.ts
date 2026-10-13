// Safe twin of the `fast-hash` fixture. A detector must stay silent here.
import argon2 from 'argon2';

import { users } from '../db/users';

export async function register(email: string, password: string) {
  const digest = await argon2.hash(password, { type: argon2.argon2id });

  await users.insert({ email, password: digest });
}
