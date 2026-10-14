// Safe twin of the `account-disclosure` fixture. A detector must stay silent
// here: one outcome for both the unknown-address and the wrong-secret path.
import type { Request, Response } from 'express';

import { authenticate } from '../auth/credentials';

export async function postLogin(req: Request, res: Response) {
  const session = await authenticate(req.body.email, req.body.password);

  if (!session) {
    return res.status(401).json({ error: 'Those credentials do not match our records.' });
  }

  return res.redirect('/dashboard');
}
