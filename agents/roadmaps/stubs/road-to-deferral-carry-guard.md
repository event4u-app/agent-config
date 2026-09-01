---
complexity: bounded
review_by: 2027-03-31
---

# Stub: road to guarding a deferral carry after the parent is archived

> **Stub — not active work.** Created 2026-09-01. Records a gap found while
> deciding the disposition of
> `road-to-council-topology-evidence-followups`. The gap is real, it is
> currently harmless, and building the guard is deliberately **out of scope**
> for the run that found it.

## The gap

A `[~]` step carried to a follow-up roadmap is validated **once**, at the moment
the parent is archived, and never again.

`deferralProblems`
(`src/agent-src/scripts/archive_completed_roadmaps.ts:414`) checks the carry from
both ends — annotation well-formed, destination exists, destination not dead,
`parent_roadmap:` back-link present. It has exactly **one** production call site
(`:574`), inside a loop over `collect()`
(`src/agent-src/scripts/update_roadmap_progress.ts:748`), and that loop skips
every `status: draft` file (`:755-757`) and everything under `archive/`,
`skipped/`, `stubs/` and `later/` (`:95`, `:315`).

So once the parent is archived, the check that created the receiver can never
see the pair again. Nothing else reads the annotation: `deferred-resolution`
appears in only two files under `src/`, and the second
(`src/scripts/lint_roadmap_complexity.ts:259`) is a warning string, not a
validator. `parent_roadmap:` has no reader outside
`archive_completed_roadmaps.ts`.

Neither reference gate closes it. `check_no_roadmap_refs`
(`src/scripts/check_no_roadmap_refs.ts`) forbids a *stable artifact* from citing
a roadmap and does not scan `agents/roadmaps/` or `agents/evidence/` at all;
`check_references` (`src/scripts/check_references.ts`) skips
`agents/roadmaps/archive` and matches only paths whose first segment is in a
fixed allowlist, which `stubs/` is not.

**Net:** deleting a live receiver reds nothing, and `check_estate_count`
(`classifyDiff`, `:490-534`) scores the deletion as an **offset** — a credit.

## The worked instance

`road-to-council-topology-evidence-followups` carries 38 obligations from a
parent that is already in `archive/`. Every one of the parent's 38 `[~]` steps
names it, and no gate stands between the receiver and its own removal.

## What would close it

One of these, in rough order of cost:

1. **A standing carry validator.** Walk every roadmap under `archive/` for
   `deferred-resolution: carried-to=<slug>`, assert the destination still
   resolves and still back-links. Diff-scoped so it costs nothing on most runs.
   The hard part is not the walk — it is that a receiver may legitimately be
   renamed, re-parented, or itself carried onward, so the check needs a
   disposition vocabulary it does not have today.
2. **Charge the deletion.** Teach `classifyDiff` that removing a roadmap which
   is some archived roadmap's `carried-to` destination is not an offset.
   Narrower, and it catches deletion but not silent emptying.
3. **Make the receiver non-draft.** Rejected for this instance: it reds
   `check_roadmap_trackable` (no `## Phase` heading) and the `relates:` ratchet,
   and it would claim the work is scheduled when every resumption trigger is
   unmet.

## Why it is not built here

The run that found this was deciding one file's disposition, not extending the
archival gate. Option 1 changes a fail-closed gate that every archival passes
through, which is a change that deserves its own review rather than riding along
with a documentation correction.

## Evidence

[`agents/evidence/analysis/topology-followups-disposition-evidence-2026-09-01.md`](../../evidence/analysis/topology-followups-disposition-evidence-2026-09-01.md)
§ 3 — the full derivation, the 43 inbound-reference census, and the gate-by-gate
read. Its appendix names what was not checked.
