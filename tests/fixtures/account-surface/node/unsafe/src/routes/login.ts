// Fixture for the `account-disclosure` class. Planted defect, never shipped
// code. Expected evidence state is `suspected`: the string alone does not
// prove the route is public.
import type { Request, Response } from 'express';

import { findByEmail, checkPassword } from '../auth/credentials';

export async function postLogin(req: Request, res: Response) {
  const user = await findByEmail(req.body.email);

  if (!user) {
    // PLANTED: the response separates "no such account" from "wrong
    // password", which enumerates registered addresses.
    return res.status(404).json({ error: 'That email is not registered.' });
  }

  if (!(await checkPassword(user, req.body.password))) {
    return res.status(401).json({ error: 'Wrong password.' });
  }

  return res.redirect('/dashboard');
}
