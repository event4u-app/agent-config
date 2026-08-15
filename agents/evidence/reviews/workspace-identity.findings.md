# Findings: workspace-identity
<!-- completion-review: v1 | reviewed: 2026-08-15 | scope: 87ea6396620741b25e2ffead9c6702be6f91f3fb64a8eb77bf140a6920c127e1 | diff: 6c3f220a17ae68cfe96ff0bd269a962b1a139b7b | reviewer: r2-fresh-subagent-workspace-identity | prompt_hash: e3e9884071a1ff96f36b8dedb4e7fedd6ff7bd7e20f935b139e27a0052a168e5 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 6c3f220a17ae68cfe96ff0bd269a962b1a139b7b
  scope_hash: 87ea6396620741b25e2ffead9c6702be6f91f3fb64a8eb77bf140a6920c127e1
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

**Re-bound in place** (contract § 2.7) after the fix pass: the reviewed content
was repaired, not withdrawn, so the artefact keeps its identity and its rows and
the marker moves to the post-fix scope. `prompt_hash` is deliberately unchanged
— it records the prompt that produced these findings, and that prompt did not
change. Disposition of all 13:

- **fixed** — 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13.
- **accepted-risk** — 1 (a documented review-contract exclusion, whose real gap
  belongs to that contract) and 12 (a stale dashboard on `main` that any
  regeneration absorbs). Both written up in `workspace-identity-census.md` § 12.

