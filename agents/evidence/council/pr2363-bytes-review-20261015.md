<!-- evidence-type: analysis -->

# PR #2363 review: four council rounds, all REQUEST_CHANGES

AI council, 2026-10-15. anthropic/claude-sonnet-4-5 + openai/codex-default,
2/2 present in each round, `--prompt-mode pr --rounds 2`, `$0.00` (both seats
subscription-authed). One run per round, no re-run. Both prompts are committed
verbatim beside this file:

- round 1: `pr2363-bytes-review-20261015.question.md`, the PR diff against
  `origin/main` at head `04d0864fa`;
- round 2: `pr2363-bytes-review-r2-20261015.question.md`, the follow-up diff
  `04d0864fa..b9664ac3a` minus generated projections, pack token sums, the
  archived roadmap's notes and the round-1 prompt;
- round 3: `pr2367-bytes-review-r3-20261015.question.md`, PR #2367 at head
  `939427f6c` against `origin/main`, omitting pack token sums, three small test
  files, the evidence files, the roadmap notes, the council record, the budget
  files and `dist/` (the prompt names the omissions);
- round 4: `pr2367-bytes-review-r4-20261015.question.md`, the round-3 fixes
  `939427f6c..55764e20a` minus `dist/`, two pack token sums and the round-3
  prompt, plus the unchanged `cmd_ci_settle.ts` as context.

PR #2363 was squash-merged (`26dd1905e`, 2026-10-15 05:33 UTC) before the
follow-up commits existed, so they are not on the PR. They sit on the local
branch and cherry-pick cleanly onto `origin/main` (probed in a detached
worktree, then removed).

## Round 1 — REQUEST_CHANGES, 2/2

Both seats converged on the same five items. openai rated them; anthropic
agreed, downgrading item 4 to low: "Misleading message; doesn't cause incorrect
behavior."

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | high | `/fix ci` and `/create-pr` run `npx tsx node_modules/.../ci_settle.ts`: fails on global/ephemeral installs, fetches tsx | `bfe5c678d` — `agent-config ci:settle` verb, bundled into `dist/cli-delegate/` |
| 2 | high | `--deep` transfer bound unenforceable as documented | `ce7c32a94`, reworded again in `843d35b14` after round 2 |
| 3 | medium | `modelVisibleBytes` counts payload, registry claims the block | `ce0fd04c1` — row renamed `tool-result-payload-bytes`, `unsupported_members`, tests |
| 4 | medium | undefined digest conflates three states; advisory always cites the 2 MB bound | `d4215f18e` |
| 5 | medium | size-bound test passes without the guard | `d4215f18e` — real files, each guard seen red when neutralised |
| 6 | low | stat-then-read is an unbounded read | `d4215f18e` — descriptor read capped at bound + 1 |
| 7 | low | hard-coded ~182k in the advisory | `ca162d7fc` — named constant checked against its evidence file |

Items 6 and 7 came from openai alone. openai's closing line:

> REQUEST_CHANGES — the PR currently promises controls it does not enforce and
> introduces a consumer-fragile CI command

## Round 2 — REQUEST_CHANGES, 2/2

anthropic, closing line:

> REQUEST_CHANGES — the growth race can report changed files as unchanged
> (correctness), and the repository doc still presents a best-effort gate as an
> enforceable ceiling (misleading claim).

openai, closing line:

> REQUEST_CHANGES — the reread guard can falsely report changed content as
> unchanged; the single highest-leverage change is to distinguish
> `over-bound-at-stat` from `grew-over-bound-during-read`

| Finding | Seats | Severity | Disposition |
|---|---|---|---|
| Growth race: a file that grows past the bound after the stat is compared on the stale stat pair and can be called unchanged | both | anthropic critical, openai medium | `c51bad362` — `grew-during-read` state, never a stat fallback; seen red through `compareRead` |
| The size check is called part of a "four-part ceiling" while bounding nothing; post-fetch `.git` size is not bytes received | both | medium | `843d35b14` — three-part ceiling plus a best-effort gate, `.git` size named as local storage |
| Evidence text implies images are unsupported members | both | low | `35d805bf2` |
| Image data counted without checking the source is base64 | openai | low | `35d805bf2` |
| The `ci:settle` tests run the source tree, not a packed install | both | low | **open** — the manual packed-install check is recorded in the round-2 prompt; no automated regression test was added |
| The cold-start test's exact-number match is brittle | anthropic | low | **not taken** — openai dropped it: "Requiring the evidence source to contain the exact measured value is the purpose of this test." |

