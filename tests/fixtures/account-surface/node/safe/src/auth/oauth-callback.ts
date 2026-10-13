// Safe twin of the `token-in-localstorage` fixture. A detector must stay
// silent here: the session never reaches client-side script storage.
import type { Request, Response } from 'express';

import { exchangeCode } from './exchange';

export async function handleCallback(req: Request, res: Response) {
  const { accessToken } = await exchangeCode(String(req.query.code));

  res.cookie('session', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });

  res.redirect('/dashboard');
}
