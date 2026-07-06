---
complexity: lightweight
execution:
  mode: autonomous
---

# Road to decision-revisit discipline

> Past decisions — honest-null verdicts, "don't relitigate" locks, budget canons — must never silently veto a beneficial change. When an agent hits such a lock and the blocked change looks net-positive, it surfaces the conflict and offers a council re-evaluation instead of dropping the improvement. Progress means adaptation.

## Goal

Close the recurring failure the maintainer has hit multiple times: an old lock (enforcement-projection honest-null, a "don't relitigate" memory, the token-frugality canon) blocks a change that would be good today, and the agent silently complies instead of questioning the lock. Ship (1) a surface-the-conflict rule, (2) revisit-conditions on every lock going forward, (3) a value-over-budget escalation for the frugality canon, (4) a sweep of existing locks, and (5) the first live application (reminder-injection re-evaluation).

## Why now (case history)

- **Reminder-injection (2026-07-06):** a design-gated item was nearly parked permanently on the 2026-06-25 enforcement-projection honest-null — even though that null tested hardened *blocking* projections, while the new proposal is discretionary contextual nudges. Different mechanism; the old verdict may not transfer.
- **Frontend/design changes (recent):** the token-frugality canon almost vetoed a net-positive design improvement purely because a budget line had once been drawn.
- Both share the shape: *a lock recorded under old conditions, applied as if permanent.* Devs re-question their code and rules continuously; this package must do the same to its own governance.

## What already exists (extend, don't duplicate)

- `decision-review` skill — backward audit of a past decision (still valid / amend / superseded). The capability exists; **the trigger does not**: nothing routes an agent to it when a lock blocks live work, and it only covers ADRs, not memory locks / honest-nulls / budget canons.
- `decision-record` / ADR template — carries `supersede:`/revisit semantics for architectural decisions.
- `notes-first-reasoning` — in-task `revisit-if` on tactical decisions.
- `ai-council` — the re-evaluation mechanism itself.

## Phase 1 — Rule: blocked-by-past-decision → surface, never silently drop

- [x] Author `src/rules/decision-revisit-gate.md` (auto rule): when a beneficial change is blocked by a **recorded past decision** — an honest-null eval verdict, a "don't relitigate" memory/context note, a budget/frugality canon line, or an ADR — the agent MUST NOT silently drop or park the change. It surfaces the conflict (what is blocked, which lock blocks it, under what conditions the lock was recorded, what has changed since) and offers numbered options including "re-evaluate the lock in the AI council". Iron Law shape: `A LOCK IS A DECISION UNDER PAST CONDITIONS, NOT A PERMANENT LAW. BENEFIT BLOCKED BY A LOCK → SURFACE + OFFER RE-EVALUATION. NEVER SILENT COMPLIANCE.`
- [x] Include the mechanism-mismatch check in the rule body: before applying a lock, verify the blocked proposal is actually the *same mechanism* the lock tested — a verdict on mechanism X never auto-extends to mechanism Y (case-zero: blocking projections ≠ discretionary nudges).
- [x] Run the artifact overlap scan (per `artifact-drafting-protocol` Phase B) against `decision-review`, `improve-before-implement`, `no-cheap-questions` (this rule ADDS a legitimate question class — the revisit offer is never a "cheap question"), and `ask-when-uncertain`; record extend-vs-create verdicts in the rule's See-also. <!-- done: no existing artifact triggers on "blocked by a lock" — verdict CREATE, confirmed via grep; decision-review extended with an inbound pointer instead of duplicated -->
- [x] Route the rule to `decision-review` for the audit procedure and to `ai-council` for the re-evaluation mechanics — the rule owns the obligation, the skills own the procedure.
- [x] Verify: `./scripts-run src/scripts/validate_frontmatter` + `./scripts-run src/scripts/check_refs` on the new rule. <!-- done: 388 artefacts, 0 failing; no broken references -->

## Phase 2 — Revisit conditions on every lock going forward