The round-2 fixes went to the council as round 3, on PR #2367.

## Round 3 — REQUEST_CHANGES, 2/2

Both seats confirmed the round-2 fixes. anthropic on the TOCTOU read: "The
`contentDigest` bounded read with `grew-during-read` detection is **solid**";
on the digest union it "correctly prevents" a legacy ledger, a growth-raced read
or a failed read from asserting unchanged. openai listed both as dropped false
positives. Both raised the same two blockers.

anthropic, stance line:

> **Highest-leverage change:** Add packaging smoke test + fix emitted command path.

openai, closing line:

> **REQUEST_CHANGES — the central consumer-install promise is neither reliably
> fulfilled nor tested against the shipped package.**

| Finding | Seats | Severity | Disposition |
|---|---|---|---|
| The emitted `agent-config ci:settle <pr>` is not on PATH for a project-local install (`node_modules/.bin`) | both | high | `2df8bfa11` — every emitter names `npm exec --no -- agent-config ci:settle`; measured on a stripped PATH, offline: the bare form exits 127 on a local install, the npm exec form reaches the binary locally and globally |
| No test exercises the packed artifact | both | high | `b3a251eff` — release install harness § consumer-ci-settle runs the line the packed `/fix ci` prints, from a `--omit=dev` local install and a global one; red (127) on a tarball packed from `939427f6c`, green on `2df8bfa11` |
| The `--deep` transfer gate is best-effort without that being decided | anthropic | medium | `e3a41d547` — best-effort stated as a decision, with the reason |
| The three-part ceiling reads as stopping a fetch in flight; "the cost bound never disappears" | openai | medium | `e3a41d547` — the bounds are checked between operations; the clone fetch is bounded only by the size gate |
| Unsupported content members are counted but their types are not logged | anthropic | medium | **not taken** — openai: "Logging each type is an enhancement, not a correctness requirement." The evidence file now says the count does not record the type |
| The bounded-read test's fixture is exactly bound + 1, so it cannot catch a regression to a whole-file read that reports the same state | openai | medium | **open** — anthropic disagreed: the fixed `HASH_BOUND_BYTES + 1` buffer "**cannot** read more". No test change in this round |
| `ci_settle.ts` decides to run by its filename | anthropic | medium | **not taken** — the basename guard is correct (openai lists it as a false positive); removing the auto-run would break the in-repo `scripts-run` path |
| The PR bundles changes with different rollback boundaries | both | medium (anthropic: "Not a blocker, but real.") | **not taken** — the PR is the follow-up to one review; each finding is its own commit |

## Round 4 — REQUEST_CHANGES, 2/2

Both seats confirmed the round-3 blockers fixed. anthropic: "The round-3
blockers are fixed correctly; this is a new defect introduced by the
test-selection facility added in this round." openai on the packed test: "The
central consumer test is otherwise sound." Both blocked on one new item.

anthropic, stance line:

> **REQUEST_CHANGES** — Reviewer B Finding 1 is a high-severity
> test-infrastructure defect. The harness can report success without running
> any tests

openai, closing line:

> **REQUEST_CHANGES — the release harness can report success after running zero
> selected sections; the highest-leverage change is to validate every
> `RELEASE_E2E_ONLY` token against the known section set and require at least
> one section to execute.**

| Finding | Seats | Severity | Disposition |
|---|---|---|---|
| `RELEASE_E2E_ONLY` with an unknown name runs zero sections and exits 0 with "all sections passed" | both | anthropic high, openai medium | `93d48399b` — names validated before any work, empty token refused, zero sections run dies, a partial run names what ran; the previous script exits 0 on `consumer-ci-settlee`, this one exits 1 |
| "bounded only by" the size gate contradicts "does not bound the transfer" | openai low, anthropic cosmetic | low | `adb5e4ec2` — "gated, not bounded" |
| The emitter consistency test uses a hand-kept file list | anthropic | medium | **not taken** — openai: "the static `EMITTERS` list is acceptable here"; anthropic: "Static list is acceptable for known surfaces." |
| The global leg puts the prefix `bin` on PATH, so it does not show `npm exec` finding the global store on its own | anthropic | low | **not taken** — openai: "prepending `$prefix/bin` is the normal execution environment for an npm global installation." |

The round-4 fixes were not put to a fifth round: the instruction was one run.
They are therefore unreviewed by the council.
