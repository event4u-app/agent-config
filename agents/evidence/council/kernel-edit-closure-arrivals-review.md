<!-- evidence-type: analysis -->

# Council review of branch fix/kernel-edit-closure-arrivals — where the ratification gate reads the closure's base side

Three rounds, 2026-10-15, with two seats configured (`anthropic/claude-sonnet-4-5`,
`openai/codex-default`, CLI transport, `--prompt-mode pr --rounds 2`, nothing
billed). Prompts, committed verbatim before each run:
`agents/evidence/council/kernel-edit-closure-arrivals-review-20261015.question.md`
(round 1, full diff at `c240e47f2`),
`kernel-edit-closure-arrivals-review-r2-20261015.question.md` (round 2, delta
`c240e47f2..d6f436404`) and
`kernel-edit-closure-arrivals-review-r3-20261015.question.md` (round 3, delta
`d6f436404..e31314353`), same directory. The full responses are local run output
(gitignored); the stances below are quoted verbatim from them.

## Round 1 — `c240e47f2`

| Seat | Stance, verbatim |
|---|---|
| anthropic/claude-sonnet-4-5 | "**REQUEST_CHANGES**" — "The fix solves the reported symptom (local vs CI file-set divergence on PR #2371) but doesn't guarantee they stay aligned — it assumes the default base-ref resolution matches the PR's actual base, which fails when `origin/main` has diverged or the PR targets another branch." |
| openai/codex-default | "**REQUEST_CHANGES** — local and CI can still attest different gated sets because they do not share immutable base and head commits; the single highest-leverage change is to require one resolved base commit SHA and classify both base and head through object-store `ClosureTree`s in every execution shape, with dirty-tree, stale/default-ref, alternate-target, and mismatched-CI-checkout regression tests." |

| # | Finding (seat) | Disposition |
|---|---|---|
| 1 | In the CI branch `--base-ref` was ignored and the script checkout stood in for the base, so the same `--base-ref` could classify two trees (both, High) | fixed in `d6f436404` — both sides read from Git objects in `--root` in every shape; `main` resolves the base once for the diff and the closure; red-proof: a judging copy checked out at HEAD given `--base-ref <base>` must gate the arrival (fails on `c240e47f2`) |
| 2 | Head closure read from the working tree while the digest reads the commit (openai, Medium) | fixed — head side is the commit at `--rev`, resolved once; red-proof: an uncommitted edit dropping the import must not hide the committed arrival (fails on `c240e47f2`) |
| 3 | The test passed `--base-ref` to the CI-shaped run where it had no effect (openai, Medium) | fixed — covered by the test in row 1 |
| 4 | Only the explicit-base case was tested (both) | added — default-base test with `refs/remotes/origin/main` (coverage; passes on `c240e47f2` too) |
| 5 | The contract overclaimed the guarantee (openai, Medium) | fixed — restated as a function of the two commits, with when the local default equals CI's base |
| 6 | `tree.read(rel) ?? ''` could mask a file vanishing mid-walk (openai, Low) | fixed — each path read once per walk |
| 7 | Use the merge-base as the default base (anthropic) | not adopted — CI's base is `base.sha`, the base-branch tip; a merge-base would diverge from CI whenever the base moved |
| 8 | "The CI workflow does not pass `--base-ref`" (anthropic) | not adopted, incorrect — the step passes `--base-ref "$BASE_SHA"` |
| 9 | `HEAD~1` fallback fragile (anthropic) | unchanged, pre-existing — the diff's base already used it |

## Round 2 — `d6f436404`

| Seat | Stance, verbatim |
|---|---|
| anthropic/claude-sonnet-4-5 | "**REQUEST_CHANGES**" — "**Single highest-leverage change:** Restore `LITERAL_PLUMBING` to line 441" |
| openai/codex-default | "**REQUEST_CHANGES** — the normal execution path can permit unratified edits to literal plumbing; the single highest-leverage change is to restore `LITERAL_PLUMBING` (preferably through the existing `derivedPlumbing` abstraction) in the line-441 gated-set computation and lock it down with a regression test." |

| # | Finding (seat) | Disposition |
|---|---|---|
| 1 | `derivedFor` dropped a `LITERAL_PLUMBING` set contributed by `derivedPlumbing()`, so name-matched plumbing such as `hooks/hook_dispatcher.ts` would go ungated (both, Critical/High) | not a defect — no `LITERAL_PLUMBING` symbol exists in `src/`, `hooks/hook_dispatcher.ts` does not exist, `derivedPlumbing` returns closure verdict modules only, and name-matched plumbing is decided by `PLUMBING_SOURCE_RE` in `classifyPaths`. The round-2 prompt had not shown those bodies; round 3 showed them verbatim. The regression test both seats asked for was added in `e31314353` (a name-matched budget file outside any closure is gated in both shapes) |
| 2 | Redundant second `resolveRevision` inside `derivedFor` (anthropic, low) | fixed — takes the resolved head commit |
| 3 | Direct test of the invalid-`--rev` refusal (suggested, non-blocking) | added |

## Round 3 — `e31314353`

| Seat | Stance, verbatim |
|---|---|
| anthropic/claude-sonnet-4-5 | "**APPROVE** — The round-2 blocker is conclusively disproven, the regression tests prove the gating mechanism works for name-matched plumbing files outside the closure, and the refactoring is minimal and correct." |
| openai/codex-default | "**APPROVE — the alleged literal-plumbing regression is disproven and now directly covered; the single highest-leverage pre-merge change is to assert that the writer’s output contains `no-such-revision`, ensuring its failure is caused by invalid-revision refusal.**" |

Both seats' highest-leverage change — one assertion that the writer's output
names the invalid revision — was taken in `621943fc9`. It is a test-only line;
no gated file changed after round 3.

## What this record does not establish

The responses are transcribed by the implementing session from gitignored run
output; the prompts are committed, so what was asked can be checked. Round 3
reviewed a delta: earlier code is covered by rounds 1 and 2. One seat stated its
round-3 confidence as "high for this delta, medium for the branch as a whole".
