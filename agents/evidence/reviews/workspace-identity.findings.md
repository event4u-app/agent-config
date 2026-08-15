# Findings: workspace-identity
<!-- completion-review: v1 | reviewed: 2026-08-15 | scope: 8aa31c7517ce2b4412950b16cb7ffe04335d7fc082c7617d3241b56aef93e1e2 | diff: 1141051719d9e43fa102394954100f4fdd7afbd9 | reviewer: r2-fresh-subagent-workspace-identity | prompt_hash: e3e9884071a1ff96f36b8dedb4e7fedd6ff7bd7e20f935b139e27a0052a168e5 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 1141051719d9e43fa102394954100f4fdd7afbd9
  scope_hash: 8aa31c7517ce2b4412950b16cb7ffe04335d7fc082c7617d3241b56aef93e1e2
  roadmap: agents/roadmaps/archive/road-to-inbox-harvest-2026-08-c-workspace-identity.md
  roadmap_hash: 1ce15c97c06cc750e3741b53af731f4109dffd9b43219ccc38f5426ef4386a59
  ac_hash: ce3a5744227034894136d9d1b8e3a37e26fe1ab1a5f1a7233db868e296b7fd7c
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-15T05:48:42Z
-->

Reviewed by a fresh subagent that did not write the code, over the full
`origin/main…HEAD` delta. It independently re-derived the changed-file list
rather than trusting the supplied `diff.patch` — which is how finding 1 exists.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | `workspace-identity.review-input/prompt.md:28` | The review scope omits a file the branch changed: `agents/evidence/metrics/evaluator-measurements.json` (4+/4-) is in neither `diff.patch` nor the changed-files list, is not a review artefact, and is the third leg of `check_cli_registry_budget_sync`'s three-number invariant. Finding 4 lives inside the omitted file. | open | |
| 2 | high | `agents/evidence/analysis/workspace-identity-census.md:64` | Census § 4 claims 5 branch call sites and "four private `_current_branch` implementations". At least five more exist unlisted: `print_required_checks.ts:135`, `_cli/handoff_generate.ts:287`, `_lib/envelope_grounding.ts:105` (already imports `git_common_dir` at :94 and still spawns `rev-parse`), `dispatch_r2_reviewer.ts:539`, and six sites in `release.ts`. Phase 1 step 1 says "list **every** site"; AC-1 is discharged over an incomplete population. | open | |
| 3 | high | `src/scripts/workspace_doctor.ts:110` | The Phase-3 deliverable re-derives two questions with fresh ad-hoc implementations, in the PR whose goal is removing exactly that. `listRegistered()` is a **fourth** `git worktree list --porcelain` parser beside the **exported** `worktree_cleanup_check.listWorktrees`; `resolveTrunk()` at :128 duplicates the **exported** `worktree_cleanup_check.resolveTrunk` with a different candidate list and return type; `merge-base --is-ancestor` at :264 re-implements its `isAncestor`. None is in the § 8 ledger, and nothing structural prevented importing them. | open | |
| 4 | medium | `agents/evidence/metrics/evaluator-measurements.json:5` | `git_sha` stamps `e3bd961588…` (= `origin/main`) while asserting `cli_help_command_count: 98` and "re-measured on the unchanged tree". At that SHA the registry has **97**. The gate compares only the number, so it passes; the provenance stamp is falsifiable and false. | open | |
| 5 | medium | `src/scripts/workspace_doctor.ts:128` | The report contradicts the resolver's stated design within one screen: `prBase UNRESOLVED … not guessed` four lines above `trunk = origin/main`, which a candidate-list search produced. Census § 11 argues landing on `main` by assumption is the plausible-but-wrong shape this type exists to remove. | open | |
| 6 | medium | `src/scripts/workspace_doctor.ts:27` | The docstring says `--strict` exits 1 "only when an identity field the caller asked to rely on is unresolved"; no per-field selection exists, `main()` filters all five, and `--help` says the opposite. Measured: `--strict` → exit 1 on `prBase`, the one field census § 11 declares correct-as-unresolved here. The flag can never be green in this repo. | open | |
| 7 | medium | `src/scripts/workspace_doctor.ts:272` | The partition assertion is a tautology: `collectPressure` increments exactly one bucket per row and sets `registered: rows.length`, so `partition_total === registered` holds by construction, and the test compares against a second call to the same `listRegistered`. The Phase-3.2 *verify* is self-satisfying; a falsifiable version needs an independently derived total. | open | |
| 8 | medium | `agents/evidence/analysis/workspace-identity-census.md:146` | Row M1 declines migration because it is "pinned by regression test instead (§ 10)". § 10's tests never reference `worktree_cleanup_check` — re-introducing the shipped defect (`repoPath` for `mainPath` at :427) leaves every test this diff adds green. The pin protects the new resolver, not the site the defect shipped in. | open | |
| 9 | low | `src/scripts/workspace_doctor.ts:77` | `unmerged` is documented as "branch is NOT an ancestor", but `_git` returns `null` on any non-zero exit, timeout or missing binary, and :265 maps `null` straight to `unmerged`. The roadmap makes the symmetric argument for `unclassifiable`; the assumed-*unmerged* mirror is accepted silently. | open | |
| 10 | low | `src/scripts/check_release_trunk_sync.ts:163` | `assertScanned({… roots: ['git rev-parse --abbrev-ref HEAD'] …})` declares a scan root the gate no longer reads after the B3 migration. | open | |
| 11 | low | `src/scripts/workspace_doctor.ts:334` | From the main checkout the report prints `Path containment: outside — this IS the main worktree`; the label and its own reason contradict each other. | open | |
| 12 | low | `agents/roadmaps-progress.md:9` | The regenerated dashboard's `+21` done is entirely `road-to-skill-catalogue-budget.md`, which this branch does not touch — `origin/main`'s dashboard was stale and this PR silently absorbs the correction, so a reader attributes the movement here. | open | |
| 13 | low | `src/scripts/workspace_doctor.ts:264` | One `merge-base --is-ancestor` subprocess per registered worktree: 307 spawns, 15.2 s wall for a read-only report, each with a 15 s timeout. One `git branch --merged <trunk>` answers the same question in one call. | open | |

## Claims the reviewer verified and found sound

Recorded because the review was asked to check them, and three of five hold as
stated:

- **Seven migrated call sites are behaviour-identical** — verified per site,
  including that both the old helpers and `workspaceIdentity()` start from
  `process.cwd()`, so no cwd divergence was introduced.
- **Three sites structurally cannot import the resolver** — confirmed by import
  graph and by `find dist/agent-src -name _lib -type d`.
- **A regression test that fails against the pre-migration primitive** —
  `workspace_identity.test.ts:161-178` is genuinely falsifiable, and the
  `GIT_DIR` pair carries a real control. Named the strongest part of the change.
- **No third worktree-misclassification instance** — no counter-example found on
  the main-worktree axis, with the caveat that the census's branch axis is
  incomplete (finding 2).
- **The pressure buckets partition the registered set** — true, but true by
  construction, which is finding 7 rather than a pass.
