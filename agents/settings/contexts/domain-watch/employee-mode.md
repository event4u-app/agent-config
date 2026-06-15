# Domain watch — Employee mode (hide hosts / tiers / drives / health)

> Watch-only note per `domain-adoption-policy`. Opened 2026-06-14 by
> `road-to-6.0.0-final-readiness` Phase 5 (employee-experience legibility).
> **Not** a commitment to build — a record of the option, the decision, and
> the demand threshold so the next harvest re-evaluates without relitigating.

## The deferred ask

The 6.0.0 review's "the workplace exists now" win raised a follow-up: a
non-technical operator should not have to see hosts, tiers, drives, and
health at all — an **employee mode** that hides that machinery behind simple
"do this task" workflows.

## Option sketch (the lowest-impact build, if it were demanded)

A single `personal.employee_mode: true` setting (default `false`) that, in the
workspace surface:

- collapses the host/tier picker to "Start" (auto-pick the best available
  host via the existing `workspace_hosts.detect()` — already shipped);
- hides the drive-health panel and the tier/fallback chrome;
- keeps the **plain-language "why" lines** from this phase's
  `render_host_decision()` available behind a "Why?" disclosure, so the
  machinery is hidden, not removed.

**Config + testing impact (why it is not free):** one new setting key (schema +
migration + matrix doc), conditional rendering across the workspace chrome,
and a second snapshot path for every host/tier/fallback view (the visible vs.
employee-mode render). That doubles the workspace-chrome test surface and adds
a settings-migration case — real cost for a feature with no current pull.

## Decision — DEFER (explicit demand-signal gate)

Deferred, per the Phase 5 gate. The gate is mechanical: build only when a
demand signal of **≥ 3 external requests for simpler onboarding** exists.
Today that count is **0** (N=1 external fork, 7 stars, zero recorded
onboarding-simplification requests in recruit-sessions / discussions /
feedback). This is consistent with the parent roadmap's council convergence
that "governance follows demand, not the reverse" for N=1.

This is **not** an open-ended "decided" — it is a defer with the concrete
re-open trigger below.

## Re-open trigger

Re-open and build the option sketch above when **≥ 3 external (non-team)
requests for simpler onboarding / hiding the host-tier machinery** are
citeable (GitHub issues / discussions, or named users with a target). Until
then: do **not** schedule employee-mode work. The plain-language host
explainability shipped in this phase (`render_host_decision`) already makes
the machinery *legible*; employee-mode would make it *hideable* — a separate,
demand-gated step.

## See also

- [`docs/contracts/workspace-boundary.md`](../../../../docs/contracts/workspace-boundary.md) — workspace owns drive health; this note is about *presentation*, not ownership.
- `src/cli/python/workspace_explain.py::render_host_decision` — the legibility surface shipped instead of employee-mode.
