---
complexity: structural
status: ready
---

# Monorepo Phase 2 — Auto-Discovery Manifest from Frontmatter

> Second of six monorepo roadmaps. Phase 1 stamped every artefact with
> a normalized frontmatter block; this phase **generates the manifest
> the installer reads**. Iron rule from the AI Council intake
> (`agents/tmp/refactor-package.txt`, last paragraph):
>
> > _Beim Erstellen eines Releases müssen alle Skills, etc. nach
> > Workspace und Pack untersucht werden, so dass das für den Installer
> > gespeichert wird und zur Verfügung steht. Es soll keine manuelle
> > Package & Workspace Liste gepflegt werden._
>
> No manual list. Ever. The release pipeline walks the source tree and
> emits a deterministic, checksum-stable JSON manifest.

## Goal

`task build-discovery` produces `dist/discovery/discovery-manifest.json`
that fully describes every workspace, pack, artefact, dependency edge,
trust level, and install rule from frontmatter alone. The manifest is
the single API the TypeScript installer, the browser wizard, the
documentation site, and any third-party consumer read.

## Prerequisites

- [ ] Phase 1 (`monorepo-phase-1-frontmatter-metadata.md`) shipped and
      green — every artefact has the v2 contract
- [ ] `docs/contracts/discovery-vocabulary.yml` exists and is locked
- [ ] Read [`docs/contracts/discovery-manifest.schema.json`](../../docs/contracts/discovery-manifest.schema.json)
      stub (extended in Phase 1 from the prior draft)

## Acceptance criteria

- [ ] `scripts/build_discovery_manifest.py` walks every artefact and
      emits `dist/discovery/discovery-manifest.json`
- [ ] Manifest matches `docs/contracts/discovery-manifest.schema.json`
      (validated by the build script and a separate
      `task validate-discovery-manifest` step)
- [ ] Output is **deterministic**: identical input tree → byte-identical
      JSON; sort keys alphabetically, stable array ordering
- [ ] Each artefact entry carries a `checksum` (sha256 of the file
      content with frontmatter normalized) for the installer's drift
      detection in Phase 3
- [ ] `task build-discovery` runs as part of `task ci`; the build fails
      if the manifest on disk diverges from a fresh re-build
- [ ] `task release-prepare` regenerates the manifest as the first step

## Non-goals

- **Not** consuming the manifest (Phase 3 ships the TS installer)
- **Not** rendering it in a GUI (Phase 6)
- **Not** physically moving files (Phase 4)

## Manifest shape

```json
{
  "schema_version": "1.0.0",
  "generated_at": "2026-05-21T00:00:00Z",
  "source_commit": "<short-sha>",
  "workspaces": [
    {
      "id": "engineering",
      "label": "Engineering",
      "description": "Devs, SREs, platform.",
      "default_packs": ["pack.engineering-base"],
      "available_packs": ["pack.laravel", "pack.symfony", "pack.nextjs", "..."],
      "artefact_count": 142
    }
  ],
  "packs": [
    {
      "id": "pack.laravel",
      "label": "Laravel",
      "workspaces": ["engineering"],
      "requires": ["pack.php", "pack.engineering-base"],
      "trust_summary": { "core": 18, "professional": 4, "experimental": 0 },
      "artefacts": ["skill.laravel", "skill.eloquent", "command.dcf-modeling"]
    }
  ],
  "artefacts": [
    {
      "id": "skill.laravel",
      "type": "skill",
      "path": ".agent-src/skills/laravel/SKILL.md",
      "workspaces": ["engineering"],
      "packs": ["pack.laravel"],
      "requires": ["pack.php"],
      "lifecycle": "active",
      "owner": "engineering",
      "trust": { "level": "core", "confidence": "high", "human_review_required": false },
      "install": { "default": true, "removable": true, "managed": true },
      "checksum": "sha256:..."
    }
  ],
  "stats": {
    "total_artefacts": 287,
    "by_type": { "skill": 170, "rule": 42, "command": 38, "persona": 11, "guideline": 14, "template": 12 },
    "by_lifecycle": { "active": 271, "experimental": 12, "deprecated": 4 }
  }
}
```

## Phase 1 — Schema lock

- [ ] Finalize `docs/contracts/discovery-manifest.schema.json` to match
      the shape above (Draft 2020-12); the schema is the contract
- [ ] ADR `docs/decisions/ADR-015-discovery-manifest-contract.md`
      with the no-manual-list invariant explicitly named
- [ ] Add `docs/contracts/discovery-manifest.md` with worked examples

## Phase 2 — Build the generator

