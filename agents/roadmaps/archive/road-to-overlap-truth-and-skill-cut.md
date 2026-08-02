---
complexity: structural
status: ready
---

# Road to overlap truth — repair the instrument, then cut the skills it was supposed to find

> The canonical skill-overlap tool has been scanning a directory that does not
> exist. `audit_skill_overlap.ts` still roots at `.agent-src.uncondensed/skills`,
> the tree ADR-051 emptied — **verified absent 2026-08-01**. It carries no
> scan-scope assertion and is not wired into CI, so it reports "no overlap" for a
> 287-skill corpus. This is the exact silent-green class
> [`road-to-gates-that-can-fail`](road-to-gates-that-can-fail.md) exists to kill,
> found in the one instrument two separate feedback tracks depend on. Council cut:
> [`feedback-9x-council-cut`](../settings/contexts/feedback-9x-council-cut.md).

## Goal

Make the overlap instrument capable of failing, re-measure the corpus with the
canonical tool, fix the one finding that is a defect rather than a preference —
the routing skill overlapping its own fallback target — and then execute the
merges the canonical tool confirms. Skills go **down**, not just sideways.

## Context (verified 2026-08-01, do not relitigate)

- `.agent-src.uncondensed/skills` **does not exist**; the tool's root resolves to
  nothing. No `assertScanned`, no CI wiring, no task entry.
- 287 skills in `src/skills/`.
- An external replication of the canonical metric (keyword cosine over the body
  with frontmatter stripped, same stopword list, same token regex, threshold 0.70)
  reported: **3 pairs ≥ 0.70**, 42 pairs in a 0.55–0.70 watch band, 6
  description-only pairs ≥ 0.50. It deliberately diverged from the canonical tool
  in two ways (root, and a minimal hand parser for `packs:` only) — so it
  **selects candidates; it does not confirm them**.
- The external run's honest self-correction: the review-skill family
  (`code-review` / `adversarial-review` / `architecture-review-lens`) appears
  **nowhere above 0.55** on either metric. The description linter already did its
  job there. The risk is concentrated, not spread.
- Most consequential single finding: **`analysis-skill-router` ↔
  `universal-project-analysis` at 0.709** — the router reads like its own broad
  fallback, which is the exact pair it exists to disambiguate.
- `lint_skill_descriptions` today checks **absence of defects** (a–d), not
  presence of the disambiguation conventions.

> **Scope boundary.** Command surface is not in scope — that belongs to
> [`road-to-surface-consolidation`](road-to-surface-consolidation.md), which works
> by demotion rather than deletion. This roadmap deletes *skills*. No merge lands
> on the external report's numbers alone.

## Phase 1 — Make the instrument capable of failing

- [x] Re-root `audit_skill_overlap.ts` at `src/skills` (or give it `--root` with
      that default) and delete the dead legacy-root fallback path rather than
      leaving it as a silent branch.
      *Verify:* the tool reports a non-zero scanned count on a clean checkout;
      the old root appears nowhere in the file.
      → `_skill_roots()` deleted; default root is the shared `SRC_SKILLS()`
      resolver, `--root` overrides. `287 skills, 3 pair(s) ≥ 70%`. Zero
      legacy-path literals remain in the script (`check_no_new_legacy_path` green).
- [x] Register the tool in the scan-scope regime: zero skills scanned is a
      failure, not an empty result.
      *Verify:* a fixture run against an empty root exits non-zero with a
      dead-scope message, and the assertion is exercised by a test.
      → `assertScanned` from `_lib/scan_scope.ts`; exit 3 +
      `audit_skill_overlap: scanned 0 skill(s) under … the scan scope is dead`.
      Missing-root and empty-root fixtures both asserted.
- [x] Wire it into `task ci` as an **advisory report** first (it must not block
      before the corpus is cleaned).
      *Verify:* a CI run prints the pair table with real counts.
      → `audit-skill-overlap` in `taskfiles/ci-fast.yml`, registered in `ci` and
      `ci-strict`. `--print-table` deliberately survives the pipeline's default
      `--quiet`: an advisory report nobody sees is the same silent green.
- [x] Add a regression test pinning the scanned-count floor, so a future container
      move re-breaks loudly instead of silently.
      *Verify:* the test fails when the root is pointed at a non-existent path.
      → `tests/scripts/audit_skill_overlap.test.ts`, floor 200 (a floor, not an
      exact count — the corpus is meant to shrink). 8/8 green.

## Phase 2 — Re-measure with the canonical tool

