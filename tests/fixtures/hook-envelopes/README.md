# Observed hook envelopes

Raw, host-captured tool-event envelopes, pinned so a parser is tested against a
shape a host actually sent rather than one this repository invented.

Distinct from [`../hooks/`](../hooks/README.md), which holds **one minimal,
representative payload per event** in the agent-config vocabulary for dispatcher
replay. These files hold **one observed envelope per interesting host shape**,
and there may be several for a single event.

## Invariants

1. Valid JSON, object at the top level.
2. Keys and value SHAPES are the host's, verbatim. Values that would carry a
   real identity — absolute home-rooted paths, session ids, tool-use ids — are
   replaced with placeholders. Nothing else is edited: an edited shape is not an
   observation.
3. Every file names, in the table below, the host, the host version, the date,
   and the evidence file that records how it was captured.

## Corpus

| File | Host | Version | Captured | Evidence |
|---|---|---|---|---|
| `claude-bash-failure.json` | claude | 2.1.286 | 2026-10-01 | [`failed-tool-call-event-2026-10-01.md`](../../../agents/evidence/analysis/failed-tool-call-event-2026-10-01.md) |

`claude-bash-failure.json` is the envelope a **failing** `Bash` call produces on
Claude Code: event `PostToolUseFailure`, no `tool_response`, the exit status in a
top-level `error` string whose first line reads `Exit code N`, and the interrupt
flag spelled `is_interrupt`. The success form — `PostToolUse` with a
`tool_response` object — is the one already covered by `../hooks/post_tool_use.json`
and by the fixture tests around `before_complete_hook`.
