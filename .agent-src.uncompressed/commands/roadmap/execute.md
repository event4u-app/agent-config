---
name: roadmap:execute
cluster: roadmap
sub: execute
skills: [agent-docs-writing]
description: Read and interactively execute a roadmap from agents/roadmaps/
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "execute the roadmap, work through the roadmap step by step"
  trigger_context: "existing agents/roadmaps/*.md referenced in the prompt"
---

# /roadmap execute
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

### 3. Resolve quality cadence (read once, before any step runs)

Read `roadmap.quality_cadence` from `.agent-settings.yml`:

| Value | When the project's quality pipeline runs |
|---|---|
| `end_of_roadmap` (default) | Once, in step 6 — before archiving |
| `per_phase` | Once after every completed phase, plus step 6 |
| `per_step` | After every completed step, plus step 6 (legacy verbose) |

Missing key, unreadable file, or unknown value → fall back to `end_of_roadmap`.
Cite the resolved cadence once in step 2's summary so the user can override it.

The Iron Law `verify-before-complete` still applies — fresh quality
output is mandatory before any "roadmap complete" claim, regardless of
cadence. Step checkboxes and `agents/roadmaps-progress.md` are ALWAYS
updated in the same response per `roadmap-progress-sync`; cadence only
gates the *quality pipeline*, not progress tracking.

### 4. Execute step by step

For each open step:

1. **Summarize** what needs to be done (in the user's language).
2. **Analyze** the codebase to understand what's needed for this step.
3. **Present a plan** — what files to change, what approach to take.
4. **Ask for confirmation**: "Should I implement this step?"
   - If yes → implement, mark the step `[x]` in the roadmap file.
   - If no / skip → move to the next step.
   - If the user wants to stop → stop and summarize progress.

### 5. After each step

- Update the roadmap file: mark the completed step `[x]` (or `[~]` / `[-]`).
- Regenerate `agents/roadmaps-progress.md` — `./agent-config roadmap:progress`.
- **Quality pipeline** — run only when `quality_cadence: per_step`.
  Otherwise skip and proceed.
- Ask: "Continue with the next step?"

### 6. After all steps in a phase

- Summarize what was accomplished in the phase.
- **Quality pipeline** — run when `quality_cadence: per_phase` (or `per_step`).
  Skip when `end_of_roadmap`.
- Ask: "Phase {N} complete. Continue with Phase {N+1}?"

### 7. When done (or stopped)

- Summarize total progress: steps completed, steps remaining.
- Update the roadmap file with the current status.
- Regenerate the dashboard one last time so it matches the final state.
- **If ALL steps are done** → run the project's quality pipeline now
  (this is the `verify-before-complete` evidence gate; required for
  every cadence value, including `end_of_roadmap`). On green, trigger
  the completion & archiving workflow from the `roadmap-management`
  skill. On red, stop, surface the failures, do not archive.

### Rules

- **Commits are governed by [`commit-policy`](../rules/commit-policy.md).**
  By default: only apply local changes and update the roadmap file — no commits.
  - If the roadmap **does not** contain explicit commit steps → never commit, never ask.
  - If the roadmap **does** contain explicit commit steps:
    - **Non-autonomous** (`personal.autonomy: off`, or `auto` before opt-in) →
      ask before each commit step.
    - **Autonomous** (`personal.autonomy: on`, or `auto` after opt-in) →
      pre-scan the roadmap **before starting**, ask **once** upfront whether
      to execute the listed commit steps, then proceed silently per the answer.
- **Push, merge, branch, PR, tag** stay permission-gated by [`scope-control`](../rules/scope-control.md#git-operations--permission-gated).
- **Always ask before implementing** a step — never auto-execute.
- **Quality cadence** is set by `roadmap.quality_cadence` (see step 3).
  Step 7 always runs the pipeline before archival regardless of cadence.
- If a step is unclear or too large, suggest breaking it down further.
- If a step reveals a problem not covered in the roadmap, flag it to the user.