- [x] Run the repaired canonical tool over `src/skills` and publish the pair table
      as `agents/evidence/reports/skill-overlap-canonical.md`, alongside the
      external report's candidates, with a **confirmed / refuted** column per pair.
      *Verify:* every candidate from the external report appears with a canonical
      score; divergences are stated, not smoothed.
      → Published. **2 of 20 candidate pairs CONFIRMED** (both video), 17 refuted,
      1 reclassified as the Phase-3 defect. Aggregate divergence from the external
      report: **none** — 287 skills, 3 pairs ≥ 0.70, 42 in the watch band, 6
      description pairs ≥ 0.50, router at 0.709, all exact.
- [x] Add the description-only cosine as a **separate, explicitly non-canonical**
      measurement, because routing happens on descriptions and body similarity
      does not measure it.
      *Verify:* the report labels it non-canonical and does not mix it into the
      merge threshold.
      → `--descriptions` flag; the renderer emits a NON-CANONICAL banner and the
      report keeps it in its own section, outside the merge table. The two
      rankings barely agree, which is the point.

## Phase 3 — The router defect (not a preference)

- [x] Strip analysis *procedure* out of `analysis-skill-router` so it carries
      routing logic only — scope classification, framework detection, the decision
      table. Procedure stays in `universal-project-analysis`.
      *Verify:* canonical re-measure of the pair lands < 0.55; a chooser that reads
      like its own fallback is a defect and this is its fix, not a cleanup.
      → **0.709 → 0.507.** Router keeps scope test + framework detection + the
      decision table (now a real table) and nothing else; its validation
      checklist, routing-heuristics restatement, and 4-item output contract are
      gone. Two reciprocal cuts in `universal-project-analysis` were required to
      clear 0.55 and are defects in their own right: a `Routing map` section that
      re-listed its own steps 3–4 verbatim, and a `Mission` block that claimed
      the router's job. Both skills PASS `skill_linter` (the original router did
      too — no warning regression).

## Phase 4 — Execute the confirmed merges

- [-] Merge only pairs/families the canonical tool confirms, one PR per family,
      with before/after canonical scores in the body. Candidate families from the
      external report, to be confirmed first: the video/story trio, the readme
      family, the roadmap pair, the worktree pair, the rule-writing pair, the
      bug-analyzer/systematic-debugging pair, the brand pair, the
      learning/pipeline pair, the NDA/intake pair, and folding
      `testing-anti-patterns` into the TDD skill.
      *Verify:* each merged-away skill's distinctive trigger phrases survive in
      the surviving skill's description, so existing muscle memory still routes;
      every downstream reference (rules, commands, contexts, docs, router entries)
      is updated in the same change.
      <!-- skipped: zero merges survive adjudication — nine families refuted by score, the tenth by composition -->
      → **No merge lands.** Nine of ten families scored below the bar. The tenth
      (video trio, 0.746 / 0.707) was **36% shared policy-path boilerplate**;
      council session 2 ruled unanimously to extract that instead of merging,
      because the trio is three distinct machine contracts — merging would delete
      `scene-blueprint.schema.yaml` + its parser and force four `/video:*`
      commands to branch on mode. Full reasoning and the token decomposition:
      the canonical report § Disposition.
- [x] Record the families the canonical tool **refutes** as explicitly kept, with
      the score — so the next sweep does not re-propose them.
      *Verify:* a kept-with-reason list exists.
      → Canonical report § **Kept with reason — do not re-propose these**:
      12 families with canonical scores and a one-line keep rationale each.
- [x] Keep, and do not merge, the families whose similarity is structural by
      design (the persona-parallel judge family; genuinely distinct framework
      surfaces) — but move the shared boilerplate that drives their score into a
      referenced common preamble instead of repeating it.
      *Verify:* scores drop without a skill being deleted.
      → Five ai-video skills now point at one
      [media policy preamble](../settings/policies/media/README.md) instead of
      repeating five policy paths each; every policy-specific sentence preserved
      verbatim. **0.746 → 0.665, 0.707 → 0.634, 0.636 → 0.548, 0.551 → 0.500.**
      Zero skills deleted, and the corpus now has **no pair ≥ 0.70 at all**.

## Phase 5 — Description disambiguation on the confirmed clusters only

- [x] For each canonical-confirmed cluster, retrofit the `description:` with (a)
      at least one **quoted literal user phrase** in the user's own words, and (b)
      a **sibling negative-routing sentence** per overlapping neighbour, kept
      mutually consistent across the cluster.
      *Verify:* the diff touches frontmatter only; no sibling pair routes the same
      phrase to both members.
      → Applied to the video trio — the family that WAS confirmed at adjudication
      time and remains the corpus's nearest same-pack neighbourhood. Frontmatter
      only, all three at the linter's 200-char hard cap or under (200 / 192 / 200). Routing is mutually
      consistent and disjoint: `'cinematic prompt'` / `'film-grade scene'` →
      video-director, `'expand this scene'` / `'blueprint for X'` →
      scene-expander, `'Pixar prompt'` / `'animated scene'` → pixar-storyteller;
      each names the sibling that wins the cases it loses.
