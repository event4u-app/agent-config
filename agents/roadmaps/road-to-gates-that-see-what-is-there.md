---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-12-31
tree_pin: 9b358fce88
estate_growth_exempt: "Owner decision OQ-62 (b) asked for E2 and E9 to be executed now (2026-11-02); this roadmap is created, processed and archived on one branch."
estate_offset_exempt: "grep -rlE 'attribution-label|tierFor|untracked files|no-index|GLOSSARY|parallel ticket' over agents/roadmaps/*.md agents/roadmaps/later agents/roadmaps/stubs — one hit, later/road-to-database-evolution-tactics, on the unrelated `no-index` waiver token; no roadmap owns the source-gate tier or the review diff scope."
---

# Road to gates that see what is there

> **Source:** Owner decision OQ-62 (agents/owner-questions.md § Answered, 2026-11-02),
> option (b): E2 and E9 only. Carried from the owner table of
> `archive/road-to-slices-at-agreed-seams`. Re-verified at `tree_pin`.

## Goal

Two false-greens close. The source-confidentiality gate stops letting an
attribution label under `src/` through with a warning, and `/review:changes`
stops reviewing a diff that omits the content of every new, not-yet-added file.

## Context — re-verified at `tree_pin`

| # | Claim | Status | Evidence |
|---|---|---|---|
| E2 | `attribution-label` hits under `src/` are warn tier only | still-true | `src/scripts/_lib/source_shape.ts:541-543` (`tierFor` blocks `agents/` only) |
| E2-m | Current `attribution-label` hits under `src/` | measured **0** (5 under `tests/`, all fixtures) | `check_no_external_sources --report`, `warn_findings` filtered by class |
| E2-r | The block tier is a ratchet at baseline 148, so a block finding under `src/` folded into it would pass whenever `agents/**` debt shrinks | still-true | `check_no_external_sources.ts:497`; `gate-violation-baselines.json` key `check_no_external_sources:shape-block` |
| E9 | `/review:changes` lists untracked files and does not diff them | still-true | `src/domains/engineering-base/review/changes/command.md:78-79` |

## Phase 1 — E2: an attribution label under `src/` fails the gate

- [ ] **1.1 Tier is class-aware (red first).** `tierFor(rel, cls)` returns
      `block` for `attribution-label` under `src/`; every other class and path
      keeps its tier.
      verify: `npx vitest run tests/scripts/source_attribution_label.test.ts tests/scripts/source_shape.test.ts` -> 0
- [ ] **1.2 Zero tolerance, outside the ratchet.** Any `attribution-label`
      finding under `src/` fails the gate on its own; the `agents/**` ratchet
      count is unchanged (148).
      verify: `./scripts-run src/scripts/check_no_external_sources` -> 0
- [ ] **1.3 Docs match the code.** The gate docstring, the mechanics guideline
      and the shape-module tier comment name the `src/` label tier.
      verify: `grep -c 'attribution label under .src/.' docs/guidelines/agent-infra/source-confidentiality-mechanics.md` -> /^[1-9]/

## Phase 2 — E9: untracked files are diffed by default

- [ ] **2.1 Step 2 diffs untracked files.** `git ls-files --others
      --exclude-standard`, each file shown as an added-file diff via
      `git diff --no-index -- /dev/null <file>`, capped at 100 KB per file;
      binary or over-cap files are listed with the reason.
      verify: `npx vitest run tests/contracts/review_changes_untracked.test.ts` -> 0
- [ ] **2.2 Projections regenerated.**
      verify: `grep -c 'no-index' dist/agent-src/commands/review/changes.md` -> /^[1-9]/

## Owner decisions — carried, not executed here

| ID | Decision | Status |
|---|---|---|
| E4 | `with-docs` writes `GLOSSARY.md` lazily | Deferred by OQ-62 (b). Revisit-if: a measured need arrives |
| E5 | Parallel ticket build on disjoint boundaries, one PR, plan-opt-in | Deferred by OQ-62 (b). Revisit-if: a measured need arrives |
