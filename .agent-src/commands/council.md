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

### 1. Resolve the target

The user invoked `/council` on exactly one input mode:

- `prompt:"<text>"` — a free-form question or proposal
- `roadmap:<path>` — a roadmap file under `agents/roadmaps/`
- `diff:<base>..<head>` — a git diff range
- `files:<path>,<path>` — a comma-separated file list

If none was supplied, ask the user which mode + target. **One question
per turn** (per `ask-when-uncertain`). Do not assume the working-tree
diff.

### 2. Check the council is configured

Read `.agent-settings.yml` → `ai_council`:

- If `ai_council.enabled` is false → state that and offer to flip it
  on. Do not flip it autonomously.
- If no member has `enabled: true` → list the install commands
  (`bash scripts/install_anthropic_key.sh`, `bash scripts/install_openai_key.sh`)
  and stop.
- If a member is enabled but its `*.key` file is missing or has the
  wrong mode → tell the user which key to install. Do not fall back to
  env vars. Ever.

### 3. Cost confirmation — ALWAYS ASK

Council calls are billable. Even under `personal.autonomy: on`, the
agent **must** ask before invoking. Surface a numbered-options block:

> External council call — billable
>
> Members: anthropic (claude-sonnet-4-5), openai (gpt-4o)
> Mode: roadmap · Target: `agents/roadmaps/<name>.md` (~3 KB after redaction)
> Cost ceiling: 50k input / 20k output tokens
>
> 1. Run the consultation
> 2. Cancel

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

Call `scripts.ai_council.orchestrator.consult(members, question, budget)`.
Members are constructed from the settings file plus the keys from
`load_anthropic_key()` / `load_openai_key()`.

Cost budget comes from `ai_council.cost_budget`. The orchestrator
runs in parallel and normalises per-member errors — one failure does
not abort the others.

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
- **Cost budget exceeded mid-fan-out** → render the partial
  responses and clearly mark the unfinished members with their
  `cost_budget_exceeded` error. Do not silently retry.
- **All members error** → render the errors and ask the user
  whether to fix and retry, or abort.

## See also

- `ai-council` skill — neutrality guidelines, anti-patterns, redaction expectations.
- `subagent-orchestration` skill — internal multi-agent variant (no network calls).
- `docs/customization.md` § Available settings → `ai_council.*`.
