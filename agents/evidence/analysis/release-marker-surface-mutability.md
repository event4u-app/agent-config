<!-- evidence-type: analysis -->

# Which release surfaces carrying `DERIVED_MARKER` can still be repaired

Measured 2026-08-24 at `63fea45c2` (main). Discharges
`b-immutable-published-surfaces` in `road-to-release-placeholder-guard`.

The blocker asks for one row per shipped release still carrying the marker and
one column per surface, with the tag state **derived** rather than assumed.
Deriving it changed two of the blocker's own premises, so the table is wider than
requested and both corrections are stated before it.

## Method

```bash
git fetch --tags origin
git cat-file -t <tag>                                  # annotated vs lightweight
git cat-file -p <tag> | grep -c 'rewrite before merge' # tag-message markers
gh release view <tag> --json body --jq '.body' | grep -c 'rewrite before merge'
python3  # split CHANGELOG.md on '## [version' headings, count per section
```

Every number below came out of one of those four commands. The marker literal is
`DERIVED_MARKER` at `src/scripts/_lib/release_highlights.ts:48` — one
definition site, matched here by its stable tail `rewrite before merge` so the
grep survives a change to the leading underscore formatting.

## Correction 1 — the tags are unprefixed, and all five are annotated

Tags in this repository are `14.11.0`, not `v14.11.0`. All five checked resolve
to `type=tag`, i.e. **annotated objects with their own message** — so the tag
message is a real, separate surface for every one of them, not just for some.

## Correction 2 — it is five releases, not three, and the earlier repair reached one surface of three

The blocker says *"Three published annotated tag messages already carry the
marker"* (14.9.0, 14.10.0, 14.11.0), on the basis that 14.5.0 and 14.6.0 were
retro-curated. The curation was real **and it only touched `CHANGELOG.md`.**
Their tag messages and their GitHub Release bodies still carry the marker today.

`archive/road-to-session-closeout.md:182,264` recorded the 14.5.0 / 14.6.0
markers as *"both now published"* and then as cleaned up. That statement is true
of the changelog and false of the other two surfaces — which is the more useful
finding than the count: **the remediation that substituted for prevention was
applied one surface deep, and nothing recorded that it was partial.**

## The table

| Release | `CHANGELOG.md` on `main` | Annotated tag message | GitHub Release body |
|---|---|---|---|
| 14.5.0 | **0** — repaired | **2** — permanent | **2** — repairable via API |
| 14.6.0 | **0** — repaired | **3** — permanent | **3** — repairable via API |
| 14.9.0 | **4** — repairable | **4** — permanent | **4** — repairable via API |
| 14.10.0 | **2** — repairable | **2** — permanent | **2** — repairable via API |
| 14.11.0 | **4** — repairable | **4** — permanent | **4** — repairable via API |
| **totals** | **10** | **15** | **15** |

Mutability per surface, stated once:

- **`CHANGELOG.md` on `main`** — mutable. An ordinary commit repairs it. This is
  the only surface the earlier retro-curation touched.
- **Annotated tag message** — **permanent.** The message is part of the tag
  object; changing it means deleting and re-creating the tag, which rewrites a
  published ref that clones, forks, mirrors, CI caches and the npm provenance
  trail may already hold. Fix forward; do not rewrite.
- **GitHub Release body** — mutable through the API
  (`gh release edit <tag> --notes-file …`). Independent of the tag object, so
  editing it does not touch the permanent surface. It is also the surface most
  readers actually see.

## What this does and does not settle

**Settles** `b-immutable-published-surfaces`: per shipped release, which surfaces
are repairable and which are permanent, derived rather than assumed.

**Does not settle** `3.1`, and this record is not an argument for taking it up.
Curation is maintainer editorial work, held deferred by two prior council
sessions. What the table adds is that a curation pass has **three** surfaces to
keep consistent, not one — and that whatever it does, the 15 tag-message lines
stay. Any `CHANGELOG.md` curated to disagree with its own tag has to say so, or
a reader comparing the two finds a contradiction with no note explaining it.

**Says nothing about prevention.** Phase 1 and Phase 2 do not wait on this file;
the blocker states that itself.
