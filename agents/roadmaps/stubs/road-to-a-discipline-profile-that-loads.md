---
complexity: lightweight
review_by: 2027-01-15
---

# Stub: a discipline profile that changes what loads

> **Arrivals:** 1 — latest `inbox-2026-11-na` (2026-11-06): the owner's "developer
> model / PO model with fewer rules" idea is this stub's `essential` profile, the only
> significant positive profile measurement on record. The round recommends the first
> scope (make it select) with the default left at `full` until the non-trap
> replication; the choice between the two scopes is still the owner's.

> **Stub — not active work.** Created 2026-11-04 by
> `road-to-a-rerun-on-the-repaired-scorer` (step 3.2), from an observed
> failure rather than a score delta.

## The failure, with its reproducing artifact

`src/agent-src/templates/agent-settings.md` calls `discipline_profile` "the ONE
runtime knob for the discipline-rule tier" and describes `essential` as
"kernel + the lift-carrying rules". On Claude nothing reads it at runtime:

- `resolve_discipline_profile`
  (`src/agent-src/templates/scripts/work_engine/_lib/agent_settings.ts`) has no
  caller outside its own definition; the other hits in `src/` are comments
  (`compile_router.ts`, `telemetry_usage_hook.ts`, `telemetry/remote.ts`).
  Reproduce: `grep -rn "resolve_discipline_profile(" src scripts`.
- The installer uses the profile only to render the settings file. A project
  install with `AGENT_CONFIG_DEV_MODE=1 --scope=project --tools claude-code`
  writes no rule files that depend on it (checked 2026-11-04).

So a consumer who sets `essential` loads the same rules as one who sets `full`.

## Why it matters now

The post-repair rerun (`docs/benchmark.md` § Post-repair rerun, weak host)
measured the profiles as injected rule sets on `claude-haiku-4-5`, 2 tasks × 12
seeds:

- `essential` (kernel + `downstream-changes`): discipline +0.261 over vanilla,
  p=0.036, at 2.9× tokens.
- `full` (every tier): −0.125, p=0.353, at 7.1×.
- the installed package with all rules: +0.125, p=0.181, at 7.8×.

On this task family the profile the settings text recommends is also the best
measured configuration. The setting cannot select it.

## Scope

Either make the profile select what a Claude install loads (a projection the
installer or a session hook applies), or correct the settings text and
`docs/customization.md` so neither promises a runtime effect. One of the two;
the first needs its own measurement on a non-trap task family before it
becomes a default.

## Trigger

An owner decision between the two scopes above, or a consumer report that the
setting had no effect.

## Kill criteria

- The installer adopts per-profile rule projection for another reason — fold
  this into that change.
