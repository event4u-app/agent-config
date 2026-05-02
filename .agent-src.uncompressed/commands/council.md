---
name: council
cluster: optimize
skills: [ai-council]
description: Consult external AIs (OpenAI, Anthropic) for an independent second opinion on a prompt, roadmap, diff, or file set — neutral framing, redacted context, advisory output only.
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "external second opinion, cross-AI review, devil's advocate on a plan/roadmap/diff, polling another model"
  trigger_context: "user wants an outside critique on an artefact (roadmap, diff, prompt, files) without polluting the reviewer with the host agent's framing"
---

# council

## Instructions

### 1. Resolve the target + capture the original ask

The user invoked `/council` on exactly one input mode:

- `prompt:"<text>"` — a free-form question or proposal
- `roadmap:<path>` — a roadmap file under `agents/roadmaps/`
- `diff:<base>..<head>` — a git diff range
- `files:<path>,<path>` — a comma-separated file list

Optional invocation flag: `mode:api|manual` overrides the per-member
and global mode for this call only (see Step 2.5). `mode:playwright`
is reserved for Phase 2c — refuse politely if invoked.

If none was supplied, ask the user which mode + target. **One question
per turn** (per `ask-when-uncertain`). Do not assume the working-tree
diff.

Also capture the user's **original ask** verbatim — the free-form
sentence that triggered the council, distinct from the bundled
artefact. For `prompt:"…"` mode the ask and the artefact are the
same string. For `roadmap` / `diff` / `files` modes, the ask is the
user's framing sentence ("review this roadmap before I execute it",
"is this diff safe to merge?"). This string flows into
`consult(..., original_ask=…)` in Step 5 so council members receive
the neutral handoff preamble alongside the artefact (per
`ai-council` skill § Neutrality — context-handoff).

### 2. Check the council is configured + price table fresh

Read `.agent-settings.yml` → `ai_council`:

- If `ai_council.enabled` is false → state that and offer to flip it
  on. Do not flip it autonomously.
- If no member has `enabled: true` → list the install commands
  (`./agent-config keys:install-anthropic`, `./agent-config keys:install-openai`)
  and stop.
- If a member is enabled but its `*.key` file is missing or has the
  wrong mode → tell the user which key to install. Do not fall back to
  env vars. Ever.

Load the price table via `scripts.ai_council.pricing.load_prices()`
(auto-bootstraps `.agent-prices.md` from defaults if missing). Run
`pricing.is_stale(table)` and, if stale, surface the staleness gate
from the `ai-council` skill (§ Stale price-table gate) before
continuing.

### 2.5. Resolve per-member execution mode

For each enabled member, resolve its mode via
`scripts.ai_council.modes.resolve_mode(name, invocation_mode,
member_settings, global_mode)`. Precedence: invocation flag >
per-member setting > global setting > default (`api`).

Construct each member from the resolved mode:

- `api` → `AnthropicClient` / `OpenAIClient` (billable, cost-gated).
- `manual` → `ManualClient` from `scripts.ai_council.clients`
  (`billable=False`, no API key, no SDK call).
- `playwright` → reserved for Phase 2c. If a settings/invocation
  resolves to it, refuse with a one-line note.

### 3. Cost confirmation — ALWAYS ASK for billable members

Council calls to billable members spend money. Even under
`personal.autonomy: on`, the agent **must** ask before invoking any
billable member.

Compute `orchestrator.estimate(question, members, table)` over the
**billable** subset only (`getattr(m, "billable", True)`). Manual
members contribute `$0` and skip the estimate.

Render the cost-confirmation numbered-options block per the
`ai-council` skill (§ Pre-call estimate format) — per-member tokens
+ USD, projected total, budget caps, then `1. Run / 2. Cancel`. If
the resolved member set is **all-manual**, skip the gate entirely
(spend = $0) and proceed directly to Step 4.

Wait for the user's pick. `1` proceeds; anything else aborts.

