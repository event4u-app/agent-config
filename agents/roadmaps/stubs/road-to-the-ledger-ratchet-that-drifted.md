---
complexity: bounded
review_by: 2026-11-09
probe: ./scripts-run src/scripts/check_gate_completeness
---

# Stub: `check_gate_completeness` is 16 over its baseline on `main`

> **Stub — not active work.** Created 2026-09-09 by
> `road-to-design-intent-conformance` Phase 2, which met this red while
> registering a new gate and is recording it rather than absorbing it. It is
> **not** that roadmap's defect and it is not fixed there.

## The measurement

```
❌  check_gate_completeness: 230 violation(s) against a baseline of 214 — 16 new.
```

Reproduced at `origin/main@f0b66473b2` (the base
`road-to-design-intent-conformance` branched from), and shown to be inherited
rather than caused, by the only probe that separates the two: the new gate
`check_projected_rule_routes` was moved out of `src/scripts/` and the count
stayed at **230**, unchanged. The new gate is additionally absent from the
230-name violator list, because it adopts `_lib/gate_ledger.ts` — so its
contribution is zero in both directions.

## Why it is a stub and not a fix

The ratchet's own note states the migration policy: *"deliberately NOT a
sweep … the remainder migrates as gates are touched. Shrink-only from here —
the number may not grow, so a NEW gate must adopt or exempt."* That policy is
intact and was honoured by the branch that found this. What is broken is the
**baseline**: 16 gates entered the registered population without adopting a
ledger or carrying a `// ledger-exempt:` marker, and nobody was stopped,
because `check_gate_completeness` runs under `task ci` (`Taskfile.yml:197`)
and under no workflow — so a red here is invisible to a PR.

Fixing it means touching 16 unrelated gates in one sweep, which is exactly the
sweep the ratchet's own doctrine refuses, or discharging them as they are
touched, which is the policy already in force and needs no roadmap. The real
question is narrower and is the one worth deciding.

## What to decide

1. **Which 16.** The violator list is 230 names and the baseline records no
   membership, only a count — so the delta cannot be attributed without
   re-deriving the population at the baseline commit (`landed: 2026-08-30`).
   A baseline that records a number and not a set cannot say what regressed;
   that is the first thing to fix, and it is one field.
2. **Whether the gate should be reachable from CI at all.** It is in `task ci`
   and in no workflow, and `check_ci_local_parity` passes — 6 gates are
   declared local-only and this is not one of them, so the parity gate is not
   seeing the same population. Either wire it into a workflow, or declare it
   `local_only:` with a reason in `src/config/ci-local-parity.yml`. Silent
   half-registration is what let 16 arrivals through.
3. **Whether to re-baseline once, with the membership recorded.** A ratchet
   that has been over its floor for an unknown number of days is not
   protecting anything; a one-time reset that also records the SET, plus the
   wiring from (2), restores the property. That is a maintainer decision,
   because raising a ratchet baseline is what the ratchet exists to refuse.

## Resolved when

`./scripts-run src/scripts/check_gate_completeness` exits 0 on `main`, and the
baseline entry in `src/config/gate-violation-baselines.json` carries the
membership set alongside the count so the next drift names its own cause.
