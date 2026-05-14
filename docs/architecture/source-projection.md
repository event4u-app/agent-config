# Pipeline A — Source projection

> **Scope:** transform verbose authoring source into the deterministic
> distribution payload that ships in the npm package. The pipeline does
> path-rewriting, `.npmignore`-style filtering, hash-tracking, and (on
> selected files) caveman-style prose compression. The *primary* function
> is the source-to-dist projection itself; raw byte reduction is small
> (~0.35 % on the source/dist boundary: 3,253,997 B → 3,242,579 B across
> 596 files) because most files are 1:1-projected with only frontmatter
> and link rewrites. Per-tool size at the downstream projection
> boundaries (`.augment/`, `.claude/`, `.cursor/`, `.windsurf/`,
> `.clinerules/`, `.windsurfrules`, `GEMINI.md`) is measured separately
> — see [`multi-tool-projection.md § Per-tool projection size`](multi-tool-projection.md#per-tool-projection-size)
> for the table produced by [`scripts/measure_projection_bytes.py`](../../scripts/measure_projection_bytes.py).

> **Historical note.** This pipeline was previously labelled
> "Compression". Renamed in the v2.10.0 feedback follow-up after the
> council pointed out that the dominant function is projection, not
> byte compression. The script names (`scripts/compress.py`,
> `scripts/compress.sh`) are kept for now to avoid a large blast-radius
> refactor; the prose-compression sub-step (and the `/compress` slash
> command for caveman text compression) still earn the legacy name.

## Input → Transform → Output

```
.agent-src.uncompressed/**         ← Source of truth (verbose, human-readable)
    ↓ scripts/compress.py + scripts/compress.sh (--sync)
.agent-src/**                      ← Compressed, hash-tracked, shipped in @event4u/agent-config
```

| Layer | Source | Output |
|---|---|---|
| Skills | `.agent-src.uncompressed/skills/<id>/SKILL.md` (+ assets) | `.agent-src/skills/<id>/SKILL.md` |
| Rules | `.agent-src.uncompressed/rules/<name>.md` | `.agent-src/rules/<name>.md` |
| Commands | `.agent-src.uncompressed/commands/**` | `.agent-src/commands/**` |
| Personas, contexts, templates | `.agent-src.uncompressed/<dir>/**` | `.agent-src/<dir>/**` |

The path rewriter ([`scripts/compress.py:157`](../../scripts/compress.py)
`apply_path_rewriter()`) converts logical names in source frontmatter
(`contexts/execution/foo.md`) into the relative form expected from
`.agent-src/rules/` (`../contexts/execution/foo.md`). Hardcoding
`.agent-src.uncompressed/` in source is a CI failure — caught by
[`scripts/check_compressed_paths.py`](../../scripts/check_compressed_paths.py).

## Entry points

| Surface | Command |
|---|---|
| Full sync | `task sync` ([`taskfiles/content.yml:4`](../../taskfiles/content.yml)) |
| Sync drift check | `task sync-check` ([`taskfiles/content.yml:38`](../../taskfiles/content.yml)) |
| Hash drift check | `task sync-check-hashes` ([`taskfiles/content.yml:43`](../../taskfiles/content.yml)) |
| Single file | `task sync-mark-done -- <path>` |
| Direct script | `bash scripts/compress.sh --sync` |

## Invariants

1. **Determinism** — same input must produce identical bytes in
   `.agent-src/`. CI enforces via `task sync-check` (no output diff
   permitted on a clean checkout).
2. **Hash tracking** — every compressed file's source-hash is stored
   in `.agent-src/.compression-hashes.json`; stale hashes are caught
   by `task sync-check-hashes`.
3. **No source-side leakage** — `.agent-src.uncompressed/` must not
   appear anywhere in compressed output (frontmatter, body, includes).
4. **Frontmatter preserved** — YAML frontmatter survives compression
   unchanged except for the path rewriter on `load_context:` entries.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `task sync-check` fails on clean tree | source edited but not re-compressed | `task sync` |
| `check-compressed-paths` fails | `.agent-src.uncompressed/` substring leaked into compressed output | re-author source, re-run `task sync` |
| Hash drift on unchanged file | concurrent edits / merge artefact | `task sync-clean-hashes && task sync` |
| Path rewriter mangles a link | logical name collision with a real relative path | declare `validator_ignore:` in rule frontmatter |

## Proving the pipeline

- [`tests/test_compress.py`](../../tests/test_compress.py) — end-to-end
  compression, hash invariants, path rewriter.
- [`tests/test_compress_paths.py`](../../tests/test_compress_paths.py)
  — path-rewriter edge cases and forbidden-substring detection.

← [Architecture overview](../architecture.md)
