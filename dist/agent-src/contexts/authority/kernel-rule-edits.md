# Kernel-Rule Edits — Slow-Rollout Guarantee

Loaded by [`scope-control`](../../rules/scope-control.md). Codifies the
soak-time guarantee for edits to always-loaded (kernel) rules under
`src/rules/`.

**Size budget:** ≤ 1,500 chars.

## The guarantee

Each kernel-rule edit ships in **its own PR** and carries a **ratification
artifact** — `agents/evidence/ratifications/<pr>.md`, reviewed by a party
other than the one that proposed or implemented the edit. The gate is
`check_kernel_edit_ratified` in `ci-fast`.

**The ≥ 24 h soak between consecutive kernel-rule PRs is retired**, ADR-268
§ 4 and K9 of `road-to-typed-grants-that-persist`: a fixed window measures
elapsed time, not control quality. Nothing observed the tree during those
24 hours; the artifact records that somebody actually looked.

Contract for the artifact: [`ratification-artifact`](../../../../docs/contracts/ratification-artifact.md).

## Trigger

A PR is a "kernel-rule edit" iff it modifies any file in `src/rules/`
that is in the locked kernel set
(see [`docs/contracts/kernel-membership.md`](../../../docs/contracts/kernel-membership.md)).
(Until 2026-07-31 this named the pre-ADR-051 authoring tree, which no
longer exists — so the trigger could not match a live file.)

The CI guard (Phase 4.2 of the always-budget-relief roadmap) fails
any PR that touches **> 1** kernel rule in the same diff. Override is
a single PR label: `bundled-always-rules-acknowledged` — the maintainer
records why the bundle is necessary in the PR body.

## Re-anchor the cache prefix in the same PR

The kernel bodies are the KV-cache prefix of every request, so editing
one invalidates that cache for every consumer. `check_kernel_prefix_stability`
(Rule Backstops workflow) fails until the edit is recorded:

```bash
./scripts-run src/scripts/check_kernel_prefix_stability --update-baseline
```

Commit the resulting `internal/bench/reports/kernel-prefix.json` **in the
same PR** — that is what makes a cache-invalidating change explicit in the
diff instead of a silent 10× cost event.

## Out of scope

- Auto-tier rules. Auto rules load on demand; the soak rationale does
  not apply with the same force.
- Context files cited by kernel rules. Context edits are reversible
  cheaply and do not change rule firing surface.
- Whitespace / typo / link fixes inside a single kernel rule. Same-rule
  cosmetic edits are not subject to the 24 h window — they ship as a
  normal PR.

## Source

- Roadmap Phase 4: always-budget-relief roadmap § Phase 4 (transient — see `agents/roadmaps/archive/`).
- Lesson: PR #36 (2026-05-04) condensed the rollout schedule under
  autonomous mandate; the slow-rollout note was deferred until this
  ADR pass.
