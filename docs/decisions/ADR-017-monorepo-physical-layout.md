---
adr: 017
status: accepted
date: 2026-05-21
decision: monorepo-physical-layout
supersedes: —
superseded_by: —
phase: v2.x · monorepo-phase-4-physical-package-layout
type: prospective
---

# ADR-017 — Monorepo Physical Package Layout

## Status

**Accepted** · 2026-05-21 · external AI Council pass (`claude-sonnet-4-5`
+ `gpt-4o`, 2 rounds, `design` lens, actual cost $0.0961) on the Phase 4
roadmap. Council issued **conditional approval** with four blockers and
two refinements; this revision folds each into the design before the
`--apply` step runs.

Session: [`agents/runtime/council/responses/phase-4-physical-layout.json`](../../agents/runtime/council/responses/phase-4-physical-layout.json) <!-- council-ref-allowed: ADR decision-trace -->

Companion artefacts:
- [`agents/roadmaps/monorepo-phase-4-physical-package-layout.md`](../../agents/roadmaps/monorepo-phase-4-physical-package-layout.md)
- [`dist/migration/move-plan.json`](../../dist/migration/move-plan.json) (94 moves, 432 core, 0 conflicts)
- [`dist/migration/pre-move-snapshot.json`](../../dist/migration/pre-move-snapshot.json) (744 files hashed)
- [`scripts/plan_physical_move.py`](../../scripts/plan_physical_move.py) (plan + apply)
- [`scripts/verify_physical_move.py`](../../scripts/verify_physical_move.py) (post-move diff vs. snapshot)

## Context

Phases 1–3 produced the artefact metadata (`packs[]`, `workspaces[]`,
`trust.level`, `install.removable`), the discovery manifest, and the
TypeScript installer **without** moving a single file. The on-disk
source tree is still flat:

```text
.agent-src.uncompressed/
  rules/        # 72 entries
  skills/       # 218 entries
  commands/     # 129 entries
  personas/     # 24 entries
  contexts/     # 32 entries
  templates/    # 24 scaffolds
  …
```

This means the metadata says "this skill belongs to `pack.laravel`" but
the file lives next to a Symfony skill and a finance persona. Consumers
of the npm release, the consumer-side `.augment/` overlay, and the
upcoming Phase 5 trust gates would all benefit from physical separation
that mirrors the manifest. Phase 4 introduces that separation in one PR
with a deterministic, history-preserving migration.

The four risks the council flagged on Phase 3 (history loss, stale path
refs, cross-pack drift, hand-edited paths) all bite hardest here.

## Decision

### 1. Layout — one core, one folder per pack

```text
packages/
  core/
    installer/                       # TS CLI (already there post-Phase 3)
    .agent-src.uncompressed/         # rules + kernel skills + scaffolds
  pack-php/.agent-src.uncompressed/
  pack-laravel/.agent-src.uncompressed/
  …
  pack-ai-video/.agent-src.uncompressed/
```

No flag day: every commit between "before" and "after" the move builds
and ships. The TS installer needs zero behavioural changes — only the
`manifest-loader.ts` path roots flip.

### 2. Mapping rules (deterministic, lockfile-stable)

Implemented in [`scripts/plan_physical_move.py`](../../scripts/plan_physical_move.py):

1. **Kernel rules** → `packages/core/` (allowlist, sanity-checked against
   [`docs/contracts/kernel-membership.md`](../contracts/kernel-membership.md) §4).
   The locked set is 10 entries; `user-interrupt-priority` was admitted
   post-P2.2 and is included.
2. **Core-trust artefacts** (`trust.level: core` AND
   `install.removable: false`) → `packages/core/`.
3. **Non-frontmatter trees** (`templates/`, `profiles/`, `presets/`,
   `contexts/`, `user-types/`, `scripts/`, `ghostwriter/`, `packs/`,
   `personas/`) → `packages/core/` verbatim. These are scaffolding and
   product internals, not pack-routable artefacts.
4. **Skill auxiliary files** (`prompts/*.md`, sub-pages inside a skill
   directory) → inherit the destination of the nearest `SKILL.md` in
   the parent directory tree. Codified to fix 9 false-positive conflicts
   on Phase 4 dry-run.
5. **Pack-routable artefacts** → `packages/pack-<id>/`, where `<id>` is
   the first entry in `packs[]`. Tie-breaking by alphabetic pack id.
6. **Quarantined scaffolds** (the 26 entries in
   [`config/discovery/unassigned-artefacts.yml`](../../config/discovery/unassigned-artefacts.yml))
   → `packages/core/` with `unassigned scaffold:` reason recorded in the
   move plan. The top-level `.agent-src.uncompressed/README.md` was added
   here during dry-run.
7. **`primary pack: meta`** → `packages/core/` (package-internal
   scaffolding, not a real pack).
8. **Unknown / missing pack** → fall back to `packages/core/` AND emit
   a conflict. `--apply` refuses to run if `conflicts > 0`.

