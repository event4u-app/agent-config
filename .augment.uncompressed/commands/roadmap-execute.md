---
name: roadmap-execute
skills: [agent-docs-writing]
description: Read and interactively execute a roadmap from agents/roadmaps/
disable-model-invocation: true
---

# roadmap-execute

## Instructions

### 1. Find the roadmap

- List all roadmap files: `agents/roadmaps/*.md` (project root) and `app/Modules/*/agents/roadmaps/*.md` (modules).
- Exclude `template.md`.
- If only one roadmap exists → use it (confirm with user).
- If multiple exist → present a numbered list and let the user choose.
- If none exist → tell the user and suggest running `roadmap-create`.

### 2. Read and understand the roadmap

- Read the full roadmap file.
- Identify the **phases** and **steps/tasks** within each phase.
- Determine which steps are already completed (look for checkboxes `[x]`, status markers, or "done" notes).
- Present a summary to the user:
  > "Roadmap: {title}"
  > "Phase 1: {name} — 3/5 Schritte erledigt"
  > "Phase 2: {name} — noch nicht begonnen"
  > "Next open step: {step description}"

### 3. Execute step by step

For each open step:

1. **Summarize** what needs to be done (in the user's language).
2. **Analyze** the codebase to understand what's needed for this step.
3. **Present a plan** — what files to change, what approach to take.
4. **Ask for confirmation**: "Should I implement this step?"
   - If yes → implement, run quality checks, mark step as done in the roadmap file.
   - If no / skip → move to the next step.
   - If the user wants to stop → stop and summarize progress.

### 4. After each step

- Update the roadmap file: mark the completed step (e.g. `[x]` or add a completion note).
- Run quality tools if code was changed (PHPStan at minimum).
- Ask: "Continue with the next step?"

### 5. After all steps in a phase

- Summarize what was accomplished in the phase.
- Ask: "Phase {N} complete. Continue with Phase {N+1}?"

### 6. When done (or stopped)

- Summarize total progress: steps completed, steps remaining.
- Update the roadmap file with the current status.
- **If ALL steps are done** → trigger the completion & archiving workflow from the `roadmap-manager` skill.

### Rules

- **Do NOT commit or push** — only apply local changes and update the roadmap file.
- **Always ask before implementing** a step — never auto-execute.
- **Run quality checks** after each code change.
- If a step is unclear or too large, suggest breaking it down further.
- If a step reveals a problem not covered in the roadmap, flag it to the user.

