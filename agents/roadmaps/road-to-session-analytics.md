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

- [ ] `agent-config analyze-session` — read the existing `work_engine` state and
  emit a post-session report: turn count, file-churn (files touched / lines), and
  an estimated token/cost band from logged context sizes. No live hooks, no daemon.
- [ ] Verify: runs against a recorded `work_engine` state fixture; deterministic
  output; no network / model calls.

## Acceptance criteria

- Command is read-only and stateless; no mid-session behaviour.
- Output derives only from already-logged state — no new always-on capture.
- Stays inside the no-runtime-daemon boundary.
