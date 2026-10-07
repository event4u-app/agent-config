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

Same command, same window — the four existing figures came out identical in
both passes, so the corpus did not move between them:

| Cause | Calls | Minutes | Share of blocking minutes |
|---|---:|---:|---:|
| user-wait | 4 | 353 | 44.0 % |
| ci-wait | 40 | 261 | 32.5 % |
| network | 69 | 113 | 14.1 % |
| sleep-poll | 3 | 28 | 3.5 % |
| build | 10 | 17 | 2.1 % |
| test | 6 | 12 | 1.5 % |
| unknown | 8 | 11 | 1.4 % |
| subagent-wait | 5 | 6 | 0.7 % |
| mcp | 0 | 0 | 0.0 % |
| **total** | **145** | **802** | |

The unknown share is now 11 of 802 blocking minutes (1.4 %), below every named
cause above `test`, so the reading bounds the claim below. What is left in
`unknown` is short calls with no common shape (a gate-coverage check run four
times, a heredoc script, a branch loop).

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
