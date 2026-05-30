---
recommended_model: inherit
name: council:debate
tier: 2
cluster: council
sub: debate
skills: [ai-council]
description: Multi-round council debate with progressive cost disclosure — each member produces a position, then rebuts the strongest opposing position in subsequent rounds. User confirms spend between rounds.
suggestion:
  eligible: true
  trigger_description: "council debate on X, multi-round rebuttal, escalate council to debate mode, push the council to argue not synthesize"
  trigger_context: "user wants real pushback — initial positions plus explicit rebuttals across rounds, with progressive cost confirmation between rounds"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /council debate

## Instructions

Specialised council mode for **multi-round debates**. Each enabled member
produces an initial position in Round 1, then rebuts the strongest
opposing position in subsequent rounds. The orchestrator pauses between
rounds and asks the user to continue (progressive cost disclosure). Hard
cap: `ai_council.cost_budget.max_total_usd` aborts the next round if
the projection breaches the cap, persisting the partial debate.

This is **not a flag** on `/council default` — debate mode changes the
orchestration shape (N members × R rounds = N×R calls) and the cost UX,
so it earns its own sub-command per the R4 verdict.

### 1. Resolve the topic

The user invoked `/council debate "<topic>"` or `/council debate <path-to-artefact>`.
Treat the argument as the **topic** of the debate (a question, a
proposal, an architectural call). If missing, ask (one question per
turn, per `ask-when-uncertain`):

> What is the topic of the debate?
>
> 1. Inline topic (e.g. "Should we adopt event sourcing for the orders module?")
> 2. Path to a file containing the topic / artefact
> 3. Cancel

Capture the resolved topic as `original_ask` verbatim. Do **not** add
the agent's framing.

### 2. Decide round count + auto-continue

Default: 2 rounds (initial position + one rebuttal). Cap: the value of
`defaults.debate_max_rounds` in [`agents/settings/.ai-council.yml`](../../../agents/settings/.ai-council.yml)
(default 4). `--rounds N` overrides the default; values above the cap
are rejected by the CLI.

Auto-continue is **off by default** — the user explicitly opts in via
`--auto-continue` when they want to skip the y/N gate between rounds.
The hard cost cap still applies regardless.

### 3. Estimate (always)

Run `council:estimate` first using `--prompt-mode=debate` (the CLI sets
this automatically when invoked via `debate`). The estimate covers
**one round**. Multiply by the planned round count for the worst-case
projection. Surface the projection to the user with a clear note that
progressive disclosure may stop the debate early.

### 4. Cost confirmation (ALWAYS ASK)

Per [`ai-council` skill § cost gate](../../skills/ai-council/SKILL.md),
always surface the projected total spend and ask for explicit consent
before invoking. Numbered options:

> The debate is projected to cost **$X.XXXX** ($Y.YYYY × N rounds, worst case).
>
> 1. Run all N rounds (auto-continue, no between-round prompt)
> 2. Run round-by-round (confirm before each next round) — recommended
> 3. Cancel

The default recommendation is option 2 (progressive disclosure). Map
option 1 to `--auto-continue`, option 2 to interactive mode, option 3
to abort.

### 5. Invoke the CLI

```bash
python3 scripts/council_cli.py debate <topic-path> \
  --output agents/runtime/council/sessions/<date>-<slug>/ \
  --confirm \
  --rounds <N> \
  [--auto-continue] \
  [--continue-as-debate <prior-session.json>] \
  --original-ask "<verbatim topic>"
```

Session directory shape: `agents/runtime/council/sessions/<YYYY-MM-DD>-debate-<slug>/`
with `debate-round-1.json`, `debate-round-2.json`, … written incrementally.
An interrupted debate leaves every completed round on disk.

### 6. Continuation pivot (optional)

If the user has a prior `/council default` session and wants more
pushback, they can pivot via `--continue-as-debate <session.json>`. The
orchestrator seeds Round 1 from the existing responses (no calls billed
for Round 1) and starts the rebuttal loop at Round 2. **Members + models
must match** the source session — a mismatch is a hard error.

### 7. Render the final synthesis

After all rounds complete, render the last round's JSON via
`/council` render flow:

```bash
python3 scripts/council_cli.py render agents/runtime/council/sessions/<dir>/debate-round-<N>.json
```

The debate mode uses the structured decision-lens template (Karpathy
synthesis) by default. `--prose-synthesis` switches to open-ended prose.

### 8. Hard floor — text only

`/council debate` produces text artefacts (round JSONs + synthesis
markdown). It does NOT edit files, commit, push, or open PRs. The
session directory is the canonical audit trail.

## Cap exceeded

If `DebateCapExceeded` fires, the CLI exits with code 3 and the partial
debate is persisted. Surface the partial-debate path to the user and
ask whether to (a) raise the cap in `agents/settings/.ai-council.yml` and rerun,
(b) stop here and render the partial result, or (c) start a new debate
with a smaller scope.
