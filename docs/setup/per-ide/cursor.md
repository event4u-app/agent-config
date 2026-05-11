# Cursor Setup

Cursor reads two rule formats:

- **Modern (`.mdc`)** — `.cursor/rules/<rule>.mdc` with YAML frontmatter
  (`description`, `globs`, `alwaysApply`). Preferred for any 2025+
  Cursor build.
- **Legacy (`.cursorrules`)** — single-file aggregate at the repo root.
  Still read by older Cursor versions; the package keeps it for
  backward compatibility.

The package ships **both** so you don't have to pick.

## Prerequisites

- Cursor 0.45+ (any 2025/2026 build): <https://cursor.com>.
- Node.js ≥ 18.

## Project install

```bash
npx @event4u/create-agent-config init --tools=cursor
```

This populates:

- `.cursor/rules/*.mdc`     — one file per rule, modern frontmatter format
- `.cursor/commands/*.md`   — slash commands mirrored from `.agent-src/commands/`
- `.cursorrules`            — legacy single-file aggregate
- `.agent-settings.yml`     — per-project knobs

Combine surfaces if you use both Cursor and Claude Code:

```bash
npx @event4u/create-agent-config init --tools=cursor,claude-code
```

## Global install

```bash
npx @event4u/agent-config global --tools=cursor
```

Seeds `~/.cursor/rules/imported/event4u/` with the curated kernel +
top-N skills. Cursor merges global + workspace rules — workspace wins
on conflicts.

## Modern `.mdc` frontmatter

Each `.mdc` file has the Cursor-shaped header:

```mdc
---
description: Scope control — no unsolicited architectural changes
globs:
alwaysApply: true
---

# Scope Control
...
```

- `alwaysApply: true` ↔ source `type: "always"` (kernel rules).
- `alwaysApply: false` ↔ Cursor model decides per turn (auto rules).
- `globs:` is intentionally empty in the package's projection — apply
  per-rule if you need path-scoped rules in your fork.

## Cursor commands

`.cursor/commands/<slug>.md` mirrors `.claude/commands/`. Nested
clusters (e.g. `council/default.md`) flatten to `council-default.md` so
Cursor's command palette stays flat.

## Marketplace install (planned — Phase 7 / S35)

The Cursor marketplace listing is filed in
`road-to-simplicity-and-everywhere.md` Phase 7. Once accepted you'll
be able to install via Cursor's Extensions panel without `npx`.

## MCP block (when MCP Phase 3 ships)

Add to `.cursor/mcp.json` (Cursor's project-scoped MCP config):

```json
{
  "mcpServers": {
    "event4u-agent-config": {
      "command": "npx",
      "args": ["-y", "@event4u/agent-config-mcp"]
    }
  }
}
```

Track <https://github.com/event4u-app/agent-config> for the actual
release tag — until `road-to-mcp-full-coverage` Phase 3 ships, this
block is informational.

## Verification

```bash
ls -la .cursor/rules/   | head -5      # *.mdc files exist
ls -la .cursor/commands/| head -5      # *.md command files exist
test -f .cursorrules                   # legacy aggregate exists
```

In Cursor itself: open the chat panel — settings should show the rules
under **Project Rules**.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Rules not picked up | Cursor < 0.45 — upgrade or rely on `.cursorrules`. |
| Modern + legacy duplicate triggers | Disable `.cursorrules` in Cursor settings. |
| Command missing in palette | `task generate-tools` then reload Cursor window. |
| Global rules ignored | Cursor needs `~/.cursor/rules/` — check OS path expansion. |

## Cross-references

- [`docs/installation.md`](../../installation.md) — install matrix index.
- [`AGENTS.md`](../../../AGENTS.md) — package self-orientation; Cursor
  reads it via the projected rules.
- [`templates/cursor-rule.mdc.j2`](../../../templates/cursor-rule.mdc.j2) —
  template used by the projection generator.
