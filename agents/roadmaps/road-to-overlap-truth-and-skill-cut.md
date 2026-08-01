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

- [ ] Re-root `audit_skill_overlap.ts` at `src/skills` (or give it `--root` with
      that default) and delete the dead legacy-root fallback path rather than
      leaving it as a silent branch.
      *Verify:* the tool reports a non-zero scanned count on a clean checkout;
      the old root appears nowhere in the file.
- [ ] Register the tool in the scan-scope regime: zero skills scanned is a
      failure, not an empty result.
      *Verify:* a fixture run against an empty root exits non-zero with a
      dead-scope message, and the assertion is exercised by a test.
- [ ] Wire it into `task ci` as an **advisory report** first (it must not block
      before the corpus is cleaned).
      *Verify:* a CI run prints the pair table with real counts.
- [ ] Add a regression test pinning the scanned-count floor, so a future container
      move re-breaks loudly instead of silently.
      *Verify:* the test fails when the root is pointed at a non-existent path.

## Phase 2 — Re-measure with the canonical tool

- [ ] Run the repaired canonical tool over `src/skills` and publish the pair table
      as `agents/evidence/reports/skill-overlap-canonical.md`, alongside the
      external report's candidates, with a **confirmed / refuted** column per pair.
      *Verify:* every candidate from the external report appears with a canonical
      score; divergences are stated, not smoothed.
- [ ] Add the description-only cosine as a **separate, explicitly non-canonical**
      measurement, because routing happens on descriptions and body similarity
      does not measure it.
      *Verify:* the report labels it non-canonical and does not mix it into the
      merge threshold.

## Phase 3 — The router defect (not a preference)

- [ ] Strip analysis *procedure* out of `analysis-skill-router` so it carries
      routing logic only — scope classification, framework detection, the decision
      table. Procedure stays in `universal-project-analysis`.
      *Verify:* canonical re-measure of the pair lands < 0.55; a chooser that reads
      like its own fallback is a defect and this is its fix, not a cleanup.

## Phase 4 — Execute the confirmed merges

- [ ] Merge only pairs/families the canonical tool confirms, one PR per family,
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
- [ ] Record the families the canonical tool **refutes** as explicitly kept, with
      the score — so the next sweep does not re-propose them.
      *Verify:* a kept-with-reason list exists.
- [ ] Keep, and do not merge, the families whose similarity is structural by
      design (the persona-parallel judge family; genuinely distinct framework
      surfaces) — but move the shared boilerplate that drives their score into a
      referenced common preamble instead of repeating it.
      *Verify:* scores drop without a skill being deleted.

## Phase 5 — Description disambiguation on the confirmed clusters only

- [ ] For each canonical-confirmed cluster, retrofit the `description:` with (a)
      at least one **quoted literal user phrase** in the user's own words, and (b)
      a **sibling negative-routing sentence** per overlapping neighbour, kept
      mutually consistent across the cluster.
      *Verify:* the diff touches frontmatter only; no sibling pair routes the same
      phrase to both members.
- [ ] Extend `lint_skill_descriptions` with two **positive** checks scoped to
      clustered skills only: missing sibling-routing when the canonical tool pairs
      the skill above threshold, and no quoted phrase in a clustered skill. Same
      allowlist-with-cap regime as the existing checks.
      *Verify:* red on a synthetic clustered skill missing both, green on the
      retrofitted corpus, wired into `task ci`. A quoted-phrase mandate on all 287
      skills is explicitly out of scope — that is noise, not routing.
- [ ] Adopt the sibling-consistency obligation as an authoring rule in the
      agent-docs authoring skill: editing one sibling's routing sentence obliges
      checking the others.
      *Verify:* the obligation is one paragraph, not a new artifact.

## Phase 6 — Stop the count from regrowing

- [ ] After the merges land, flip the canonical tool from advisory to blocking at
      the canonical 0.70 threshold for **same-pack pairs only**. A new skill above
      threshold must merge or carry a reviewed justification under the same
      allowlist-with-cap regime — the cap forces periodic re-litigation instead of
      silent growth.
      *Verify:* a synthetic above-threshold same-pack addition fails CI.

## Non-goals (recorded refusals)

- **No merges on the external report's numbers.** The report selects; the
  canonical tool confirms. This is the whole reason Phase 1 precedes Phase 4.
- **No cross-pack merges.** Every confirmed candidate is same-pack; a cross-pack
  merge changes install shape and is a different decision.
- **No quoted-phrase mandate corpus-wide.**
- **No gate manifest, no gate mutation tests.** Council refused both as governance
  about governance; the scan-scope assertion in Phase 1 already kills the class.

## Surface delta

**−12 skills** if all candidate families confirm (287 → 275), **+2 linter checks,
+1 evidence report, +1 blocking threshold**, and one instrument that goes from
structurally-incapable-of-failing to load-bearing. Net negative in the unit that
costs routing quality every session.

## Provenance

Source: `agents/tmp.old/skill-rule-routing.txt` (operator-owned; contains the
external overlap replication whose candidate pairs Phase 2 must confirm or refute).
Disposition: council 2026-08-01 (`anthropic/claude-sonnet-4-5` + `openai/gpt-4o`,
2 rounds) — [`feedback-9x-council-cut`](../settings/contexts/feedback-9x-council-cut.md).
The dead-root finding in Phase 1 was verified directly against the working tree on
2026-08-01, not reported by the source document.