- [x] Extend the `ai-council` skill's convergence-summary output format: every "don't relitigate" verdict MUST record scope (which mechanism/question exactly is settled) and at least one `revisit-if:` condition (new evidence class, environment or model-generation change, N-th blocked encounter, age threshold). A lock without revisit conditions is an authoring error.
- [x] Extend memory-writing guidance (`memory-consolidation` skill): "don't relitigate" memories follow the same contract — settled-scope + revisit-if, and must distinguish **settled-by-evidence** (an eval ran) from **settled-by-decision** (a maintainer call) since the latter is cheaper to reopen.
- [x] Extend `decision-record`: the escalation litmus gains the reverse direction — when recording a lock, name the condition that would reopen it. <!-- done: added a Revisit-if bullet to "4. Lock the choice + consequences" -->
- [x] Verify: `./scripts-run src/scripts/skill_linter` on the touched skills. <!-- done: 3 pass, 0 fail (invoked directly against the 3 touched SKILL.md files — the --changed flag itself is stale, still hardcoded to .agent-src.uncondensed/dist paths from the pre-src/ layout; noted as a tooling gap, out of this roadmap's scope -->

## Phase 3 — Frugality canon: value-over-budget escalation

- [x] Add a "value-over-budget" clause to the frugality canon (`token-budget-discipline` rule + frugality-charter context): budget rules exist to cut waste, not capability — when a change is blocked *purely* by a budget line but is plausibly net-positive (better outcomes, fewer retries, higher activation), the agent surfaces the trade-off (estimated token delta vs expected benefit) instead of auto-rejecting. The budget line is an input to the decision, never the decision.
- [x] Cross-link from `telegraph-speak` and the thin-projector/trim surfaces so every budget-enforcement point carries the escalation pointer.
- [x] Verify: `./scripts-run src/scripts/check_condensation` targeted on touched rules (preservation-guard: Iron Law sections byte-stable). <!-- done: passed -->

## Phase 4 — Sweep existing locks

- [x] Inventory current locks: memory-index "don't relitigate" entries, `agents/settings/contexts/` locked verdicts, and honest-null records. For each, classify settled-by-evidence vs settled-by-decision and add the missing scope + revisit-if line (in the context files; memory entries get updated on next touch). <!-- done: 21 context files matched lock/settled patterns; 9 genuinely retrofitted with scope+revisit-if, 2 already had equivalent tables (labeled), 5 ADR-context files + 5 others reviewed and deliberately not retrofitted (see report). Memory-index entries left for next touch per the step's own instruction. -->
- [x] Flag locks whose recorded conditions have already drifted (model generation, tooling, package architecture) as revisit candidates in a short report under `agents/tmp/` for maintainer triage — surfaced, not auto-reopened. <!-- done: agents/tmp/lock-drift-candidates-2026-07-06.md — 3 confirmed drift items (2 stale .py script paths post-py2ts-migration, 1 date-order flag on senior-personas-and-skills-map.md vs persona-governance.md) -->
- [x] Verify: `./scripts-run src/scripts/check_refs` on touched context files. <!-- done: no broken references -->

## Phase 5 — First live application: reminder-injection re-evaluation

- [x] Draft the council question (`agents/runtime/council/questions/`): should contextual, discretionary reminder injection via hooks be built — given that the 2026-06-25 honest-null tested hardened *blocking* projections (different mechanism), and given Source C's documented pattern of discretionary pre-message nudges? Include both the old verdict's evidence and the mechanism-mismatch argument. <!-- done 2026-07-06: reminder-injection-reevaluation.md, incl. counter-considerations (miss-rate unknown, recursive-verification null, weak-host lever) -->

- [x] Run the council debate on it (maintainer-confirmed spend) and record the convergence summary — with scope + revisit-if per Phase 2 — in `agents/settings/contexts/`. <!-- done 2026-07-06: 2-round debate split (build vs reject), tie-break round converged unanimously on (b') build-to-measure; promoted to agents/settings/contexts/reminder-injection-verdict.md with scope + revisit-if -->
- [x] Apply the verdict to `road-to-prompt-pattern-adoption.md` Phase 5: positive → replace the design-only steps with build steps (hook nudges + eval); negative → keep the gate, now with an explicit revisit-if instead of an open-ended block. <!-- done 2026-07-06: Phase 5 materialized as build-to-measure (flag-gated apparatus, 3-arm A/B incl. random-reminder negative control, pre-registered thresholds) -->

## Acceptance criteria

- One new rule (`decision-revisit-gate`); everything else folded into existing skills/contexts.
- Every future council convergence and "don't relitigate" memory carries scope + revisit-if.
- The frugality canon carries the value-over-budget escalation at every enforcement point.
- The reminder-injection question has a fresh, correctly-scoped verdict — in either direction.
