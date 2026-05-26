# Pipeline C — Multi-tool projection

> **Scope:** generate the tool-specific surface files that non-Augment
> hosts (Claude Code, Cursor, Cline, Windsurf, Gemini CLI, Copilot CLI)
> read from their conventional locations.

## Input → Transform → Output

```
.agent-src/**                      ← Compressed payload
    ↓ scripts/compress.py --generate-tools
.claude/      .cursor/             ← Claude Code, Cursor (rules + skills)
.clinerules/  .windsurfrules       ← Cline (rules dir), Windsurf (concatenated file)
GEMINI.md                          ← Gemini CLI (symlink → AGENTS.md)
.github/copilot-instructions.md    ← Copilot Chat + PR review (already shipped)
```

Per-tool method ([`scripts/compress.py:_filter_tool_dirs`](../../scripts/compress.py)):

| Tool | Surface | Method | Coverage |
|---|---|---|---|
| Claude Code | `.claude/` | native plugin + symlinks | rules + skills + commands |
| Augment VSCode/IntelliJ | `.augment/` | install.sh copies + symlinks | rules + skills + commands |
| Copilot CLI | (plugin) | native plugin | rules + skills + commands |
| Cursor | `.cursor/` | install.sh symlinks | rules only |
| Cline | `.clinerules/` | install.sh symlinks | rules only |
| Windsurf | `.windsurfrules` | install.sh concatenates | rules only |
| Gemini CLI | `GEMINI.md` | install.sh symlink → AGENTS.md | rules only |

Hosts opt in / out via `.agent-settings.yml § tools.enabled`. The
generator filters output to enabled tools only — disabling Cursor
removes `.cursor/` on next `task generate-tools`.

## Entry points

| Surface | Command |
|---|---|
| Regenerate all enabled | `task generate-tools` ([`taskfiles/content.yml:63`](../../taskfiles/content.yml)) |
| Clean output | `task clean-tools` ([`taskfiles/content.yml:69`](../../taskfiles/content.yml)) |
| Direct script | `python3 scripts/compress.py --generate-tools` |
| Consumer install | `scripts/install.sh` (calls `--generate-tools` after `--project-augment`) |

## Invariants

1. **Modern formats only** — Claude / Cursor get the host's modern
   skill / rule format; legacy XML / `.cursorrules` is not emitted.
2. **Tool gating respected** — output for `tools.enabled = false`
   never appears on disk.
3. **Determinism** — same input + settings produce identical output;
   CI enforces via `task sync-check`.
4. **Path stability** — surface files live at the host's documented
   location ([Cursor](https://docs.cursor.com), [Cline](https://docs.cline.bot),
   [Windsurf](https://docs.codeium.com)).

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Cursor doesn't see rules | `.cursor/` not generated | `tools.enabled.cursor: true` then `task generate-tools` |
| Claude Code missing a skill | skill not in `.agent-src/` yet | run Pipeline A (`task sync`) first |
| Stale `.windsurfrules` after rule rename | concatenation cache | `task clean-tools && task generate-tools` |
| Gemini CLI reads outdated content | `AGENTS.md` changed without re-symlink | `task generate-tools` |

## Per-tool projection size

The previous "0.45 % reduction" headline was a wrong-boundary
measurement: that figure compares `.agent-src.uncompressed/` to
`.agent-src/`, but the pipeline's claimed function is *projection*, not
byte compression. The table below is produced by
[`scripts/measure_projection_bytes.py --regenerate`](../../scripts/measure_projection_bytes.py)
with every tool ID temporarily enabled in `agents/.agent-tools.yml`.

| Surface | Files | Symlinks | Bytes materialized | Method |
|---|---:|---:|---:|---|
| `.agent-src.uncompressed/` | 596 | 0 | 3,253,997 | verbose source (input) |
| `.agent-src/` | 596 | 0 | 3,242,579 | source projection (path-rewrite + `.npmignore`) |
| `.augment/` | 61 | 7 | 136,146 | Augment Code — copies (rules) + symlinks (skills/cmds) |
| `.claude/` | 0 | 395 | 0 | Claude Code — pure symlinks |
| `.cursor/` | 61 | 189 | 124,741 | Cursor — per-rule `.mdc` materialized + symlinks |
| `.clinerules/` | 0 | 61 | 0 | Cline — pure symlinks |
| `.windsurf/` | 61 | 106 | 125,010 | Windsurf — per-rule wave-8 `.md` + symlinks |
| `.windsurfrules` | 1 | 0 | 114,263 | Windsurf legacy — concatenated single file |
| `GEMINI.md` | 0 | 1 | 0 | Gemini CLI — symlink → `AGENTS.md` |

**What the pipeline optimises**

- **Format fidelity** — each tool receives content in the format its host
  reads natively (Cursor `.mdc` frontmatter, Windsurf Wave-8 frontmatter,
  Claude / Cline symlinked into the source tree, Gemini single-file).
- **Path stability** — surface paths match the host vendor's
  documentation so users opt in by enabling the tool, not by remapping.
- **Materialization minimization** — pure-symlink tools (`.claude/`,
  `.clinerules/`, `GEMINI.md`) contribute zero bytes; tools that need a
  format transform materialize only the transformed rule files.

**What the pipeline does not optimise**

- **Raw byte count** — `.cursor/` and `.windsurf/` *grow* the on-disk
  footprint by ~125 KB each because their host formats require
  per-rule frontmatter that cannot be supplied via symlink alone.
  `.windsurfrules` materializes the rule set a second time as a
  concatenated single file for users who prefer that surface.
- **Source dedup** — the same rule body appears in `.agent-src/rules/`
  *and* in every tool's materialized projection. This is intentional:
  removing the duplication would push format conversion into runtime.

Re-run the measurement after every change to the projection logic:

```bash
python3 scripts/measure_projection_bytes.py --regenerate
python3 scripts/measure_projection_bytes.py --json    # CI-friendly
```

## Proving the pipeline

- [`tests/test_modern_editor_formats.py`](../../tests/test_modern_editor_formats.py)
  — verifies Claude / Cursor receive modern format with correct
  frontmatter; runs only when `task generate-tools` has been executed.
- [`tests/test_compress.py`](../../tests/test_compress.py) — covers
  the shared compress / generate-tools entrypoint and `_filter_tool_dirs`.
- [`scripts/measure_projection_bytes.py`](../../scripts/measure_projection_bytes.py)
  — per-tool byte / file / symlink count; the per-tool-size table above
  is its output.

← [Architecture overview](../architecture.md)
