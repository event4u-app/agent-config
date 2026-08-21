# roadmap-management — progress dashboard

> Mode body of the [`roadmap-management`](../SKILL.md) skill (router-head
> retrofit, 2026-08-20). Content moved VERBATIM from SKILL.md — load this
> file when the mode table in SKILL.md routes here.

## Progress dashboard — `agents/roadmaps-progress.md`

A generated dashboard aggregates progress across every open roadmap. It sits at
`agents/roadmaps-progress.md` (outside `roadmaps/` to keep the folder clean) and
is rewritten by `.augment/scripts/update_roadmap_progress.ts`.

**Always regenerate in the SAME response** after any of the following
(enforced by [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md)):

- Creating a new roadmap (`/roadmap:create`)
- Marking a step `[x]`, `[~]`, or `[-]` during `/roadmap:process-*`
- Archiving or moving a roadmap to `skipped/`
- Adding, renaming, or removing a phase

Command:

```bash
./agent-config roadmap:progress           # rewrite the dashboard
./agent-config roadmap:progress-check     # CI: fail if stale
```

The `./agent-config` wrapper lives in the project root (written by the
package installer, gitignored) and delegates to the master CLI inside
`node_modules/@event4u/agent-config/` or `vendor/event4u/agent-config/`.
No global tooling required.

The dashboard is a **read-only snapshot**. Do not edit it by hand — regenerate it.

### Blockers on the dashboard

The overview table's `Blocker` column counts each roadmap's open
`## Blockers` entries (or the legacy `> Blocked until` note) and links
to the per-roadmap breakdown, which lists every open blocker with
owner, blocked scope, and full instructions. Authoring shape:
[`templates/roadmaps.md` rule 20](../../agent-src/templates/roadmaps.md);
authoring guidance: [`roadmap-writing § 5b`](../roadmap-writing/SKILL.md).
Clearing a blocker flips its `Status: resolved` and regenerates the
dashboard in the same reply, same cadence as a checkbox flip. The
blocker entry is also the canonical **awaiting-evidence** signal —
see [§ Awaiting evidence](authoring.md#awaiting-evidence--a-blocker-entry-never-a-new-glyph).

