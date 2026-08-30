<!-- evidence-type: analysis -->
# Why a one-file change takes a session — measured

> Measured 2026-08-30 over the 10 most recent sessions in this package's
> transcript store (`~/.claude/projects/<mangled-cwd>/*.jsonl`, 2026-08-27 →
> 2026-08-30), excluding the measuring session itself. Instrument: transcript
> parse by `requestId`, so a request is counted once even though the host writes
> `thinking`, `text` and `tool_use` as separate rows — an earlier pass that
> counted rows inflated every per-call figure and is not the basis here.

## Corpus

| | |
|---|---|
| sessions | 10 |
| real user requests | 76 |
| API calls (distinct `requestId`) | 3,241 |
| tool calls | 3,196 (96.2 % `Bash`) |
| file mutations (`Edit`/`Write`) | 55 |
| session wall-clock span | 86.9 h |
| model-generation time | 6.8 h |
| tool-execution time | 14.2 h |

Span minus model minus tool is 65.9 h, i.e. **76 % of elapsed session time is
neither the model nor a tool** — sessions left open between requests. Elapsed
session time is therefore not the metric; the two numbers below are.

## The four findings

### F1 — 42.6 API round-trips per user request, and every one of them is serial

3,241 calls / 76 requests = **42.6 calls per user request**; 3,196 tool calls /
55 mutations = **58 tool calls per file change**.

Across **3,212 tool-using assistant messages the mean batch size is exactly
1.00** — not one message in the corpus carried two tool calls, although the
harness instructs that independent calls go in one block. At a median
model-generation latency of 4.7 s (mean 7.6 s, p90 14.3 s) the serialization
alone costs ≈ 5 min of model time per request before a single tool runs.

This is not a read-loop: **exact-duplicate command re-runs are 0.3 %** (9 of
3,090). The agent is doing 42 genuinely distinct steps, one at a time.

### F2 — 64 % of tool time is 167 blocking calls

| command | n | total | median |
|---|---|---|---|
| `ci_settle` | 45 | **162.9 min** | 217 s |
| `npx vitest` | 77 | 87.2 min | 68 s |
| `cat` (compound/heredoc) | 188 | 72.1 min | 23 s |
| `python3 -` | 424 | 65.0 min | 9 s |
| `git push` | 54 | **60.0 min** | 67 s |
| `git add` | 110 | 30.0 min | 16 s |
| `task preflight` | 10 | 16.0 min | 96 s |

167 calls exceeded 60 s and account for **547 min = 9.1 h of the 14.2 h** of
tool time. Two mechanisms are visible in the tail:

- **`ci_settle` blocks the foreground.** Its own default deadline is 45 min
  (`src/scripts/ci_settle.ts:127`) while the `Bash` tool caps at 600 s, so ten
  of the twelve slowest calls in the corpus are `ci_settle` stopped at
  592–603 s and then re-invoked. 2.7 h of a 14.2 h budget is spent watching CI
  in the foreground.
- **git hooks are on the interactive path.** `pre-push` runs `task consistency`
  (its own header states "~15-40 s"; measured median 67 s, max 890 s) and
  `pre-commit` runs `lint_marketplace` plus the roadmap-dashboard check
  (measured median 16 s over 110 `git add` calls).

### F3 — the delivered always-on payload is 7.4× the governed budget

`check_always_budget` reports **60,252 / 60,254 chars (100.0 %) across 9 rules**
and is the gate the package treats as the always-on ceiling.

What the host actually receives is `~/.claude/rules/`, written by this
package's own installer:

| activation on Claude Code | rules | chars | ≈ tokens |
|---|---|---|---|
| keyword-only triggers | **79** | **340,109** (75.9 %) | 85,027 |
| path triggers nested under `triggers:` | 15 | 77,011 | 19,252 |
| `type: always` | 9 | 29,864 | 7,466 |
| no trigger | 1 | 1,007 | 251 |
| **total** | **104** | **447,991** | **111,997** |

**Zero of the 104 installed rules emit a top-level `paths:` key** — the only
per-file activation surface Claude Code reads. `triggers.keyword` and
`triggers.file_pattern` are nested under a key the host does not parse, so all
104 rules arrive on every request regardless of what the request is about. The
79 keyword-only rules (85k tokens) are a routing surface that does not exist on
this host.

**Independent cross-check.** `src/config/preamble-payload-budget.json` records a
gated baseline of **102,520 tokens** and explicitly *excludes* the user-scope
bucket as "machine-dependent, not CI-checkable". 102,520 + 111,997 = **214,517**,
against a measured first-call context floor of **218,705–230,705 tokens** in all
ten sessions. Two instruments built for different purposes agree to within 3 %,
which is what makes the floor a fact rather than an estimate.

### F4 — context size is NOT the per-call latency driver, and saying so matters

| context | n | median latency |
|---|---|---|
| 200–300k | 559 | 4.3 s |
| 400–500k | 791 | 4.8 s |
| 600–700k | 268 | 4.8 s |
| 900–1000k | 82 | 5.9 s |

Median latency rises 37 % across a 4× context increase. So the 220k floor is
**not** what makes a turn slow — it is what makes a turn *expensive*, and what
pushes sessions toward the 994,216-token maximum observed and the compaction
that follows. Any proposal that sells preamble reduction as a latency fix is
selling the wrong benefit; F1 and F2 are the latency, F3 is the cost.

## What this rules out

- **Read-loops / flailing** — 0.3 % duplicate re-runs.
- **Subagent overspawn** — 38 `Agent` calls in 3,196, 0.06 h of tool time.
- **Thinking cost** — thinking blocks are ~2.6 M chars of 4.9 M output tokens
  total; they are not the tail.
- **Context length as latency** — F4.
