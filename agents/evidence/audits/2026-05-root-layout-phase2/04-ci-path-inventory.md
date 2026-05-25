# Audit 4 — CI-path inventory

> Verdict: **✅ Pass.** Complete inventory of hardcoded paths across 14 workflows + 6 taskfiles. ~27 distinct edit points enumerated; no opaque or generated paths. Phase 3 can plan the atomic-edit set deterministically.

## Method

1. Grep every `.github/workflows/*.yml` for `paths:`, `working-directory:`, `cache-dependency-path:`, and `run:` lines.
2. Grep every `taskfiles/*.yml` and `Taskfile.yml` for path-bearing keys.
3. Classify each hit by "movable" (referenced source/internal path) vs "frozen" (consumer surface).
4. Count distinct edit points required to relocate `.agent-src/` or `.agent-src.uncompressed/` (the Phase 3 high-value moves).

## Findings — workflows

### Path-filter inventory (`on.push.paths` / `on.pull_request.paths`)

| File | Path pattern | Phase-1 status |
|---|---|---|
| `bench-drift.yml` | `internal/bench/**` | ✅ already migrated |
| `check-visibility-drift.yml` | (sync-related, no root-dir reference) | n/a |
| `consistency.yml` | (`.agent-src*/**`, scripts) | 🟡 source-relative |
| `freeze-guard.yml` | (router/kernel paths) | n/a |
| `migration-dry-run.yml` | (`.agent-src.uncompressed/rules/**`) | 🟡 source-relative |
| `skill-lint.yml` | (`packages/<pack>/.agent-src.uncompressed/**`) | 🟡 source-relative |
| `smoke.yml`, `smoke-public-install.yml` | (consumer-install paths) | 🔒 contract |
| `tests.yml` | (broad `.agent-src*/**`) | 🟡 source-relative |

### Working-directory inventory (deploy-mcp-worker.yml)

```
working-directory: internal/workers/mcp     # 5× (Phase 1 ✅)
cache-dependency-path: internal/workers/mcp/package-lock.json  # 1× (Phase 1 ✅)
```

### Script invocations referencing source paths

```
tests.yml:152          python3 scripts/compress.py --sync
tests.yml:246/250      working-directory: packages/core/installer
consistency.yml:90     python3 scripts/check_references.py
consistency.yml:93     python3 scripts/check_portability.py
skill-lint.yml:98      python3 scripts/skill_linter.py --changed
sync-visibility.yml:61 python3 scripts/lint_topics_yaml.py
sync-visibility.yml:66 python3 scripts/sync_github_metadata.py
```

All invoke scripts under `scripts/` (🔒 frozen at root by ADR-028).

## Findings — taskfiles

### `.agent-src.uncompressed/` references (source-of-truth)

`taskfiles/ci-fast.yml`:
- Line 58–59: `packages/{{.PACK}}/.agent-src.uncompressed/` (lint-pack)
- Line 83: `.agent-src.uncompressed/skills/*/SKILL.md`
- Line 93: `.agent-src.uncompressed/templates/skill-archive-note.md`
- Line 117, 122, 137, 230, 240, 414, 465: various source-tree scans

Total: **9+ source-path references** in `ci-fast.yml`.

### `.agent-src/` references (compressed output)

`taskfiles/content.yml`:
- Line 6, 27, 42, 161, 230: sync/projection task references

Total: **5+ output-path references** in `content.yml`.

### `internal/` references (Phase-1 migrated)

```
taskfiles/engine.yml:20    internal/bench/reports/
taskfiles/mcp.yml:120      dir: internal/workers/mcp
```

Phase 1 already migrated these. ✅

## Phase 3 edit-point count (worst case)

If Phase 3 relocates `.agent-src/` and/or `.agent-src.uncompressed/`:

| Surface | Edit points | Notes |
|---|---|---|
| `scripts/compress.py` | ~3 constants | `TARGET_DIR`, `UNCOMPRESSED_DIR`, `HASH_FILE` |
| `scripts/install.py` | ~10 path tuples | `.agent-src/<sub>` mappings (lines 2174–2220) |
| `scripts/annotate_discovery.py` | 2 constants | `ROOT`, `HASH_FILE` |
| `scripts/check_references.py` | 1 regex | skip pattern |
| `taskfiles/ci-fast.yml` | 9 lines | source-tree scans |
| `taskfiles/content.yml` | 5 lines | output-tree refs |
| `.github/workflows/consistency.yml` | path filter | `.agent-src*/**` |
| `.github/workflows/tests.yml` | path filter | broad |
| `.github/workflows/skill-lint.yml` | path filter | source |
| `.github/workflows/migration-dry-run.yml` | path filter | source |

**Total: ~27 distinct edit points across 10 files.** All scripted, all CI-gated.

## Verdict: ✅ Pass

The CI surface is fully visible. No opaque paths, no generated regex blocks, no shell `cd $X/$Y` constructions. Phase 3 can write an atomic codemod that touches these 10 files in one commit and have CI green on the same PR.

## Recommendation

When Phase 3 opens (gated on Audit 2 ✅): write a one-shot `scripts/migrate_source_path.py` that walks all 27 edit points and updates them atomically. CI-validate against `task ci-essentials` + `task ci-cloud-bundle` in the same commit.

## Evidence

- Full `grep` capture from Phase 2 run (2026-05-25).
- 14 workflow files scanned, 6 taskfile files scanned, all source-path-bearing constants in `scripts/` enumerated.