### 4. Bundle the context

Use `scripts.ai_council.bundler`:

- `prompt` mode → `bundle_prompt(text)`
- `roadmap` mode → `bundle_roadmap(path)`
- `diff` mode → `bundle_diff(base, head)`
- `files` mode → `bundle_files(paths)`

The bundler runs redaction + size guard. If `BundleTooLarge` raises,
surface the byte count and ask the user to narrow scope. Do **not**
truncate silently.

Print the manifest (what was included) and the excluded list before
sending — gives the user a chance to abort if scope is wrong.

### 5. Run the orchestrator

Members are constructed from the settings file plus
`load_anthropic_key()` / `load_openai_key()`. Cost budget comes from
`ai_council.cost_budget`.

Detect project context once via
`scripts.ai_council.project_context.detect_project_context()` (reads
`composer.json`, `package.json`, root `README.md` — never raises;
empty-fields fall back to bare neutrality preamble).

Call:

```python
consult(
    members, question, budget,
    table=table,
    on_overrun=_handle_overrun,
    project=project,
    original_ask=original_ask,
)
```

`project` + `original_ask` flow into `handoff_preamble()` so each
member receives a neutral context-handoff alongside the artefact
(see `ai-council` skill § Neutrality — context-handoff). Members run
**sequentially**; per-member errors are normalised — one failure
does not abort the others. Define `_handle_overrun(event)` per the
`ai-council` skill (§ Mid-flow overrun callback) to surface the user
prompt before each breaching member.

### 6. Render the report

Use `scripts.ai_council.orchestrator.render(responses)` for the
per-member sections (stacked, not side-by-side — narrow terminals).
Then write the **Convergence / Divergence** section yourself:

- **Agreements** — points all members made (or did not contradict).
- **Disagreements** — points where members took opposing positions.
- **Unique insights** — points raised by exactly one member.
- **Suggested next actions** — translated into concrete options for
  the user.

End with a numbered-options block asking the user how to proceed
(e.g. update the roadmap, request a second round, ignore the
critique).

### 7. Hard floor — text only

`/council` produces **text**. It does **NOT**:

- Edit any file in the project.
- Open, comment on, or merge any PR.
- Run `git` commands beyond `git diff` (read-only).
- Persist API responses outside the current chat unless the user
  explicitly asks (Phase 4 — out of scope for v1).

This is restated in step 7 deliberately. The neutrality framing
loses meaning if the council can act on the project directly.

## Failure modes

- **Member SDK not installed** → tell the user exactly which `pip
  install` runs (`pip install anthropic` / `pip install openai`).
  Do not fall back to mocks.
- **Key file mode drift** → refuse and point at the install script.
  The 0600 contract is non-negotiable.
- **Manual mode + non-interactive stdin** → `ManualClient` reads
  pasted replies from stdin terminated by a line containing only
  `END`. If stdin is closed before any reply lands, the member
  returns empty text with `error="manual_aborted"`; render the
  partial result and ask the user.
- **Invalid mode value** → `resolve_mode()` raises
  `InvalidModeError` with the exact settings path. Surface verbatim
  and stop.
- **Cost budget exceeded mid-fan-out** → render the partial
  responses and clearly mark the unfinished members with their
  `cost_budget_exceeded` error. Do not silently retry.
- **Stale price table, refresher fails (offline)** → state the
  failure, re-offer "continue with stale table / cancel", do not
  proceed silently.
- **`.agent-prices.md` corrupt (missing frontmatter or columns)** →
  surface the parse error, suggest deleting the file to bootstrap
  fresh from defaults; never silently fall back.
- **All members error** → render the errors and ask the user
  whether to fix and retry, or abort.

## See also

- `ai-council` skill — neutrality guidelines, anti-patterns, redaction expectations.
- `subagent-orchestration` skill — internal multi-agent variant (no network calls).
- `docs/customization.md` § Available settings → `ai_council.*`.
