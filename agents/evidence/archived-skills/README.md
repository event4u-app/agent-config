# Archived Skills

> Tombstones for skills removed from `.agent-src.uncondensed/skills/`.
> Contract owner: [`step-2-skill-inventory-rationalization.md`](../roadmaps/step-2-skill-inventory-rationalization.md)
> Phase 3.

## The contract

Every skill that disappears from `.agent-src.uncondensed/skills/` must
leave one file here:

```
agents/evidence/archived-skills/<slug>.md
```

The file follows the template at
[`.agent-src.uncondensed/templates/skill-archive-note.md`](../../.agent-src.uncondensed/templates/skill-archive-note.md)
and is validated by `scripts/lint_archived_skills.py`. Removal without
the matching note is a CI failure — `task lint-archived-skills` runs
inside `task ci`.

## Why archive notes exist

1. **Replacement discoverability** — a caller who searches the repo
   for an archived slug must land on a note explaining what to use
   instead, not a 404.
2. **Audit trail** — Council Opus #5 made archive notes an explicit
   floor: rationalization decisions must survive their executor.
3. **Reversibility** — `last_known_callers` + `replacement` + the
   activation snapshot at archival time are enough to restore the
   skill if the merge proves wrong.

## What lives here

- This `README.md` (the contract).
- One `<slug>.md` per archived skill, conforming to the template.

That's the whole directory. Nothing else; the linter rejects stray
files.

## What does NOT live here

- Drafts, scratch notes, or alternative explanations — those belong in
  the candidates table (`agents/runtime/metrics/skill-rationalization-candidates.md`).
- Pre-removal preserved copies of the SKILL.md body — git history is
  the source of truth.
- Cross-skill rationalization rationale — that belongs in the
  candidates table; archive notes cite it, they don't duplicate it.

## Authoring an archive note

1. Mark the row in `skill-rationalization-candidates.md` as actioned
   (date, PR link).
2. Copy the template body from
   [`.agent-src.uncondensed/templates/skill-archive-note.md`](../../.agent-src.uncondensed/templates/skill-archive-note.md).
3. Fill the six required frontmatter fields (`slug`, `archived_on`,
   `last_seen_count`, `reason`, `replacement`, `last_known_callers`).
4. Write the three body sections (*Why archived*, *What replaces it*,
   *Last-known callers*). Keep each section short — link the
   candidates row instead of restating it.
5. Stage alongside the SKILL.md removal in the **same commit**. The
   linter pairs them.

## Restoring an archived skill

If a merge / supersession proves wrong:

1. `git revert` the removal commit (or copy the SKILL.md back from
   `git show <archive-commit>~1:<path>`).
2. Delete the archive note here.
3. Update the candidates table row with the rollback rationale.
4. Re-run `task lint-skills && task lint-archived-skills`.

The archive note exists to make restoration cheap, not to make removal
permanent.