Each fix and its verification is in the `fix(workspace):` commit message; the
two that matter most are F3 (the duplication this PR existed to remove, present
in the PR itself) and F8 (a regression pin that protected the wrong layer, now
mutation-verified at the caller).

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | `workspace-identity.review-input/prompt.md:28` | The review scope omits a file the branch changed: `agents/evidence/metrics/evaluator-measurements.json` (4+/4-) is in neither `diff.patch` nor the changed-files list, is not a review artefact, and is the third leg of `check_cli_registry_budget_sync`'s three-number invariant. Finding 4 lives inside the omitted file. | accepted-risk | `agents/evidence/metrics` is a DOCUMENTED review-scope exclusion (`dispatch_r2_reviewer.ts:112`, rationale at `:103`) — the review process writes `gate-metrics.jsonl` there. The observation is right and the attribution is not; narrowing the exclusion is a completion-review contract change with its own scope-hash consequences. Written up in `workspace-identity-census.md` § 12. |
| 2 | high | `agents/evidence/analysis/workspace-identity-census.md:64` | Census § 4 claims 5 branch call sites and "four private `_current_branch` implementations". At least five more exist unlisted: `print_required_checks.ts:135`, `_cli/handoff_generate.ts:287`, `_lib/envelope_grounding.ts:105` (already imports `git_common_dir` at :94 and still spawns `rev-parse`), `dispatch_r2_reviewer.ts:539`, and six sites in `release.ts`. Phase 1 step 1 says "list **every** site"; AC-1 is discharged over an incomplete population. | fixed | 6c3f220a1 — Census § 4 now lists 15 sites across 10 files, each with a written migrate/not reason; cause recorded (a `head -20`-truncated grep). Ledger totals corrected 7/21 → 7/31. |
| 3 | high | `src/scripts/workspace_doctor.ts:110` | The Phase-3 deliverable re-derives two questions with fresh ad-hoc implementations, in the PR whose goal is removing exactly that. `listRegistered()` is a **fourth** `git worktree list --porcelain` parser beside the **exported** `worktree_cleanup_check.listWorktrees`; `resolveTrunk()` at :128 duplicates the **exported** `worktree_cleanup_check.resolveTrunk` with a different candidate list and return type; `merge-base --is-ancestor` at :264 re-implements its `isAncestor`. None is in the § 8 ledger, and nothing structural prevented importing them. | fixed | 6c3f220a1 — `workspace_doctor` now imports the exported `listWorktrees` + `resolveTrunk`; `WorktreeEntry` exported to type the import. The per-row `merge-base` call is gone with F13. |
| 4 | medium | `agents/evidence/metrics/evaluator-measurements.json:5` | `git_sha` stamps `e3bd961588…` (= `origin/main`) while asserting `cli_help_command_count: 98` and "re-measured on the unchanged tree". At that SHA the registry has **97**. The gate compares only the number, so it passes; the provenance stamp is falsifiable and false. | fixed | 6c3f220a1 — Record re-stamped at this branch HEAD and verified by reading `src/cli/registry.ts` at that object: 98 entries. |
| 5 | medium | `src/scripts/workspace_doctor.ts:128` | The report contradicts the resolver's stated design within one screen: `prBase UNRESOLVED … not guessed` four lines above `trunk = origin/main`, which a candidate-list search produced. Census § 11 argues landing on `main` by assumption is the plausible-but-wrong shape this type exists to remove. | fixed | 6c3f220a1 — `trunk_provenance` shipped and rendered — states it is a candidate-ref search and NOT the recorded remote default that `identity.prBase` reports. |
| 6 | medium | `src/scripts/workspace_doctor.ts:27` | The docstring says `--strict` exits 1 "only when an identity field the caller asked to rely on is unresolved"; no per-field selection exists, `main()` filters all five, and `--help` says the opposite. Measured: `--strict` → exit 1 on `prBase`, the one field census § 11 declares correct-as-unresolved here. The flag can never be green in this repo. | fixed | 6c3f220a1 — Docstring corrected to "any identity field", and it now states that `--strict` is red by design in a repo with no `refs/remotes/origin/HEAD`. |
| 7 | medium | `src/scripts/workspace_doctor.ts:272` | The partition assertion is a tautology: `collectPressure` increments exactly one bucket per row and sets `registered: rows.length`, so `partition_total === registered` holds by construction, and the test compares against a second call to the same `listRegistered`. The Phase-3.2 *verify* is self-satisfying; a falsifiable version needs an independently derived total. | fixed | 6c3f220a1 — Cross-checked against `independentRegisteredCount()`, parsed from the plain `git worktree list` — a different command and format. A disagreement is surfaced in `note`; the test asserts the mechanism, not just equality. |
| 8 | medium | `agents/evidence/analysis/workspace-identity-census.md:146` | Row M1 declines migration because it is "pinned by regression test instead (§ 10)". § 10's tests never reference `worktree_cleanup_check` — re-introducing the shipped defect (`repoPath` for `mainPath` at :427) leaves every test this diff adds green. The pin protects the new resolver, not the site the defect shipped in. | fixed | 6c3f220a1 — Pinned at the CALLER in `worktree_cleanup_check.test.ts`. Mutation-verified: restoring `isStandardLocation(repoPath, resolved)` fails that test and only that test (1 failed / 24 passed); revert → 25/25. |
| 9 | low | `src/scripts/workspace_doctor.ts:77` | `unmerged` is documented as "branch is NOT an ancestor", but `_git` returns `null` on any non-zero exit, timeout or missing binary, and :265 maps `null` straight to `unmerged`. The roadmap makes the symmetric argument for `unclassifiable`; the assumed-*unmerged* mirror is accepted silently. | fixed | 6c3f220a1 — Dissolved by F13 — `for-each-ref --merged` classifies from a set, so there is no per-row probe whose failure could be read as `unmerged`. A failed probe now sends every row to `unclassifiable` and says so in `note`. |
| 10 | low | `src/scripts/check_release_trunk_sync.ts:163` | `assertScanned({… roots: ['git rev-parse --abbrev-ref HEAD'] …})` declares a scan root the gate no longer reads after the B3 migration. | fixed | 6c3f220a1 — `roots:` now names `<git-dir>/HEAD via workspaceIdentity().branch`, which is what the gate reads. |
| 11 | low | `src/scripts/workspace_doctor.ts:334` | From the main checkout the report prints `Path containment: outside — this IS the main worktree`; the label and its own reason contradict each other. | fixed | 6c3f220a1 — Equality case returns `contained: null` and renders `n/a`; a test asserts the main checkout never prints "outside". |
| 12 | low | `agents/roadmaps-progress.md:9` | The regenerated dashboard's `+21` done is entirely `road-to-skill-catalogue-budget.md`, which this branch does not touch — `origin/main`'s dashboard was stale and this PR silently absorbs the correction, so a reader attributes the movement here. | accepted-risk | `origin/main`'s dashboard is stale against its own roadmap files, so ANY regeneration absorbs the +21; leaving it stale to keep the diff clean contradicts the dashboard's derived-artifact contract. Named in census § 12 and in the PR body so the movement is not misread. |
| 13 | low | `src/scripts/workspace_doctor.ts:264` | One `merge-base --is-ancestor` subprocess per registered worktree: 307 spawns, 15.2 s wall for a read-only report, each with a 15 s timeout. One `git branch --merged <trunk>` answers the same question in one call. | fixed | 6c3f220a1 — One `for-each-ref --merged` replaces 307 `merge-base` spawns — measured 15.2s → 1.6s. Cross-verified branch-by-branch against the old method: both agree on all 9 unmerged. |

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
