---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
depends: road-to-delivery-for-every-host
depends_on: road-to-delivery-for-every-host
relates:
  - slug: road-to-delivery-for-every-host
    relation: depends
    note: >
      Predecessor. Runs after its Phase 4 so this file's measurement lands on the
      post-flip baseline rather than on the pre-flip total.
  - slug: road-to-the-skill-surface-framing-choice
    relation: disjoint
    note: >
      A carrier for one deferred census item, not an owner of the catalog bucket —
      it holds a framing question, this file holds the standing bytes.
estate_growth_exempt: "Owner-instructed 2026-09-07. Charges +1 active roadmap against the origin/main `active_roadmaps` floor of 4 measured at 0918def55 — the floor is the base-ref measurement, not a stored number (ADR-243). The 14,846-token skill catalog is the second-largest standing bucket and is held by no active roadmap; `road-to-the-skill-surface-framing-choice.md` carries `status: carrier` for one deferred census item and does not own the bucket."
estate_offset_exempt: "Offsets nothing. It disposes no roadmap and archives nothing, so the one-in-one-out half has no move available and is claimed here instead."
---

# Road to skill menu economy

> **Source.** Owner instruction 2026-09-07 out of analysis round `inbox-2026-09-u`,
> consumed to `agents/tmp.old/inbox-2026-09-u/`. Re-measured at `0918def55` (v14.20.0);
> corrections forced by that re-measurement carry `corrected-from-reproduction`. Owner
> ruling **E5** is decided in this file. Runs after `road-to-delivery-for-every-host`
> Phase 4 so its measurement lands on the new baseline.

## Goal

The preloaded skills catalog costs no more than the skills a model can actually route to:
every skill that is only ever reached through a command or a flow leaves the model's menu
but stays installed and callable, and a skill-MCP replaces the remaining catalog only if a
pre-registered comparison shows equal-or-better hit rate at equal-or-lower standing bytes.

## Prerequisites

- [ ] Predecessor Phase 4 merged (the baseline this file measures against is the post-flip
      one).
- [ ] Read `src/scripts/_lib/preamble_byte_census.ts:290` (`censusSkillsCatalog`) and
      `src/scripts/schemas/skill.schema.json:28` (the description cap and its recorded
      distribution).
- [ ] Run `agent-config roadmap:context --roadmap road-to-skill-menu-economy` and record the
      probe's `scanned:` line against the `relates:` block above.

## Context

At `0918def55` the catalog bucket is **14,846 tok** for 299 skills
(`check_preamble_payload_budget`, built by `censusSkillsCatalog` from `- name: description`
per skill and reading no body byte). Skill bodies — 299 files, roughly 596k tok — are
already on demand, which is why a corpus that size reports as ~14.8k standing.

**Why shortening descriptions is not the lever — `corrected-from-reproduction`.** The draft
said descriptions sit near a cap at "median 184 chars, max 206". Re-derived over all 299
`SKILL.md` files by two independent methods that agree: **median 181, max 200**, min 133,
with the top of the distribution at 198/199/200. The **206 was structurally impossible**:
`src/scripts/schemas/skill.schema.json:28` sets `description.maxLength: 200`, and its own
docstring records the measured distribution as median 181 / p75 189 / max 200 with zero
over 200 — the cap was lowered from 220 on 2026-08-22 precisely because 220 described no
artifact. The draft's conclusion survives and gets stronger: the corpus is **at** the cap,
not near it, so **count on the menu** is the whole remaining lever and no byte-shaving
budget exists to spend.

Menu-economy fields are nearly unused: `user-invocable` appears on 2 of 299,
`disable-model-invocation` on 1 of 299. The trigger corpus labels 100 of 299 skills
(`src/skills/*/evals/triggers.json`).

**Owner ruling E5 (final):** a skill-MCP is adopted as the catalog carrier only if, on the
labelled trigger corpus, its hit rate ≥ the catalog's and its standing bytes ≤ the catalog's
after Phase 1 — both numbers pre-registered before the comparison runs. The completeness
invariant holds either way: no skill leaves the install.

## Phase 1: Menu census and marking

- [ ] **1.1 Census every skill's entry paths:** model-routed (description match),
      command-only (`src/domains/**/command.md` references), flow-only (`src/flows`), or
      both. Publish the classification in
      `agents/evidence/analysis/skill-menu-census-2026-09.md` pinned to the commit, first
      line `<!-- evidence-type: analysis -->`.
      verify: 299 rows; every row has ≥ 1 entry path or is flagged `orphan`; re-run at the
      same pin is byte-identical; `./scripts-run src/scripts/lint_evidence_artifacts` green.
