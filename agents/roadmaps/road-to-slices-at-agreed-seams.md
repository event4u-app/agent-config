---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-12-31
tree_pin: c183b82358
estate_growth_exempt: "Operator asked for this roadmap to be made active and processed in the same invocation (2026-11-02, /analyze:inbox … then /roadmap:process-full, one PR, merged). It closes and archives in that PR."
estate_offset_exempt: "grep -rlE 'frontier|GLOSSARY|vertical slice|expand.contract|diff --cached|horizontal slice|debug-log prefix' over agents/roadmaps/*.md agents/roadmaps/later agents/roadmaps/stubs (whole roadmap tree) — no roadmap owns the challenge-me grilling repairs, the review diff matrix or the ticket-slicing rule; later/road-to-guided-journeys owns only the router (not planned here)."
relates:
  - slug: later/road-to-guided-journeys
    relation: disjoint
    note: "Owns the workflow router / flow membership. Third arrival recorded there; not planned here."
  - slug: later/road-to-a-retro-the-merge-runs
    relation: disjoint
    note: "Owns retro learning kinds (mechanical vs judgement). Not planned here."
---

# Road to slices at agreed seams

> **Source:** `agents/tmp.old/inbox-2026-11-i/` (topics t1, t3) — two agent
> analyses of an external skill-carrying package plus one founder-interview
> proposal, each beside an owner transcript. Re-verified at `tree_pin` on
> 2026-11-02; claims the tree overtook are marked *overtaken*.

## Goal

The plan interview asks only questions whose prerequisites are settled, the
pitch declares the seams its tests sit at, tickets come out as vertical slices,
and the review never reports "nothing to review" while staged work exists. No
source name stands in `src/`, and the gate would see one if it did.

Owner constraint (transcripts): *learn, use and adapt — extend what exists, do
not build a second copy.* Every step edits an existing artefact; no new command,
no new skill, no new always-on rule text.

## Context — re-verified at `tree_pin`

