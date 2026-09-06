---
model_tier: medium
name: agent-handoff
pack: meta
intent: "Resume a previous session in a fresh chat: pick a session, generate a handoff, auto-seed the next session"
routes_to: [agent-docs-writing]
replaces: []
visibility: visible
skills: [agent-docs-writing]
description: Pick a recent session, generate a handoff from its transcript, and seed a fresh session with it — or summarize the live conversation for copy-paste.
argument-hint: "[--print | --file | with tasks]"
suggestion:
  eligible: true
  trigger_description: "user asks for an agent handoff, to resume/continue a previous session in a fresh chat, or a context-summary to paste into a new chat"
  trigger_context: "explicit ask — 'agent handoff'/'agend handoff' (typo), 'handoff summary', 'context summary for fresh chat', 'resume/continue an old session in a fresh chat', 'fasse für neuen chat zusammen', 'neue session mit altem stand'. Never inferred."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /agent-handoff

Resume-style flow: pick one of the recent sessions, a handoff is generated
deterministically from its transcript, and the next session starts with that
handoff already injected as context. The legacy copy-paste summary of the
*live* conversation stays available as `--print`.

## Steps — primary flow (CLI-backed session picker)

### 1. List the recent sessions

```bash
agent-config handoff --list
```

Sources, merged newest-first: the cross-host chat-history log (primary),
native Claude Code transcripts (`~/.claude/projects/<slug>/`), and the Codex
session store (`~/.codex/sessions/`, Codex's only source).

### 2. Present the picker

Show the sessions as ONE numbered-options block (per `user-interaction` —
date · branch · summary per line) and let the user pick. One question, then
wait.

### 3. Generate the handoff for the pick

```bash
agent-config handoff --session <id>
```

The generator extracts the handoff sections deterministically from the
transcript — no LLM spend, reproducible, privacy-floored per line (violating
lines are DROPPED and counted, never rewritten) — and writes the result
atomically to `agents/runtime/state/handoff-context.md` (gitignored runtime
state, one-shot).

### 4. Hand over to the fresh session

Tell the user: **start a new session — the handoff is injected
automatically** (the `handoff-context` session_start hook consumes the file
exactly once, then deletes it). In a terminal-capable context, offer
`agent-config handoff --session <id> --launch claude` (or `--launch codex`)
to spawn the fresh session directly:

- `claude` — seeds via the session_start hook (clean first message).
- `codex` — this package binds no hook there; the adapter passes the handoff as the
  initial prompt instead. Same UX, different transport.
- Bundle hosts this package binds no hook on (Antigravity, Copilot) → use `--print` and
  copy-paste.

## Fallback mode — summarize the LIVE conversation (`--print`)

On `/agent-handoff --print` (or when no session log exists), summarize the
current conversation in-model — the original flow. Collect branch
(`git branch --show-current`), uncommitted changes (`git status --short`),
recent commits (`git log --oneline -5`), the active roadmap under
`agents/roadmaps/`, and the task list only when explicitly asked
("/agent-handoff with tasks"). Then emit:

```
---
Branch: {branch}
Last commit: {hash} {message}
Roadmap: {roadmap file if active, or "none"}
---

## User instructions (VERBATIM — highest priority)
- {every standing constraint / exclusion / correction the user gave, quoted
  word-for-word, NEVER summarized — a paraphrase silently drops requirements
  and causes post-handoff drift}

## Done
- {1-2 sentences summarizing what was accomplished}

## Open
- {bullet list of remaining tasks or next steps}

## Resume pointer
- {the exact next action: "continue with X"}

## Repeatable workflow (only when the work is iterative)
- Atomic unit: {the one thing repeated per iteration}
- Per-iteration steps: {1, 2, 3}
- Decision criteria: {when to stop / branch}

## Errors + fixes
- {what failed and the fix that worked — so the new chat does not re-hit it}

## Feedback history
- {corrections/preferences the user gave, so they are not re-violated}

## Key decisions
- {important decisions made during this conversation}

## Relevant files
- {list of files that were edited or are important for context}
```

The CLI generator emits the same section set (minus the live-only
*Repeatable workflow* / *Feedback history* refinements) — the template above
stays the single source of the section contract.

**Verbatim-first is the load-bearing rule:** the *User instructions* and
*Feedback history* sections are preserved word-for-word and never compressed —
lossy re-summarization of the user's own constraints is the exact failure this
template prevents. Everything else (Done / Key decisions) stays concise.

### Present the fallback to the user

Show the handoff prompt in a fenced code block and say:

```
> Copy this into a new chat to continue where we left off.
```

## Iron Law — printed output is ALWAYS a fenced code block

```
THE HANDOFF MUST BE WRAPPED IN A FENCED ```markdown CODE BLOCK
SO THE USER CAN COPY IT IN ONE CLICK. NEVER RENDER IT AS LIVE
MARKDOWN. NEVER SPLIT IT ACROSS MULTIPLE BLOCKS.
```

Applies to every in-chat emission (`--print` fallback, bundle hosts). Use
` ```markdown ` as the fence so consumers get syntax highlighting and the
inner content is preserved verbatim. Add one short prose line above the
block (e.g. *"Copy this into a new chat:"*) and nothing after — no follow-up
questions, no numbered options. The picker in Step 2 is the one exception:
it is the flow's single question, asked BEFORE any handoff is generated.

## 2b. File-artifact mode — `HANDOFF.md` (optional, host-neutral)

On `/agent-handoff --file` (or when a workflow skill's phase boundary asks
for a standing handoff), ALSO write the contract to
`agents/runtime/state/HANDOFF.md` (gitignored runtime state — plain
Markdown, no host API). Required fields, in order:

```
# HANDOFF
## Mode
{current workflow mode/phase, e.g. Implement (TDD)}
## Contract received
{what the previous phase handed over}
## Contract owed
{what the current phase must produce before yielding}
## Decisions
- {decision taken, with one-line rationale} {optionally close the line with
  `[reversible]` or `[irreversible]` — those two spellings exactly}
## Open questions
- {unresolved items the next session must not silently drop — each as a
  question ending in `?`; write `none` when there genuinely are none}
## Next command
{the single command or step to run first on resume}
```

**Resume rule:** a workflow skill's step 0 checks for this file and resumes
from its contract (mode-inference table) instead of re-deriving state; a
long phase refreshes the file before yielding. Validated by
`lint_handoffs.ts` when present — a missing required field is red, and so is an
`## Open questions` section that answers neither way (blank, or a bare `TBD` /
`TODO` / `...`). A `?`-terminated question passes; so does an explicit `none` —
the check exists to stop a blank section reading as an all-clear, not to force a
question where there is none.

**Critical-planning-file safety protocol** (applies to HANDOFF.md and agent
roadmap edits): read the current file FIRST; take a timestamped backup copy
next to it (`HANDOFF.md.<ts>.bak`) before overwrite; duplicate-check before
appending (never double-append a section); preserve the section structure;
post-verify the write by re-reading the required fields.

## Detection — when natural-language triggers count as explicit

The user does not need to type `/agent-handoff` literally. Treat as
explicit invocation when the prompt contains a verbatim mention of:

- `agent handoff` / `agend handoff` (typo) / `handoff`
- `fresh chat`, `neuer chat`, `for a new chat`
- `context summary for {fresh,new} chat`
- `fasse … für … chat zusammen`
- `resume {a,the} previous session`, `continue {an,the} old session`
- `neue session mit dem stand von {gestern,letzter session}`,
  `alte session … weitermachen`

A vague *"summarize this conversation"* without handoff/new-chat
framing → NOT a trigger. Surface `/agent-handoff` as a numbered option,
do not auto-execute.

## Rules

- **Primary flow is CLI-backed.** When `agent-config` is reachable, route
  through the picker (Steps 1–4); fall back to the in-model summary only on
  `--print`, on bundle hosts, or when the CLI reports no sessions.
- **Concise everywhere EXCEPT the verbatim sections.** Keep Done / Key
  decisions tight, but never truncate *User instructions* or *Feedback history*
  to hit a line target — losing a user constraint costs far more than the
  tokens. The concise-<30-line default applies to the narrative, not the
  verbatim record.
- **Keep errors + fixes — and keep the dead ends.** Record what failed AND the
  fix that worked, so the new chat does not re-hit it. Skip reasoning chatter,
  but **never** drop an approach that was tried and abandoned *without* a fix:
  that is the more expensive omission, because the fresh session has no way to
  know it was already ruled out and will spend the same tokens re-deriving it.
  A dead end with no fix is a **result** — the same honest-null discipline the
  rest of this package applies to measurements. List them explicitly, with one
  line each on what killed them, under a `Failed approaches` heading; write
  `None` when there genuinely were none, so the reader can tell "nothing was
  ruled out" apart from "the section was skipped".
- **Branch name is critical** — always include it.
- **Open tasks are critical** — the new chat needs to know what's left.
- **Decisions are important** — prevents the new chat from re-asking settled questions.
  A decision line may close with `[reversible]` or `[irreversible]`, which tells the
  successor "we picked A over B, easy to revisit" apart from "we already migrated the
  data". The tag is optional; those two spellings are the only accepted ones, and a
  near-miss (`[reversble]`, `[Irreversible]`) is a validation error rather than a
  silently untagged line. No claim is made that tagging improves resumption — that
  stays the registered, unmeasured `envelope_resume_success` metric.
- **File list is optional** — only include if the new chat will need to edit specific files.
- **NEVER render a printed handoff as live markdown** — see Iron Law above.

## When to use this vs. `agents/runtime/.agent-chat-history`

- `/agent-handoff` picks a **past session** and seeds the next one (or, with
  `--print`, pushes a copy-paste summary of the live one). Works across
  tools; the auto-inject path needs a hook-capable host on the same machine.
- `agents/runtime/.agent-chat-history` is **pull-based** and **multi-session**: every
  session writes its own entries tagged with a 16-char session
  fingerprint derived from the platform `session_id` (schema v4, see
  [`chat-history-platform-hooks`](../../agents/settings/contexts/chat-history-platform-hooks.md)).
  Works only on the same machine and same repo, but captures every
  phase / decision any session logged. Pull prior-session context into
  the current chat verbatim with `/chat-history import`; mine a prior
  session for project-improving learnings with
  `/memory mine-session --mode=proposals`.

Prefer `/agent-handoff` for planned context switches and session resumes;
use `/chat-history import` after a crash or fresh-chat reopen on the same
workspace to surface prior-session context verbatim.

Three distinct mechanisms — do not conflate them:

- **handoff** (this command) — a one-shot seed for the *next* chat;
  generated from a picked session (or pushed from the live one), ephemeral,
  verbatim on the user's instructions.
- **[`chat-history import`](../chat-history/import/command.md)** — pull a prior *session's* logged context into the current chat.
- **durable memory** ([`memory-consolidation`](../../../skills/memory-consolidation/SKILL.md)) — cross-*run* curated facts; a handoff is not memory, and memory is not a transcript.