- [ ] **1.2 Mark command-only and flow-only skills `user-invocable: false`** in frontmatter;
      the projector drops them from the model menu but leaves the skill directory installed.
      verify: skill count on disk 299; `check_preamble_payload_budget` catalog bucket drops
      by the marked skills' name+description bytes; a fixture invokes each marked skill via
      its command successfully.
- [ ] **1.3 Orphans are reported, not deleted.** Any `orphan` row is listed in the PR body
      with its last command reference; no removal.
      verify: `grep -c orphan <census>` equals the PR-body count.

## Phase 2: Skill-MCP comparison (E5)

- [ ] **2.1 Pre-register** the comparison in `internal/bench/skill-menu-vs-mcp-PREREG.md`:
      corpus = `src/skills/*/evals/triggers.json` (100 labelled), arms = post-Phase-1 catalog
      against the existing skill MCP surface, metrics = hit rate and standing bytes, the E5
      criterion verbatim.
      verify: file exists before any run artefact; `--selftest` rejects a planted defect.
- [ ] **2.2 Run both arms; write the artefact; apply E5.** If adopted: the catalog carrier
      flips to MCP for Claude Code only (hosts per the predecessor's `hosts` axis). If not:
      the artefact records the numbers and the catalog stays.
      verify: artefact with both arms' numbers and a one-line verdict citing E5; no catalog
      line removed before the artefact exists.

## Phase 3: Truth surfaces

- [ ] **3.1 Update the census-driven per-host cost table** (predecessor Phase 7.2) with the
      catalog bucket after Phases 1 and 2.
      verify: table equals census.

## Kill register

- **K1** Removing the catalog on the promise of a tool call — a wholesale swap before 2.2.
- **K2** Shortening descriptions to hit the budget. The corpus is at the schema cap of 200
  with median 181; there is no slack, and the recall cost of cutting into it is unmeasured.
- **K3** Deleting orphan skills in this roadmap.
- **K4** New top-level CLI verb; a daemon.
- **K5** Moving this file to `later/` or descoping to a carrier.

## Provenance

- **Source:** an owner-directed external LLM ideation round, consumed to
  `agents/tmp.old/inbox-2026-09-u/`. No third-party repository, product or vendor is a
  source of this plan.
- **Gap table:** `KEEP` — the bucket's standing cost and how `censusSkillsCatalog` computes
  it, the 299-skill corpus, the near-zero use of the two menu-economy fields, the 100
  labelled trigger sets, and E5's pre-registration criterion. `KEEP, corrected` — the
  description distribution (median 181 / max 200 against a schema cap of 200, not 184/206)
  and the catalog bucket (14,846 tok, not 14,849). `CUT` — nothing; the correction
  strengthens the draft's own conclusion rather than removing a step.
- **Council:** none. E5 is an owner ruling.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-07 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|---|---|---|---|---|---|
| 1 | A skill leaves the menu and becomes unreachable in practice | product | `user-invocable: false` is correct only if the command or flow path really is the sole entry. A misclassified skill is installed, listed nowhere, and reachable by nobody — a silent capability loss that every file-count check passes. | 1.1 requires an explicit entry path per row with `orphan` as the only alternative, and 1.2 makes a successful command invocation of each marked skill part of the same verification | Phase 1: Menu census and marking |
| 2 | The MCP arm is adopted on an unfalsifiable comparison | implementation | Both metrics are easy to move after the fact by re-scoping the corpus or redefining a hit. | 2.1 pre-registers corpus, arms, metrics and the E5 criterion verbatim before any run, and 2.2 forbids removing a catalog line before the artefact exists; K1 forbids the wholesale swap | Phase 2: Skill-MCP comparison (E5) |
| 3 | The census is read as a deletion list | product | An `orphan` row looks like dead weight, and the cheapest response to a list of orphans is to remove them. | K3 forbids deletion in this roadmap and 1.3 requires each orphan to ship with its last command reference, so the row is a question rather than a verdict | Phase 1: Menu census and marking |
| 4 | The corrected description figures are re-derived wrongly and reopen K2 | implementation | The draft's 184/206 were wrong in both directions, and a later reader who re-measures loosely could conclude there is byte slack to spend. | The Context names the derivation and the schema line that caps it, and K2 states the cap and the median together so a proposal to shorten meets the number instead of the impression | Phase 1: Menu census and marking |

## Acceptance Criteria

- [ ] Catalog bucket ≤ 10,000 tok on Claude Code after Phase 1, or the census proves fewer
      than 100 skills are command-only or flow-only.
- [ ] 299 skills installed; every marked skill callable by its command.
- [ ] Skill-MCP decision recorded against the pre-registered criterion.
