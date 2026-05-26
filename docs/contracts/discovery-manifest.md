---
stability: beta
keep-beta-until: 2026-08-19
---

# Discovery manifest — worked-example reference

> Companion to [ADR-015](../decisions/ADR-015-discovery-manifest-contract.md)
> and [`discovery-manifest.schema.json`](discovery-manifest.schema.json).
> The ADR is the decision; the schema is the contract; this file is the
> worked-example reference linters, the installer, and contributors
> cite at runtime.

## Source of truth

The generator
[`scripts/build_discovery_manifest.py`](../../scripts/build_discovery_manifest.py)
walks `.agent-src.uncondensed/` and emits the manifest to
`dist/discovery/discovery-manifest.json` plus a sidecar
`discovery-manifest.json.sha256` for tamper detection.

```bash
task build-discovery                  # regenerate the manifest
task validate-discovery-manifest      # re-build to tempdir + diff committed
task discovery-stats                  # pretty-print the stats block
```

`task ci` runs `build-discovery`, `validate-discovery-manifest`,
`check-discovery-determinism`, and `check-artefact-checksums` so a
stale committed manifest, a non-deterministic build, or a
per-artefact checksum drift all fail CI (Phase-6 invariants).

## Top-level shape

```jsonc
{
  "version": 1,
  "generated_at": "2026-05-21T00:00:00Z",
  "scanner_version": "a1b2c3d4e5f6",
  "checksum": "sha256:<64 hex>",
  "workspaces": [ /* one entry per workspace in config/discovery/workspaces.yml */ ],
  "packs":      [ /* one entry per pack in config/discovery/packs.yml */ ],
  "artefacts":  [ /* sorted by path, ADR-013 frontmatter projected here */ ],
  "unassigned": [ /* artefacts that failed assignment; reason required */ ],
  "documented_unassigned": [ /* explicit skips from config/discovery/unassigned-artefacts.yml */ ],
  "stats": { /* see below */ }
}
```

- `version` — stays `1` for additive changes (ADR-015). Breaking → bump.
- `generated_at` — UTC ISO-8601. **Only field allowed to differ** between
  two determinism runs.
- `scanner_version` — first 12 hex of `sha256(build_discovery_manifest.py)`.
- `checksum` — `sha256:<hex>` of the JSON with `checksum` zeroed and
  `generated_at` normalized to `"<normalised>"`.

## Worked artefact entry

```jsonc
{
  "path": ".agent-src.uncondensed/skills/laravel/SKILL.md",
  "category": "skill",
  "name": "laravel",
  "workspaces": ["engineering"],
  "packs": ["laravel"],
  "requires": ["php"],
  "lifecycle": "active",
  "trust": {
    "level": "professional",
    "confidence": "high",
    "human_review_required": false
  },
  "install": { "default": false, "removable": true },
  "checksum": "sha256:<64 hex of normalized file content>"
}
```

- `path` is the canonical identity. There is no `id` field — the path
  is short, unique, and survives renames via git history (ADR-015).
- `requires` is optional. Empty/absent → no extra pack dependencies
  beyond the artefact's own `packs[]`.
- `checksum` covers the on-disk bytes with frontmatter normalized
  (sorted keys, trailing newline, no trailing whitespace). Used by the
  Phase-3 installer for drift detection.

## Worked pack entry

```jsonc
{
  "id": "laravel",
  "label": "Laravel",
  "description": "PHP framework — Eloquent, Artisan, queues, jobs.",
  "workspaces": ["engineering"],
  "requires_hint": ["php"],
  "trust_level_default": "professional",
  "artefact_count": 18
}
```

`requires_hint` is a vocabulary-side hint (lives in
`config/discovery/packs.yml`); the canonical dependency edges sit on
the artefact-level `requires` field, which the installer aggregates.

## Stats block

```jsonc
{
  "total_artefacts": 419,
  "by_category":      { "skill": 246, "rule": 91, "command": 76, "template": 6 },
  "by_lifecycle":     { "active": 405, "experimental": 12, "deprecated": 2, "archived": 0 },
  "by_trust_level":   { "core": 142, "professional": 220, "experimental": 41, "advisory": 12, "restricted": 4 },
  "unassigned_count": 0,
  "documented_unassigned_count": 3
}
```

