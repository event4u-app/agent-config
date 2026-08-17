<!-- evidence-type: analysis -->

# Spike cf02 — memory staleness census on the curated store

**Date:** 2026-08-17
**Roadmap:** [road-to-context-fidelity.md](../../roadmaps/road-to-context-fidelity.md) Phase 0
**Tree:** `9beeb0662` (branch base `origin/main`)
**Host stamp:** Claude Code 2.1.233 · model `claude-opus-5[1m]`
**Pre-registered threshold (Phase 2 kill criterion):** a stale ratio **below
10 %** shrinks Phase 2 to stamps only, with the ladder unbuilt and the null
published.

## Verdict up front

**The stale ratio is 21.5 % (23 of 107). The kill criterion does not fire and
the eviction ladder stays justified.**

And the more useful half: the ratio the *existing instrument* reports is
**0.0 %**, and that 0.0 % is an artefact. Had this census read the instrument
instead of the tree, it would have killed Phase 2 on a number that measures
stamping rather than truth.

## Why the shipped instrument reads 0.0 %

`memory_report` prints `staleness-rate=0.0% (0/107)`, and `check_memory` reports
zero findings. Both are correct about what they measure and neither measures
staleness in the sense this roadmap means.

| Fact | Value | Consequence |
|---|---|---|
| Entries carrying `last_validated` | 107 / 107 | The stamp is not missing — it is a `REQUIRED_KEY` (`check_memory.ts:60-68`) |
| Distinct `last_validated` values | **1** — `2026-07-09` | Every entry was stamped on one day. 107 stamps, not 107 verifications |
| Distinct `review_after_days` values | **1** — `365` | One uniform window, applied without regard to volatility |
| Earliest date any entry can read stale | **2027-07-09** | The instrument is structurally silent for another 326 days |
| Commit anchor in the stamp | **absent** | A date cannot be tied to a tree state, so no reader can tell a verified entry from a re-stamped one |
| Store-wide contradiction sweep | **absent** | `check_memory_contradiction` requires `--type --key --body`: it validates one *proposed* entry, not the store |

Two of those rows are the whole finding. A uniform stamp plus a uniform 365-day
window means the age axis cannot distinguish a true entry from a false one, and
the missing commit anchor means it cannot be repaired by reading the dates more
carefully. This is the already-satisfied-test shape: a check that passes because
it cannot fail.

## Method — what was actually done

Because no store-wide contradiction sweep exists, the tree axis was walked by
hand: **all 107 entries**, one per row, each `body` claim checked against the
current tree with a targeted grep or read. Three verdicts, assigned by evidence
rather than by age:

- **still-true** — the load-bearing assertion holds, with a `file:line`.
- **stale** — the tree now contradicts it, with what the tree says instead.
- **unverifiable** — the claim is about an external system, a past event, a host
  behaviour, or a recorded preference, so the tree can neither confirm nor refute
  it. Counted separately rather than folded into either side; folding them into
  "true" would inflate the pass rate and folding them into "stale" would
  manufacture defects.

Three walkers were used, one per store. **They were not independent in any sense
that buys confidence, and the earlier wording here claimed otherwise.** The sets
are disjoint, so every one of the 107 entries has exactly one classifier and
mutual blindness is vacuous — there is nothing to agree or disagree about.
Inter-rater agreement is therefore not merely unmeasured, it is undefined for
this design. Corrected on R2 finding 8.

The per-entry verdicts are recorded **in this file**, below, and that too is a
correction: they were first pointed at "this run's session transcript", i.e. under
`agents/runtime/`, which this same change documents as gitignored state absent
from any worktree. A ratio whose substrate lives in an unavailable store is not
auditable, and the number that keeps Phase 2's kill criterion from firing is
exactly the number that has to be.

## Result