### 3. Mechanic — `git mv` only

Every move uses `git mv` so `git log --follow` keeps working on every
artefact post-move. The plan script's `--apply` mode is the only entry
point; it refuses if any conflict remains. No human-edited paths.

### 4. Byte-identity contract

`task sync` + `task build-discovery` after the move must produce
`.agent-src/`, `.augment/`, and `dist/discovery/discovery-manifest.json`
byte-identical to the pre-move snapshot **except** for
`artefacts[].path` values. [`scripts/verify_physical_move.py`](../../scripts/verify_physical_move.py)
captures a post-move snapshot and diffs against
`dist/migration/pre-move-snapshot.json`; the only allowed delta is the
`path` field per artefact.

### 5. Rollback

The whole move is a single PR. `git revert <merge-sha>` restores the
prior layout in one commit; the next `task sync` round-trip is back to
the pre-move snapshot. No data migration, no manifest schema change, no
installer behaviour change.

## Consequences

### Positive

- Metadata-to-disk parity: a consumer can now `cd packages/pack-laravel`
  and see exactly what `pack.laravel` ships, no manifest indirection.
- Phase 5 (trust) lands cleanly inside `packages/core/installer/` and
  reads per-pack metadata from `packages/pack-*/.agent-src.uncompressed/`.
- Phase 6 (browser wizard) maps packs 1:1 to its left-nav.
- Cross-pack drift is now lintable (`task lint-pack-boundaries` in
  Phase 4.4 of the roadmap).
- `git log --follow` keeps working — no history loss.

### Negative

- One large PR (~526 file moves). Reviewers need the move plan as the
  primary review artefact, not per-file diff inspection.
- Editors with the old tree open will hit broken paths until they pull.
  Mitigated by docs-update in the same PR (`AGENTS.md`, `README.md`,
  `docs/architecture.md`).
- Path refs in CI workflows, Taskfile, and the discovery scanner need
  one-line updates. The roadmap enumerates each.

### Neutral

- The npm tarball shape changes (paths only). The installer copies
  files by manifest entry, not by source path, so consumers see no
  difference.

## Alternatives considered

1. **Phased move (one pack per PR).** Rejected: 16 PRs, partial states
   on disk for weeks, `task sync` invariants harder to enforce.
2. **Symlink farm.** Rejected: Windows support, npm tarball duplication,
   and the installer would have to dereference paths.
3. **Stay flat, lift packs into manifest-only.** Rejected: this is the
   current state; it forfeits the metadata-to-disk parity that Phase 5
   and Phase 6 depend on.

## Council resolution (Round 2)

Four blocking items and two refinements raised by the council; each
resolved before `--apply` runs.

### B1 — Final source location of `.agent-src.uncompressed/`

The council asked whether the source tree nests inside `packages/core/`
(current design) or becomes a peer `pack-core/`. **Decision: keep
`packages/core/.agent-src.uncompressed/`.** Three reasons:

1. `packages/core/` is the engine + installer + kernel rules +
   scaffolding (templates, profiles, presets, contexts, user-types).
   None of that is pack-routable; making it a "pack" inverts the
   product mental model.
2. The installer in `packages/core/installer/` already lives next to
   the manifest loader; co-locating the rules that bootstrap the
   installer reduces cross-package import chains.
3. The TS installer consumes `dist/discovery/discovery-manifest.json`,
   not source paths, so the "location is privileged" critique does not
   bite — the manifest is the API.

### B2 — `git mv` rename detection at scale

Default `diff.renameLimit` since git 2.9 is 1000. Plan: 94 explicit
`git mv` operations + 1 directory rename for `core/`. Each move is
content-identical (no edits during move). Test gate: after `--apply`,
run `git diff --name-status HEAD~1` and assert `R100` (100 % rename
similarity) on every moved file. Verification script enforces this.

### B3 — Consumer-facing output contract

`task sync` writes `.agent-src/` (compressed) and `.augment/` (overlay)
at repo root — **unchanged** location and structure. The byte-identity
contract covers exactly these two trees plus the discovery manifest.
What changes:

- `dist/discovery/discovery-manifest.json` `artefacts[].path` values
  (path-only delta, enforced by `verify_physical_move.py`).
- npm tarball internal paths (consumers never touch these; installer
  uses manifest entries).

What stays identical: `.agent-src/`, `.augment/`, manifest checksums
of non-path fields, lockfile schema, installer behaviour.

### B4 — Installer dual-layout support

Not required. Consumers install via `npm install
@event4u/agent-config@<version>`; each version ships a self-consistent
tarball. There is no "consumer pulls mid-PR" scenario because consumers
do not consume the source repo — they consume the published tarball.
Source-tree contributors who pull the merge commit move atomically
with the layout. The "dual-layout" complexity the council proposed
exists in code-host-as-CDN ecosystems we do not target.

