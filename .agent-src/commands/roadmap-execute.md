---
name: roadmap-execute
skills: [agent-docs-writing]
description: Read and interactively execute a roadmap from agents/roadmaps/
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "execute the roadmap, work through the roadmap step by step"
  trigger_context: "existing agents/roadmaps/*.md referenced in the prompt"
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
- Regenerate `agents/roadmaps-progress.md` — `./agent-config roadmap:progress`.
- Ask: "Continue with the next step?"

### 5. After all steps in a phase

- Summarize what was accomplished in the phase.
- Ask: "Phase {N} complete. Continue with Phase {N+1}?"

### 6. When done (or stopped)

- Summarize total progress: steps completed, steps remaining.
- Update the roadmap file with the current status.
- Regenerate the dashboard one last time so it matches the final state.
- **If ALL steps are done** → trigger the completion & archiving workflow from the `roadmap-management` skill.

### Rules

- **Commits per [`commit-policy`](../rules/commit-policy.md).** Default: only
  apply local changes and update the roadmap file — no commits.
  - Roadmap **without** commit steps → never commit, never ask.
  - Roadmap **with** commit steps:
    - **Non-autonomous** (`autonomy: off`, or `auto` before opt-in) → ask before each.
    - **Autonomous** (`autonomy: on`, or `auto` after opt-in) → pre-scan **before
      starting**, ask **once** upfront, then proceed silently per the answer.
- **Push, merge, branch, PR, tag** stay permission-gated by [`scope-control`](../rules/scope-control.md#git-operations--permission-gated).
- **Always ask before implementing** a step — never auto-execute.
- **Run quality checks** after each code change.
- If a step is unclear or too large, suggest breaking it down further.
- If a step reveals a problem not covered in the roadmap, flag it to the user.
