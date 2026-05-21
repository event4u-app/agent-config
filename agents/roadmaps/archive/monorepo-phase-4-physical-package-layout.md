---
complexity: structural
status: ready
---

# Monorepo Phase 4 — Physical Package Layout

> Fourth of six monorepo roadmaps. Phases 1–3 produced the metadata,
> the discovery manifest, and the TS installer **without** moving any
> file on disk. This phase performs the actual physical migration
> from the current flat `.agent-src.uncompressed/` layout into a
> `packages/core/` + `packages/pack-*` monorepo, in a way that keeps
> the installer working from the first commit to the last.

## Goal

The source tree is restructured into:

```text
packages/
  core/                       # rules, kernel skills, installer source
    installer/                # TS CLI (Phase 3)
    .agent-src.uncompressed/  # core artefacts only
  pack-php/
  pack-laravel/
  pack-symfony/
  pack-nextjs/
  pack-react/
  pack-engineering-base/
  pack-finance/
  pack-product/
  pack-strategy/
  pack-sales/
  pack-operations/
  pack-content/
  pack-media/
  pack-support/
  pack-governance/
```

Every artefact lives in exactly one `packages/pack-*/` (or
`packages/core/`), derived from its primary `packs[]` value. The
discovery manifest, the TS installer, and the consumer install flow
keep working at every commit — no flag day.

## Prerequisites

- [x] Phase 1, 2, 3 shipped, green, and consumed by at least one
      real consumer project for a full release cycle
- [x] Every artefact has a unique primary pack declared in its
      frontmatter (Phase 1 contract)
- [x] An ADR captures the chosen mapping and the migration mechanic
      (`docs/decisions/ADR-017-monorepo-physical-layout.md` — the
      original ADR-016 slot was reassigned during numbering review)

## Acceptance criteria

- [x] Source tree matches the layout above; no `.md` file remains
      under the legacy `.agent-src.uncompressed/` root
- [x] `task sync` produces the same `.agent-src/` and `.augment/`
      trees byte-for-byte before vs. after the move (verified by
      sha256 snapshot taken on the last pre-move commit)
- [x] `dist/discovery/discovery-manifest.json` is byte-identical
      before vs. after the move except for `artefacts[].path`
      values (which now point to the new locations)
- [x] TS installer continues to work from a fresh consumer project
      pulling either the pre-move or post-move release
- [x] CI runs across all packages in parallel; per-package lint and
      test isolation is enforced
      (`.github/workflows/skill-lint.yml` `skill-lint-per-pack`
      matrix — 17 shards, fail-fast: false, all green)

## Non-goals

- **Not** splitting the npm package — the monorepo still ships a
  single `@event4u/agent-config` for now; package fan-out is a
  later optional roadmap
- **Not** introducing per-pack versioning — everything ships as
  one version (`agent-config 3.0.0`) for at least one release
  after the move
- **Not** redoing the Composer package layout — the PHP entry
  remains a single composer package consuming the npm release

## Mapping rules (deterministic)

A small `scripts/plan_physical_move.py` reads every artefact's
frontmatter and emits a `dist/migration/move-plan.json`:

```json
{
  "moves": [
    { "from": ".agent-src.uncompressed/skills/laravel/SKILL.md",
      "to":   "packages/pack-laravel/skills/laravel/SKILL.md",
      "reason": "primary pack: pack.laravel" }
  ],
  "stays_in_core": [
    { "path": "packages/core/.agent-src.uncompressed/rules/scope-control.md",
      "reason": "rule, owner: core" }
  ],
  "conflicts": []
}
```

- Primary pack = first entry in `packs[]`. Ties broken by
  alphabetic order of pack id (deterministic, lockfile-stable).
- Rules whose `trust.level` is `core` and `install.removable: false`
  land in `packages/core/`.
- Kernel rules (the 9 always-loaded Iron-Law rules) are pinned to
  `packages/core/` by an explicit allowlist in the plan script —
  a sanity check, not a duplication.
- Conflicts (artefact with no clear primary pack) fail the script
  with a per-file report; humans resolve via frontmatter edits.

## Phase 1 — Plan + ADR + snapshot

- [x] Run `scripts/plan_physical_move.py --dry-run` against
      the current tree; commit `dist/migration/move-plan.json`
- [x] Hand-review every entry; resolve all `conflicts: []` by
      tightening frontmatter `packs[]` order
