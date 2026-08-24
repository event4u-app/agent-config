# roadmap-writing — follow-up roadmap shape

> Mode body of the [`roadmap-writing`](../SKILL.md) skill (router-head
> retrofit, 2026-08-23 — SKILL.md reached the K6 400-line cap). Content moved
> VERBATIM from SKILL.md § 7; load this file when § 7 routes here.

When a parent roadmap closes with `[~]` items, the
[`roadmap-management`](../../roadmap-management/SKILL.md) skill spawns a
follow-up. Authors and reviewers must know the shape so they can
recognise it:

```markdown
---
complexity: lightweight
status: draft                      # optional — draft hides from dashboard
parent_roadmap: <parent-slug>      # back-link to the archived source
---

# Roadmap: Follow-up to <parent-title>

> <One sentence: carried-over outcome.>

## Context

This roadmap collects items deferred from
[`agents/roadmaps/archive/<parent-slug>.md`](../archive/<parent-slug>.md).
{ … original phases preserved verbatim … }

<!-- For option 2 (ready + blocked), add this as a body note, NOT in frontmatter: -->
> Blocked until <condition>. Execution starts when the condition clears.
```

Two states the author picks between (mirrors the Iron Law 3
numbered-options block in [`roadmap-progress-sync`](../../../rules/roadmap-progress-sync.md)):

- **`status: draft`** → hidden from `agents/roadmaps-progress.md`
  until flipped. Use for items the user wants captured but not
  surfaced to the active backlog yet.
- **`status: ready` (default; omit the key)** plus body
  `> Blocked until …` note → visible in the dashboard, execution
  gated by the documented condition. The blocking is a body
  convention, not enforced by the dashboard generator — readers
  honor the note.

The follow-up roadmap is **not** authored from scratch — the
deferred steps are copied verbatim (with their phase context). This
preserves the plan exactly as the author originally wrote it.
