---
complexity: lightweight
status: ready
---

# Roadmap: Ecosystem-Harvest — Ergonomics

**Trigger:** Ecosystem survey (see [`road-to-ecosystem-harvest-index`](road-to-ecosystem-harvest-index.md)).
Source cited source-anonymously (**E** = a production slash-command collection);
full provenance in the index § Provenance.

**Priority: P3.** Low-risk ergonomic wins over capabilities the suite already
has — a friendlier front door, not new power.

## Goal

Add a few dispatch/command ergonomics that make the existing skill surface easier
to reach, plus two small self-improvement / documentation loops — none of which
add new capability, only better access to what already ships.

## Reality check — already shipped (do NOT rebuild)

| Candidate | Verdict | Evidence |
|---|---|---|
| Skill/command routing (internal) | Shipped | `analysis-skill-router`, `command-routing`, `slash-command-routing-policy` |
| Subagent orchestration | Shipped, stronger | `subagent-orchestration` (8 modes, cross-model judge), `delegation-policy` |
| TDD skill | Shipped | `test-driven-development` |
| Skill self-improvement | Shipped (skills) | `skill-improvement-pipeline` |
| Per-turn model pinning | Shipped, superior | vendor-neutral `model_tier` + `model-recommendation` (source hardcodes dated model ids) |

- [x] Reality check complete — routing exists *inside rules*; the gaps are a **user-facing dispatch entry**, **per-phase TDD commands**, and a **persona** self-improvement analog.

## Phase 1 — Adopt-now plate (≤ 4 units)

- [ ] **U1 — `/smart-fix` auto-routing dispatcher command.** A user-facing "throw me a problem" entry that classifies the issue and dispatches to the right specialist skill (over the existing routers). *Source E (smart-fix).* Verify: three sample problems route to three correct specialists.
- [ ] **U2 — Per-phase TDD commands.** Thin ergonomic split — `tdd:red` / `tdd:green` / `tdd:refactor` — over the existing `test-driven-development` skill. *Source E.* Verify: each command drives its phase of the existing skill.
- [ ] **U3 — Persona self-improvement loop.** An analog to `skill-improvement-pipeline` targeting **personas**: feed recent corrections/failures → refine a persona's `Unique Questions`. *Source E (improve-agent).* Verify: one persona's questions measurably tightened from a correction sample; respects `persona-governance`.
- [ ] **U4 — Worked hand-off templates.** Add explicit "use the output of step N as context for step N+1" worked examples to `subagent-orchestration` docs (a documentation gap, not a capability gap). *Source E.* Verify: the examples render + match the suite's actual orchestration modes.

## Council convergence (2026-07-11)

Not separately debated (all low-risk ergonomics over existing capability); the
index-level council pass placed this in P3 — nice-to-have, ship after the P1/P2
plates.

## Acceptance criteria

- [ ] `/smart-fix` routes sample problems to the correct specialists.
- [ ] TDD per-phase commands drive the existing skill (no logic duplication).
- [ ] Persona self-improvement loop respects `persona-governance`.
- [ ] Dashboard regenerated.
