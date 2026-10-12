<!-- evidence-type: analysis -->

# Turnaround blocking time by cause — 2026-10

`road-to-blocking-time-by-cause` Phase 2. The 2026-10-01 reading
(`turnaround-reading-2026-10-01.md`) measured a blocking share of 0.8908 and
named one mechanism "as a hypothesis rather than a finding": parallel worktree
drain runs waiting on CI settles and subagent returns. It could not test that,
because the probe kept only durations. The probe now assigns every call over
60 seconds exactly one cause. This page is the reading that tests it.

## Invocation

```
./scripts-run src/scripts/probe_turnaround \
    --store ~/.claude/projects/-Users-mathiasberg-projects-galawork-galawork-packages-event4u-agent-config \
    --limit 10
```

`--store` is required for the reason the 2026-10-01 page gives: the reading was
taken from a worktree, whose cwd mangles to a slug naming no transcript store.

## Window shape

| | |
|---|---|
| Window | the 10 most recently modified sessions in the store, excluding the measuring session (`CLAUDE_CODE_SESSION_ID` was set and matched) |
| Read | 2026-10-07, ~02:30Z |
| Oldest / newest mtime | 2026-10-02T02:27Z / 2026-10-07T00:03Z |
| User requests | 293 |
| API calls | 3,729 (12.73 per request) |
| Tool calls | 3,664 in 3,361 tool-using requests (batch 1.09) |
| Tool time | 978 min |
| Blocking calls (>60 s) | 145, holding 802 min (share 0.82) |
| First-call context floor | 220,761–244,894 tokens |

The window overlaps the 2026-10-01 one only in part: that reading saw 252
blocking calls and 1,266 blocking minutes. Neither the share nor the floor here
is a delta against it, and none is offered as one.

## First pass — inconclusive, and why

The classifier as Phase 1 shipped it gave:

| Cause | Calls | Minutes |
|---|---:|---:|
| ci-wait | 39 | 251 |
| subagent-wait | 5 | 6 |
| test | 6 | 12 |
| build | 10 | 17 |
| network | 65 | 94 |
| sleep-poll | 3 | 28 |
| mcp | 0 | 0 |
| **unknown** | **17** | **393** |

The unknown share (393 of 802 min, 49 %) was larger than the largest named
cause, so by step 2.2 this pass is **inconclusive** and no hypothesis verdict is
drawn from it. The unknown calls were read in memory, not published:

- 353 min were four questions put to the human (`AskUserQuestion`), one of them
  open for 328 min. That is a wait on a person, not on the machine, and it got a
  row of its own — `user-wait` (with `ExitPlanMode`, the other tool that
  returns only when the human answers). Folding it into a named cause would
  have hidden the largest single wait in the window inside a cause it is not.
- Two council runs (`council_cli run`), 7 min — calls to outside models, now
  `network`.
- One poll loop whose wait sat in a `do sleep …` body — the classifier now
  reads past `do` / `then` / `else` to the command in the body.

Each new rule is pinned in `tests/scripts/probe_turnaround_causes.test.ts`.

## Second pass — the reading

Same window — the four existing figures came out identical in every pass, so
the corpus did not move between them. The table is the classifier as it ships
in PR #2248, after a review of that PR made shell splitting quote-aware (a `;`
or `|` inside a quoted argument no longer opens a segment); that moved one call
of 1 min from `network` to `unknown` and changed nothing else:

| Cause | Calls | Minutes | Share of blocking minutes |
|---|---:|---:|---:|
| user-wait | 4 | 353 | 44.0 % |
| ci-wait | 40 | 261 | 32.5 % |
| network | 68 | 112 | 14.0 % |
| sleep-poll | 3 | 28 | 3.5 % |
| build | 10 | 17 | 2.1 % |
| test | 6 | 12 | 1.5 % |
| unknown | 9 | 12 | 1.5 % |
| subagent-wait | 5 | 6 | 0.7 % |
| mcp | 0 | 0 | 0.0 % |
| **total** | **145** | **802** | |

The unknown share is now 12 of 802 blocking minutes (1.5 %), far below the
largest named cause, so the reading bounds the claim below. What is left in
`unknown` is short calls with no common shape (a gate-coverage check run four
times, a heredoc script, a branch loop).

**What the classifier cannot see.** A compound command takes the cause of its
first matching segment, so `git commit && git push` puts the whole call's time
— commit hooks included — on `network`. Subshells, `$(…)` and heredoc bodies
are not modelled. Per-cause minutes are therefore an attribution by rule, not a
measurement of where inside a call the time went.

## The hypothesis — refuted

`ci-wait` plus `subagent-wait` hold **267 of 802 blocking minutes, 33.3 %** —
not the majority. The hypothesis the 2026-10-01 reading named is **refuted** for
this window.

Two qualifications, both stated so the verdict is not over-read:

- `ci-wait` alone is still the largest machine-side cause, and the single
  largest cause an agent can act on. What refutes the hypothesis is the
  `subagent-wait` half (6 min) and the size of `user-wait`, not a small CI wait.
