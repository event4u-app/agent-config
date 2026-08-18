# Subagent lifecycle — Phase 0 Step 3: #58109 reproduced, and two findings it dragged out

> Evidence for Phase 0 Step 3 of
> [`road-to-subagent-lifecycle-integrity`](../../roadmaps/road-to-subagent-lifecycle-integrity.md),
> plus a method correction that changes what Steps 2 and 4 cost.
> Measured 2026-08-13 on host **2.1.229** (the version pinned in
> [`subagent-lifecycle-phase0-host-pin.md`](subagent-lifecycle-phase0-host-pin.md)),
> against `origin/main` @ `af9b8d7ff`. Every number below carries the command
> that produced it.

## F1 — #58109 reproduces on this host, with a matched control

Step 3 asks for a reproduce-or-refute: "a subagent instructed to end on a
`tool_use` block, then asked for a structured report. Record whether the parent
receives the report."

Two subagents, dispatched in the same turn, same `subagent_type` (`Explore`),
same task (count the files in `src/rules/`), same requested output — a
`REPORT-BEGIN` / `REPORT-END` block. The **only** difference is the shape
instruction for the final step.

| Arm | Instructed final step | What the parent received |
|---|---|---|
| **Control** | end on assistant text carrying the report | the full report — `rule_files: 116`, `first_file: active-remediation.md` |
| **Treatment** | emit the report as text, then make ONE final tool call (`echo done`) and stop | **`(no output)`** |

The treatment arm was not idle and did not fail: the host's own completion
notification recorded **3 tool uses and 18,242 tokens** for it, against the
control's 1 tool use and 17,737 tokens. It did the work, it emitted the report,
and the parent received an empty result.

**Verdict: REPRODUCED.** A subagent whose last block is a `tool_use` delivers
nothing to its parent on 2.1.229, regardless of what it produced beforehand.
This is symptom (2) of the operator's report — *finished, but not returned* —
and it is now a same-host, controlled observation rather than an upstream issue
number.

> **Numbering correction, 2026-08-18.** *finished, but not returned* is symptom
> **(3)**, not (2); (2) is *endless subagent runs*. The roadmap's own header and
> its symptom → defect map both number it that way. The observation above is
> unaffected — only the label was wrong — and the original sentence stays so the
> mistake remains auditable.

