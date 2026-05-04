---
name: council:default
cluster: council
sub: default
skills: [ai-council]
description: Default council lens — neutral framing, redacted context, advisory output only. Run `/council default <input>` for prompt/roadmap/diff/files; the cluster shows a menu when invoked bare.
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Default lens — invoked via /council dispatcher; no direct trigger."
---

# /council default

Base orchestration entry point for the council. Specialised lenses
(`/council pr`, `/council design`, `/council optimize`) wrap this same
flow with mode-specific neutrality preambles.

## Instructions

### 1. Resolve the target + capture the original ask

The user invoked `/council default` on exactly one input mode:

- `prompt:"<text>"` — a free-form question or proposal
- `roadmap:<path>` — a roadmap file under `agents/roadmaps/`
- `diff:<base>..<head>` — a git diff range
- `files:<path>,<path>` — a comma-separated file list

Optional invocation flag: `mode:api|manual` overrides the per-member
and global mode for this call only (see Step 2.5). `mode:playwright`
is reserved for Phase 2c — refuse politely if invoked.

Optional **rounds**: `rounds:N` (1-3) enables multi-round debate. Round
1 sees the artefact alone. Round 2+ sees the artefact plus anonymised
critiques from the previous round (provider/model identity stripped).
Total spend = N × single-round cost; surface this in the cost gate.
Default `rounds:1`.

Optional **mode_override**: `mode_override=pr|design|optimize` swaps
the system-prompt addendum for one of the specialised lenses
(see `prompts.py` `_MODE_TABLE`). The bundle mode is unchanged; only
the per-mode neutrality addendum is replaced. Routed by the
`/council pr`, `/council design`, `/council optimize` sub-commands —
surface to the user as "council on <target> — <lens> lens".

If no input mode was supplied, ask the user which mode + target. **One
question per turn** (per `ask-when-uncertain`). Do not assume the
working-tree diff.

Also capture the user's **original ask** verbatim — the free-form
sentence that triggered the council, distinct from the bundled
artefact. For `prompt:"…"` mode the ask and the artefact are the
same string. For `roadmap` / `diff` / `files` modes, the ask is the
user's framing sentence ("review this roadmap before I execute it",
"is this diff safe to merge?"). This string flows into
`consult(..., original_ask=…)` in Step 5 (per `ai-council` skill §
Neutrality — context-handoff).

### 2. Check the council is configured + price table fresh

Read `.agent-settings.yml` → `ai_council`:

- If `ai_council.enabled` is false → state that and offer to flip it
  on. Do not flip it autonomously.
- If no member has `enabled: true` → list the install commands
  (`./agent-config keys:install-anthropic`, `./agent-config keys:install-openai`)
  and stop.
- If a member is enabled but its `*.key` file is missing or has the
  wrong mode → tell the user which key to install. Do not fall back
  to env vars. Ever.

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

Run the CLI in **estimate** mode first — it bundles the artefact, runs
redaction, and prints the per-member preview without spending:

```bash
./agent-config council:estimate <question-file> \
    [--input-mode prompt|roadmap] \
    [--max-tokens N] \
    [--mode-override api|manual] \
    [--original-ask "<framing sentence>"]
```

For `prompt:"<text>"` mode, write the text to a temp file first
(`mktemp` is fine) and pass that path. For `roadmap:<path>`, pass the
roadmap file with `--input-mode roadmap`. `diff` and `files` modes
remain Phase 4 — for now ask the user to convert into a `prompt`.

The CLI prints a `council:estimate · members=N (billable=M)` line
followed by per-member projected USD and a TOTAL. Render that to the
user inside the cost-confirmation numbered-options block per the
`ai-council` skill (§ Pre-call estimate format) — then `1. Run /
2. Cancel`. If the billable count is `0`, skip the gate entirely
(spend = $0) and proceed directly to Step 4.

Wait for the user's pick. `1` proceeds; anything else aborts.

### 4. Run the CLI

Once the user picks `1`, invoke the same arguments with `run` plus
`--confirm` and an output path under `agents/council-sessions/`:

```bash
./agent-config council:run <question-file> \
    --output agents/council-sessions/<UTC-timestamp>.json \
    --confirm \
    [--rounds 1|2|3] \
    [--input-mode …] [--max-tokens …] [--mode-override …] \
    [--original-ask "<framing sentence>"]
```

The CLI:

- bundles the artefact via `scripts.ai_council.bundler` (redaction +
  size guard — `BundleTooLarge` exits 2 with the byte count),
- builds members from `.agent-settings.yml` (refusing if
  `ai_council.enabled` is false or no member is wired up),
- detects project context via `detect_project_context()`,
- calls `orchestrator.consult(...)` with the `cost_budget` from
  settings,
- writes the responses JSON to `--output`.

Per-member errors are normalised — one failure does not abort the
others. Exit code `1` means **all** members errored; `0` means at
least one succeeded; `2` means the gate refused before any spend.

### 5. Render the report

Use `./agent-config council:render <output.json>` for the per-member
sections (stacked, not side-by-side — narrow terminals). Then write
the **Convergence / Divergence** section yourself:

- **Agreements** — points all members made (or did not contradict).
- **Disagreements** — points where members took opposing positions.
- **Unique insights** — points raised by exactly one member.
- **Suggested next actions** — translated into concrete options for
  the user.

End with a numbered-options block asking the user how to proceed
(e.g. update the roadmap, request a second round, ignore the
critique).

### 6. Hard floor — text only

`/council` produces **text**. It does **NOT**:

- Edit any file in the project.
- Open, comment on, or merge any PR.
- Run `git` commands beyond `git diff` (read-only).

The CLI persists the responses JSON under `agents/council-sessions/`
for traceability, but the agent never edits other project files on
the user's behalf. The neutrality framing loses meaning if the
council can act on the project directly.

## Failure modes

- **CLI exits 2, "ai_council.enabled is false"** → tell the user how
  to flip it on; do not flip it autonomously.
- **CLI exits 2, "no council member has `enabled: true`"** → list the
  install commands (`./agent-config keys:install-anthropic`,
  `./agent-config keys:install-openai`) and stop.
- **CLI raises `BundleTooLarge`** → surface the byte count and ask the
  user to narrow scope. Do not truncate silently.
- **Member SDK not installed** → CLI prints the missing-package
  message; tell the user exactly which `pip install` runs
  (`pip install anthropic` / `pip install openai`). Do not fall back
  to mocks.
- **Key file mode drift** → CLI refuses; point at the install script.
  The 0600 contract is non-negotiable.
- **Invalid mode value** → CLI surfaces `InvalidModeError` with the
  exact settings path. Surface verbatim and stop.
- **Cost budget exceeded mid-fan-out** → render the partial responses
  and clearly mark unfinished members with `cost_budget_exceeded`. Do
  not silently retry.
- **Stale price table, refresher fails (offline)** → state the
  failure, re-offer "continue with stale table / cancel", do not
  proceed silently.
- **`.agent-prices.md` corrupt (missing frontmatter or columns)** →
  surface the parse error, suggest deleting the file to bootstrap
  fresh from defaults; never silently fall back.
- **All members error (CLI exit 1)** → render the errors via
  `council:render` and ask the user whether to fix and retry, or
  abort.

## See also

- `/council` — cluster dispatcher.
- `ai-council` skill — neutrality guidelines, anti-patterns, redaction expectations.
- `subagent-orchestration` skill — internal multi-agent variant (no network calls).
- `scripts/council_cli.py` — the CLI entry point this command wraps.
- `docs/customization.md` § Available settings → `ai_council.*`.
