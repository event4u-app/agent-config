# ADR 0001 — Hard-stop hook surface

> Area: `cost` · Status: accepted · Date: 2026-05-16 · Type: retrospective
> Roadmap: `agents/roadmaps/step-11-ruflo-parity.md` Phase 2 Step 3

## Context

`step-11-measurement-governance-parity` Phase 2 lands a 5-tier budget
ladder (`OK / INFO / WARNING / CRITICAL / HARD_STOP`) evaluated by
[`scripts/cost/budget.mjs`](../../../scripts/cost/budget.mjs). The
roadmap requires that the `HARD_STOP` tier fail closed when the user
opts into `cost.enforcement: hard-stop` — without changing the
default-on advisory experience.

This package is a governance layer, not a runtime orchestrator (see
[`step-11`](../../../agents/roadmaps/step-11-ruflo-parity.md) scope
boundary). The hook must therefore live at a **process-entry seam**,
not inside the rule-loader, agent dispatcher, or per-tool-call
interceptor — none of those exist in this codebase by design.

## Decision

Land a single shell-entry preflight script:
[`scripts/cost/preflight.mjs`](../../../scripts/cost/preflight.mjs).

### Surface

- **Where it fires:** any shell or CI wrapper that opts in by calling
  `task cost:preflight` (or `node scripts/cost/preflight.mjs`) before
  composing a turn. Not auto-injected anywhere.
- **What it does:** wraps `budget.mjs check`. Reads `cost.enforcement`
  from `.agent-settings.yml`. Exits non-zero **only** when
  `enforcement: hard-stop` **and** `level: HARD_STOP`.
- **Refusal output:** human-readable refusal block citing
  [`docs/contracts/cost-enforcement.md`](../../contracts/cost-enforcement.md)
  with the three bypass paths (raise budget · reset ledger · disable
  enforcement). Machine-readable equivalent on `PREFLIGHT_QUIET=1`.

### Default behaviour without a budget

When `cost.budgets.{daily,weekly,monthly}` are all `0`:

- `preflight.mjs` exits `0`. Always.
- This is the **fail-open default**. Unconfigured projects never get
  blocked.

### Bypass

Three options, all documented in the refusal block and the contract:

1. **Raise the budget** — edit `.agent-settings.yml § cost.budgets`.
2. **Reset the ledger** — `node scripts/cost/track.mjs reset` (drops
   historical spend from utilization).
3. **Disable enforcement** — set `cost.enforcement: advisory`.

No env-var override. Bypass is durable and auditable.

## Considered alternatives

### Alt 1 — Rule-loader hook (rejected)

Refuse to compose the turn-start preamble in the kernel-rule loader.

**Why rejected:** the kernel-rule loader is a static-projection step
(`scripts/sync.py` writes `.agent-src/rules/` from
`.agent-src.uncompressed/`). There is no live loader at turn-start to
hook — Claude / Augment / etc. read the projected files directly. A
"refusal" would have to be baked into the file content, which mixes
policy enforcement with documentation. Out of scope.

### Alt 2 — `/onboard` boot path (rejected)

Block `/onboard` when over budget.

**Why rejected:** `/onboard` is a one-shot install path. Blocking it
when the **historical** spend exceeds the **new** budget creates a
chicken-and-egg lock-out. Onboarding must never fail-closed.

### Alt 3 — Per-tool-call interceptor (rejected)

Wrap every tool call with a budget check.

**Why rejected:** this package doesn't intercept tool calls. Building
that would require a runtime engine — the explicit Non-goal of
`step-11` (see scope boundary). This is the Ruflo-style runtime
absorption we ruled out.

### Alt 4 — Single-shell-entry preflight (accepted)

The chosen surface. Opt-in by wrapper invocation; predictable; no
runtime, no projection coupling, no chicken-and-egg edges. Matches the
governance-layer charter.

## Consequences

- **Positive:** consumers who want fail-closed behaviour get it with
  one settings flip + one task invocation. The default-on experience
  is unchanged. No runtime is introduced. The hook composes with `task
  ci`, `task work:*`, or any shell wrapper the consumer chooses.
- **Negative:** the hook is **opt-in by wrapper**. A consumer who sets
  `enforcement: hard-stop` but never invokes `task cost:preflight`
  gets no enforcement. Documented as a known limitation; mitigated by
  surfacing the gap in `agent-status`.
- **Reversal cost:** flip `cost.enforcement: advisory` globally, or
  remove the `task cost:preflight` call from wrappers. Hook becomes
  inert with no code change.

## References

- [`docs/contracts/cost-enforcement.md`](../../contracts/cost-enforcement.md) — contract surface.
- [`scripts/cost/budget.mjs`](../../../scripts/cost/budget.mjs) — evaluator.
- [`scripts/cost/preflight.mjs`](../../../scripts/cost/preflight.mjs) — this hook.
- [`agents/roadmaps/step-11-ruflo-parity.md`](../../../agents/roadmaps/step-11-ruflo-parity.md) Phase 2 Step 3 — origin.
- [`agents/audit-2026-05-14-north-star/external-findings.md`](../../../agents/council-sessions/audit-2026-05-14-north-star/external-findings.md) § 2 row "hard stop" — upstream Ruflo pattern this absorbs.
