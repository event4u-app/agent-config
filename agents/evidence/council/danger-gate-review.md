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