| Store | n | still-true | stale | unverifiable | stale % (of n) |
|---|---:|---:|---:|---:|---:|
| `product-rules.yml` | 66 | 52 | 9 | 5 | 13.6 % |
| `historical-patterns.yml` | 24 | 12 | **11** | 1 | **45.8 %** |
| `incident-learnings.yml` | 17 | 9 | 3 | 5 | 17.6 % |
| **Total** | **107** | **73** | **23** | **11** | **21.5 %** |

Against the verifiable subset alone (107 − 11 = 96), the stale ratio is
**24.0 %**. Both readings clear the 10 % threshold, so the verdict does not
depend on which denominator a reader prefers — stated because a single
denominator would have invited exactly that objection.

**Age axis: 0.0 %. Tree axis: 21.5 %.** Same store, same day, same 107 entries.

## The distribution is the second finding

Staleness is not uniform across the stores, and the spread is large enough to
matter for the ladder's thresholds:

- `historical-patterns` is **45.8 %** stale — three times the `product-rules`
  rate. Its entries are mostly *downstream-surface* notes ("adding X touches
  these N places"), and those decay every time a generator changes. Six of its
  eleven stale rows trace to one event: ADR-201 removed markdown condensation,
  so every entry describing a manual dist write or a `--mark-done` step is now
  wrong.
- `product-rules` is **13.6 %** stale, and its stale rows cluster too: five of
  nine are entries about the `subagents.auto` setting, which
  always-on-orchestration deleted. One removal invalidated five entries.
- `incident-learnings` carries the **highest unverifiable share** (5 of 17,
  29 %) — unsurprising, since an incident is a past event by definition.

**A uniform 365-day window is therefore the wrong shape**, independent of its
length: the volatile store and the stable store get the same treatment, and the
volatile one is the one that decays. That is a finding for Phase 2 step 3, whose
thresholds this census was meant to supply.

## What a single upstream change does to the store

The clustering above is the mechanism worth carrying forward: **staleness
arrives in batches, not per entry.** Two removals (ADR-201's condensation step,
the `subagents.auto` knob) account for **11 of the 23** stale rows. An
age-and-quarantine ladder handles the slow tail; it does not handle a batch, and
a batch is what actually happened here twice.

This is not an argument against the ladder — the 21.5 % justifies it. It is an
argument that contradiction-against-the-tree has to be the *primary* signal and
age the fallback, which is what Phase 2 step 5 already says ("contradiction
outranks retention") and what the missing commit anchor currently makes
impossible to compute.

## Reproduction

Age axis, deterministic:

```
./scripts-run src/scripts/memory_report --format text     # staleness-rate=0.0% (0/107)
./scripts-run src/scripts/check_memory                    # 0 error(s), 0 warning(s), 0 info
grep -h last_validated agents/memory/*.yml | sort | uniq -c   # 107 × 2026-07-09
grep -h review_after_days agents/memory/*.yml | sort | uniq -c # 107 × 365
```

Tree axis: **not reproducible by a command** — that is the point of the missing
sweep. It was a per-entry read, and re-running it means re-reading. What IS
available is the substrate: every one of the 107 verdicts is listed below with the
pointer it was decided on, so a reader can re-check any single row cheaply and
disagree with it specifically rather than with the total.

## Per-entry verdicts — the substrate

Every row was decided on a targeted grep or read against the tree at `9beeb0662`.
`stale` rows carry what the tree says instead, because those are the rows the
verdict rests on and the ones most worth disagreeing with.

### `incident-learnings.yml` — 17 entries: 9 still-true · 3 stale · 5 unverifiable

| id | verdict | evidence |
|---|---|---|
| `adr-number-collision-on-parallel-prs` | still-true | `docs/decisions/INDEX.md`; per-file `adr:` frontmatter; `src/scripts/adr/regenerate_index.ts` |
| `agent-config-hooks-need-global-binary` | **stale** | `hooks/hooks.json` now binds **9** events, not 5; each command resolves a project-local `dist/hooks/dispatch.js` FIRST, so no global install is required; the final fallback exits 0, not 127 |
| `auto-commit-empties-roadmaps` | unverifiable | external git identity acting outside the repo; the tree only shows the backstop `src/scripts/lint_empty_roadmaps.ts` |
| `commit-relocates-into-per-branch-worktree` | unverifiable | host-side automation; no relocation pipeline anywhere in `src/scripts`, `hooks/`, or the installed hooks |
| `council-curl-timeout-fix` | still-true | `src/scripts/ai_council/clients.ts:475` (`--connect-timeout 30`, `--max-time 290`), `:481` |
| `council-install-path-convergence` | still-true | archived roadmap records the Q1 SPLIT + bootstrap shim; `.claude-plugin/marketplace.json` |
| `council-removal-depth-principle` | still-true | zero hits for the three named symbols across `src/` and `tests/`; `retrieval-v1` survives in `memory_status.ts` as stated |
| `discovery-strict-frontmatterless-template` | **stale** | the named script is `.ts`, not `.py`; the Python CI job is gone (`.github/workflows/no-python-in-src.yml` forbids it); `test_projection_scoped` exists nowhere. The frontmatter-less template survives, but the failure mechanism is obsolete |
| `enforcement-projection-honest-null` | still-true | `bench_ab_v2_run.ts:167`, `:206-219` (exactly the 3 safety-floor rules); `condense.ts` has zero `hardened` hits, so still unwired |
| `feedback-locks-never-permanent` | still-true | encoded as the named `decision-revisit-gate` rule |
| `fresh-worktree-gate-quirks` | **stale** | quirk 1 is gone: the pre-commit template states the runtime is Node/tsx and warns-then-exits-0 when the CLI is absent, with no `python3` call anywhere. Quirk 2's flag survives, but the headline mechanism is contradicted |
| `git-stash-probe-conflict-hazard` | unverifiable | a past working-tree behaviour; nothing in the tree encodes or contradicts it |
| `github-pr-head-sync-glitch` | unverifiable | external platform lag; the tree shows only a mitigation reading the same field |
| `glama-sync-break-src-move` | still-true | `internal/glama/`, task `mcp:glama-test`, `src/scripts/mcp_server/` all present; the root cause itself is external |
| `py2ts-bundle-macos-symlink-and-tmpdir-traps` | still-true | `dist/install/install.mjs` tracked; the realpath fix documented at `src/scripts/install.ts:5341-5352` |
| `py2ts-parallel-snapshot-clobber` | still-true | shared golden tree at `tests/_lib/parity_oracle.ts:136`, capture gate `:139`, refusal text `:373-376` |
| `roadmap-archival-vs-inbound-refs` | still-true | gate intact at `src/agent-src/scripts/update_roadmap_progress.ts:1080`, `:1108`; script is now `.ts` |

### `historical-patterns.yml` — 24 entries: 12 still-true · 11 stale · 1 unverifiable

| id | verdict | evidence |
|---|---|---|
| `a1-crosshost-subagent-degradation` | still-true | `condense.ts:2126`, `:2231`, `:2292-2308`, wired `:2592-2593`; ADR-109 present |
| `adding-a-plain-skill-downstream-surface` | **stale** | the hand-maintained step is gone — `.md` is copied verbatim by `--sync` per ADR-201; no manual dist write remains |
| `adding-a-standalone-command-downstream-surface` | **stale** | two load-bearing parts false: `task sync` DOES write dist commands now, and the plugin is a bootstrap shim with no content commands |
| `ai-council-cli-repo-local-only` | still-true | `ai_council/config.ts:736-738` (ADR-104 supersedes ADR-093), `:692`, `:756` |
| `bench-ab-cost-and-activation-mechanics` | still-true | `taskfiles/bench-ab.yml:104`, `:127`, `:120-122`; runner `bench_ab_task_runner.ts:245-260`. Path drift only (`.py` → `.ts`) |
| `claude-plugin-local-install-via-worktree` | **stale** | the ADR it rests on is `status: superseded` and states "every quantity in this record's rationale is now false" |
| `command-cluster-ci-surface` | still-true | hardcoded pack-id enum in the manifest schema; ADR-013 packs table; gate `lint_discovery_manifest.ts:258` |
| `deleting-a-command-downstream-surface` | **stale** | core claim inverted — ADR-201 removed the condensation step; the plugin-symlink step is dead |
| `gh-pr-diff-patch-per-commit-series` | **stale** | `consistency.yml:257-259` now states the OPPOSITE and the invocation carries no `--patch`; workflow and checker are both renamed |
| `live-trigger-eval-human-gate` | still-true | `skill_trigger_eval.ts:497-502` opens `/dev/tty` and refuses automation; task `test-triggers-live` |
| `local-task-ci-tools-empty-tension` | **stale** | `agents/.agent-tools.yml` lists 8 tools, not `tools: []`, so `generate-tools` is not a local no-op |
| `media-substrate-extraction-a1` | **stale** | the roadmap it calls open is archived; the substrate half holds |
| `node-modules-symlink-committed` | still-true | the single-line add is in history; `.gitignore:9-16` carries the no-trailing-slash rationale verbatim; `git ls-files node_modules` empty |
| `pr-gate-roadmap-archival` | still-true | `archive_completed_roadmaps.ts:3`, `:19-28`; rule `roadmap-progress-sync.md:66,75`. Path drift (`.py` → `.ts`) |
| `project-single-install-source-of-truth` | **stale** | the roadmap it calls active is archived; the mechanism landed and is TS, not Python |
| `py2ts-mcp-serving-and-teardown-pr` | still-true | zero tracked `.py` under `src/`; no `pyproject.toml`/`requirements*`; MCP server is TS |
| `roadmap-dashboard-phase-heading-gotcha` | still-true | `update_roadmap_progress.ts:586-587`, `PHASE_RE` `:71-72`, draft exclusion `:279`,`:684` |
| `roadmap-dashboard-regen-script-mismatch` | still-true | canonical wrappers at `src/cli/registry.ts:72-73` |
| `roadmap-progress-regen-side-effects` | **stale** | `roadmap:progress` does NOT auto-archive — no `git mv` in the script; archival is the separate `/create-pr` sweep |
| `settings-schema-downstream-install-bundle` | still-true | bundle tracked; entry imports the settings schema; CI gate rebuilds and diffs `dist/install/` |
| `source-confidentiality-sweep` | still-true | no `compare-*.md` under `agents/evidence/analysis/`; `_lib/link_crypto.ts:1-20` states the policy verbatim |
| `typecheck-use-task-not-bare-tsc` | **stale** | the stated REASON is false: `tsconfig.json` excludes `tests`, and `npm run typecheck` never runs `tsconfig.test.json`. The advice survives; its rationale does not |
| `video-strategy-2026-06` | **stale** | the cited council artifact is absent, all six video roadmaps are archived, and the adapter count is 10, not 5 |
| `zed-agents-skills-dir` | unverifiable | the load-bearing half is external host behaviour; the tree-side anchor checks out |

### `product-rules.yml` — 66 entries: 52 still-true · 9 stale · 5 unverifiable

The nine stale rows, with what the tree says instead:

| id | verdict | evidence |
|---|---|---|
| `council-ecc-parity-positioning` | **stale** | its verified counts (258 skills / 93 rules / 162 commands / 26 personas) are now 290 / 117 / 200 / 32 |
| `council-judge-harness-2026-06-26` | **stale** | the adopted option is not what shipped — `check_quality_regression.ts:7` states there is no such dependency, and the hand-rolled stats layer is the live path |
| `council-memory-knowledge-validation-tests` | **stale** | the claimed shared phase embedded in two roadmaps does not exist; the only tree hit is the memory entry itself |
| `council-memory-tripwire-engine` | **stale** | ADR-116:12-19 records the pre-decided engine was **never built**; re-resolved to hand-rolled BM25 + trigram prefilter |
| `council-orchestration-flip-honest-null` | **stale** | the `subagents.auto` knob it keeps at `ask` no longer exists — the template says it was REMOVED and a lint rejects it |
| `council-subagent-auto-cost-downshift` | **stale** | same removal; what shipped is `subagents.downshift: true`, so "default stays ask" is no longer true of the tree |
| `council-subagent-default-flip-revisit` | **stale** | same removal; the ask→on question was superseded by always-on orchestration |
| `council-team-shared-memory` | **stale** | the gitignore-intake verdict is not implemented — `agents/memory/intake/` is not ignored and its README is tracked |
| `evidence-v2-accumulation-killed` | still-true | both evals present; ground-truth linter is now `skill_linter.ts` (was `.py`) |

The five unverifiable rows: `council-decisions-workspace-phases` (a past deferral),
`gstack-adoption-disposition` (an external repo assessment),
`local-ci-hygiene-shipped` (a past CI state),
`route-design-decisions-to-ai-council` (a recorded user preference),
`source-a-deep-dive-subagent-reframe` (an external codebase's internals).

The remaining 52 verified still-true against named `file:line` pointers spanning
`src/rules/`, `src/skills/`, `src/scripts/`, `docs/decisions/`,
`src/config/agent-settings.template.yml`, `taskfiles/`, and the roadmap archive.
Five are worth naming because they anchor rules this run relied on:
`feedback-end-of-reply-summary-and-pr-link` (`src/rules/direct-answers.md:46`),
`feedback-no-proactive-quality-tools`
(`src/rules/senior-engineering-discipline.md:67`), `never-drop-inherited-commits`
(`src/rules/git-history-discipline.md:32`), `no-cheap-sequencing-questions`
(`src/rules/no-cheap-questions.md:34`), and `roadmap-later-disposition`
(`agents/roadmaps/later/`, enforced by `lint_roadmap_later_disposition.ts`).

## The batch mechanism, in the substrate

The clustering claimed above is visible in the tables. Two upstream removals
account for **11 of the 23**:

- **ADR-201 removed markdown condensation** →
  `adding-a-plain-skill-downstream-surface`,
  `adding-a-standalone-command-downstream-surface`,
  `deleting-a-command-downstream-surface`,
  `discovery-strict-frontmatterless-template`,
  `claude-plugin-local-install-via-worktree`,
  `project-single-install-source-of-truth` — six rows, one change.
- **`subagents.auto` was deleted** → `council-orchestration-flip-honest-null`,
  `council-subagent-auto-cost-downshift`,
  `council-subagent-default-flip-revisit` — three rows, one change.

Plus two independent decays (`gh-pr-diff-patch-per-commit-series` reversing,
`typecheck-use-task-not-bare-tsc` losing its rationale while keeping its advice).

## What this does not show

- **Every row has exactly one classifier**, so a borderline
  `still-true` / `unverifiable` call could move a few rows and nothing in this
  design would catch it. It cannot plausibly move 23 rows to below 11, which is
  what the verdict would need to flip — but the right response to doubt is to
  re-check a named row above, not to re-argue the total.
- **`still-true` is the weakest verdict in the set.** It means the load-bearing
  assertion held against one targeted probe, not that the whole body is accurate.
  Several rows carry a note that a path or a count inside them has drifted while
  the claim survived; those are counted true and are the most likely to be
  reclassified by a stricter reading.
- Nothing here says a stale entry ever misled a session. The harm is inferred
  from the content, not observed in behaviour — the same boundary cf03 states.
- The intake store (`agents/memory/intake/`) is out of scope: `learning_sidecar`
  already decays it on a 30-day half-life and never promotes into the curated
  files, which is a deliberate council condition, not a gap.
