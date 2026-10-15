<!-- evidence-type: analysis -->

# Council review of the danger-gate change — governance triggers, needs-owner, the base-revision run

Four rounds, 2026-10-15, two seats configured (`anthropic/claude-sonnet-4-5`,
`openai/codex-default`, CLI transport, `--prompt-mode pr --rounds 2`). Prompts,
committed verbatim before each run:
`agents/evidence/council/danger-gate-review-20261015.question.md` (round 1, the
whole change), `agents/evidence/council/danger-gate-review-r2-20261015.question.md`,
`agents/evidence/council/danger-gate-review-r3-20261015.question.md` and
`agents/evidence/council/danger-gate-review-r4-20261015.question.md` (deltas). The
full responses are local run output and are summarised here, with the seats'
stances in their own words. The round-2 run first came back degraded (0/2
present, the local quota counter at 50/50); the counter was reset and the same
prompt re-run, which is the run recorded below.

## Verdicts

| Round | anthropic/claude-sonnet-4-5 | openai/codex-default |
|---|---|---|
| 1 | "REJECT — Two critical blockers and one high-severity issue make this unsafe to ship" | "REQUEST_CHANGES — the merge-authorization gate can mask classifier failure, execute through a head-influenced runtime, and miss valid owner-reserved YAML." |
| 2 | "REJECT — Two HIGH severity findings that are not merely unguarded edge cases but direct bypasses of the gate's security invariants" | "REQUEST_CHANGES — valid YAML and a failed `git ls-files` probe can still bypass owner escalation" |
| 3 | "REQUEST_CHANGES — the nested-field bug is a correctness violation (fail-open where it should fail-closed), the temp-leak contradicts stated guarantees, and the lockfile protection is unproven." | "REQUEST_CHANGES — nested YAML can still yield a non-owner policy and fail the danger gate open." |
| 4 | "APPROVE — All round-3 findings substantively resolved, no new defects, test coverage complete and meaningful. The change fails closed on every anomaly path." | "APPROVE — the substantive danger-gate defects are fixed; before merge, the highest-leverage change is to install a guarded cleanup trap immediately after successful `mktemp`, before the non-empty and directory checks, and make the prose match that exact guarantee." |

## Findings and dispositions

| Round | Finding (seats) | Disposition | Red-proof |
|---|---|---|---|
| 1 | The shell block masked a `tsx` failure behind the cleanup and never validated the last line (both, blocker) | fixed — exit status and last line must agree on one verdict, else `classifier-unusable` → `needs-owner`; the block exits 0 only on `routine` | the tests run the block as shipped; a crashing and a lying base classifier both red before |
| 1 | The base copy ran through the head checkout's `tsx` (both, blocker) | fixed within the boundary — a head that tracks `node_modules` or changes the dependency manifest is `runtime-unverified`; the clean-runner assumption is stated in the command | manifest and tracked-`node_modules` cases |
| 1 | A failed `git cat-file -e` read as absence (both, medium/high) | fixed — `readSide` uses `ls-tree`, a failed read is null and fires | unit test red with the old branch |
| 1 | `consequenceMembersOf` accepted an array (both) | fixed | test red before |
| 1 | Cleanup incomplete (both) | fixed — `trap` on exit; round 3 moved it ahead of `cd` | temp-directory assertion |
| 1 | Suffix-anchored patterns also match fixtures (both, medium) | kept — the width is the ratification gate's own any-prefix rule pattern so every projection root matches; an extra match errs toward a review, never toward `routine` | comment at the pattern |
| 1 | The owner-trigger-id test was tautological (both) | fixed — one witness path per owner trigger, asserting it fires alone and yields `needs-owner` | — |
| 1 | `reopenPolicyOf` missed valid YAML (openai, blocker) | fixed over rounds 1–3 — one stated subset; anything outside it, nested, quoted, flow, explicit-key, merge-key or block-scalar, reads `owner`; every committed ADR still reads as declared (test) | YAML fixtures red with each earlier reader |
| 1 | Shallow clones skip the replays (both, medium/low) | kept — the replays skip by name and every path they exercise is also a hand-written case | — |
| 1 | ADR-282 is named by number (anthropic, medium) | kept — ADR-282 declares `reopen_policy: owner`, so `owner-reserved-decision` sends it to the owner; a successor that does not declare it is the residual | — |
| 2 | A failed `mktemp` derived `/classifier-base` (both, high) | fixed — no path before `mktemp` succeeds; `temp-dir-unavailable` | `mktemp` shim |
| 2 | Yarn, pnpm and Bun manifests not checked (anthropic, medium) | fixed; round 3 added a test per path | each path red with the list shortened |
| 2 | `git ls-files` failure read as "nothing tracked" (openai, high) | fixed — the substitution's own status is checked | `git` shim failing only `ls-files` |
| 3 | Nested `reopen_policy` yielded a non-owner policy (both, high) | fixed — only a column-zero line can | nested fixtures red with the round-3 reader |
| 3 | The trap came after `cd` (both, low) | fixed — the trap follows `mktemp`'s two checks | unenterable-directory test red before |
| 4 | The prose said "the moment one exists" while two checks precede the trap (openai, low) | fixed in the prose, after the approving round: it now names the two checks and what an interruption there can leave | — |
| 4 | The unenterable-directory test cannot be built as root (both, non-blocking) | the case skips for uid 0, saying why | — |