### R1 — `primary_pack` frontmatter field

`scripts/plan_physical_move.py` already uses `packs[0]` as the
destination. Round-2 hardening: the plan also reads an explicit
`primary_pack:` frontmatter field when present and prefers it over
`packs[0]`. Lint that requires `primary_pack` on every pack-routable
artefact lands in Phase 4.4 (out of scope for the move itself; the
move uses today's data and the new fallback).

### R2 — Pre-move pack-boundary lint

The current plan dry-run finds 0 conflicts after the auxiliary-file
inheritance rule landed. A cross-pack-reference lint (an artefact in
`pack.laravel` citing one in `pack.symfony` without a declared
dependency) is deferred to Phase 4.4 — the move itself does not edit
file contents, so cross-pack references survive the move byte-identical.

## Compliance + verification

- `scripts/plan_physical_move.py` is the only mover. Hand-edited paths
  fail `task verify-physical-move`.
- `scripts/verify_physical_move.py` enforces the byte-identity
  contract.
- `task ci` runs both as a hard gate post-move.
- Per-pack lint matrix lands in Phase 4.4 of the roadmap.

## Future work

- Phase 4.4 — per-pack `pack.yaml` + boundary lint.
- Phase 4.5 — contributor scaffolders (`task new-skill`,
  `task move-artefact`).
- Phase 6 (optional) — split distribution per pack as separate npm
  packages (see addendum below).

## Addendum — Optional split distribution (Phase 4.6, documented-only)

**Status:** documented, **not implemented**. Revisit only when a real
consumer demands a single-pack install path that the bundled release
cannot satisfy.

### Why this is a separate gate

The current model ships one tarball, `@event4u/agent-config`, covering
core + every pack. Splitting raises three real costs (release matrix,
version-skew between packs and core, lockfile complexity in consumer
projects) for benefits that today are speculative: no consumer has
asked for `@event4u/agent-config-laravel` alone.

### Proposed shape (if/when we ship it)

Each pack publishes as its own npm package; core stays the anchor:

```text
@event4u/agent-config             # core (kernel rules + installer + contracts)
@event4u/agent-config-laravel     # pack-laravel only
@event4u/agent-config-symfony     # pack-symfony only
… one package per packages/pack-*/
```

Consumer projects pick:

```json
{
  "dependencies": {
    "@event4u/agent-config": "^3.0.0",
    "@event4u/agent-config-laravel": "^3.0.0"
  }
}
```

The installer reads the union of installed `@event4u/agent-config*`
packages and treats them as if they were in one tarball — discovery
manifest, lockfile, and trust gates stay identical.

### Version coupling rules

- **Core pins the major.** Every split pack `peerDependencies` core
  at the matching major (`"@event4u/agent-config": "^3.x"`). A pack
  may not load against a core it was not designed for.
- **Packs may bump minor independently.** A new skill in `pack-laravel`
  can ship as `3.4.0` while core stays at `3.2.0`; the installer
  accepts any minor `>= the pack's declared core-minimum`.
- **Patches are local.** A pack bugfix releases as a pack patch; no
  core re-release required.
- **Breaking changes are coupled.** Any major bump in core forces a
  major bump in every published pack within the next release train —
  consumers see one synchronised major boundary, not seventeen.

### Lockfile shape under split distribution

`agent-config.lock.json` gains an `installed_packages[]` array; each
entry pins one published package + its version + integrity hash. The
existing `packs[]` array continues to enumerate logical packs (the
unit the installer reasons about); `installed_packages[]` is the
physical tarball-level pin.

```json
{
  "core_version": "3.4.1",
  "installed_packages": [
    { "name": "@event4u/agent-config",          "version": "3.4.1", "integrity": "sha512-…" },
    { "name": "@event4u/agent-config-laravel",  "version": "3.4.0", "integrity": "sha512-…" }
  ],
  "packs": [ "core", "pack-laravel" ]
}
```

### Non-goals of this addendum

- **Not** authorising the split. The Phase 4 roadmap parks the work
  explicitly; this addendum documents the design so the option is
  understood, not opened.
- **Not** committing to per-pack release cadence. Independent bumps
  are *allowed* by the version rules, not *required*; today's
  monolithic release stays the default until a consumer asks.
- **Not** changing the discovery manifest. Whether one tarball or
  seventeen ship the bytes, `dist/discovery/discovery-manifest.json`
  is byte-identical for the same source SHA.

### Revisit triggers

Open this design and convert to an implementation roadmap **only** if:

1. A named consumer needs one pack without the rest (e.g. a Laravel-only
   shop refusing the Symfony or React payload), **and**
2. The bundled release size becomes a real install-time pain (>5 MB
   tarball or >30 s install on cold cache), **and**
3. We have at least one volunteer maintainer per split pack willing
   to own its release cadence.

All three. Any single trigger alone is insufficient — the cost of the
split outweighs a partial benefit.