- [x] Capture a pre-move sha256 snapshot of `.agent-src/`,
      `.augment/`, and the discovery manifest in
      `dist/migration/pre-move-snapshot.sha256`
- [x] Write the ADR with the chosen rules, the conflict resolutions,
      and the rollback plan

## Phase 2 — Migration tooling

- [x] Extend the plan script to a `--apply` mode that performs
      the moves via `git mv` (preserves history)
- [x] Add `scripts/verify_physical_move.py` that re-runs
      `task sync` + `task build-discovery`, then diffs the post-move
      outputs against the snapshot; the only allowed diff is in
      `artefacts[].path` values
- [x] CI workflow `.github/workflows/migration-dry-run.yml` runs
      the plan script weekly while the move is in flight and posts
      a comment if conflicts appear

## Phase 3 — Execute the move (single PR)

- [x] Run `scripts/plan_physical_move.py --apply` on a dedicated
      `monorepo/physical-move` branch; no other change in the PR
- [x] Update path references in:
      `scripts/build_discovery_manifest.py`,
      `scripts/lint_artefact_frontmatter.py`,
      `Taskfile.yml`, `.github/workflows/*.yml`,
      `packages/core/installer/src/manifest-loader.ts`

- [x] Run `task sync && task build-discovery` locally; assert the
      post-move snapshot diff matches the expected path-only delta
      (remote CI is the full-pipeline gate)
- [x] Land the PR with the migration script's commit message
      explicitly documenting how to revert (single `git revert`)

## Phase 4 — Per-package isolation

- [x] Each `packages/pack-*/` gets its own `package.json`-like
      manifest `pack.yaml` (id, label, owner, requires, version);
      generated from frontmatter, never hand-edited
- [x] Each pack carries its own minimal `README.md` (auto-generated
      from frontmatter `description` of every artefact in the pack)
- [x] `task lint-pack-boundaries` ensures no skill in `pack-laravel/`
      references files outside its pack except via `requires` edges
      already declared in `pack.yaml`
- [x] Skill-linter runs per-package in parallel CI matrix; per-pack
      green is a hard merge gate
      (`task lint-pack PACK=<id>` + `.github/workflows/skill-lint.yml`
      `skill-lint-per-pack` matrix; linter accepts directory args via
      `gather_candidate_files_under`)

## Phase 5 — Contributor ergonomics

- [x] Add `task new-skill` interactive scaffolder that asks for
      pack, type, name, workspaces, then drops a templated file
      into the right `packages/pack-*/skills/<name>/SKILL.md`
- [x] Add `task move-artefact <id> <target-pack>` helper that
      re-runs the plan script for a single artefact and applies
      the `git mv`
- [x] Update `AGENTS.md` "Editing this repo" to point at
      `packages/` instead of the legacy root
- [x] Update onboarding skill `agents-md-thin-root` references

## Phase 6 — Optional split distribution

- [x] Document (in ADR, not implement) how each pack could later
      ship as its own npm package consumable a la carte
      (ADR-017 addendum "Optional split distribution", §"Proposed shape")
- [x] Define the version coupling rules (core pins major; packs
      may bump minor independently) and the lockfile shape under
      split distribution
      (ADR-017 addendum §"Version coupling rules" + §"Lockfile shape")
- [x] Park the implementation; revisit only when a real consumer
      demands a single-pack install path that the current bundled
      release cannot satisfy
      (ADR-017 addendum §"Revisit triggers" — three-condition AND-gate)

## Quality gates

```bash
task plan-physical-move --dry-run     # plan only
task verify-physical-move             # diff vs. snapshot
task lint-pack-boundaries             # no cross-pack drift
task sync && task build-discovery     # round-trip
# remote CI runs the full pipeline; local full runs are skipped
```

## Downstream consumers

- Phase 5 (trust) lands inside `packages/core/installer/` and
  reads per-pack `pack.yaml` trust summaries
- Phase 6 (browser wizard) treats packs as first-class navigable
  entities; the physical layout maps 1:1 to the wizard's left nav

## Failure modes guarded against

- **History loss.** Every move uses `git mv`; `git log --follow`
  works on every artefact post-move.
- **Stale path refs.** Phase 3 explicitly enumerates every
  consumer; CI catches regressions because `task sync` would fail
  on a broken path.
- **Cross-pack drift.** `task lint-pack-boundaries` blocks merges
  that introduce undeclared inter-pack references.
- **Conflict resolution by hand.** The plan script is the only
  source of truth; humans only edit frontmatter, never paths.