## Rounds 5–9 — the owner's decision on dependency manifests

On 2026-10-15 the owner decided, on PR #2375, that a change to `package.json`
or a lockfile must not yield `needs-owner`; it goes to the council. The base
classifier must still not run through a head-influenced runtime. The change was
re-presented as delta rounds, prompts verbatim in
`agents/evidence/council/danger-gate-review-r5-20261015.question.md` to
`agents/evidence/council/danger-gate-review-r9-20261015.question.md`. The first
round-9 run was skipped by the council's necessity heuristic (agent invocation,
"bugfix" bucket). A skip is not a verdict, so the same prompt was re-run with
`--invocation user_explicit`, since the owner had ordered the review. That
re-run is the one recorded.

| Round | anthropic/claude-sonnet-4-5 | openai/codex-default |
|---|---|---|
| 5 | "REQUEST_CHANGES — the delta is close but needs: 1. Explicit prose documenting crash→council behavior … 2. Test combining no-strip-types with poisoned tsx … 3. Gate-level test for nested manifest changes" | "REQUEST_CHANGES — nested manifests can still reach `routine`, and fallback-runtime failures are incorrectly downgraded from owner to council." |
| 6 | "REQUEST_CHANGES — The grep exit-status fail-open … must be fixed before merge." | "REQUEST_CHANGES — manifest detection still fails open when `grep` errors" |
| 7 | "REQUEST_CHANGES — … two shipping-risk gaps remain: Fail-open file-read … Gated+manifest precedence" | "REQUEST_CHANGES — the temporary-file reader can still fail open despite the new prose claiming otherwise" |
| 8 | "REQUEST_CHANGES — The production code is correct, but the test has two issues" | "REQUEST_CHANGES — the production fix is correct, but the regression test is privilege-dependent" |
| 9 | "APPROVE — all four round-8 findings correctly addressed, no new defects, test coverage is sound and privilege-independent." | "APPROVE — the delta correctly answers all four round-8 findings without expanding the production blast radius" |

| Round | Finding (seats) | Disposition | Red-proof |
|---|---|---|---|
| 5 | Only root manifests were checked; a nested `package.json` took the trusted-runtime branch (openai, high) | fixed — manifests are matched by basename at any depth | nested manifest + no type stripping + head-installed `tsx` |
| 5 | A failed fallback on a manifest change became `needs-council` (both) | fixed — only a valid fallback verdict is floored to `needs-council`; no valid verdict is `needs-owner` | crashing runtime |
| 5 | No test combined no type stripping with a head-installed `tsx` (both) | fixed — three such tests, one of them pinning the stated residual | — |
| 5 | Bare `git diff --quiet` broke under `set -e` (openai, medium) | fixed | `set -e` test |
| 6 | grep's error status read as "no manifest" (both, high) | fixed — no external matcher; NUL-separated listing matched by a `case` on the basename | — |
| 6 | A newline in a parent directory could evade a line-based match (openai, medium) | fixed — `git diff --name-only -z` | newline-directory test |
| 6 | Malformed zero-exit fallback untested (openai, low) | test added; it asserts the exit code since round 7 | — |
| 7 | A listing written but not read back left `DEPS=0` (both, medium/high) | fixed — an empty record is appended as an end marker, and the listing is trusted only when the loop reaches it | listing linked to `/dev/null` |
| 7 | Gated file plus bump under a forged `routine` should be `needs-owner` (anthropic) | kept — under the owner's decision a valid lower verdict from the fallback becomes `needs-council (runtime-uncertain)`. That is the stated residual, and the other seat agreed | — |
| 8 | The fixture depended on privileges; generation was not proven (both) | fixed — `/dev/null` link plus a `git` shim logging that the listing exited 0 | test red against the round-7 block |

The PR's own class after these rounds: the trunk's classifier, run by this
block, says `needs-council` (`merge-authority-surface`). The trunk's closure
cannot be stripped, so that run falls back to `tsx`, and this PR changes no
manifest. The classifier this PR introduces says `needs-owner`
(`merge-authority-surface`, `reviewer-trust-chain`).
