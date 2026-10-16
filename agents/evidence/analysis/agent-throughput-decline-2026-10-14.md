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

## Corrections (2026-10-16)

Appended, not rewritten: the body above stands as written on 2026-10-14 so a
reader can see what the correction corrects. Every figure here is re-read
against `main` @ `085ec41ff` (the commit the roadmap's 2026-10-15 revision
measured) unless a row says otherwise.

### C1 — Finding 1's "about 4×" compares commits, and commits stopped meaning merges

First-parent commits on `085ec41ff`, night window 22:00–08:00 Europe/Berlin (a
commit before 08:00 belongs to the previous evening's night). Per-night figures
divide by **every** night in the window, so a night on which runs stalled and
nothing landed stays in the denominator. A merged change is a commit whose
subject ends in `(#N)` or is GitHub's merge subject — every commit in all three
windows does. Net ticked steps = added minus removed `- [x]` lines under
`agents/roadmaps/` in each commit's first-parent diff; the first tick column
excludes files the commit creates (a roadmap authored with checked steps is
authoring), the second counts them. Reproduce with `probe_turnaround --ref
085ec41ff --git 2026-08-10..2026-08-23,2026-08-24..2026-09-06,2026-09-28..2026-10-13`.

| Window | nights (with a commit) | merged changes | per night | true merge commits | net ticked, edited files | per night | net ticked, incl. created files | per night |
|---|---|---|---|---|---|---|---|---|
| 2026-08-10..23 | 14 (13) | 148 | 10.6 | 148 | 383 | 27.4 | 794 | 56.7 |
| 2026-08-24..09-06 | 14 (13) | 98 | 7.0 | 48 | 311 | 22.2 | 420 | 30.0 |
| 2026-09-28..10-13 | 16 (14) | 108 | 6.8 | 13 | 282 | 17.6 | 306 | 19.1 |

Merged changes per night are near flat between the second and third window; what
fell is **work per merge**. The roadmap's 2026-10-15 revision printed 56.7 /
30.0 / 19.1 ticked steps per night — **reconciled exactly**: that series counts
ticks in created files and divides by calendar nights. Half of the first
window's ticks were roadmaps authored with checked steps, so the decline in work
done is 27.4 → 17.6, smaller than the 56.7 → 19.1 the revision shows. Its
merged-change series (11.1 / 7.7 / 7.7) is **not reconciled**: no denominator
tried here (active or calendar nights) reproduces it, and its method is not
recorded.

### C2 — the `drain/*` column reads zero by construction after the squash switch

The column counts merge commits whose subject names a `drain/*` branch. The last
such commit on first-parent `main` is `d88b9b556` (2026-09-30, PR #2107); from
October nearly every PR lands as a squash commit, whose subject carries no
branch name (13 true merge commits in the third window above, against 108
commits). "No drain lane has merged since W41" is therefore a property of the
merge method, not evidence that lanes stopped.

### C3 — three of the six causes were this size during the high-throughput weeks

| Cause in this file | Value in the high-throughput period | Source |
|---|---|---|
| first-call context 209k–245k (Finding 6) | 218,705–230,705 on 2026-08-30 | `agents/evidence/analysis/agent-turnaround-2026-08-30.md:95` |
| `git push` p50 1.0 min (Finding 2) | median 67 s on 2026-08-30 | `agents/evidence/analysis/agent-turnaround-2026-08-30.md:52` |
| `tests.yml` p50 13–14 min W41/W42 (Finding 2) | 14 min 2026-08-17..24 | this file's own CI table, Finding 2 |

They are costs worth cutting, not causes of the decline.

### C4 — Finding 3's "workable backlog shrank" is contradicted by the estate

At `085ec41ff`, 26 active roadmaps carry **576** open `- [ ]` steps; **51** of
them carry a `blocked-by:` (or code-spanned `` `blocked-by``) marker in the
step's text (from its checkbox to the next checkbox or heading), so **525** carry
none; `status:` is read from frontmatter only. The same run gives **10 of 20**
`ready` roadmaps at 0 ticked steps. Reproduce with `probe_turnaround --ref
085ec41ff`. The roadmap's revision counts 528 with a narrower marker scope;
either figure means the active estate does not bound a night.

### C5 — three sums in the body do not add up

| Table | Rows sum to | Stated total | Status |
|---|---|---|---|
| Finding 2 activity hours | 84.8 h | 92.2 h | `unknown` — 7.4 h unaccounted; the extraction script was not committed, so the missing class cannot be named |
| Finding 5 refusal classes | 124 | 123 | `unknown` — one refusal counted in two classes, or the total is off by one; not reconstructible from the tree |
| Finding 4 turn classes | 1,558 | 1,560 | `unknown` — two turns unclassified; not reconstructible from the tree |

### C6 — the real `block-no-verify` false-positive set

Finding 5 names `grep -n` / `-nE`. Plain `grep -n` and `git status; sed -n …`
pass today. What the guard still refuses is short `-n` on **every** git
subcommand: `_NO_VERIFY_SHORT` (`src/scripts/hooks/block_no_verify.ts:45`) is
checked against every token at `:342`, and any short bundle containing `n` at
`:349`. Probed 2026-10-16 through the exported `_check_command`: `git grep -n`,
`git grep -nE`, `git log -n 5`, `git branch -n`, `git push -n` and
`git merge -n` are all refused; `grep -n` and `git status; sed -n 1p` pass;
`git commit -n` and `git am -n`, the real bypasses, are refused as they must be.

### C7 — prior art this file did not cite

- `src/scripts/probe_turnaround.ts` — the committed transcript instrument the
  "throwaway Python" duplicates; its baseline is `src/config/turnaround-budget.json`.
- `agents/evidence/analysis/turnaround-reading-2026-10-01.md:100` — the
  regression in blocking share and context floor was already read on 2026-10-01
  and left "for whoever owns that number next".
- `agents/evidence/analysis/turnaround-blocking-by-cause-2026-10.md:83-85` — the
  2026-10-07 cause split (`ci-wait` 261 min, `sleep-poll` 28 min), against which
  the 2026-10-16 run of the probe reads `sleep-poll` 212 min and `ci-wait` 186 min.
- Decisions D6–D8 of the archived `road-to-blocking-time-by-cause` — the CI-wait
  mitigation (background next wait on the waiter's last line,
  `src/scripts/ci_settle.ts:300`) and the closure of `user-wait` as holding no
  avoidable minutes, both of which this file's recommendations re-plan.
