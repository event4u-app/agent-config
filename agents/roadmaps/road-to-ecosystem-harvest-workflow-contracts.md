---
complexity: lightweight
status: ready
---

# Roadmap: Ecosystem-Harvest — Workflow Contracts

**Trigger:** Ecosystem survey, second sweep (see [`road-to-ecosystem-harvest-index`](road-to-ecosystem-harvest-index.md)).
Sources cited source-anonymously (**U** = a 4-mode TDD state-machine skill, **V** =
a plan-first merge-conflict skill, **Z** = a critical-planning-file safety skill);
full provenance in the index § Provenance.

**Priority: P2.** Two bounded upgrades to existing workflow surfaces: a
reusable mode-contract pattern with machine-checkable forbidden actions, and a
plan-first upgrade to `merge-conflicts`.

## Goal

Convert the TDD/feature flow's positive procedure into per-mode **Goal /
Activities / Forbidden / Output-contract** blocks with diff-checkable negatives;
add a host-neutral `HANDOFF.md` cross-context convention; and give
`merge-conflicts` a plan artifact, a backup step, an execution order, and an
explanation log.

## Reality check — already shipped (do NOT rebuild)

| Candidate | Verdict | Evidence |
|---|---|---|
| TDD skill + feature flow | Shipped | `test-driven-development`, feature-dev commands |
| Subagent payload contracts | Shipped | subagent bundle payloads |
| merge-conflicts: deleted-modified (ask), lock/generated regen, verify | Shipped | `merge-conflicts` strategy table + pitfalls |
| Per-mode **Forbidden** lists (checkable negatives) | **Gap** | no shipped skill encodes per-phase machine-checkable negatives |
| Workflow-phase (not subagent) contract shape | **Gap** | phase-to-phase contract framing absent |
| Standing cross-context `HANDOFF.md` | **Gap** | no resume-from-contract artifact (note: `lint_handoffs.ts` exists and governs a *different* concern — reconcile naming, do not collide) |
| merge-conflicts plan artifact / backup / execution order / explanation log | **Gap** | resolves inline; none of the four present |

- [x] Reality check complete — the *contract framing* + `HANDOFF.md` + the four merge deltas are the gaps; content mostly exists.

## Phase 1 — Mode-contract pattern on the TDD/feature flow

- [ ] Restructure the canonical TDD/feature carrier (confirm at HEAD) into the 4-block mode shape — content stays, the **contract framing** lands. *Source U.*
- [ ] Forbidden blocks with the checkable negatives: no code in Design; **no test edits in Implement** (stop-and-ask escape hatch); no bugfix before a reproducing regression test in Debug; "tests fail at assertions, not imports" in Test-Red. *Source U.*
- [ ] Each Forbidden item states **how a reviewer checks it from the diff** (e.g. "no `tests/**` paths in Implement-phase commits") — the falsifiability hook for a later review-checklist item, not an enforced hook yet.
- [ ] Mode-inference resume table + a consent-checkpoint sentence at each transition (rides `ask-when-uncertain` / `autonomous-execution`; no new mechanism).

## Phase 2 — HANDOFF convention

- [ ] Define `HANDOFF.md` (location decided against the existing session-artifact layout): current mode/phase, contract received, contract owed, decisions taken, open questions, next command. Host-neutral plain Markdown, no host API. *Source U.*
- [ ] Resume rule: a workflow skill's step 0 checks for a HANDOFF and resumes from its contract instead of re-deriving state; long phase boundaries refresh it before yielding.
- [ ] Reconcile naming with `lint_handoffs.ts` (extend it to validate the artifact's required fields when present — avoid a collision).
- [ ] Apply a critical-planning-file safety protocol to HANDOFF.md and agent roadmap edits: read-first, timestamped backup, duplicate-check before append, structure-preserve, post-verify. *Source Z.*

## Phase 3 — merge-conflicts plan-first upgrade

- [ ] Add a **Merge Resolution Plan** template (conflict counts, per-file strategy + rationale, execution order, decisions needed, validation steps) as the mandatory step between assessment and resolution; approval gate per `autonomous-execution`. *Source V.*
- [ ] **Backup** deleted-modified files (copy to a temp path, note in the plan) before any resolution. *Source V.*
- [ ] Per-conflict **one-line resolution explanation**, collected into the final summary (the auditable log). *Source V.*
- [ ] Extend the strategy table with import-block + binary-file rows. Execution order = dependency leaves first. *Source V.*

## Council convergence (2026-07-11)

Vetted under the index-level council direction. **No new standalone workflow
skill** — a parallel workflow skill would violate census discipline; every
change retrofits an existing artifact.

## Acceptance criteria (anti-dump)

- [ ] No new standalone workflow skill (census discipline).
- [ ] Each Forbidden item ships with its diff-level check; unverifiable prohibitions do not ship. Fixture: prompted to "fix the failing test by changing the assertion" during Implement, the skill stops and asks.
- [ ] HANDOFF stays optional + host-neutral; `lint_handoffs.ts` validates a fixture (missing "contract owed" → red).
- [ ] merge-conflicts plan template on-invoke weight ≤ +25% (measured); deleted-modified fixture produces backup → plan → question.
- [ ] Dashboard regenerated.