- [ ] Create `scripts/build_discovery_manifest.py` (stdlib + PyYAML,
      ≤ 400 LOC, `--quiet`, `--out <path>`, `--validate`)
- [ ] Walk `.agent-src/` (the compressed canonical tree); for each
      `.md` file, parse frontmatter via Phase 1 parser
- [ ] Build the workspace graph by aggregating artefacts grouped on
      `workspaces[]`; build the pack graph the same way on `packs[]`
- [ ] Resolve `requires` edges; emit a dependency error if a pack
      requires another pack that has zero artefacts
- [ ] Compute per-artefact checksum: sha256 over the file content
      after normalizing the frontmatter (sorted keys, no trailing ws)
- [ ] Sort everything: workspaces, packs, artefacts, requires arrays
- [ ] Validate output against the schema before writing
- [ ] Emit `dist/discovery/discovery-manifest.json` and a sibling
      `dist/discovery/discovery-manifest.sha256`
- [ ] Unit tests `tests/scripts/test_build_discovery_manifest.py`:
      empty tree, single skill, dependency cycle, missing required
      pack, determinism (run twice → byte-identical)

## Phase 3 — Wire it into the pipeline

- [ ] Add `task build-discovery` to `Taskfile.yml`; depends on
      `task sync` (Phase 1 produces the compressed tree first)
- [ ] Add `task validate-discovery-manifest` that re-runs the build
      to a temp file and `diff`s against the committed manifest;
      non-zero diff = CI fail (catches "forgot to regenerate")
- [ ] Wire both into `task ci` after `task lint-artefact-frontmatter` <!-- carve-out: new-gate-verification -->
- [ ] Add `task release-prepare` that calls `task sync`,
      `task build-discovery`, `task generate-tools` in that order;
      this is the single command a release runs

## Phase 4 — Stats, deprecations, and lifecycle reports

- [ ] Generator emits `dist/discovery/deprecation-report.md` listing
      every `lifecycle: deprecated` artefact and the date it was
      marked (from frontmatter `last_reviewed` + lifecycle change)
- [ ] Generator emits `dist/discovery/trust-report.md` summarizing
      trust levels per workspace and flagging any
      `human_review_required: true` artefact in a non-advisory
      workspace (sanity check)
- [ ] Generator emits `dist/discovery/orphan-report.md`: artefacts
      whose declared pack has no other members (likely a typo); CI
      fails on orphans unless `lifecycle: experimental`

## Phase 5 — Consumer-facing convenience

- [ ] Publish `dist/discovery/workspaces.json` and
      `dist/discovery/packs.json` as flattened sub-views for
      lightweight consumers (browser wizard preview, marketing site)
- [ ] Add a small `task discovery-stats` that pretty-prints the
      `stats` section so developers can sanity-check counts locally
- [ ] Document the published artefacts in
      `docs/contracts/discovery-manifest.md` under "Published files"

## Phase 6 — CI invariants

- [ ] CI step: `task build-discovery && git diff --exit-code
      dist/discovery/` — fails if the committed manifest is stale
- [ ] CI step: schema validation runs against the committed manifest
      from a fresh clone (no implicit regeneration trust)
- [ ] CI step: assert determinism — run twice in CI, byte-diff must
      be empty
- [ ] CI step: assert checksum stability — every artefact's checksum
      in the manifest must match a freshly computed sha256

## Quality gates

```bash
task build-discovery                  # primary new command
task validate-discovery-manifest      # CI guard against stale commits
task lint-artefact-frontmatter        # Phase 1 prereq
# remote CI runs the full pipeline; local full runs are skipped
```

## Downstream consumers

- Phase 3 — TS installer reads `discovery-manifest.json` to render
  the workspace picker, resolve `requires` edges, and write the
  lockfile entries
- Phase 5 — Trust gates read `trust.*` from manifest entries
- Phase 6 — Browser wizard fetches the manifest as static JSON
- External tools (Claude, Cursor, third-party) can consume the
  manifest as a stable contract; no source-tree access required

## Failure modes guarded against

- **Manual drift.** Anyone hand-editing a "pack list" is impossible —
  there is no list to edit. Adding a pack means stamping artefacts
  with `packs: [my-new-pack]`; the manifest grows on the next build.
- **Non-deterministic builds.** Sorted keys + sorted arrays + stable
  timestamp from `--source-commit` arg keep CI hashes reproducible.
- **Stale manifest in release.** `task validate-discovery-manifest`
  blocks the release on uncommitted drift.
- **Orphan packs from typos.** Phase 4's orphan report fails CI.
