// Fixture for the `token-verify-off` class. Planted defect, never shipped code.
import jwt from 'jsonwebtoken';

export function readSession(token: string) {
  // PLANTED: `none` is accepted, so an unsigned token the caller wrote is
  // read as a valid session.
  return jwt.verify(token, process.env.SESSION_KEY!, {
    algorithms: ['none', 'HS256'],
  });
}
