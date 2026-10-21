---
adr: 296
status: accepted
date: 2026-10-21
decision: advisory-session-notice-declared
supersedes: —
superseded_by: —
phase: road-to-advisories-heard-the-same-day · steps 4.1, 4.2
type: structural
reopen_policy: unclassified
protected_dimensions: none
provenance:
  kind: agentic
  agentic_mode: council
  decision_makers: [council]
  human_directed: true
evidence:
  strength: E1
  basis:
    - agents/evidence/council/advisory-session-notice-20261021.md
    - agents/evidence/council/advisories-worktree-run-design-20261021.md
    - agents/roadmaps/road-to-advisories-heard-the-same-day.md
    - agents/roadmaps/road-to-an-update-that-installs-itself-only-when-it-is-safe.md
review_trigger: >-
  Reopened if the notice is found to carry fetched text into session context, if
  a session start is measured past its latency baseline because of it, or if a
  user reports the default `notify` showed advisories they never asked about.
---

# ADR-296 — The advisory notice on `session_start` is a declared, read-only authority expansion

## Status

Accepted 2026-10-21 by an AI council round of the same day (2/2, `ratified`,
with conditions), after a first round the same day fixed the architecture.
It is the explicit, narrow approval that the open blocker
`concerns-refused-as-authority-expansion` asked for any `session_start`
surface; it decides nothing about the update-notice concerns that blocker
holds.

## Context

`road-to-advisories-heard-the-same-day` needs findings to reach a person in a
session the same day. The first round (Q3) put all network access in the CLI
(`agent-config audit:deps refresh`) and an opt-in CI schedule; the session
start reads a cache file. The blocker of 2026-10-20 asked of any
`session_start` surface that it (b) be declared if it expands authority, (c)
stay read-only, (d) gate any action on a user-owned setting.

## Decision

1. **It is an authority expansion, and this record declares it.** The notice
   executes nothing, but a privileged hook that chooses what the agent sees and
   proposes an action ("fix now: `/audit deps fix <id>`") gains influence over
   what the agent does next (round 2, Q1, both seats).
2. **It is read-only by construction.** It rides the existing `session_start`
   handler (no new concern, no `hook_manifest` change), reads one cache file,
   and writes one "shown today" stamp. Its module holds no network or process
   code, asserted by a transitive import walk in the tests.
3. **Every printed field is validated.** IDs, versions, package names, paths,
   tiers and verdicts pass a strict single-line grammar with a length cap; a
   field that fails prints as `?`. Fetched prose is never cached at all.
4. **The gate is user-owned, and it is a default, not an opt-in.**
   `advisories.mode` (class C, `consent`) ships `notify`. That is weaker than
   affirmative consent, and is stated here rather than implied: what keeps it
   from flipping behaviour on an existing install is that the notice needs a
   cache, and a cache exists only after someone ran the refresh in that project.
5. **The refresh reminder is a suggestion, never an action.** It appears only
   once a project-local refresh already created the cache; the refresh itself
   enforces `advisories.egress`.

## Consequences

- A session start on a project whose advisories were refreshed can print up to
  three interrupting lines a week, a digest count, a silent-source line and a
  stale-data line.
- The update-notice concerns stay blocked; nothing here changes their terms.

## Alternatives

- **A new hook concern** — rejected: the concern allowance is 0, and a concern
  is a governed unit the blocker's round would have to clear anyway.
- **Network in the hook process** — rejected in round 1 (Q3), both seats.
- **Waiting for the blocker's round** — rejected in round 2 (Q2), both seats:
  the blocker concerns surfaces that can act; this one cannot.
