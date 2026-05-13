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

## Proving the pipeline

- [`tests/test_modern_editor_formats.py`](../../tests/test_modern_editor_formats.py)
  — verifies Claude / Cursor receive modern format with correct
  frontmatter; runs only when `task generate-tools` has been executed.
- [`tests/test_compress.py`](../../tests/test_compress.py) — covers
  the shared compress / generate-tools entrypoint and `_filter_tool_dirs`.

← [Architecture overview](../architecture.md)
