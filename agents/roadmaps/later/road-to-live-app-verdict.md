---
complexity: lightweight
status: later
parent_roadmap: autonomous-verify-loop
---

# Roadmap: Live-app Playwright as the canonical verdict source (verify-repair-loop)

> **Blocked until:** a consumer repo's live-app CI run of the
> `playwright-testing` skill is recorded under `agents/evidence/`.
> **Why that half and not the other:** the trigger below is a conjunction whose
> first conjunct has already fired — `road-to-mission-mode` is archived. Only
> the consumer-CI half is still open, so naming the whole conjunction would let
> the probe resolve the archived half and report FIRED on a third of the
> evidence.
> **What the probe actually returns here, and why that is correct:**
> `undecidable`. The condition names a directory rather than a file, and a
> directory exists in every checkout, so no existence test decides it. Giving it
> a concrete filename would mean inventing an artefact nobody has agreed to
> produce — a probe lighting up on a name this note made up is worse than an
> honest `undecidable`. Parked 2026-08-19 by `road-to-estate-drawdown` Phase 2
> batch 1, verdict PARK-PROBEABLE.
> **Origin:** spawned from `road-to-autonomous-verify-loop.md` (Phase 2,
> 2026-06-15) to carry its one deferred item without trapping the parent in
> Iron Law 3.

## Trigger (both must hold before this leaves `later/`)

1. `road-to-mission-mode` (or a later mission) ships a mission whose output is
   **UI-observable**, AND
2. [`playwright-testing`](../../../src/skills/playwright-testing/SKILL.md) is wired
   into a **consumer's CI** (a live app the loop can drive).

Until both hold, [`verify-repair-loop`](../../../src/skills/verify-repair-loop/SKILL.md)
uses test/quality verdicts only — never a live app. The reason is no longer a flat
prohibition: [`resident-process-governance`](../../../docs/contracts/resident-process-governance.md)
replaced that on 2026-08-27 (ADR-249). Services a Playwright verdict drives outlive the
command that started them, so they are a **P1 supervised resident process** — permitted
only with a named supervisor, a declared write scope, a documented stop path and
claim-consistency. Nothing here declares any of the four, which makes it P2 and
prohibited. ADR-124 § 1 Class A says the same thing from the engine side: a Class-A
invocation terminates after command completion.

## Phase 1 — Live-app verdict (only when the trigger fires)

- [ ] Add a **live-app Playwright verdict** as a verify context in
      `verify-repair-loop` (per-context timeout ceiling, mandatory test
      isolation / ephemeral services, higher flake-tolerance window than
      unit tests — per the council's verify-context-heterogeneity finding).
- [ ] Decision doc: confirm the live-app path stays runtime-free **per turn**
      (services spun up + torn down inside the turn, no persistent daemon) or
      explicitly scope it as ephemeral-runtime-required; satisfy the four
      governance conditions in `resident-process-governance` or stay P0.
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
