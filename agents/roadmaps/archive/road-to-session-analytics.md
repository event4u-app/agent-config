---
complexity: structural
status: ready
parent_roadmap: road-to-positioning-and-enforcement
---

# Road to session analytics — a post-session cost/turn/churn report

**Trigger:** Spun out of `road-to-positioning-and-enforcement` (Iron Law 3
resolution, 2026-06-25). That roadmap's enforcement thesis measured honest-null,
but one Phase-2 idea is genuinely useful and orthogonal to enforcement, so it is
preserved here as its own draft rather than buried with the cancelled items.

**Status: ready** — on the dashboard, awaiting execution authorization.

## Goal

A **post-session** analysis command — never live mid-session injection, never a
daemon, never provider-specific live token parsing. Stateless, run on demand,
reads the existing `work_engine` state. Consistent with the package's no-runtime
identity (cf. [[council-ecc-parity-positioning]] do-not-cross list).

## Phase 1 — analyze-session

- [x] `agent-config analyze-session` — read-only post-session report from the
  existing `.work-state.json` + `agents/runtime/state/context-hygiene.json`:
  files touched (`changes`), per-directive outcomes (blocked flagged), halts, and
  tool-call / loop activity. No live hooks, no daemon. Done 2026-06-25
  (`src/scripts/_cli/cmd_analyze_session.ts`, registry + bash-dispatcher wired as
  a `delegate` command mirroring `explain`). **Token/cost band dropped:**
  source-discovery found NO per-session token/cost source in the package, so the
  report prints an honest "not tracked" line rather than a fabricated estimate.
- [x] Verify: 5/5 vitest (`tests/scripts/cmd_analyze_session.test.ts`) + registry
  parity 5/5 + real run via the bash dispatcher against the GT-U10 fixture +
  `tsc --noEmit` clean. Deterministic; no network / model. Done 2026-06-25.

## Acceptance criteria

- Command is read-only and stateless; no mid-session behaviour.
- Output derives only from already-logged state — no new always-on capture.
- Stays inside the no-runtime-daemon boundary.
