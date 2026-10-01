# Findings: menu-precision-close

**Skipped:** no code surface for this completion — the diff is two markdown files (a roadmap's evidence prose and a generated docs census section) and changes no executable path, scope 917d82474db71973f89f6a593ff5358a2ffba6fc202d2fe93cb5054a117bb915, declared 2026-10-01

<!-- evidence-type: v1 | type: declared-skip | declared: 2026-10-01 -->

## Why this is skip-eligible rather than under-reviewed

The branch `drain/menu-precision-close` changes exactly two files:
`agents/roadmaps/road-to-a-menu-whose-precision-is-measured.md` and
`docs/SKILL_CENSUS.md`. Neither is executable, neither is read by a gate as
configuration, and no `src/` path is touched — so no projection regeneration
was required and none was run.

The skip phrase would be a false statement on a code diff, so the claim is
stated in a form a reader can check: a branch-scoped diff against `origin/main`
lists those two paths and nothing else.

## What the change does, for a reader who has only this artefact

It corrects five figures that were wrong when written — `59132`, `14783`,
`315 B`, `11/11`, `four of them` — against a re-run of the tools that produce
them, and regenerates the census table (198 to 197, the one delta being
`ui-component-architect` gaining a trigger corpus). It re-runs the Phase 3
blocker's `Resolved when` probe rather than re-reading its status line, records
the result (0 `observed-true` of 9 hosts scanned), and leaves 3.1 and AC-4 open
with the three inputs a future session would need to close them.

Two figures were deliberately NOT "corrected": `138325` and `198` are honest
drift rather than error — a shrink-only ratchet moved the first and the census
declares itself a dated snapshot — so they are re-measured and explained in
place instead of being quietly restored.

## Relationship to the previous round's artefact

`menu-precision.findings.md` is left in place unchanged. It binds scope
`775a1a32…`, which this change supersedes; it records a review that did happen
and is not rewritten to look like this one. Its finding 9 — that nothing in CI
keeps the census table fresh — was accepted as a risk on that branch, and the
drift this change repairs by hand is the expected consequence of that
acceptance rather than a contradiction of it.
