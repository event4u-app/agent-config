// Safe twin of the `token-verify-off` fixture. A detector must stay silent here.
import jwt from 'jsonwebtoken';

export function readSession(token: string) {
  return jwt.verify(token, process.env.SESSION_KEY!, {
    algorithms: ['HS256'],
    issuer: 'https://id.example.test',
    audience: 'https://app.example.test',
  });
}
