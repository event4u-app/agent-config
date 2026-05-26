---
adr: 015
status: accepted
date: 2026-05-21
decision: discovery-manifest-contract
supersedes: —
superseded_by: —
phase: v2.x · monorepo-phase-2-virtual-packs-discovery Phase 1
type: prospective
---

# ADR-015 — Discovery Manifest Contract

## Status

**Accepted** · 2026-05-21 · in-session AI Council pass. Folds the Phase-2
intake invariant (`agents/tmp/refactor-package.txt`, last paragraph) and
the additive-vs-rewrite call into the schema. Phase-1 prerequisite for
[`monorepo-phase-2-virtual-packs-discovery`](../../agents/roadmaps/monorepo-phase-2-virtual-packs-discovery.md).

## Context

[ADR-013](ADR-013-discovery-frontmatter-contract.md) locked the five
per-artefact frontmatter keys. The release pipeline now needs a single
JSON contract — `dist/discovery/discovery-manifest.json` — that the
TypeScript installer (Phase 3), the browser wizard (Phase 6), the docs
site, and any third-party consumer read instead of walking the source
tree. The invariant from the founder intake:

> Beim Erstellen eines Releases müssen alle Skills, etc. nach Workspace
> und Pack untersucht werden, so dass das für den Installer gespeichert
> wird und zur Verfügung steht. Es soll keine manuelle Package &
> Workspace Liste gepflegt werden.

**No manual list. Ever.** The pack and workspace shape grows by stamping
frontmatter, not by editing a list.

A v1 manifest schema already lives at
[`docs/contracts/discovery-manifest.schema.json`](../contracts/discovery-manifest.schema.json)
(carried over from the archived R3 discovery roadmap). The Phase-2
roadmap §"Manifest shape" sketched an *ideal* shape that differs from
the on-disk schema in several places (per-artefact `checksum`,
optional `requires`, a `stats` block). The decision is whether to
rewrite the schema or extend it additively.

## Decision

**Extend the v1 schema additively.** Three changes, no removals, no
field renames, version stays `1`:

1. **`artefact.checksum`** — `sha256:<hex>`, REQUIRED. Computed over the
   on-disk file bytes after frontmatter normalization (sorted keys,
   trailing newline). Drift detector for the Phase-3 installer.
2. **`artefact.requires`** — `array<pack_id>`, OPTIONAL. Pack-level
   dependency edges resolved by the installer; empty/absent means the
   artefact has no extra pack requirements beyond its own `packs[]`.
3. **`stats`** — REQUIRED top-level object. `total_artefacts`,
   `by_category`, `by_lifecycle`, `by_trust_level`. Cheap sanity surface
   for `task discovery-stats` + downstream dashboards.

The Phase-2 roadmap's example also mentioned `id`, `owner`, and
`install.managed`. **Not adopted.** The path is the canonical artefact
identity (matches ADR-013), ownership is already encoded in
`workspaces[]` + `packs[]`, and `install.managed` adds a third
install-axis without a current consumer. Re-evaluate in Phase 5.

### Source-of-truth tree

The generator walks `.agent-src.uncondensed/`, **not** `.agent-src/`.
The Phase-2 roadmap text §Phase 2 says "the condensed canonical tree"
— that is a documentation slip. `augment-source-of-truth` rule states
that uncondensed is canonical; the condensed tree is a build output
and may be regenerated. Manifest pipelines that read build outputs are
fragile to bootstrap order.

### No git in the manifest

The roadmap example included `source_commit`. **Not adopted.** The
existing `scanner_version` (first 12 hex of `sha256(build_discovery_manifest.py)`)
already pins generator identity. Embedding `git rev-parse HEAD` breaks
hermetic determinism tests in environments without a git checkout
(CI shallow clones, vendor tarballs). A consumer that needs the commit
can pin from the surrounding release artefact (changelog, tag).

## Consequences

### Positive

- Existing consumers (the Phase-1 linter, the round-trip test, the
  `lint_discovery_manifest.py` validator) keep working — top-level
  `version` stays `1`, all v1 fields stay required.
- Per-artefact `checksum` makes the Phase-3 installer drift-detection
  trivial — one hash compare per file.
- `requires` is opt-in: artefacts that don't need cross-pack deps cost
  zero extra bytes.
- Stats are computed from the artefact list — no second walk of the
  tree, no risk of stats/list desync.

### Negative

- Every artefact entry grows by ~80 bytes (the checksum). For ~420
  artefacts, the manifest grows ~33 KB. Acceptable.
- The first build after this ADR rewrites every artefact entry; the
  diff is large. Reviewed once and committed.

### Neutral

- `version` stays `1`. A future breaking change (rename `packs` to
  `pack_ids`, drop `unassigned`, etc.) bumps to `2`. This ADR sets the
  precedent that **additive** changes do not bump.

## Determinism contract

Two builds of the same source tree MUST produce byte-identical JSON
when `generated_at` is normalized. Specifically:

- All arrays sorted (`artefacts` by `path`, `workspaces`/`packs` in
  vocabulary order, `requires`/`workspaces[]`/`packs[]` per-entry sorted).
- JSON serialized with `sort_keys=True`, `indent=2`, trailing newline.
- The global `checksum` covers the manifest minus `generated_at` and
  itself (zeroed during hash input).
- Per-artefact `checksum` covers the file content with frontmatter
  normalized (sorted keys, trailing newline, no trailing whitespace).

## Failure modes guarded against

- **Manual drift** — no pack list to hand-edit; new packs/workspaces
  enter via frontmatter stamps on artefacts.
- **Stale manifest in release** — Phase 3 ships `task validate-discovery-manifest`
  which re-builds to a tempdir and `diff`s against the committed file.
- **Checksum collision with content edits** — per-artefact `checksum`
  surfaces any file mutation; the installer can refuse to overwrite a
  user-modified artefact (Phase 3).
- **`version: 1` reused for breaking changes** — this ADR explicitly
  scopes `version: 1` to additive evolutions; breaking → bump + new ADR.

## References

- [ADR-013](ADR-013-discovery-frontmatter-contract.md) — frontmatter
  contract (the input side of this manifest).
- [`docs/contracts/discovery-manifest.schema.json`](../contracts/discovery-manifest.schema.json)
  — the locked schema.
- [`docs/contracts/discovery-manifest.md`](../contracts/discovery-manifest.md)
  — worked examples + consumer guide.
- [`agents/roadmaps/monorepo-phase-2-virtual-packs-discovery.md`](../../agents/roadmaps/monorepo-phase-2-virtual-packs-discovery.md)
  — the implementing roadmap.
