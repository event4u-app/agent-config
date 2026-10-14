# Password policy

Decoy: prose about passwords, with no code on any account surface. It names
every word the lexical classes key on and must still produce no finding.

- A password is at least twelve characters. No composition rule, no forced
  rotation, no maximum below 64.
- Candidate passwords are checked against a breached-password list before the
  account is created.
- Storage uses the platform's own password hash, never a general-purpose
  digest such as `md5` or `sha256`, and never a hand-rolled salt scheme.
- A pepper, where one is used, lives outside the credential store.
- A reset token is single-use and compared with a constant-time helper, never
  with `==`.