- `user-wait` is one dominant call. Without the 328-min question, CI plus
  subagent waits would hold 267 of 474 min (56 %). A window's verdict can turn on
  one human being away from the keyboard; that is why 3.4 reports
  `underpowered` rather than a verdict when the second window's shape differs.

### Where the `ci-wait` minutes went

Read from the waiter's own last line, in memory, over every blocking call whose
command names a CI waiter (44 calls, a slightly wider net than the 40 the
classifier assigns, because a CI waiter inside a command another rule matched
first is counted here too):

| Waiter ended with | Calls | Minutes |
|---|---:|---:|
| `DID NOT SETTLE` (no verdict, re-invoked) | 20 | 184 |
| `SETTLED GREEN` | 16 | 55 |
| `SETTLED RED` | 3 | 20 |
| killed or backgrounded, no verdict line | 4 | 31 |
| `WITHHOLDING A VERDICT` | 1 | 1 |

Most CI minutes were spent in waits that returned no verdict at all: the
9-minute foreground deadline expired while checks were still pending, and the
caller waited again.

## What grew the context floor

`road-to-blocking-time-by-cause` 4.1. The 2026-10-01 reading measured a
first-call context floor maximum of 244,518 tokens against the 230,705
baseline and declined to attribute it. Read from the same store:

| | Max-floor session | Comparator |
|---|---|---|
| Session | `1e95a767` | `0ae74690` |
| First call | 2026-09-29T06:39Z | 2026-10-01T00:48Z |
| Host version | 2.1.277 | 2.1.277 |
| First-call floor | 244,518 | 232,272 |
| Started with | `/analyze:inbox` | `/roadmap:process-full` |

The comparator is the session nearest the baseline that ran the same host
version, so the host's own system prompt and tool schemas are held constant as
far as the store can show. The floor delta is **12,246 tokens**.

Contributors, measured as the characters each one put into the transcript
before the first API call (`chars / 4` is the estimate every other payload
measurement in this repository uses):

