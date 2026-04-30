---
name: work
skills: [refine-prompt, command-routing]
description: Drive a free-form prompt end-to-end through refine → score → plan → implement → test → verify → report — Option-A loop over the `work_engine` Python engine, confidence-band gated, no auto-git.
disable-model-invocation: true
---

# work

## Instructions

### 1. Resolve the prompt

`/work` accepts the user's request as a free-form prompt. Resolve the
input in this order:

1. **Inline argument** — `/work <prompt>` (everything after the verb is
   the prompt; quoting is not required).
2. **Pasted block** — markdown block under the command in the same turn.
3. **No input** — ask once, with numbered options:

   ```
   > 1. I'll type the prompt now — paste it on the next line
   > 2. Load from a file — give me a path
   > 3. Abort — never mind
   ```

   On `1`, wait for the user. On `2`, ask for the path and read it. On
   `3`, stop.

Strip leading/trailing whitespace at the boundary, but preserve casing
and internal spacing — the scorer reads the original text when grading
goal clarity.

### 2. Prepare the state file

The engine persists everything in `.work-state.json` (same envelope as
`/implement-ticket`, different `input.kind`). Two cases, in this order:

- **Resume** — `.work-state.json` exists with `input.kind="prompt"`. Do
  not pass `--prompt-file` or `--persona`; mid-flight switches are
  refused by the engine.
- **Fresh run** — no state file. Write the resolved prompt to
  `prompt.txt` (raw text, single file, UTF-8) and pass it via
  `--prompt-file prompt.txt`. Honour `roles.active_role` from
  `.agent-settings.yml` via `--persona`.

If a `.work-state.json` exists but carries a ticket envelope
(`input.kind="ticket"`), that's an `/implement-ticket` flow in
progress. Stop and ask:

```
> A ticket-flow state file is already in `.work-state.json`. Pick one:
> 1. Resume the ticket flow — re-run /implement-ticket
> 2. Discard it — delete the state file and start /work fresh
> 3. Abort
```

### 3. Drive the Option-A dispatch loop

Run the engine with the state file on every iteration:

```bash
./agent-config work \
    --state-file .work-state.json \
    [--prompt-file prompt.txt --persona <name>]   # first call only
```

The dispatcher wires `PYTHONPATH` and routes to the engine module
internally. `./agent-config` is the only supported entry point in
consumer repos — do not call the engine module directly.

Branch on the exit code:

| Exit | Meaning | Action |
|---|---|---|
| `0` | SUCCESS — final report on stdout | Go to step 5 |
| `1` | BLOCKED — halt surface on stdout, state persisted | Inspect `questions[0]` |
| `2` | Config/IO error | Surface the stderr message to the user, stop |

On exit `1`, look at the first line after `[halt] outcome=… step=…`:

- **Starts with `@agent-directive: refine-prompt`** — invoke the
  [`refine-prompt`](../skills/refine-prompt/SKILL.md) skill against
  `state.input.data.raw`, write the resulting `reconstructed_ac` and
  `assumptions` arrays back onto `state.input.data`, then re-run.
- **Starts with `@agent-directive:` (other verbs)** — see §4.
- **Starts with `>`** — user question per
  [`user-interaction`](../rules/user-interaction.md). Emit verbatim,
  wait for the user, write their answer back onto `state.input.data`
  (or the matching slice), then re-run. Never guess.

### 4. Confidence-band semantics

The engine's `refine` step scores the reconstructed envelope and routes
on the resulting band. Never attempt to flip the band yourself — the
engine owns the verdict.

| Band | Outcome | What the agent does |
|---|---|---|
| `high` | SUCCESS | Engine proceeds silently; the breakdown lands on `state.input.data.confidence` and is included in the delivery report |
| `medium` | PARTIAL halt | Engine emits the assumptions report; surface verbatim, wait for the user. On confirm, write `state.input.data.confidence_confirmed=true` and re-run. On refine, replace `state.input.data.raw` with the new prompt, clear `reconstructed_ac` + `assumptions`, and re-run |
| `low` | BLOCKED halt | Engine emits exactly one clarifying question on the weakest dimension (per [`ask-when-uncertain`](../rules/ask-when-uncertain.md) Iron Law). Surface verbatim, wait for the user, append their answer to `state.input.data.raw`, clear `reconstructed_ac` + `assumptions`, and re-run |

Once the gate releases, the rest of the loop is identical to
`/implement-ticket`: `create-plan`, `apply-plan`, `run-tests`,
`review-changes` directives flow through the same dispatch table.

### 5. Final report + close-prompt

On exit `0`, the engine prints the delivery report. Surface it
unchanged, then append:

```
> 1. /commit — stage + commit per the delivery report
> 2. /create-pr — open a pull request from this branch
> 3. Keep working — I'll hold the state file for the next /work
> 4. Discard — delete .work-state.json
```

Per [`scope-control`](../rules/scope-control.md), git operations are
permission-gated. Never run `/commit` or `/create-pr` without the user
choosing them.

### Rules

- Honour [`scope-control`](../rules/scope-control.md),
  [`minimal-safe-diff`](../rules/minimal-safe-diff.md), and
  [`verify-before-complete`](../rules/verify-before-complete.md) inside
  every directive.
- Never bypass the engine. Don't skip steps, don't rewrite outcomes,
  don't flip `confidence_confirmed` without the user's explicit OK.
- The low-band halt emits **one** question. If you find yourself
  surfacing two, you reformatted the engine output — stop and surface
  it verbatim.
- Persona is session-global. Read it from `.agent-settings.yml` on the
  fresh run; never accept a `--persona` flag from the user mid-flight.
- When `telemetry.artifact_engagement.enabled: true` in
  `.agent-settings.yml`, emit one `./agent-config telemetry:record` per
  boundary (per phase-step or per task — see `granularity`) with the
  consulted+applied artefact ids. Full contract in
  [`artifact-engagement-recording`](../rules/artifact-engagement-recording.md).
  Default-off; absent setting is a silent no-op.

## Examples

```
/work fix the failing login test under tests/feature/auth
/work                                # asks for the prompt
/work add a CSV export endpoint to the audit-log controller
```

## See also

- [`refine-prompt`](../skills/refine-prompt/SKILL.md) — fills `reconstructed_ac` + `assumptions` on the rebound from the first-pass halt
- [`implement-ticket`](implement-ticket.md) — sibling command for ticket-shaped input; same engine, different envelope
- [`commit`](commit.md), [`create-pr`](create-pr.md) — post-delivery commands the user runs explicitly
