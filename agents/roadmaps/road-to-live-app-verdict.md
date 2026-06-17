---
complexity: lightweight
status: draft
parent_roadmap: autonomous-verify-loop
---

# Roadmap: Live-app Playwright as the canonical verdict source (verify-repair-loop)

> **Status: draft (trigger-gated).** Spawned from
> `road-to-autonomous-verify-loop.md` (Phase 2, 2026-06-15) to carry its one
> deferred item without trapping the parent in Iron Law 3. Hidden from the
> dashboard until flipped to `ready` — flip only when the trigger below fires.

## Trigger (both must hold before this leaves draft)

1. `road-to-mission-mode` (or a later mission) ships a mission whose output is
   **UI-observable**, AND
2. [`playwright-testing`](../../src/skills/playwright-testing/SKILL.md) is wired
   into a **consumer's CI** (a live app the loop can drive).

Until both hold, [`verify-repair-loop`](../../src/skills/verify-repair-loop/SKILL.md)
uses test/quality verdicts only — never a live app (which needs running services
= a runtime, violating [`no-runtime-boundary`](../../docs/contracts/no-runtime-boundary.md)).

## Phase 1 — Live-app verdict (only when the trigger fires)

- [ ] Add a **live-app Playwright verdict** as a verify context in
      `verify-repair-loop` (per-context timeout ceiling, mandatory test
      isolation / ephemeral services, higher flake-tolerance window than
      unit tests — per the council's verify-context-heterogeneity finding).
- [ ] Decision doc: confirm the live-app path stays runtime-free **per turn**
      (services spun up + torn down inside the turn, no persistent daemon) or
      explicitly scope it as ephemeral-runtime-required; honor
      `no-runtime-boundary`.
- [ ] `evals/triggers.json` + behavior eval updated for the live-app context.

## Council notes

Council (claude-sonnet-4-5 + gpt-4o, deep + peer-review, 2026-06-15) flagged
live-app verification as a distinct execution context: slow, stateful, needs
services — NOT interchangeable with unit/quality runs. It must carry its own
timeout ceiling, isolation requirement, and flake-tolerance window. The verdict
remains non-sovereign (judge confirms after the numeric gate). Full convergence
inlined in `agents/evidence/analysis/verify-repair-loop-phase1-gate.md`.

## Provenance

- Parent: `road-to-autonomous-verify-loop.md` (archived after Phase 2).
- Source-E (external agent-harness reference, code-audited 2026-06-15): the
  live-Playwright verdict is its strongest idea; control structure only —
  model-pinned agent set and UI rubric rejected. Maintainer-recoverable link in
  the parent's Provenance.
