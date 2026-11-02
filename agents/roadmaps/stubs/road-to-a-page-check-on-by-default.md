---
complexity: lightweight
review_by: 2027-03-31
---

# Stub: road to a page check on by default

> **Stub — not active work.** Split out of `road-to-a-page-that-says-what-it-loads`
> (round `inbox-2026-11-g`, decision E5) because it needs elapsed evidence, not
> effort: the four third-party/legal-page rows stay behind
> `web_launch_readiness.enabled` until their claim is backed.

**Trigger:** `claim:third-party-load-finds-planted` in `docs/CLAIMS.md` measured
on a held-out corpus written without sight of the detector, meeting its bars.

**What it settles, once triggered (owner-reserved — a consumer-facing default flip):**

- whether the four rows run on by default for `region: de|eu` in report-only
  mode (deterministic, offline, no LLM), while the LLM-arm claim
  `web-launch-readiness-finds-more` stays where it is;
- whether `/audit web` becomes a sub-mode of the existing `/audit` verb, a thin
  wrapper over the checker (no new verb).
