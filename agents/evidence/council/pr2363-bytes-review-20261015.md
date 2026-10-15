<!-- evidence-type: analysis -->

# PR #2363 review: two council rounds, both REQUEST_CHANGES

AI council, 2026-10-15. anthropic/claude-sonnet-4-5 + openai/codex-default,
2/2 present in each round, `--prompt-mode pr --rounds 2`, `$0.00` (both seats
subscription-authed). One run per round, no re-run. Both prompts are committed
verbatim beside this file:

- round 1: `pr2363-bytes-review-20261015.question.md`, the PR diff against
  `origin/main` at head `04d0864fa`;
- round 2: `pr2363-bytes-review-r2-20261015.question.md`, the follow-up diff
  `04d0864fa..b9664ac3a` minus generated projections, pack token sums, the
  archived roadmap's notes and the round-1 prompt.

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

The round-2 fixes were not put to a third round: the instruction was one
re-presentation. They are therefore unreviewed by the council.
