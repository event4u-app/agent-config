---
name: implement-ticket
skills: [refine-ticket, feature-planning]
description: Drive a ticket end-to-end through refine → memory → analyze → plan → implement → test → verify → report — Option-A loop over the `work_engine` Python engine, block-on-ambiguity, no auto-git.
disable-model-invocation: true
---

# implement-ticket

## Instructions

### 1. Resolve input

Accept one of four input paths:

1. **Explicit key** — `/implement-ticket PROJ-123`
2. **Branch detection** — no arg → `git branch --show-current` + regex
   `[A-Z]+-[0-9]+`
3. **Pasted text** — markdown block under the command
4. **URL** — `/implement-ticket https://…/browse/PROJ-123`

For paths 1, 2, 4: run steps 1-3 of the [`jira-ticket`](jira-ticket.md) command
(extract ID, fetch ticket, scan for Sentry links). For path 3: parse the pasted
markdown. If no input resolves:

```
🎫 Which ticket should I implement? Paste a key, URL, or the ticket text.
```

### 2. Prepare the state file

The engine persists everything in a JSON state file (default:
`.work-state.json` in the repo root). The resolved ticket lives inside
the work-state envelope as `input.kind="ticket"`, `input.data={id,
title, body, acceptance_criteria}` — the engine builds that wrapping
internally when given `--ticket-file`, so callers pass the ticket JSON
unchanged.

Three cases, in this order:

- **Legacy state file present** — `.implement-ticket-state.json` exists
  and `.work-state.json` does not. Migrate before doing anything else:

  ```bash
  ./agent-config migrate-state
  ```

  Writes `.work-state.json` and renames the source to
  `.implement-ticket-state.json.bak`. Idempotent and safe to skip if
  already done. After this, treat the run as **Resume**.
- **Fresh run** — no state file at all. Write the resolved ticket to
  `ticket.json` (id, title, body, acceptance_criteria) and pass it via
  `--ticket-file ticket.json`. Honour `roles.active_role` from
  `.agent-settings.yml` via `--persona`.
- **Resume** — `.work-state.json` exists. Do **not** pass `--ticket-file`
  or `--persona`; mid-flight persona switches are refused by the engine.

### 3. Drive the Option-A dispatch loop

Run the engine with the state file on every iteration:

```bash
./agent-config implement-ticket \
    --state-file .work-state.json \
    [--ticket-file ticket.json --persona <name>]   # first call only
```

The dispatcher wires `PYTHONPATH` and routes to the engine module
internally. `./agent-config` is the only supported entry point in
consumer repos — do not call the engine module directly.

Then branch on the exit code:

| Exit | Meaning | Action |
|---|---|---|
| `0` | SUCCESS — final report on stdout | Go to step 5 |
| `1` | BLOCKED — halt surface on stdout, state persisted | Inspect `questions[0]` |
| `2` | Config/IO error | Surface the stderr message to the user, stop |

On exit `1`, look at the first line after `[halt] outcome=… step=…`:

- **Starts with `@agent-directive:`** — agent work required, see §4.
- **Starts with `>`** — user question per
  [`user-interaction`](../rules/user-interaction.md). Emit the numbered
  options verbatim, wait for the user, write their answer back onto the
  matching state slice, then re-run the engine. Never guess.

### 4. Directive mapping

When `questions[0]` is `@agent-directive: <verb> [key=value …]`, dispatch:

| Directive | What to do | State write-back |
|---|---|---|
| `create-plan` | Invoke [`/feature-plan`](feature-plan.md) with the refined ticket + memory hits | `state.plan` = result; `state.outcomes.plan = "success"` |
| `apply-plan` | Apply changes per `state.plan` under [`minimal-safe-diff`](../rules/minimal-safe-diff.md) + [`scope-control`](../rules/scope-control.md); one file at a time, read before edit | `state.changes` = `[{path, purpose}]`; `state.outcomes.implement = "success"` |
| `run-tests scope=targeted` | Invoke [`/tests-execute`](tests-execute.md) on the files in `state.changes` | `state.tests` = `{verdict, durations, details}`; `state.outcomes.test = "success"` only when `verdict == "success"` |
| `run-tests scope=full` | Same but whole suite (persona `qa` widens to this) | Same as above |
| `review-changes` | Invoke [`/review-changes`](review-changes.md) | `state.verify` = `{verdict, confidence, notes}`; `state.outcomes.verify = "success"` only when `verdict == "success"` |

After the write-back, **re-run the engine**. The dispatcher skips
already-successful steps and resumes at the next pending one. On a
non-success verdict, do **not** flip `outcomes` — the engine will reissue
the same directive so the agent can fix and retry.

Never invent directive verbs. Never skip a directive because "the state
already looks right". The state is authoritative only when the engine
wrote it.

### 5. Final report + close-prompt

On exit `0`, the engine prints the delivery report (nine fixed sections).
Surface it unchanged. Append the close-prompt:

```
> 1. /commit — stage + commit per the delivery report
> 2. /create-pr — open a pull request from this branch
> 3. Keep working — I'll hold the state file for the next /implement-ticket
> 4. Discard — delete .work-state.json (and any .implement-ticket-state.json.bak)
```

**Never run `/commit` or `/create-pr` without the user choosing them.**
Per [`scope-control`](../rules/scope-control.md), git operations are
permission-gated.

### Rules

- Honour [`scope-control`](../rules/scope-control.md),
  [`minimal-safe-diff`](../rules/minimal-safe-diff.md), and
  [`verify-before-complete`](../rules/verify-before-complete.md) inside
  every directive.
- Never bypass the engine. Don't skip steps, don't rewrite outcomes,
  don't flip `verdict` from `failed` to `success`.
- Persona is session-global. Read it from `.agent-settings.yml` on the
  fresh run; never accept a `--persona` flag from the user mid-flight.
- Memory section in the report is absent when no hit changed an outcome.
  That is by design — don't pad it.
- When `telemetry.artifact_engagement.enabled: true` in
  `.agent-settings.yml`, emit one `./agent-config telemetry:record` per
  boundary (per phase-step or per task — see `granularity`) with the
  consulted+applied artefact ids. Full contract in
  [`artifact-engagement-recording`](../rules/artifact-engagement-recording.md).
  Default-off; absent setting is a silent no-op.

## Examples

```
/implement-ticket PROJ-123
/implement-ticket                               # uses current branch
/implement-ticket https://acme.atlassian.net/browse/PROJ-123
```

## See also

- [`refine-ticket`](refine-ticket.md), [`feature-plan`](feature-plan.md), [`tests-execute`](tests-execute.md), [`review-changes`](review-changes.md) — skills the directives delegate to
- [`commit`](commit.md), [`create-pr`](create-pr.md) — post-delivery commands the user runs explicitly
