# Inflation checks

Run against the changelog row each claim came from.

- [ ] **Widened verb** — *improves* did not become *transforms*, *fixes for X* did not become *fixes*, *supports* did not become *solves*.
- [ ] **Supplied number** — every percentage, count or duration is in the changelog or a cited source; one that is not is cut, never rounded into plausibility.
- [ ] **Smoothed status** — beta, preview, opt-in, one region or one plan survives into every surface; a gated release is never announced as available to everyone.
- [ ] **Absorbed achievement** — a gain that came from a dependency upgrade, a vendor or a contributor is credited to them, not presented as our feature.

The number, status and attribution checks are mechanical: `detect_ai_tells --baseline <changelog-row> <draft>` lists every one of them the draft added or dropped. A widened verb is caught by reading only.
