# The substantive-content threshold — road-to-cost-parity-3 Phase 1

Why `SUBSTANTIVE_TOKEN_FLOOR` in `src/scripts/_cli/handoff_sessions.ts` is
10,000 parsed tokens, and what the measurement says about the predicate it
sits in. Every number below was produced on this machine's own transcript
store; none is carried over from a prior session's claim.

**Measured:** 2026-08-10 · **Host:** Claude Code · **Store:** `~/.claude/projects`
(217 session files). Token unit: **parsed transcript tokens** —
`input_tokens + cache_read + cache_creation` of the last main-chain assistant
record, the same definition `_lib/cc_transcript.ts` uses. No byte proxy.

## The predicate

A candidate is substantive when it has

```
assistant_records >= 1  AND  (tool_calls >= 1  OR  final_context_tokens >= FLOOR)
```

read from the counts-only session-eol state. Absent, unreadable, or
mis-shaped state **lists** the candidate; a `tool_calls` key missing from a
state file written before that counter existed reads as *unknown*, never as
zero.

## What the store says

| Population | Sessions |
|---|---|
| Session files scanned | 217 |
| No assistant record at all — what the gate is for | 10 |
| At least one assistant record | 207 |
| … of those, at least one `tool_use` block | 206 |
| … of those, zero `tool_use` blocks | 1 |

Token distribution over the sessions carrying a tool call: **p10 = 254,939**,
**p50 = 524,374**.

## Three findings, one of which is uncomfortable

1. **The `tool_calls` arm carries the population.** 206 of 207 answered
   sessions satisfy it. The token arm serves the ~0.5 % tail plus any host
   whose transcript records no tool blocks — it is a fail-open widener, not
   the load-bearing half. Stating that here is cheaper than a future reader
   inferring the two arms are comparable in weight.
2. **The real filter is `assistant_records >= 1`.** It is what removes the
   10 empty sessions, which is the defect the phase exists to repair. The
   OR-pair refines; it does not do the work.
3. **10,000 is chosen to be un-hideable, not to be discriminating.** It sits
   25x below the p10 of real working sessions (254,939), so no session that
   did real work can fall under it, while a single trivial exchange does.
   The asymmetry is deliberate: a wrongly listed candidate is noise the user
   scrolls past, a wrongly hidden one is data loss they cannot see.

## Reproduce

The scan is a fold over each `~/.claude/projects/*/*.jsonl`, main chain only
(`isSidechain !== true`):

- `assistants` — records with `type === 'assistant'` carrying `message.usage.input_tokens`
- `toolCalls` — records with `type === 'assistant'` whose `message.content[]`
  holds a block of `type === 'tool_use'`
- `finalTokens` — the billable-input sum of the LAST such assistant record

`src/scripts/session_eol_report.ts` produces the assistant/turn/token columns
of this table directly; the `tool_use` column is the counter this phase added
to `_lib/session_eol.ts` (`EolCounters.tool_calls`), so a re-run after any
session writes state reproduces it from the state files themselves.

## Known limitation

The store is single-machine and single-host: 217 Claude Code sessions, zero
Codex sessions. The `tool_calls` counter is fed by the Claude transcript
shape; a host that records tool invocations differently reports zero and
falls through to the token arm, which is why that arm exists and why it fails
open. Revisit if a second host's store becomes available.
