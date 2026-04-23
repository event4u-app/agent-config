---
name: roadmap-create
skills: [agent-docs-writing]
description: Interactively create a new roadmap file in agents/roadmaps/
disable-model-invocation: true
---

# roadmap-create

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
- Save to the chosen location.
- Show the final path.

### 7. Update the progress dashboard

Regenerate `agents/roadmaps-progress.md` so the new roadmap shows up:

```bash
./agent-config roadmap:progress
```

Mention the new overall count to the user.

### 8. Offer execution

After saving, ask the user (in their language) whether to start executing the roadmap immediately.

If yes → switch to the `roadmap-execute` command workflow with the newly created file.

### Rules

- **Do NOT auto-generate content** — always ask the user for input.
- **Do NOT commit or push.**
- **Write the roadmap in English** (per project convention for `.md` files).
- Follow the roadmap template from `.augment/templates/roadmaps.md`.
- Keep the file focused: 500–1000 lines max. If larger, suggest splitting.
