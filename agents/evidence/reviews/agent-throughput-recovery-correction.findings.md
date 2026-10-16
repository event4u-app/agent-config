# Findings: agent-throughput-recovery-correction
<!-- completion-review: v1 | reviewed: 2026-10-16 | scope: 71218205a4bb92d75eee5075888c5e4b4d81e5becd2eabe0b3d3577356959433 | diff: 3fc192f9ab7ce2fe841befd41071b0a846a46c81 | reviewer: r2-fresh-subagent-agent-throughput-recovery-correction | prompt_hash: 0c479b083da4f961159c297a927a7df54f1a02666270538f6527383f6d248871 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-agent-throughput-recovery-correction"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-16 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 3fc192f9ab7ce2fe841befd41071b0a846a46c81
  scope_hash: 71218205a4bb92d75eee5075888c5e4b4d81e5becd2eabe0b3d3577356959433
  roadmap: agents/roadmaps/road-to-agent-throughput-recovery.md
  roadmap_hash: 03c5a983e4b3d9f332ccfb855d6c602cf16a20ec9fc103bb6a5e5103a19c5e05
  ac_hash: accb145e7d6cf1135c13bc050fe057490e9110eb3876debc44962af832c559e4
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-16T09:38:43Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/_lib/turnaround_throughput.ts:129-140 | Denominator: every per-night figure (C1 table, the 1.2 baseline 7.71 / 21.86, the AC-4 target) divides by nights *with at least one commit*. A night on which runs stalled — usage limit, refusal loop, nothing merged — leaves the denominator, so the instrument is blind to exactly the failure the roadmap measures and AC-4 can be "exceeded" by having fewer active nights. The windows also differ in length (14 / 14 / 16 calendar nights; active 13 / 13 / 14) and neither the calendar count nor the dropped nights are stated anywhere. | fixed | 71e5d99c9 — denominator is every night in the window; active and calendar nights both printed and recorded |
| 2 | medium | src/scripts/probe_turnaround.ts:694 | Window/ref: `readyAtZero` always reads the working tree at `REPO_ROOT`, ignoring `--ref` (and `--workspace`). One run therefore mixes refs: git figures at `085ec41ff`, estate at HEAD. Proof in the tree: at `085ec41ff` `agents/roadmaps/` holds 26 roadmap files (C4 says "26 active"), at HEAD 34 with 29 `ready` — and step 1.1 prints "16 of 29 `ready`", a population larger than C4's whole active set. Neither C4's 576 / 51 / 525 nor the Context's "10 of 20 `ready` at 0 ticked" is reproducible by the probe at its stated ref, yet 1.1 is ticked as "one run prints every figure of the Context section" (AC-2). | fixed | 71e5d99c9 — estate read at --ref via git; at 085ec41ff the probe prints 10 of 20 and 525 of 576 |
| 3 | medium | src/scripts/probe_turnaround.ts:698 | Window: refusals come from `collectRefusalStats(workspace)` — the whole turn-end-gate state directory, all time (1.1: "305 in 141 sessions") — while turn ends, pauses and push p50 come from the `--limit` session window (10 sessions). The output prints them side by side with no window line, so "305 refusals" vs "265 turn ends" compares different populations; nor is the window of the Context/Finding 5 figure (123) it is meant to reproduce stated. | fixed | 71e5d99c9 — refusal line names its window (whole store, earliest..latest, not the --limit window) |
| 4 | low | src/config/turnaround-budget.json:82,87 | Sum/recompute: the note claims "Ratios recompute from this block", but 555 / 686 = 0.80904, which rounds to 0.8090, not the recorded `blocking_share` 0.8091 (the block stores rounded minutes; the reading came from unrounded ones). The +0.1889 delta is computed from 0.8091. Other figures check: 2912/267 = 10.91, 2962/2577 = 1.15, cause split 212+186+115+38+3+1 = 555, 244,472 − 230,705 = 13,767; 1.2 entry 108/14 = 7.71, 306/14 = 21.86; C1 table 148/13, 98/13, 108/14, 794/13, 420/13, 306/14 all match; C4 576 − 51 = 525; pauses 4 + 6 = 10. | fixed | 71e5d99c9 — note states the share is from unrounded seconds and the minutes are rounded |
| 5 | low | src/scripts/probe_turnaround.ts:715 | The four sum checks cannot fire on real data: `classifyTurnEnd` returns exactly one label, pauses are split by an if/else, and the refusal total is defined as `sumOf(byDetector)` (`src/scripts/_lib/turn_end_refusals.ts:907`); the blocking tail is one cause per call. 1.1's "Four sum checks exit 1 on a mismatch; the overlapping-label fixture fails it" exercises `checkSum` in isolation only. AC-2's "class rows sum to its totals" is satisfied by construction, not checked — fine as a guard, but not evidence. | fixed | 71e5d99c9 — the 1.1 note now says the production tables are exclusive by construction and their sum checks are guards, not evidence |
| 6 | low | src/scripts/_lib/turnaround_throughput.ts:51 | `plain-ask` only fires when the last prose line literally ends in `?`; a question wrapped in emphasis (`…?**`), parentheses, or followed by a link/summary line reads as `other`. The 1.1 reading "0 plain-text asks of 265" is implausible enough that it needs a control run on a known plain ask in the real store before it is reported as a finding. | fixed | 71e5d99c9 — rule reads through emphasis, brackets and a trailing link, pinned red-first; still 0 on the real window |
| 7 | low | src/scripts/probe_turnaround.ts:398 | A pause whose timestamp does not parse is counted as `day` instead of `unknown`, contradicting the module header ("every table carries an `unknown` row"); night/day split silently absorbs bad data. | fixed | 71e5d99c9 — pauses carry an unknown row, included in the sum check |
| 8 | low | src/config/turnaround-budget.json:111 | Numerator: "commits counts merged changes" assumes every non-merge first-parent commit is a squashed PR; no subject/`(#NNNN)` check excludes direct pushes or bot/release commits. In window 2 that is 50 of 98 commits unverified. | fixed | 71e5d99c9 — merged changes count commits naming a PR; every commit in the three windows does |
| 9 | low | src/scripts/_lib/turnaround_throughput.ts:306 | Window: `readCiMinutes` filters by `--created` UTC calendar dates, not the 22:00–08:00 night window the git figures use, and truncates silently at `--limit 1000`; step 1.1 reports "`tests.yml` p50 14.1 / 15 min" without naming which windows the two values belong to. | fixed | 71e5d99c9 — CI line names UTC created dates per window and flags a truncated listing |
| 10 | low | src/scripts/_lib/turnaround_throughput.ts:249,261 | `status:` and `status: ready` are matched anywhere in the body (multiline), not only in frontmatter; `blocked-by` is a bare substring, so a prose mention ("not blocked-by anything") counts a step as blocked. Affects the C4 51 / 525 split. | fixed | 71e5d99c9 — status read from frontmatter only, blocked-by as a marker only |
| 11 | low | src/scripts/_lib/turnaround_throughput.ts:144 | Net ticked counts any added `- [x]` under `agents/roadmaps/`, including a new roadmap or stub authored with pre-ticked steps, which is authoring, not work done in the night. | fixed | 71e5d99c9 — ticks in files the commit creates are excluded and reported separately |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->

## Reviewer dispatch — declared prompt delta

The reviewer was a fresh general-purpose subagent pointed at the hashed
`prompt.md` in the input package, with two additions: the working directory,
and one extra question asked on top of the prompt's search grid — for the
appended corrections section and the new budget readings, check denominators,
windows and sums (step 0.3 of the roadmap names those three axes). The addition
stated no expected outcome. The reviewer wrote this table directly.
