---
name: roadmap:create
cluster: roadmap
sub: create
skills: [agent-docs-writing]
description: Interactively create a new roadmap file in agents/roadmaps/
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "create a roadmap for X, plan this work as a roadmap"
  trigger_context: "multi-phase work without an existing agents/roadmaps/*.md"
---

# /roadmap create
## Instructions

### 1. Determine location

Ask the user (in their language) where the roadmap should be created:

> 1. Project root (`agents/roadmaps/`)
> 2. In a module (`app/Modules/{Name}/agents/roadmaps/`)

If the user picks a module → ask which module (list available modules if needed).
Create the `agents/roadmaps/` directory if it doesn't exist at the chosen location.

### 2. Read the roadmap template

- Read `.augment/templates/roadmaps.md` for the roadmap structure.
- Use its structure as the basis for the new roadmap.

### 3. Gather content interactively

Ask the user (in their language) step by step:

1. **Title / goal**: What is the goal of this roadmap? (one sentence)
2. **Context**: What context is important? (module, affected classes, Jira tickets, etc.)
3. **Phases**: What phases does the roadmap have? (e.g. "Phase 1: Preparation, Phase 2: Migration, Phase 3: Cleanup")
4. For each phase → What steps belong in Phase {N}?

After each input, show what you've captured and ask the user (in their language) to confirm or adjust.

**Important:** The user may answer in any language, but the roadmap file must be written in **English**.
Translate user input to English when writing the file.

### 4. Build the roadmap file

Use the template structure:

```markdown
# Roadmap: {title}

> {One sentence goal}

## Prerequisites

- [ ] Read `AGENTS.md` and relevant module docs
- [ ] {any specific prerequisites}

## Context

{Context from user input}

## Phase 1: {name}

- [ ] **Step 1:** {description}
- [ ] **Step 2:** {description}
- [ ] ...

## Phase 2: {name}

- [ ] **Step 1:** {description}
- [ ] ...

## Acceptance Criteria

- [ ] {criteria}
- [ ] All quality gates pass (PHPStan, Rector, tests)

## Notes

{Optional notes}
```

### 5. Review loop

Show the complete roadmap to the user and ask (in their language) if anything should be added or changed.

- If yes → apply changes, show again.
- Repeat until the user says it's done.

### 6. Save the file

- Generate a filename from the title: kebab-case, e.g. `optimize-webhook-jobs.md`.

**Before saving, check for filename collisions across the entire
roadmap namespace** — active, `archive/`, `skipped/`, and any nested
subdirs (e.g. `agent-memory/`). A new roadmap that shadows an
archived or skipped one silently buries history; never overwrite,
never auto-suffix without the user's pick.

```bash
NAME="<kebab-case-name>.md"
# Project-root roadmaps:
find agents/roadmaps -type f -iname "$NAME" 2>/dev/null
# Module-scoped roadmaps (only if step 1 picked a module):
find app/Modules/<Module>/agents/roadmaps -type f -iname "$NAME" 2>/dev/null
```

Use `-iname` (case-insensitive) so case-only differences still count
as a collision on case-sensitive filesystems.

If the search returns one or more hits → **STOP**. Show the matches
and ask (in the user's language):

> Found N existing roadmap(s) with this name:
>   - `agents/roadmaps/archive/<file>.md` (archived)
>   - `agents/roadmaps/skipped/<file>.md` (skipped)
>
> 1. Pick a different name — suggest `<name>-v2`, `<name>-<scope>`, or `<name>-<YYYY-MM>`
> 2. Open the existing file first — revival or extension may be the right move
> 3. Abort creation

- **1** → re-prompt for name, re-run the collision check, repeat until clean.
- **2** → read the existing roadmap, summarize state, hand back to the user.
- **3** → stop without writing anything.

Only when the search is empty: save to the chosen location and show the final path.

### 7. Update the progress dashboard

Regenerate `agents/roadmaps-progress.md` so the new roadmap shows up:

```bash
./agent-config roadmap:progress
```

Mention the new overall count to the user.

### 8. Offer council review (B1 hook)

If `.agent-settings.yml` has `ai_council.enabled: true` **and** at least
one member is enabled (`anthropic` or `openai`), ask the user (in their
language):

> 1. Run the council on this roadmap before execution? (billable)
> 2. Skip council review

Suppress this question entirely when `personal.autonomy: on` is set —
council is billable, autonomous mode must not silently spend tokens
(see `road-to-ai-council.md` Decision 3 / Q47).

If the user picks **1**:

- Run `/council roadmap:<path>` with the user's original ask captured
  in step 1 as `original_ask` (the handoff preamble carries it
  verbatim, see `scripts/ai_council/prompts.py`).
- Append the council findings as a `## Council review (<UTC date>)`
  section at the bottom of the roadmap. Include the trace path to
  `agents/council-sessions/<timestamp>/raw-text.md` so future readers
  can audit.
- Do **not** rewrite the roadmap based on the findings — surface them,
  let the user decide what to act on.

If the user picks **2** → continue.

### 9. Offer execution

After saving (and any council review), ask the user (in their language) whether to start executing the roadmap immediately.

If yes → switch to the `roadmap-execute` command workflow with the newly created file.

### Rules

- **Do NOT auto-generate content** — always ask the user for input.
- **Do NOT commit or push.**
- **Do NOT include commit steps in the roadmap** unless the user explicitly
  requested them. See [`commit-policy`](../rules/commit-policy.md#never-write-commit-steps-into-roadmaps-unsolicited).
  Roadmaps plan **work**; commits are a separate delivery decision.
- **Every phase MUST contain at least one `- [ ]` checkbox.** A roadmap
  without checkboxes is invisible to `agents/roadmaps-progress.md` and
  violates [`roadmap-progress-sync`](../rules/roadmap-progress-sync.md)
  Iron Law #2.
- **Status is binary: `ready` (default) or `draft`.** Create new
  roadmaps as **ready** — no `status:` field needed, ready is
  implicit. Only mark `status: draft` (in YAML frontmatter) when the
  user explicitly says it should be hidden from the dashboard (still
  being authored, awaiting upstream decisions, capture-only synthesis
  without executable phases). If the user wants draft, ask once at
  step 3 — do not infer it.
- **Write the roadmap in English** (per project convention for `.md` files).
- Follow the roadmap template from `.augment/templates/roadmaps.md`.
- Keep the file focused: 500–1000 lines max. If larger, suggest splitting.
- **Never overwrite an existing roadmap.** Step 6's collision check
  scans active, `archive/`, and `skipped/` (plus nested subdirs).
  On hit → STOP and present the rename / open / abort options. Auto-
  suffixing (`-v2`, `-2026-05`) requires explicit user pick.
