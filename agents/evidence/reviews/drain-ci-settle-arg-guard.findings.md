# Findings: drain-ci-settle-arg-guard
<!-- completion-review: v1 | reviewed: 2026-10-01 | scope: 70f2302fcf7ddd1f4bcd1638162ef0d532dda4ba15b07f8aa9f2824a4f4cd421 | diff: 14815e5c2e3f2d4a36e052693e51fa68d2af8096 | reviewer: r2-fresh-subagent-drain-ci-settle-arg-guard | prompt_hash: 67895abbeb52771e5ea06832a95215aa4b96101d966531bdcfd3fa3d9b469c22 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-ci-settle-arg-guard"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-01 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 14815e5c2e3f2d4a36e052693e51fa68d2af8096
  scope_hash: 70f2302fcf7ddd1f4bcd1638162ef0d532dda4ba15b07f8aa9f2824a4f4cd421
  roadmap: agents/roadmaps/road-to-host-claims-the-tree-contradicts.md
  roadmap_hash: f7c0a4e89879f2bf01ff2e9dd4758b3c12268c4198418d7d7ac67f673a318e22
  ac_hash: 8439c3410ee5d2255385153cb79564dabe632ef329bccaa73dcd89fc07284169
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-01T01:09:10Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/ci_settle.ts:361 | The mandatory positional is the one argument left unvalidated, so the exact failure shape this change exists to remove stays reachable. `parseArgs` refuses every unknown flag, every unusable flag value and every extra positional, but `positional[0]` is accepted verbatim: `parseArgs(['PR-2130'])` returns `kind: 'ok'`. `main` then takes `readTarget` → `unreadable` and prints "waiting anyway" (:413), every `poll` returns `unreadable` because `gh pr view PR-2130` exits non-zero (classifyPoll :215), there is no streak cap (:461 increments and prints only), and the run burns the whole budget to end at `DID NOT SETTLE within 9 min` — which is verbatim the "read as a slow CI rather than as their own typo" outcome the new docstring (:304-320) names as the defect. A shape check on the PR argument is the same refusal the flags already get. | fixed | The PR argument is now validated like every flag: a number, `#number` or a pull-request URL, with a branch name refused on purpose because this tool binds its verdict to one head. Test: `parseArgs — the PR argument itself`, six rejected shapes including the reported `PR-2130`. (`9d86abcdd`) |
| 2 | low | src/scripts/ci_settle.ts:372 | The replaced parser guarded with `Number.isFinite(n) && n > 0`; the replacement guards with `/^[0-9]+$/` plus `n <= 0` (:374), which does not exclude `Infinity`. A digits-only argument past `Number.MAX_VALUE` parses to `Infinity`, passes both checks, and reaches `deadline = Date.now() + timeoutMin * 60_000` (:422) as `Infinity`, so `Date.now() >= deadline` (:472) is never true and the loop can no longer reach its own `DID NOT SETTLE` branch — an unbounded wait in a tool whose stated contract is that it always returns a stated non-verdict. Exotic input, but the finiteness guard existed before this diff and is gone after it. | fixed | The `Number.isFinite` guard the rewrite dropped is restored, with its own message. Test: `refuses a digits-only value that parses to Infinity`. (`9d86abcdd`) |
| 3 | low | tests/scripts/ci_settle.test.ts:264 | Two refusal branches introduced by this diff have no test, in a guard whose entire product is refusal. `given.has(name)` → `given twice` (ci_settle.ts:350) is never exercised; and of the two halves of `v === undefined \|\| v.startsWith('--')` (:356) only the first is covered — `refuses a flag given with no value at all` (:271) passes `['2130','--timeout-min']`, never `['2130','--timeout-min','--interval-sec','5']`. `--interval-sec` is also never fed a bad value, so the `'seconds'` arm of the message at :372 is untested. A refusal branch never seen red has unknown sensitivity. | fixed | All three named branches now have assertions — repeated flag, flag whose value is the next flag, and a bad `--interval-sec` value exercising the `seconds` arm. Seen red before the fix commit. (`9d86abcdd`) |
| 4 | low | src/scripts/ci_settle.ts:365 | The extra-positional message interpolates the stray value into a fixed `--timeout-min` suggestion, which is correct only for the measured `1700` case. `ci_settle 2130 notes.txt` answers `e.g. --timeout-min notes.txt` — advice that `parseArgs` itself would refuse at :372 — and a stray `--interval-sec` value is guessed as a timeout. The surrounding refusals all name the actual constraint; this one names a guess. | fixed | The message names the real constraint — one positional, the PR number — instead of interpolating the stray value into a `--timeout-min` suggestion the guard would itself refuse. Test asserts the old advice string is absent. (`9d86abcdd`) |


## Two things this artefact records rather than smooths over

**The fixes predate the artefact, and the gate is right to say so.** The review
was commissioned mid-work rather than through a pre-merge dispatch, so all four
findings were closed in `9d86abcdd` before this file was committed. That makes
the verdict `fix-before-artifact` rather than a clean `artifact-not-committed`,
and the honest move is to state it here instead of shaping the file to avoid it.

**The input package's acceptance criteria do not cover this diff, and the
reviewer caught that.** `dispatch_r2_reviewer` requires a roadmap, and the one
supplied — `road-to-host-claims-the-tree-contradicts` — governs the
enforcement-by-host format column and `one_question_per_ask_hook.ts`. None of
its five criteria touches `ci_settle.ts`. The reason is that this change has no
governing roadmap at all: it is a defect found while draining the estate, where
the drain's own documented `ci_settle` invocation named a flag the tool does not
have. Binding the review to an unrelated roadmap was the wrong call; the right
one was to say there is no roadmap.

One live misreading hazard follows from it and is named so nobody inherits it:
that roadmap's AC-5 reads "the guard's runtime behaviour is byte-identical
before and after". It is about `one_question_per_ask_hook.ts`. This diff
deliberately DOES change a guard's runtime behaviour, and a later reader
matching the word "guard" across the two could conclude the criterion was
violated. It was never in scope.

**One risk the reviewer raised that is not closed here.** Making a tolerant
parser strict is a breaking change for callers, and the contract's tool
allowlist barred the reviewer from sweeping for call sites. That sweep was run
on the implementing side instead: `grep -rn 'ci_settle' src/ docs/` over the
authored tree returns twelve mentions and exactly ONE naming a flag — the
`/roadmap:process-full` table this diff corrects. Every other reference spells
the command with no arguments. A reader who wants to re-run that sweep has the
command; it is cheap and it is the only thing standing between this change and
a caller it did not consider.
