# Runtime Visibility — Design

Addresses **Gap 3** from `agents/roadmaps/product-maturity.md`: runtime is active but
invisible. User doesn't notice when it runs, what it does, or what value it delivers.

## Principle

Runtime should feel like **"the agent got smarter"** — not **"the agent got noisier"**.

Visibility is a spectrum. Too little → "why did I enable this?". Too much → "the agent
talks too much now". Target: subtle, on-demand details, opt-in depth.

## Visibility levels

| Level | Who enables | What surfaces | Default |
|---|---|---|---|
| Silent | `cost_profile=minimal` | Nothing — runtime is off | ✅ |
| Subtle | `cost_profile=balanced` | One-line headers when runtime dispatches a skill | — |
| Verbose | `cost_profile=full` | Full execution trace, timings, validation steps | — |

In `minimal`, **runtime is not active at all** (matrix: `runtime_enabled=false`).
Visibility is only relevant when the user opts into runtime via `balanced`+.

## Subtle mode (default for runtime users)

One-line prefix when runtime triggers a skill:

```
▸ runtime: agent-handoff (assisted)
```

- `▸` marker distinguishes runtime output from agent narration.
- Skill name is the Kebab-case directory name.
- Execution type in parens: `(assisted)` or `(automated)` per execution-classification-standard.
- No timing, no validation details, no dispatch metadata.

## Verbose mode (for maintainers and debugging)

```
▸ runtime: agent-handoff (assisted) · 142ms
  ↳ validate: input shape ✓
  ↳ validate: tool-safety ✓
  ↳ dispatch: context-create
  ↳ result: ok
```

- Indentation shows nesting.
- Timing in ms.
- Validation and dispatch steps with checkmarks.
- Still no full arguments or payloads — those go to logs / reports.

## Non-negotiables

1. Runtime MUST NOT print debug output unless verbose is explicitly set.
2. Runtime MUST NOT interrupt agent flow — prefixes appear inline, not as blocking dialogs.
3. Runtime MUST NOT duplicate what the agent already says. No "I'm now calling X" + runtime prefix.
4. Runtime output is routed to stdout, never stderr, unless something actually failed.

## On-demand details

Users who want details without running verbose can:

- `task runtime-list` — shows the last N executions with type and result.
- `task report-stdout` — reads reports for a human-readable summary.
- `task report` (with runtime active) — generates a fresh report file.

These commands exist regardless of profile; they read from whatever feedback/metrics
files the current profile produces.

## Value signaling

Runtime should periodically (not every turn) signal value delivered:

- After N executions: "runtime saved X validation failures this week" (summary from
  feedback.json).
- On skill failure caught by runtime: explicit "runtime rejected this — see reason".
- On pattern detection (from feedback): "this skill has failed 3x recently" as a
  **suggestion**, not a block.

Value signaling is **part of full profile**, guarded by `feedback_suggestions_in_chat`.

## Implementation tasks mapped

| Roadmap task | Implementation |
|---|---|
| Define what "runtime is active" looks like | Three levels above: silent / subtle / verbose |
| Agent mentions "Executing skill X (assisted mode)" | Subtle prefix `▸ runtime: X (assisted)` |
| Agent mentions "Validation step triggered by runtime" | Verbose mode only |
| Structured output format when runtime executes a skill | Prefix format standardized above |
| Execution log via `task runtime-list` or `task report-stdout` | Already exists (see Taskfile.yml) |
| Do NOT make runtime noisy | Subtle mode is default; verbose is opt-in |
| Document "What does runtime do? Why should I enable it?" | This document + runtime package README |
| Before/After comparison: runtime off vs on | See `agents/docs/vanilla-vs-governed.md` + future runtime section |

## Open questions

- Should subtle prefixes be colored in terminal? **Yes, when TTY** — standard dim grey.
  In non-TTY (CI, logs) → plain text.
- Should the prefix show input size? **No** — noise. Verbose mode shows timing only.
- Should there be a `--trace` flag on the runtime? **Yes** — maps to verbose for the
  next single invocation, without changing profile.

## Related

- `agents/docs/feedback-consumption.md` — when runtime output becomes suggestion.
- `agents/docs/observability-scoping.md` — which audiences see what.
- `agents/docs/execution-classification-standard.md` — assisted vs automated semantics.
