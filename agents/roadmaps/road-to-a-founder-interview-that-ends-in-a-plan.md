---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-12-31
tree_pin: 9b358fce88
estate_growth_exempt: "Owner decision OQ-61 (a), 2026-11-02, asks for one new composed procedure skill behind `/challenge-me founder`, so skill_count rises 302 -> 303 and skill_description_tokens rises by the new description; the admission row in agents/decisions/skill-admissions.jsonl carries the five answers. The roadmap is written, executed and archived in the same change, so active roadmaps do not grow."
estate_offset_exempt: "grep -rliE 'founder interview|founder-interview|challenge-me founder' agents/roadmaps/ (whole tree incl. archive, later, stubs, skipped) — one hit, archive/road-to-slices-at-agreed-seams, which only CARRIED the item as owner decision F1/F2 and closed without executing it (see relates). No active, later or stub roadmap owns the founder interview."
relates:
  - slug: archive/road-to-slices-at-agreed-seams
    relation: continues
    note: "Carried F1 (`/challenge-me founder`, owner demand t3) and F2 (end-ask order prototype -> business plan -> deck) to the owner; OQ-61 answered (a). This roadmap executes both."
---

# Road to a founder interview that ends in a plan

> **Source:** Owner decision OQ-61 (agents/owner-questions.md § Answered,
> 2026-11-02) — "OQ-61: a". Re-verified at `tree_pin` on 2026-11-02.

## Goal

`/challenge-me founder` interviews a founder about hobbies, ideas and everyday
problems, researches market, competition and willingness to pay itself instead
of asking, deepens with the challenge-me grilling, and always ends in a
roadmap. After the roadmap it asks one question per turn, in the order
prototype → business plan → deck, where "prototype" is medium-neutral (pilot,
offer, mock-up, landing page — not only an app). It composes the existing
skills instead of restating them, and it frames, never decides.

## Context — verified at `tree_pin`

| # | Claim | Status | Evidence |
|---|---|---|---|
| C1 | No `founder` sub-command exists; the head routes vision, with-docs, closure | true | `src/domains/meta/challenge-me/command.md:31-37` |
| C2 | A new skill needs ≥ 5 should-trigger and ≥ 5 should-not-trigger queries | true | `src/scripts/lint_new_skill_gate.ts:43` |
| C3 | A roadmap producer must end in the closure pass; 8 producers today | true | `src/scripts/lint_roadmap_producers.ts:34-40`; `tests/scripts/lint_roadmap_producers.test.ts:59` |
| C4 | Strategy and business-plan output frame, never decide; footers are mandatory | true | `src/rules/strategy-safety-floor.md:49`; `src/rules/finance-safety-floor.md:47` |
| C5 | The founder pack already points deck work at `html-deck` | true | `src/packs/founder-strategy/FIRST_WIN.md:40-41` |
| C6 | skill_count has no allowance; growth takes the claim path | true | `src/config/estate-count-budget.json:25` |
| C7 | Standing payload sits at the ceiling (135,865 of 135,867 with the live grant), so a new catalogue line must be paid back | true | `check_preamble_payload_budget` at `tree_pin` |
| C8 | Trigger-eval rotation: slot 10 already holds 23 suites (peak 230 = `MAX_WEEKLY_QUERIES`); a suite named `founder-interview` hashes into slot 10 (projected peak 240), `founder-idea-interview` into slot 6 (12 → 13) | true | `src/scripts/trigger_eval_rotation.ts:121,128-135` |

## Phase 1 — The composed skill

- [x] **1.1 Trigger corpus first.** `src/skills/founder-idea-interview/evals/triggers.json`
      with five exemplars (EN + DE) and five near-misses / counterexamples naming
      the neighbours (`vision-articulation`, `fundraising-narrative`,
      `customer-research`, `/challenge-me vision`, `html-deck`).
      verify: `jq '[.queries[] | select(.trigger==true)] | length' src/skills/founder-idea-interview/evals/triggers.json` -> /^5$/
- [x] **1.2 The procedure skill.** `src/skills/founder-idea-interview/SKILL.md`: interview
      → self-research (market, competition, willingness to pay) → challenge-me
      grilling → roadmap via `roadmap-writing` + closure → one-at-a-time asks
      prototype → business plan → deck; links the composed skills, carries both
      safety floors.
      verify: `./scripts-run src/scripts/lint_new_skill_gate` -> 0
- [x] **1.3 Admission row.** Five answers in `agents/decisions/skill-admissions.jsonl`.
      verify: `./scripts-run src/scripts/check_skill_admissions` -> 0

## Phase 2 — The thin sub-command

- [x] **2.1 `/challenge-me founder`.** `src/domains/meta/challenge-me/founder/command.md`
      routes to the skill, declares `produces_roadmap: true`, ends in the closure
      pass; the head's table and menu list it.
      verify: `./scripts-run src/scripts/lint_roadmap_producers` -> 0
- [x] **2.2 Producer count follows.** `tests/scripts/lint_roadmap_producers.test.ts` 8 → 9.
      verify: `npx vitest run tests/scripts/lint_roadmap_producers.test.ts` -> 0

## Phase 3 — Estate, payload and measurements

- [ ] **3.1 Pay back the catalogue line.** Net zero standing payload.
      verify: `./scripts-run src/scripts/check_preamble_payload_budget --approved oq-42-image-floor-routes-to` -> 0
- [ ] **3.2 Projections, counts and pinned measurements.** `task sync`,
      `task generate-tools`, count docs, routing-coverage seed and the measurement
      tests a new skill moves — only upward.
      verify: `task check-routing-coverage` -> 0
- [ ] **3.3 Rotation stays under its ceiling.**
      verify: `npx vitest run tests/scripts/trigger_eval_rotation.test.ts` -> 0
