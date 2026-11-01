# Skill-duplication findings — Phase 3 consolidation discovery

Replaces the *assumption* that "227 skills is duplicative" with **evidence**, and
defines the merge-gate. **No skill is merged here** — any actual merge is a
separate roadmap (per `preservation-guard` + `minimal-safe-diff`). Scope +
method settled by AI-council (claude-sonnet-4-5 + gpt-4o, 2026-06-09).

## Headline

A within-family description-similarity scan over all **227 skills** surfaces only
**10 pairs ≥ 0.35** TF-IDF cosine (5 ≥ 0.45) — and **every one has a documented
reason to stay distinct.** **Zero merge candidates survive scrutiny.** The
duplication assumption is not supported by the evidence.

## Method (reproducible)

- **Input:** `docs/contracts/skill-family-map.yml` (the Phase-2 spine).
  Schema-validated against `src/skills/` first — fail-fast on drift (227 == 227 ✓).
- **Similarity:** manual **TF-IDF cosine** over each skill's frontmatter
  `description:` (the trigger/capability surface), tokens = lowercased alphanum
  ≥ 3 chars minus a small stop-list. Compared **within family only** (the spine's
  `family`) — cross-family pairs are noise (different domains).
- **Dormancy:** `git log --since='6 months ago' -- src/skills/<name>/`.
- Re-run: the one-shot logic above (no committed generator yet; a follow-up may
  wire it into CI).

## Findings — within-family pairs ≥ 0.35 (all keep-distinct)

| Score | Family | Pair | Why keep distinct |
|---|---|---|---|
| 0.64 | backend-data | `laravel` ↔ `symfony-workflow` | different frameworks; `laravel-routing` / `symfony-routing` rules exist precisely to disambiguate |
| 0.61 | debugging-analysis | `project-analyzer` ↔ `universal-project-analysis` | layered — single-pass vs deep multi-pass audit (the former's description routes to the latter) |
| 0.49 | product-discovery | `estimate-ticket` ↔ `refine-ticket` | distinct workflow steps (size vs rewrite/AC) |
| 0.46 | review-judging | `judge-bug-hunter` ↔ `judge-code-quality` | distinct single-scope **lenses** — merging violates the [review-lens dispatch contract](contracts/review-lens-schema.md) |
| 0.46 | frontend-design | `blade-ui` ↔ `livewire` | distinct Laravel view stacks |
| 0.41 | backend-data | `project-analysis-laravel` ↔ `project-analysis-node-express` | different stacks (analysis carve-outs) |
| 0.38 | agent-admin | `command-routing` ↔ `command-writing` | routing (dispatch) vs authoring |
| 0.36 | agent-admin | `roadmap-management` ↔ `roadmap-writing` | managing/progress vs authoring |
| 0.35 | review-judging | `judge-bug-hunter` ↔ `judge-test-coverage` | distinct single-scope lenses (dispatch contract) |
| 0.35 | backend-data | `project-analysis-laravel` ↔ `project-analysis-symfony` | different frameworks |

**Dormancy:** **0 / 227** skills are git-dormant — but a corpus-wide restructure +
condensation touched every skill in the last 6 months, so the 6-month commit
signal is **currently uninformative**. It becomes meaningful once the tree
settles; re-run then.

## Scoped human-audit surface

The maintainer's audit set (per the roadmap) is bounded to: (a) skills in
`archive/skipped/stubs` — **none exist** in `src/skills/`; and (b) the 10
highest-similarity pairs above. Evidence-based disposition for all 10:
**keep distinct**, reasons recorded above. The maintainer may override, but no
pair presents a duplication case on the evidence.

## Merge gate

```
A MERGE CANDIDATE IS PROPOSED ONLY IF IT IS GENUINELY DUPLICATIVE
AND ROUTING STAYS STABLE (>=95% OF CORPUS PROMPTS ROUTE TO THE SAME
SKILL OR A DOCUMENTED REPLACEMENT) AFTER CONSOLIDATION.
```

- `validation_method: live_telemetry_required` · **`status: deferred`**.
- **The ≥95% routing criterion is ADVISORY, not an automated gate, in this phase.**
  Live telemetry is not deployed and there is no skill-*selection* oracle
  (`skill_trigger_eval.py` measures trigger *coverage*, not which skill wins a
  multi-match; only 14/227 skills carry `triggers.json`). A synthetic harness is
  a **hypothesis generator, not a validator** — gating a merge on it would be
  theatre. The gate activates when live selection telemetry exists.

## `candidate_for_merge` (the Phase-3 spine conclusion)

**Empty.** No skill is flagged `candidate_for_merge` — the evidence disposition is
keep-distinct for all 10 surfaced pairs. The `skill-family-map.yml` `candidate_*`
fields therefore remain absent (a populated value would assert a conclusion the
evidence does not support).

## Limitations

- **Description-similarity only.** The capability signal is the `description:`
  field; trigger-data is too sparse (14/227 `triggers.json`) for the council's
  intended description+trigger composite. A future pass with full trigger data
  could refine the scores.
- **No selection oracle / synthetic predictions** ≠ production routing.
- **Dormancy uninformative now** (post-restructure timestamp reset).

## See also

- [`skill-family-map.yml`](contracts/skill-family-map.yml) · [`skills-taxonomy.md`](skills-taxonomy.md) — the inputs.
- [`review-lens-schema.md`](contracts/review-lens-schema.md) — the dispatch contract that protects the lens pairs above.
- [`governance.md`](governance.md) — lifecycle + single-source-of-truth rules.
