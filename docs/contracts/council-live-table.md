---
stability: beta
keep-beta-until: 2027-02-22
---

# Council live table — live log and human inbox

**Status:** v1 · **Owner:** `src/scripts/ai_council/live_table.ts` ·
**Writers:** `council:run`, `council:debate` · **Readers:** any IDE or app
that draws the table (Agent Switch's council board is the first).

A council used to write nothing until it ended (a debate: until a round
ended). This contract lets a reader draw the table while it runs and lets the
human at the table speak, pause and stop between seats.

## Where

```
<project>/agents/runtime/council/live/<stem>/
  live.jsonl    # written by the council, append-only
  inbox.jsonl   # written by the human side, append-only
```

`<stem>` is the `--output` file's name without `.json` (`council:run`) or the
`--output` folder's name (`council:debate`). The folder appears with the first
seat call — a run that stops at its cost preview leaves nothing. It is pruned
with the other council artifacts (`session_retention_days`).

`AGENT_CONFIG_COUNCIL_LIVE=0` turns both files off; declared `seats:` still
apply.

## `live.jsonl` — one JSON object per line

Every line carries `v: 1`, `type` and `at` (ISO 8601).

| `type` | Fields | When |
|---|---|---|
| `run.started` | `subcommand` (`run`\|`debate`), `ask` (≤ 800 chars), `response` (the output path, project-relative), `seats[]`: `{id, member, model, role, brief, transport, billable}` or, for a seat that cannot sit, `{…, absent: <reason>}`; `pids[]` (the council process and its ancestors, nearest first); `cwd` | first line, written with the first seat call |
| `seat.started` | `seat` (id), `turn` (how often this seat has been asked, from 1) | before the seat's request |
| `seat.finished` | `seat`, `turn`, `ok`, `error`, `headline` (the answer's verdict line, else its first line, ≤ 160), `input_tokens`, `output_tokens`, `latency_ms` | after the answer |
| `seat.skipped` | `seat`, `turn`, `reason` | the table was stopped; nothing was sent |
| `human.said` | `text`, `before` (the seat it was heard before) | a remark from the inbox joined the prompts |
| `human.refused` | `reason`, `before` | a remark failed the council egress check; its text is not logged and is never sent |
| `run.paused` / `run.resumed` | `before` | the human raised a hand / let the table go on |
| `run.stopping` | `before`, `by` (`human`\|`pause-limit`) | the human stopped the table, or a pause outlived 30 minutes |
| `run.finished` | `status` (`completed`\|`stopped`\|`failed`), `response` | the output was written, or the process ended without it |

`turn` counts calls to one seat. In `council:run` it equals the round; in a
debate a stance repair is a further turn of the same seat.

Tie a run to the session that started it through `pids[]` or through
`response`, which the session's own command line names — never by timing.

## `inbox.jsonl` — one JSON object per line

| Message | Effect |
|---|---|
| `{"type":"say","text":"…"}` | From the next seat on, every prompt carries the remark (≤ 2000 chars) in a delimited block; the council egress check runs on it first |
| `{"type":"pause"}` | Before the next seat the table waits, polling twice a second, until `resume` or `stop`; after 30 minutes it stops |
| `{"type":"resume"}` | Ends a pause |
| `{"type":"stop"}` | Every remaining seat answers with an error, nothing more is sent, and the run finishes as `stopped` with what it has |

The council reads the inbox before each seat; seats are called one after
another, so a seat boundary is the earliest point a remark can land. A line
still being written is read on the next look. Unknown or malformed lines are
skipped.

## What this does not do

- No token streaming: a seat's answer appears when it is complete.
- No interruption mid-answer: pause and stop act at the next seat.
- The inbox is a local file: anyone who can write the project folder can
  speak at the table, the same trust as the project itself.