The reproduction is a **lower bound on the cost**, not the cost: the work was
paid for in full and discarded in full. Any dispatch shape that can end on a
tool call carries this risk, which is exactly why Phase 2 Step 1's contract
addendum ("the final message is a single text-only envelope — never end on a
tool call") is the right shape. This measurement is the evidence that clause was
missing.

## F2 — the Phase-1 ledger cannot see the failure it exists to detect

Both arms above were also observed by the `subagent-ledger` concern shipped in
Phase 1 Step 2. Their records are identical on the field that matters:

```
$ grep '"event":"subagent_stop"' agents/runtime/state/subagent-ledger/2026-08.jsonl
… "ref":"37d6a5b3e90a" … "duration_ms":13949 … "envelope_parse":"absent" …   ← control
… "ref":"09fd5bc102df" … "duration_ms":18692 … "envelope_parse":"absent" …   ← treatment
```

The durations pin the identity: 13,949 ms / 18,692 ms against the host's
reported 14,067 ms / 18,799 ms for control and treatment respectively.

The control **returned a complete report**. The treatment **returned nothing at
all**. The ledger recorded the same verdict for both, because
`classifyEnvelope` (`src/scripts/hooks/subagent_ledger_hook.ts:216-232`) returns
`absent` for two distinct states:

- line 217 — the message is `null` or blank: *nothing came back*;
- line 220 — the message exists but holds no JSON-object candidate: *prose came
  back, and prose is what almost every subagent returns*.

Over the whole current window that verdict is unanimous:

```
$ grep -o '"envelope_parse":"[a-z_]*"' agents/runtime/state/subagent-ledger/2026-08.jsonl | sort | uniq -c
  25 "envelope_parse":"absent"
```

25 of 25. A rate computed from this column would read as a 0 % envelope-return
rate and would be measuring the fact that subagents answer in prose, not the
fact that some answers are lost.

**Consequence, and it lands on two open steps.** Phase 1 Step 4 publishes "the
envelope return rate" as the instrument that replaces the 0.27 % model-carried
capture — computed from this column, that number is not the quantity its name
claims. Phase 2 Step 2 keys its disk-fallback on exactly this distinction
("parse `last_assistant_message` with `validateResponse`; **on failure**, look
for the Step-1 disk envelope") — as written it would fall back on every prose
return, which is nearly all of them.

The repair is a three-way split (`no_message` / `no_envelope` / `ok`) rather
than today's two-way collapse. It is deliberately **not** made in this PR: it
changes a recorded data shape and the 16 assertions in
`tests/hooks/subagent_ledger.test.ts`, which is past the bounded-remediation
bar, and it belongs to Phase 2 whose re-scope this evidence triggers. It is
recorded against Phase 2 Step 2 in the roadmap.

## F3 — the raw-payload capture Steps 2 and 4 need is already shipped

Step 2 specifies "one throwaway `SubagentStop` command hook in a scratch
project; capture the raw stdin JSON", and Step 4 the same shape for
`PreToolUse` / `PostToolUse` inside a subagent. That scaffolding does not need
to be written. The dispatcher already does it:

- `_maybe_capture_payload` — `src/scripts/hooks/dispatch_hook.ts:486` — writes
  the raw stdin payload to `$AGENT_HOOK_CAPTURE_DIR` when that variable is set,
  fail-silent on any IO or JSON error.
- It is called **unconditionally** at `:1082`, immediately after stdin is read
  and *before* concern resolution — so it captures every event on every
  platform, including events no concern is bound to.
- It is present in the built bundle the host actually runs
  (`grep -c AGENT_HOOK_CAPTURE_DIR dist/hooks/dispatch.js` → 1).

Verified by invoking the shipped dispatcher directly:

```
$ printf '%s' '{"hook_event_name":"SubagentStop","agent_id":"probe-abc","session_id":"probe"}' \
  | AGENT_HOOK_CAPTURE_DIR=<scratch> npx tsx src/scripts/hooks/dispatch_hook.ts \
      --platform claude --event subagent_stop --native-event SubagentStop \
      --project-dir . --dry-run
{ "platform": "claude", "event": "subagent_stop", "role": "orchestrator", "concerns": ["subagent-ledger"] }

$ cat <scratch>/claude__SubagentStop__1786646889790__21759.json
{
  "captured_at": "2026-08-13T18:48:09Z",
  "platform": "claude",
  "event": "subagent_stop",
  "native_event": "SubagentStop",
  "raw_payload": { "hook_event_name": "SubagentStop", "agent_id": "probe-abc", "session_id": "probe" }
}
```

So Steps 2 and 4 reduce to: set `AGENT_HOOK_CAPTURE_DIR` in the host
environment, start a fresh session, dispatch one subagent, read the files. The
residual act is a host-environment change, which is why the step stays open —
see the blocker in the roadmap for the exact wording.

**Why this session did not simply do it.** The variable must be present in the
process environment the *host* spawns hooks from; a shell command issued from
inside a session cannot reach it. Placing it there means editing the user-global
`~/.claude/settings.json` `env` block — a change to the agent's own tool
configuration, affecting the two other sessions live on this repository, and
requiring a fresh session before it takes effect. `security-sensitive-stop`
§ self-modification routes that through the edit-permission gates rather than
letting a session apply it to itself.

## F4 — `agent_type` does not arrive on `SubagentStop`

```
$ grep '"event":"subagent_stop"' …/2026-08.jsonl | grep -c '"agent_type":null'
18
$ grep -c '"event":"subagent_stop"' …/2026-08.jsonl
25
$ grep -c '"event":"subagent_start"' …/2026-08.jsonl
7
```

The stop handler reads `rec?.agent_type ?? str(payload, 'agent_type',
'agentType', 'subagent_type', 'subagentType')`
(`subagent_ledger_hook.ts:634`). A record shows a type **only** when its
matching start record supplied one — all 7 correlated stops do, and all 18
uncorrelated stops read `null`, meaning the payload itself carried none under
any of the four accepted spellings.

By contrast `subagent_start` carries it every time (`"agent_type":"Explore"`,
`"general-purpose"`). So the field exists in the host's vocabulary and is not
sent on stop.

This is Step 2's second assertion, and it fails: `agent_type` does **not**
arrive as documented on `SubagentStop`. It does not close Step 2 — the first
assertion (`last_assistant_message`) is still unanswerable from this instrument,
per F2, since `absent` conflates the two states — but it fixes the direction the
step will find, and it is a constraint on Phase 2 Step 2, which keys its
block-once valve per agent and would have no type to log alongside it.

## F5 — stop fires far more often than start, and the reason is not established

7 starts against 25 stops in the same window. 18 stops carry an `agent_id` the
ledger has never seen announced.

**This number is confounded and must not be quoted as a per-dispatch ratio.**
Three sessions were live on this repository during the window and all three
write to the same ledger file; one stop record carries
`"agent_type":"general-purpose"` with a 263-second duration, which this session
did not dispatch. What the window supports is the weaker, still useful claim:
`SubagentStop` fires for agents whose `SubagentStart` this instrument did not
see, so an open-record set keyed on the start event will not close cleanly —
one such record (`2b2d87a9a4d9.json`) sat in
`agents/runtime/state/subagent-ledger/open/` for four minutes before a late stop
closed it.

Separating "the host fires stop more than once per agent" from "other sessions
share the ledger" needs the per-session split the ledger's `OpenRecord` already
carries (`session_id`, `subagent_ledger_hook.ts:592`) but does not write to the
appended line. That is a Phase 1 measurement question, not a Phase 0 one, and it
is recorded against Phase 1 Step 4.

## What this evidence does NOT establish

- **Not** that `last_assistant_message` is absent on `SubagentStop`. F2 is
  precisely the finding that this instrument cannot tell that from a prose
  return. Step 2's first assertion needs the raw capture F3 describes.
- **Not** a dispatch-level stop:start ratio — see F5's confound.
- **Not** anything about `PreToolUse` / `PostToolUse` payloads inside a
  subagent. Step 4 is untouched by this session and stays open.