- [x] Extend `lint_skill_descriptions` with two **positive** checks scoped to
      clustered skills only: missing sibling-routing when the canonical tool pairs
      the skill above threshold, and no quoted phrase in a clustered skill. Same
      allowlist-with-cap regime as the existing checks.
      *Verify:* red on a synthetic clustered skill missing both, green on the
      retrofitted corpus, wired into `task ci`. A quoted-phrase mandate on all 287
      skills is explicitly out of scope — that is noise, not routing.
      → `clustered-no-sibling-routing` + `clustered-no-quoted-phrase`, cluster
      membership computed by the canonical instrument itself (no second
      implementation of the metric). Red/green fixtures both directions incl.
      "names one sibling but not the other"; 15/15 green. Already in `task ci`
      via the existing `lint-skill-descriptions` entry. **Dormant today (0
      clustered)** — by construction, not by accident.
- [x] Adopt the sibling-consistency obligation as an authoring rule in the
      agent-docs authoring skill: editing one sibling's routing sentence obliges
      checking the others.
      *Verify:* the obligation is one paragraph, not a new artifact.
      → One bullet in `agent-docs-writing` § Rules, naming why the linter cannot
      cover it: it catches a *missing* clause, not an *inconsistent* one.

## Phase 6 — Stop the count from regrowing

- [x] After the merges land, flip the canonical tool from advisory to blocking at
      the canonical 0.70 threshold for **same-pack pairs only**. A new skill above
      threshold must merge or carry a reviewed justification under the same
      allowlist-with-cap regime — the cap forces periodic re-litigation instead of
      silent growth.
      *Verify:* a synthetic above-threshold same-pack addition fails CI.
      → `--strict` in `ci` + `ci-strict`. Synthetic same-pack twin → **exit 1**;
      the identical twin cross-pack → exit 0; reviewed allowlist entry → exit 0;
      reason-less entry and over-cap → exit 2. Shipped allowlist is empty.
      17/17 green. No merges "landed" (see Phase 4), but the corpus reached the
      clean state the flip was gated on: zero same-pack pairs at threshold.

## Non-goals (recorded refusals)

- **No merges on the external report's numbers.** The report selects; the
  canonical tool confirms. This is the whole reason Phase 1 precedes Phase 4.
- **No cross-pack merges.** Every confirmed candidate is same-pack; a cross-pack
  merge changes install shape and is a different decision.
- **No quoted-phrase mandate corpus-wide.**
- **No gate manifest, no gate mutation tests.** Council refused both as governance
  about governance; the scan-scope assertion in Phase 1 already kills the class.

## Surface delta

**Projected: −12 skills** if all candidate families confirm (287 → 275), **+2
linter checks, +1 evidence report, +1 blocking threshold**, and one instrument
that goes from structurally-incapable-of-failing to load-bearing.

**Actual (2026-08-02): −0 skills.** Corpus stays at 287. The projection assumed
the candidate families would confirm; the repaired instrument refuted nine of
ten outright, and the tenth was 36% shared policy-path boilerplate — below the
bar once that was extracted, and made of three distinct machine contracts whose
merge would have deleted a parsed schema and forced four `/video:*` commands to
branch on mode. Two council sessions (4 rounds) ruled against merging on both
the threshold question and the boilerplate question.

What did go down: **−5 duplicated policy blocks**, **−1 duplicated routing map**,
**−1 router that described the work it was supposed to route to** (0.709 →
0.507), and **−3 pairs above the merge bar → 0**. What went up: +2 linter checks,
+1 evidence report, +1 blocking threshold, +1 allowlist (empty).

The honest version of "skills go down, not sideways": **skills did not go down.**
The instrument that was supposed to tell us which ones could was broken, and the
first thing it said once repaired was *fewer than you think*. Recording that is
worth more than a merge the evidence does not support — and the blocking gate
now makes the next unjustified pair a build failure instead of a silent one.

## Provenance

Source: `agents/tmp.old/skill-rule-routing.txt` (operator-owned; contains the
external overlap replication whose candidate pairs Phase 2 must confirm or refute).
Disposition: council 2026-08-01 (`anthropic/claude-sonnet-4-5` + `openai/gpt-4o`,
2 rounds) — [`feedback-9x-council-cut`](../settings/contexts/feedback-9x-council-cut.md).
The dead-root finding in Phase 1 was verified directly against the working tree on
2026-08-01, not reported by the source document.