Counts derive from the `artefacts[]` list — no second walk, no desync
risk. The optional `_count` fields mirror the lengths of the
`unassigned` and `documented_unassigned` arrays for dashboard ease.

## Published files

`task build-discovery` writes:

| File | Purpose |
|---|---|
| `dist/discovery/discovery-manifest.json` | The canonical manifest. |
| `dist/discovery/discovery-manifest.json.sha256` | Sidecar checksum of the on-disk file bytes. |
| `dist/discovery/discovery-manifest.summary.md` | Human-readable workspace/pack summary. |
| `dist/discovery/deprecation-report.md` | Phase-4 lifecycle report — lists every `lifecycle: deprecated` artefact with workspace / pack context. |
| `dist/discovery/trust-report.md` | Phase-4 trust report — per-workspace breakdown of trust levels and `human_review_required` artefacts. |
| `dist/discovery/orphan-report.md` | Phase-4 orphan report — non-experimental artefacts whose declared pack has no other members (typo signal). |
| `dist/discovery/workspaces.json` | Phase-5 flattened workspace sub-view — per workspace, the set of packs + artefact paths visible in it. Lightweight surface for browser wizard previews. |
| `dist/discovery/packs.json` | Phase-5 flattened pack sub-view — per pack, the artefact paths, plus `by_lifecycle` and `by_trust_level` counts. Lightweight surface for pack-picker UIs. |

### Sub-view shape

`workspaces.json` and `packs.json` carry the parent manifest's
`checksum`, `generated_at`, and `scanner_version` so consumers can
pin against the same source-of-truth version. Artefacts are
referenced by `path` (the stable identity from the main manifest);
there is no `id` field.

```jsonc
// workspaces.json
{
  "generated_at": "…",
  "scanner_version": "…",
  "checksum": "sha256:…",
  "workspaces": [
    {
      "id": "engineering",
      "label": "Engineering",
      "description": "…",
      "default_packs": ["engineering-base", "php", "laravel"],
      "optional_packs": ["symfony"],
      "artefact_count": 124,
      "packs": [
        { "id": "engineering-base", "artefact_count": 83, "artefacts": [".agent-src.uncondensed/skills/…/SKILL.md", "…"] }
      ]
    }
  ]
}
```

```jsonc
// packs.json
{
  "generated_at": "…",
  "scanner_version": "…",
  "checksum": "sha256:…",
  "packs": [
    {
      "id": "engineering-base",
      "label": "Engineering Base",
      "description": "…",
      "workspaces": ["engineering"],
      "requires_hint": [],
      "trust_level_default": "core",
      "artefact_count": 83,
      "artefacts": [".agent-src.uncondensed/skills/…/SKILL.md", "…"],
      "by_lifecycle":   { "active": 82, "experimental": 1, "deprecated": 0, "archived": 0 },
      "by_trust_level": { "core": 83, "professional": 0, "experimental": 0, "advisory": 0, "restricted": 0 }
    }
  ]
}
```

Both sub-views are byte-identical between two consecutive
`task build-discovery` runs (modulo `generated_at`), same determinism
guarantee as the main manifest.

## Consumer guide

- **Phase-3 installer** — reads `artefacts[]`, resolves `requires`,
  verifies each file against its `checksum` before write.
- **Browser wizard / docs site** — reads `workspaces[]`, `packs[]`,
  `stats` to render pickers and counts.
- **Third-party tools** — treat the schema as the contract; pin the
  schema by `version` and watch for breaking-change ADRs.

## See also

- [ADR-013](../decisions/ADR-013-discovery-frontmatter-contract.md) —
  the frontmatter contract (input side).
- [ADR-015](../decisions/ADR-015-discovery-manifest-contract.md) —
  the manifest contract (output side, this file).
- [`frontmatter-contract.md`](frontmatter-contract.md) — per-artefact
  worked frontmatter examples.
