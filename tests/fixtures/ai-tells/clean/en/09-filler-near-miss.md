> Clean by construction: one ordinary use of "in order to" in a sentence where
> the shorter form would be ambiguous. Near-miss for `tell-filler-phrase`.

In order to reproduce the failure you need both the stale token and the second
browser tab; either one alone gives a clean login. That is why the first three
bug reports were closed as not-reproducible and the fourth included a screen
recording.

The fix invalidates the token on the server rather than in the tab, so the
second tab now fails the same way the first one does.