| Contributor | Max-floor | Comparator | Delta (chars) | ≈ tokens |
|---|---:|---:|---:|---:|
| Invoked command body (the slash command's own text) | 65,681 | 30,205 | +35,476 | +8,869 |
| Instructions (always-loaded rule and memory text) | 414,754 | 414,892 | −138 | −35 |
| Session context | 1,079 | 1,003 | +76 | +19 |
| Hook additional context | 2,521 | 2,576 | −55 | −14 |
| Skill listing | 42,131 | 42,131 | 0 | 0 |
| Deferred-tools, agent-listing and MCP-instruction deltas | 12,250 | 12,250 | 0 | 0 |
| Prompt snapshot | 10,178 | 10,178 | 0 | 0 |
| Everything else (environment, model, output style, date, permissions, hook success, command header) | 7,449 | 7,449 | 0 | 0 |

**Attribution.** About 8,870 of the 12,246 tokens — 72 % — are the body of
the slash command the session was started with: `/analyze:inbox` is 35,476
characters longer than `/roadmap:process-full`. The always-loaded instructions
are flat (−138 characters), and so is every attachment the host injects. The
floor maximum is therefore set by **which command opened the session**, not by
growth in the context every session pays.

**Unattributed: about 3,400 tokens** (12,246 less the +8,839 net of the rows
above). The host's system prompt and tool
definitions are not written to the transcript, so the store cannot show them.
The same host version on both sides makes a change there unlikely; it does not
rule one out, and this page does not claim it.

`src/config/turnaround-budget.json` is not edited: `git diff --exit-code
a75bb3210 -- src/config/turnaround-budget.json` exits 0.

## Second window

`road-to-blocking-time-by-cause` step 3.4. The window the targets in
`docs/CLAIMS.md` claim `turnaround-blocking-by-cause-targets` were
pre-registered against, read after the 3.3 mitigation merged in #2248 on
2026-10-07. The targets were committed before that merge; this reading is the
first one taken against them.

### Window shape

| | |
|---|---|
| Window | the 10 most recently modified sessions in the store, excluding the measuring session |
| Read | 2026-10-12, ~12:50Z |
| Oldest / newest mtime | 2026-10-11T09:32Z / 2026-10-12T14:51Z |
| Sessions accrued after the 3.3 merge | 18 at the store root, so the 10 newest all post-date it |
| User requests | 153 |
| API calls | 2,956 (19.32 per request) |
| Tool calls | 3,271 in 2,806 tool-using requests (batch 1.17) |
| Tool time | 511 min |
| Blocking calls (>60 s) | 119, holding 320 min (share 0.626) |
| First-call context floor | 211,620–242,742 tokens |

The newest file is a session that was still running while this was read, so its
mtime moves; the window is a snapshot at the time above and not a reproducible
selection. This window is also not the same KIND of work as the first: it is
dominated by SVG-engine and release sessions, where the first window was
dominated by parallel drain runs. Claim (6) names that: a delta between two
windows can be a corpus change.

### Blocking tail by cause

| Cause | Calls | Minutes |
|---|---:|---:|
| `ci-wait` | 2 | 5 |
| `subagent-wait` | 1 | 1 |
| `test` | 22 | 120 |
| `build` | 6 | 29 |
| `network` | 41 | 82 |
| `sleep-poll` | 3 | 11 |
| `mcp` | 0 | 0 |
| `user-wait` | 0 | 0 |
| `unknown` | 44 | 71 |

### The classifier was widened before this reading, and not toward the targets

A first pass over this window left **70 of 119 blocking calls and 179 of 320
minutes** `unknown` — more than the largest named cause, which is the condition
step 2.2 names for calling a reading inconclusive and reopening the rule table.
Reading those calls showed three shapes the rules could not see, each one fixed
and pinned by a test in `tests/scripts/probe_turnaround_causes.test.ts`:

| Shape | Example from this window | Now reads as |
|---|---|---|
| An env assignment sharing a segment with its command | `cd <wt> && AGENT_CONFIG_BROWSER_SUITES=1 npx vitest run` | `test` |
| Git's global options before the subcommand | `git -C <wt> push -u origin <branch>` | `network` |
| A provider CLI invoked directly rather than through `council_cli` | `codex exec --skip-git-repo-check …` | `network` |

`NOISE_SEGMENT` anchors an assignment at the end of its segment, so it only ever
saw the `D=/tmp/x;` form and never the prefix form; this package's own
token-efficiency rule tells agents to write `git -C <path> …`, so that shape is
common here and was invisible to a rule anchored on `git push`.

**None of the three touches `ci-wait` or `user-wait`** — they move minutes into
`test` and `network` only. So the two target causes are measured by exactly the
rules the targets were pre-registered against, and the widening cannot have
moved a target either way. The four existing figures are unchanged by it: the
test that pins them is green, and the numbers in the shape table above are
byte-identical before and after.

After the widening, `unknown` holds 44 calls and 71 min — below `test` (120 min),
so the reading is conclusive under 2.2's own rule. What is still in it, read in
memory and published as counts only:

| What the unknown calls were | Calls | Minutes |
|---|---:|---:|
| A `python3` script in a session scratchpad (image sweeps) | 28 | 42 |
| A local script or gate run (`tsx src/scripts/…`, a `for` loop over gates) | 4 | 15 |
| A `git` subcommand whose wait is a local hook (`commit`, `add`, `status`) | 6 | 7 |
| The `Read` tool on a large file | 4 | 5 |
| The `Write` tool | 1 | 1 |
| Other shell | 1 | 1 |

No new cause was added for them. The two largest groups are a one-off scratchpad
workload and a local gate run; naming a cause after work that happened to fill
one window is how a closed set grows a row per window, and 2.2's condition for
reopening is no longer met.

### Against the pre-registered targets

Read over every call in the window whose command names a CI waiter — 55 emitted,
54 with a result — and over every structured ask.

| Cause | Target | Baseline | This window | Verdict |
|---|---|---|---|---|
| `ci-wait` | at most 10 waiter calls ending `DID NOT SETTLE` in the foreground | 20 of 44 | **0 of 54** | met |
| `ci-wait` (secondary) | at most 130 blocking minutes | 261 | **5** | met |
| `user-wait` | zero avoidable blocking minutes | 0 avoidable of 4 calls | **0 calls, 0 min** | underpowered |

`user-wait` is underpowered on the floor the claim sets for it: clause (4) asks
for at least 5 structured asks before the cause can be judged, and this window
holds zero. Underpowered is neither a pass nor a miss and is cited for neither.

`ci-wait` is **not** underpowered: clause (4)'s floor is fewer than 20 CI waits
in the window, and this window holds 55. The window also holds fewer total
blocking calls than the first (119 against 145), which clause (4) explicitly
says is not an underpowering ground on its own.

### How the `ci-wait` target was met, and what the instrument can no longer see

Of the 54 waiter calls with a result:

| Shape | Calls |
|---|---:|
| Started as a background job, returning at once | 31 |
| Foreground `ci_settle` | 3 |
| Foreground `gh pr checks` / `gh run watch` | 20 |

Not one ended with `DID NOT SETTLE`. Three ended green, two red, and the rest
ended on a checks table or a background-job handle. The mechanism is the one D7
chose: the waiter names the still-pending checks and a background next wait
rather than expiring in the foreground.

**The honest limit, stated because the zero invites over-reading.** A background
waiter does not block by construction, and its verdict never appears in the last
line of the tool result, so this instrument cannot see a background wait that
ended without a verdict. The target as written asks about FOREGROUND calls, and
the zero answers that question correctly. The broader question — how often does
a wait end with no verdict at all — is no longer answerable from the transcript
alone, and a future reading that wants it needs the waiter to write its outcome
somewhere the probe can read. That is recorded here as a measurement gap, not as
a reason to discount the met verdict.

`src/config/turnaround-budget.json` is still not edited by this reading.
