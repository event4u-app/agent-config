---
model_tier: inherit
name: explain-run
pack: meta
tier: 2
visibility: internal
description: "Read-only 'why did that happen' run report — resolved rule set, rules fired, artefact engagement, subagent dispatches, hook/loop/freshness state — even when the user just says 'explain the last run'."
argument-hint: "[--task <id>] [--since <ref>]"
skills: [agent-docs-writing]
suggestion:
  eligible: false
  rationale: "Package-internal maintainer diagnostic — only the event4u/agent-config repo runs this."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# explain-run

Thin runner for the read-only explainability engine `explain_run`
(`src/scripts/explain_run.ts`). Renders one Markdown
report answering **"why did the agent do that this run?"** entirely from
artefacts other parts of the suite already write — no new state, no capture,
no daemon.

The report covers: the resolved rule set (kernel vs trigger-routed, from
`dist/router.json`), rules the audit log actually observed firing, artefact
engagement (consulted vs applied), subagent dispatches (mode / tiers / token
deltas), a hook / loop / freshness state snapshot, and a parked list of
"why" questions this v0 cannot answer yet (surfaced, never silently omitted).

## Instructions

### 1. Resolve the window

Both arguments are optional and narrow the report:

- `--task <id>` — restrict to one task id seen in the audit log.
- `--since <ref>` — an ISO-8601 timestamp / date cutoff (e.g. `2026-07-01`).

With neither, the engine reports over all available artefacts. Pass through
exactly what the user gave — do not invent a task id or a date.

### 1b. Optionally explain ONE dispatch decision

`--decision "<task text>"` adds a section that walks the judgment ladder for
that text: the rung taken, every rung genuinely evaluated-and-rejected with its
detector's own reason, and the rungs the resolver never reached (`not-reached` —
never a fabricated rejection). Absent `--decision`, the section is omitted and
the rest of the report is unchanged.

The remaining flags are the ladder's input signals — pass only what the user
states, since each one changes the resolution:

- `--size-estimate <int>` · `--slices <int>` — the size signals; a task at or
  below the size floor never delegates.
- `--ordered-plan` — the slices are ordered rather than independent.
- `--agent-teams` — the host reports the `agent_teams` capability (without it a
  communication-shaped task degrades below rung 3).
- `--halted` — `emergency.orchestration_halt` is set.
- `--no-spawn-primitive` — the host has no `subagent_spawn` primitive.
- `--inside-subagent` — the classification runs inside a subagent session
  (recursive-dispatch guard).
- `--approval-required` — a human decision is pending; resolves ∅ before every
  rung.

The token/cost line under that section prints the freshest real dispatch record
in the window and states that it is **not** matched to this decision — the
record shape carries no decision key, so correspondence is never claimed.

### 2. Run the engine

```bash
./scripts-run src/scripts/explain_run [--task <id>] [--since <ISO-8601>] \
  [--decision "<task text>"] [--size-estimate <int>] [--slices <int>] \
  [--ordered-plan] [--agent-teams] [--halted] [--no-spawn-primitive] \
  [--inside-subagent] [--approval-required]
```

Exit codes:

- `0` → report rendered to stdout; continue to step 3.
- `2` → bad argument (unknown flag or unparsable `--since`); surface stderr
  and stop.

The engine prints an honest `no data — <source> absent or empty` for any
section whose source file is missing — that is expected output, not an error.

### 3. Surface the report

Show the engine's Markdown output. Do not re-summarize or re-order it — the
report already opens with a plain-language `## Summary`. If the user wants the
report written to a file, add `--output <path>` and confirm the write.

## Rules

- **Read-only** — this command only reads on-disk artefacts. It never edits,
  captures, or writes state (aside from an explicit `--output` file).
- **Do NOT commit or push** — the working tree is left to the user.
- **Never edit generated trees** — per [`source-of-truth`](../rules/source-of-truth.md),
  the engine lives in `src/scripts/`; never hand-edit `dist/agent-src/` or any
  tool projection.
- **Honest nulls, not invented rows** — the engine's `no data` lines are
  correct output; do not fabricate rule firings or dispatches to fill them.

## When NOT to use

- To *change* behaviour — this only explains it. Rule / routing edits go
  through the normal source-of-truth flow.
- Kill criterion: the engine self-documents a delete-if-unused-after-3-releases
  criterion; if this command sees zero use, retire it with the engine.

## See also

- `explain_run` (`src/scripts/explain_run.ts`) — the read-only engine this wraps.
- `/agent-status` — live session snapshot (this is the retrospective, artefact-sourced view).
- [`source-of-truth`](../rules/source-of-truth.md) — edit `src/`, never generated trees.