| # | Claim | Status | Evidence |
|---|---|---|---|
| D1 | External source named as a path in `src/`; gate green and not even warning | still-true | `src/domains/meta/challenge-me/vision/command.md:458`, `with-docs/command.md:351` |
| — | Gate baseline expires 2026-10-25 | **overtaken** — reaffirmed, expires 2026-12-21 | `src/config/gate-violation-baselines.json` |
| D2/D4 | Grilling walks depth-first; stop is a 95 % heuristic | still-true | `vision/command.md:197`, `:97-118` |
| D3 | `with-docs` reads `CONTEXT.md` only | still-true | `with-docs/command.md:24-26` |
| D5 | Pitch has no seams / test decisions | still-true | `grep -ci seam vision/command.md` = 0 |
| D6 | One ticket per roadmap step, no vertical slice, no expand–contract | still-true | `src/skills/emit-tickets/SKILL.md:56` |
| D8–D10 | TDD lacks seam / horizontal slice; quality judge has no named smells; debugging has no tagged debug logs | still-true | greps = 0 in the three skills |
| D15 | Grilling only for maintainers | **overtaken** (#2730) | `challenge-me/command.md:14-17` |
| D15b | Stale `lint_flows.py` references | still-true | `src/flows/*.yaml`, `flow.schema.json:5,13`, `generate_cookbook.ts:13` |
| D17 | Review diffs committed (two-dot) + unstaged only; staged-only work → "nothing to review" | still-true | `src/domains/engineering-base/review/changes/command.md:70-74` |
| D18 | `/implement-ticket` fetches tracker text without the quarantine pointer | still-true | `implement-ticket/command.md:40-42`; `/work` has it at `work/command.md:69` |
| F3 | `with-docs` tags a menu option inline as "recommended"; cluster menu has no recommendation line | still-true | `with-docs/command.md:268`; `challenge-me/command.md:59-65` |
| F4 | Founder pack FIRST_WIN says no deck is written | still-true (stale) | `src/packs/founder-strategy/FIRST_WIN.md:40-41` |
| D13 | Every skill carries `## Do NOT`, nothing pairs it with a positive goal | still-true | `skill_linter.ts:1733-1739` |

## Phase 1 — Nothing reported green that the check did not see

- [ ] **1.1 Remove the two source lines (D1).** Drop the `Inspiration:` bullets
      in `vision/command.md` and `with-docs/command.md`; regenerate projections.
      verify: `grep -c 'Inspiration:' src/domains/meta/challenge-me/vision/command.md src/domains/meta/challenge-me/with-docs/command.md` prints 0 for both.
- [ ] **1.2 The gate sees the D1 shape.** A `src/` fixture carrying an
      `Inspiration: <owner>/<repo>/…/SKILL.md` line is at least a warn finding of
      `check_no_external_sources`; a test pins it.
      verify: the new test fails with the detection reverted and passes with it.
- [ ] **1.3 Review diff matrix, committed + staged (D17).** Step 2 of
      `/review-changes` diffs against the merge-base (three-dot) and adds
      `git diff --cached`; "empty" only when every source is empty. Untracked
      files are *listed* (never diffed by default — owner decision E9).
      verify: `grep -cE 'diff --cached|merge-base' src/domains/engineering-base/review/changes/command.md` ≥ 2 and the "both empty" wording is gone.
- [ ] **1.4 Quarantine pointer in `/implement-ticket` (D18).**
      verify: `grep -c untrusted-input-defense src/domains/engineering-base/implement-ticket/command.md` ≥ 1.

## Phase 2 — Agree before slicing

- [ ] **2.1 Frontier grilling (D2/D4).** Ask only from the frontier (questions
      whose prerequisites are answered); fact lookups never block a turn; stop
      when the frontier is empty, then check the four completion conditions.
      One question per turn stays.
      verify: `grep -ci frontier src/domains/meta/challenge-me/vision/command.md` ≥ 2 and `grep -c depth-first` = 0.
- [ ] **2.2 Glossary read side (D3).** `with-docs` reads `GLOSSARY.md` first,
      `CONTEXT.md` as fallback. Writing stays off (owner decision E4).
      verify: `grep -c GLOSSARY.md src/domains/meta/challenge-me/with-docs/command.md` ≥ 1.
- [ ] **2.3 Seams and test decisions in the pitch (D5).** Declared, never asked.
      verify: `grep -ci seam src/domains/meta/challenge-me/vision/command.md` ≥ 2.
- [ ] **2.4 Vertical slices in `emit-tickets` (D6).** Vertical-slice rule,
      prefactoring first, expand–contract as the one exception for wide refactors.
      verify: `grep -ciE 'vertical|expand.contract' src/skills/emit-tickets/SKILL.md` ≥ 2.
- [ ] **2.5 Recommendation lines in the cluster (F3).** Neutral option block plus
      one recommendation line in `with-docs` and under the cluster menu.
      verify: `grep -c -- '— recommended\.' src/domains/meta/challenge-me/with-docs/command.md` = 0 and `grep -c 'Recommendation' src/domains/meta/challenge-me/command.md` ≥ 1.

## Phase 3 — Build, review and debug at the seams

- [ ] **3.1 Skill deltas (D8–D10).** TDD names the declared seam and horizontal
      slicing as an anti-pattern; the quality judge carries named smells as lead
      words (always a judgement); debugging tags temporary logs with one prefix and
      removes them by grep.
      verify: `grep -ci seam src/skills/test-driven-development/SKILL.md` ≥ 1; `grep -ciE 'shotgun surgery|primitive obsession' src/skills/judge-code-quality/SKILL.md` ≥ 1; `grep -c 'DEBUG-' src/skills/systematic-debugging/SKILL.md` ≥ 1.
- [ ] **3.2 Flow references point at the real linter (D15b).**
      verify: `grep -rn 'lint_flows.py' src/flows src/scripts/schemas src/scripts/generate_cookbook.ts` prints nothing.
- [ ] **3.3 `Do NOT` stage 1 (D13).** Additive linter suggestion: a `Do NOT`
      section with no positive-goal pairing earns an info-level hint, never an error.
      verify: a fixture skill without pairing produces the hint in a test; the existing skill suite stays green.
- [ ] **3.4 FIRST_WIN names the deck path (F4).**
      verify: `grep -c 'not\*\* write the actual deck' src/packs/founder-strategy/FIRST_WIN.md` = 0.

## Owner decisions — carried, not executed here

| ID | Decision | Recommendation |
|---|---|---|
| E2 | `src/` in the source gate to block | Yes — strengthens a floor; council first |
| E4 | `with-docs` writes `GLOSSARY.md` lazily | Yes, opt-in |
| E5 | Parallel ticket build (disjoint boundaries, one PR) | Off by default, plan-opt-in |
| E9 | Untracked files in the review diff by default | Yes, size-capped, `.gitignore`-respecting |
| F1 | `/challenge-me founder` interview (owner demand, t3) | Build as a thin sub-command; needs a skill-count exemption |
| F2 | Order of the end asks: prototype → business plan → deck | Prototype first, as the owner named it |

## Kill / decline register

| ID | Item | Reason |
|---|---|---|
| K2 | New `/to-spec`, `/to-tickets`, `/implement-spec`, `/teach` commands | Counterparts exist (`!pitch`, `emit-tickets`, `/implement-ticket`, `learning-tutor`) |
| K10 | Tracker publishing / two-way sync | ADR-102 |
| K11 | Typed spec/ticket contracts | Ticket YAML + manifest are the contract |
| K16 | Central rejection index (D16) | Recorded by-design (`recurring-criticism-mechanics.md:36-40`); `roadmaps-owned.md` + inbox recurrence cover the arrival side |
