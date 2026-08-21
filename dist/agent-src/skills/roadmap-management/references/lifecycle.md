# roadmap-management — creating, executing, resuming

> Mode body of the [`roadmap-management`](../SKILL.md) skill (router-head
> retrofit, 2026-08-20). Content moved VERBATIM from SKILL.md — load this
> file when the mode table in SKILL.md routes here.

## Working with roadmaps

### Creating a roadmap

1. Ask the user for goal, context-create, and phases.
2. Use the template structure from `.augment/templates/roadmaps.md`.
3. Review with the user iteratively until approved.
4. **Branch & release questions — at most once, only if genuinely useful.**
   Default: stay on the current branch, no version numbers in the
   roadmap. Only propose a separate branch when there is concrete,
   evidence-based reason (e.g. risky migration benefits from a spike).
   Never include release versions, deprecation dates, or git tags in
   the roadmap text. If the user declines, do **not** re-propose during
   `/roadmap:process-*`. Decline = silence. See [`scope-control`](../../rules/scope-control.md#decline--silence--no-re-asking-on-the-same-task).
5. Save with a kebab-case filename (e.g. `optimize-webhook-jobs.md`).
   **Before writing**, scan the entire roadmap namespace for a
   collision — active, `archive/`, `skipped/`, and nested subdirs —
   with `find agents/roadmaps -type f -iname "<name>.md"`. If any
   hit comes back, stop and ask the user to rename, open the
   existing file, or abort. Never silently overwrite an archived
   or skipped roadmap. Detailed prompt in
   [`commands/roadmap/create.md`](../../commands/roadmap/create.md)
   step 6.
6. Regenerate the dashboard so the new roadmap is included.

### Executing a roadmap

0. Resolve the mode per `roadmap-process-loop` § 3a: suffix, frontmatter
   `execution.mode`, invocation form (absent = derived, not
   `interactive`). Under `/roadmap:process-*` the mode selects the
   interaction pattern via the run-start execution contract — see
   [`roadmap-execution-contract`](../../contexts/execution/roadmap-execution-contract.md).
   The manual flow below describes `interactive`; under `autonomous`
   / `phase-checkpoints` step 4's per-step ask is replaced by the
   accepted contract. **Mode never changes archival semantics** —
   glyph counting, the closure decision table, and the Iron Law 3
   deferred-resolution gate below apply identically in every mode.
1. Read the full roadmap.
2. Find the next unchecked step (`- [ ]`).
3. Summarize what needs to be done.
4. Ask the user before implementing (numbered options: implement / adjust / skip).
5. After implementation: mark `[x]`, run quality gates, then regenerate the dashboard.
6. Move to the next step.

### Resuming a roadmap

When picking up a roadmap in a new session:
1. Read the roadmap to understand the full context.
2. Check which steps are already completed (`[x]`).
3. Summarize progress to the user.
4. Continue from the next open step.

