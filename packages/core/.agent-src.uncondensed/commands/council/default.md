---
model_tier: inherit
name: council:default
tier: 2
cluster: council
sub: default
skills: [ai-council]
description: Default council lens — neutral framing, redacted context, advisory output only. Run `/council default <input>` for prompt/roadmap/diff/files; the cluster shows a menu when invoked bare.
suggestion:
  eligible: false
  rationale: "Default lens — invoked via /council dispatcher; no direct trigger."
workspaces:
  - agent-config-maintainer
packs:
  - meta
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
and global mode for this call only (see Step 2.5).

Optional **rounds**: `rounds:N` (1-3) overrides the multi-round
debate count. Round 1 sees the artefact alone. Round 2+ sees the
artefact plus anonymised critiques from the previous round
(provider/model identity stripped). Total spend = N × single-round
cost; surface this in the cost gate.

Optional **depth**: `depth:deep` raises the round floor to
`ai_council.deep_min_rounds` (default `3`, max'd with `min_rounds`)
for architecture, refactoring, or bug-diagnosis artefacts. Set
explicitly by the user, or derived from `council_depth: deep`
declared in the frontmatter of the active rule, skill, or command —
the host translates that to `--depth deep` on the CLI. If multiple
active artefacts disagree, **deep wins** (max policy). Explicit
`rounds:N` overrides depth.

The default comes from `ai_council.min_rounds` in
`.agent-settings.yml` (default `2` so members critique each other at
least once before convergence). **Do NOT ask the user "how many
rounds?"** when `rounds:N` is unset or `N <= min_rounds` — proceed
with the settings default. Ask only when the artefact is genuinely
complex and you want more depth than `min_rounds` provides; surface
the proposal as a numbered choice (per `ask-when-uncertain`) with
the cost delta.

Resolution chain (highest priority first):
1. `rounds:N` / `--rounds N` — explicit user override.
2. `depth:deep` / `--depth deep` — floors at `max(deep_min_rounds, min_rounds)`.
3. `ai_council.min_rounds` — default.

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
(auto-bootstraps `agents/runtime/.agent-prices.md` from defaults if missing). Run
`pricing.is_stale(table)` and, if stale, surface the staleness gate
from the `ai-council` skill (§ Stale price-table gate) before
continuing.

### 2.5. Resolve per-member execution mode

For each enabled member, resolve its mode via
`scripts.ai_council.modes.resolve_mode(name, invocation_mode,
member_settings, global_mode)`. Precedence: invocation flag >
per-member setting > global setting > default (`manual`).

Construct each member from the resolved mode:

- `api` → `AnthropicClient` / `OpenAIClient` (billable, cost-gated).
- `manual` → `ManualClient` from `scripts.ai_council.clients`
  (`billable=False`, no API key, no SDK call).

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
    [--prompt-mode pr|design|optimize|analysis] \
    [--original-ask "<framing sentence>"]
```

`--prompt-mode` is the lens-override flag routed by the
`/council pr|design|optimize|analysis` wrappers. It swaps the
per-mode neutrality addendum (see `scripts/ai_council/prompts.py`
`_MODE_TABLE`) without changing the bundle shape. Bare
`/council default` invocations leave it unset.

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
`--confirm` and an output path under `agents/runtime/council/sessions/`:

```bash
./agent-config council:run <question-file> \
    --output agents/runtime/council/sessions/<UTC-timestamp>.json \
    --confirm \
    [--rounds 1|2|3] \
    [--depth standard|deep] \
    [--input-mode …] [--max-tokens …] [--mode-override …] \
    [--prompt-mode …] \
    [--original-ask "<framing sentence>"]
```

`--rounds` defaults to `ai_council.min_rounds` from
`.agent-settings.yml` (or `2` if unset). Pass `--rounds N` only when
the user explicitly asked for a different count or a complex
artefact justifies more depth — do not pass `--rounds 1` to "save
money" by default; the settings owner already chose `min_rounds`.

`--depth` defaults to `standard`. Set `--depth deep` when the
active rule, skill, or command declares `council_depth: deep` in
its frontmatter; the floor becomes
`max(ai_council.deep_min_rounds, ai_council.min_rounds)` (default
`3`). If `--rounds N` is also passed, `--rounds` wins.

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

### 5a. Apply the critical-evaluation lens

Before turning findings into options, run every finding through the
*Critical evaluation* checklist from the
[`ai-council` skill](../../skills/ai-council/SKILL.md#critical-evaluation--convener-skeptic-stance):
codebase fit · locked-decision conflict · already addressed · cost
/ benefit · hallucination. Cite host evidence (file:line, ADR,
contract) for each verdict.

Render a **Host verdict** table after `Convergence / Divergence`:

| # | Finding (one-line) | Member(s) | Verdict | Reason (host evidence) |
|---|---|---|---|---|
| 1 | … | sonnet, gpt-4o | `accept` | matches `path/to/file.py:42` |
| 2 | … | sonnet | `accept-with-modification` | scope creep — narrow to module X |
| 3 | … | gpt-4o | `reject` | contradicts ADR `docs/decisions/foo.md` |
| 4 | … | sonnet | `needs-input` | ambiguous — open question for user |

The host is the convener **and** the skeptic — never paraphrase
council output as host reasoning, and never auto-promote convergence
to correctness.

### 5b. Translate verdicts into user options

End with a numbered-options block carrying the host verdict per
finding (e.g. `1. [accept] Apply finding 1 — <patch summary>`,
`2. [reject] Skip finding 2 — <reason>` — user can override). Always
include "discard council input" as an option.

### 6. Hard floor — text only

`/council` produces **text**. It does **NOT**:

- Edit any file in the project.
- Open, comment on, or merge any PR.
- Run `git` commands beyond `git diff` (read-only).

The CLI persists the responses JSON under `agents/runtime/council/sessions/`
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
- **`agents/runtime/.agent-prices.md` corrupt (missing frontmatter or columns)** →
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
