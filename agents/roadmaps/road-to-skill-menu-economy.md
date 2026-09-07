---
complexity: lightweight
execution:
  mode: phase-checkpoints
depends_on: road-to-delivery-for-every-host
estate_growth_exempt: "Owner-instructed, 2026-09-07. The 14.8k-token skill catalog is the second-largest standing bucket and is held by no active roadmap; `road-to-the-skill-surface-framing-choice.md` is a carrier for one deferred census item, not an owner of the bucket. Charges +1 active roadmap."
estate_offset_exempt: "Offsets nothing."
---

# Road to skill menu economy

> **Source:** owner instruction 2026-09-07, verified against `6a98e0e` (v14.20.0). Owner ruling **E5** is decided in this file. Runs after `road-to-delivery-for-every-host` Phase 4 so its measurement lands on the new baseline.

## Goal

The preloaded skills catalog costs no more than the skills a model can actually route to: every skill that is only ever reached through a command or a flow leaves the model's menu but stays installed and callable, and a skill-MCP replaces the remaining catalog only if a pre-registered comparison shows equal-or-better hit rate at equal-or-lower standing bytes.

## Context

At 6a98e0e the catalog bucket is 14,849 tok for 299 skills (`check_preamble_payload_budget`, `censusSkillsCatalog`): name plus description only; bodies (~596k tok) are already on demand. Descriptions are already near a cap (median 184 chars, max 206 across `src/skills/*/SKILL.md`), so shortening is not the lever; **count on the menu** is. Menu-economy fields are nearly unused: `user-invocable` on 2/299, `disable-model-invocation` on 1/299. The trigger corpus labels 100/299 skills.

**Owner ruling E5 (final):** a skill-MCP is adopted as the catalog carrier only if, on the labelled trigger corpus, its hit rate ≥ the catalog's and its standing bytes ≤ the catalog's after Phase 1 — both numbers pre-registered before the comparison runs. The completeness invariant holds either way: no skill leaves the install.

## Phase 1: Menu census and marking

- [ ] **1.1 Census every skill's entry paths:** model-routed (description match), command-only (`src/domains/**/command.md` references), flow-only (`src/flows`), or both. Publish the classification in `agents/evidence/analysis/skill-menu-census-2026-09.md` pinned to the commit.
      verify: 299 rows; every row has ≥ 1 entry path or is flagged `orphan`; re-run is byte-identical.
- [ ] **1.2 Mark command-only and flow-only skills `user-invocable: false`** in frontmatter; the projector drops them from the model menu but leaves the skill directory installed.
      verify: skill count on disk 299; `check_preamble_payload_budget` catalog bucket drops by the marked skills' name+description bytes; a fixture invokes each marked skill via its command successfully.
- [ ] **1.3 Orphans are reported, not deleted.** Any `orphan` row is listed in the PR body with its last command reference; no removal.
      verify: `grep -c orphan <census>` equals the PR-body count.

## Phase 2: Skill-MCP comparison (E5)

- [ ] **2.1 Pre-register** the comparison in `internal/bench/skill-menu-vs-mcp-PREREG.md`: corpus = `src/skills/*/evals/triggers.json` (100 labelled), arms = post-Phase-1 catalog vs existing skill MCP surface, metrics = hit rate and standing bytes, the E5 criterion verbatim.
      verify: file exists before any run artefact; `--selftest` rejects a planted defect.
- [ ] **2.2 Run both arms; write the artefact; apply E5.** If adopted: catalog carrier flips to MCP for Claude Code only (hosts per predecessor's `hosts` axis). If not: the artefact records the numbers and the catalog stays.
      verify: artefact with both arms' numbers and a one-line verdict citing E5; no catalog line removed before the artefact exists.

## Phase 3: Truth surfaces

- [ ] **3.1 Update the census-driven per-host cost table** (predecessor 7.2) with the catalog bucket after Phase 1/2.
      verify: table equals census.

## Acceptance Criteria

- [ ] Catalog bucket ≤ 10,000 tok on Claude Code after Phase 1, or the census proves fewer than 100 skills are command/flow-only.
- [ ] 299 skills installed; every marked skill callable by command.
- [ ] Skill-MCP decision recorded against the pre-registered criterion.

## Kill register

- **K1** Removing the catalog on the promise of a tool call (wholesale swap before 2.2).
- **K2** Shortening descriptions to hit the budget (already at cap; recall cost unmeasured).
- **K3** Deleting orphan skills in this roadmap.
- **K4** New CLI verb; a daemon.
- **K5** Moving this file to `later/` or descoping to a carrier.
