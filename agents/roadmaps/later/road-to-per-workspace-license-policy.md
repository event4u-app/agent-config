---
complexity: small
status: blocked-for-later
---

# Road to per-workspace license policy — heterogeneous monorepos derive per workspace, not per root

> **Blocked until:** a real consumer repo hits the v1 escalation, i.e. a
> heterogeneous monorepo (workspace SPDX id differs from root) is actually
> encountered and the maintainer wants derivation instead of an escalation.
> Until then the v1 scope-limiter is the correct answer: escalate, never
> silently derive.
> **Origin:** `road-to-provenance-and-license-governance.md` Q1-residual,
> council debate 2026-07-28 (claude-sonnet-4-5 + gpt-4o, 2 rounds, real
> clash). One member argued day-one necessity — root Apache-2.0 deriving
> "GPL borrow permitted" while the borrow lands in an MIT-published
> workspace is a latent legal liability surfacing only at external audit.
> The other argued root-only v1. Adopted middle path (the dissenting
> member's own named mind-changer): an explicit v1 scope-limiter that
> escalates on divergence.

## What v1 already does (do not rebuild)

`detect_target_license` scans declared workspaces (`package.json`
`workspaces` globs, `composer.json`) for their own license declarations.
Any workspace SPDX id differing from the root escalates through the
existing sources-disagree path; no policy file is written. Homogeneous and
single-workspace repos derive root-only as designed.

## What this roadmap would add

- [ ] Per-workspace policy derivation: one derived policy per workspace,
  each carrying its own `derived_from` + LICENSE SHA, with the borrow gate
  resolving policy by the workspace a changed file belongs to.
- [ ] Ledger records gain a workspace field so a borrow's target scope is
  recorded at write time (retroactive re-classification of pre-existing
  entries is the migration cost the council flagged — plan it explicitly,
  never by git archaeology).
- [ ] Escalation stays the fallback for the unresolvable case (a changed
  file outside every declared workspace).

## Why not now

No consumer datapoint yet, and the escalation makes the dangerous case
loud rather than silent — the compliance hole the clash was about is
already closed. Building full derivation before a real heterogeneous repo
exists would be speculative surface (subtraction before addition).
