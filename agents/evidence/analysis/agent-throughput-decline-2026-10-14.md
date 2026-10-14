<!-- evidence-type: analysis -->
# Agent throughput decline — where the night shifts went

Measured 2026-10-14 on `origin/main` @ `555e50a29`, for
`road-to-agent-throughput-recovery`. Question from the owner: autonomous runs
used to close ~20 roadmaps in one night; now they close fewer and stop more
often. Why, and what can change it.

## Sources and their limits

- **Host session transcripts** — 62 files under the host's per-project transcript
  directory (main checkout plus four worktree directories), 2026-09-12 to
  2026-10-14. Older transcripts are no longer on disk, so the high-throughput
  period (2026-08) has **no transcript evidence**; every then-versus-now
  comparison below that reaches into August uses git history or the CI API
  instead, and says so.
- **Git history** of `origin/main`, first-parent, 2026-05 onwards.
- **CI API** — `tests.yml` and `consistency.yml` pull-request runs; August
  figures from date-windowed API queries (n = 86–100 per window).
- The extraction scripts were throwaway Python run outside the tree; step 1.1
  of the roadmap ports them into a committed instrument so these numbers can be
  re-read rather than re-argued.

## Finding 1 — throughput fell about 4×, and the parallel drain pattern ended

| ISO week | first-parent commits on main | roadmaps archived | `drain/*` lane merges |
|---|---|---|---|
| W33 (Aug 10–16) | 143 | 49 | 0 |
| W34 (Aug 17–23) | 214 | 80 | 106 |
| W35 | 155 | 47 | 57 |
| W37 | 151 | 32 | 79 |
| W38 | 25 | 6 | 18 |
| W39 | 12 | 4 | 1 |
| W40 | 113 | 37 | 18 |
| W41 | 108 | 26 | 0 |
| W42 (partial) | 51 | 18 | 0 |

Non-merge commits: 1,898 in 2026-08-17..31 against 500 in 2026-09-28..10-14.
The best single days (2026-08-22: 22 archived, 2026-08-23: 24) all sit inside
the weeks where many `drain/road-to-*` branches merged side by side. Since W41
every change lands as one squash PR at a time; no drain lane has merged since.

## Finding 2 — half of the measured wall-clock is waiting on gates, serially

Tool-call wall-clock attributed by command shape, across all 62 transcripts
(92.2 h measured; gaps over 10 minutes excluded as idle):

| Activity | Hours | Share |
|---|---|---|
| Model (time between a tool result and the next assistant message) | 25.7 | 27.9 % |
| Waiting on remote CI (`ci_settle`, `gh pr checks`, `gh run`) | 24.9 | 27.0 % |
| Other Bash | 13.2 | 14.4 % |
| `git push` (pre-push hook) | 7.2 | 7.8 % |
| Local tests / CI subsets | 6.4 | 6.9 % |
| Council runs | 5.1 | 5.5 % |
| Lints / checks | 2.3 | 2.5 % |

`ci_settle` was called 584 times (p90 9.2 min, capped at 10); `git push` 467
times (p50 1.0 min). Both block the lane in the foreground: while one PR waits,
no other roadmap advances. In the drain period those waits overlapped across
lanes; now they add up.

CI itself grew heavier, though it is not the largest single factor:

| Window | `tests.yml` PR run p50 |
|---|---|
| 2026-07-20..27 | 5 min |
| 2026-08-17..24 | 14 min |
| 2026-08-31..09-06 | 18 min |
| W40 / W41 / W42 | 20 / 13 / 14 min |

| Date | `check_*`/`lint_*` scripts | hook `.ts` files | workflows |
|---|---|---|---|
| 2026-07-15 | 167 | 8 | 26 |
| 2026-08-20 | 248 | 37 | 28 |
| 2026-09-15 | 314 | 58 | 33 |
| 2026-10-14 | 334 | 67 | 35 |

## Finding 3 — the workable backlog shrank; the parked one grew 7×

| Date | active roadmaps | parked in `later/` |
|---|---|---|
| 2026-07-15 | 17 | 14 |
| 2026-08-20 | 27 | 53 |
| 2026-09-15 | 10 | 86 |
| 2026-10-14 | 26 | 104 |

The active estate today carries 62 owner-reserved / owner-question mentions. A
night run now spends its time on roadmaps whose remaining steps wait on a
decision, a measurement window or an external trigger — and stops there.

## Finding 4 — most stops are decision asks the owner answers with the recommendation

End-of-turn assistant messages, classified by their closing text (1,560 turns):

| Turn ends with | Count |
|---|---|
| summary / other | 943 |
| numbered options + recommendation line | 269 |
| PR link | 227 |
| blocker report | 119 |

The most frequent short owner replies: `1` (46), `mach weiter` (29), `2` (10),
`3` (5). The recommended option is almost always the one taken, so most of the
269 asks bought a round-trip and no information.

## Finding 5 — the turn-end gate refused 123 turn ends, half of them on a wrong pin

| Refusal class | Count |
|---|---|
| language: pinned `en`, reply was German (the owner writes German) | 64 |
| verification: file changed, no recorded verification | 49 |
| pending-decision | 4 |
| promissory close | 4 |
| language: pinned `de` | 2 |
| completion claim on a stale CI read | 1 |

Each refusal costs a full extra model turn over the whole context. The
language class is a defect, not an obligation: a pin of `en` against a German
prompt. The `hooks.turn_end_gate.*` settings were removed ("always armed"), so
there is no per-detector off switch while a detector misfires.

Guard false positives seen in the same window: `block-no-verify` refused
`grep -n` / `-nE` 12 times (short flag read as `git … -n`);
`block-speaking-inbox-dir` 13 times; host auto-mode classifier denials about
25 times.

## Finding 6 — every session starts at 210–245k tokens of context

First assistant turn input (cache create + cache read + input) per session:
**209k–245k tokens**, flat across the whole window. `~/.claude/rules/` holds
106 rule files (369 KB, roughly 90k tokens); only 2 of them carry `paths:`, so
on this host the other 104 load unconditionally (`claudeRuleRewrite.ts`
documents why: `paths:` is the only activation key the host reads). The checkout
runs `lean_projection.mode: delivery`, but the user-global install is the
eager full-body corpus.

Consequences seen in the transcripts: 12 auto-compactions (one at 932k tokens,
49.7 s), and **~40 "usage limit reached" pauses** in four weeks, several of
them overnight (12:40am, 2:50am, 3:10am, 4:20am, 5:40am…), each suspending the
run until the window reset. A large standing context is paid on every turn and
on every subagent spawn, so it converts directly into earlier limit hits.

## What the numbers do not show

- No transcript covers August, so "the model got slower per step" can be
  neither confirmed nor ruled out; model share of wall-clock (28 %) is measured
  for the current window only.
- Usage-limit pauses depend on plan and on parallel sessions on the same
  account; their count is a lower bound of their cost, not a causal proof.
- Decision-ask classification is by closing text, so an ask phrased without a
  `Recommendation:` / `Empfehlung:` line is counted as "summary / other".
