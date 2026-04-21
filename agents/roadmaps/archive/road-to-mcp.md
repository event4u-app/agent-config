# Roadmap: MCP Config Generation

> One `mcp.json` → per-tool output files for Claude Desktop, Cursor, and
> Windsurf. `${env:VAR}` substitution included. Nothing else.

This is the **only surviving phase** from the archived
[`archive/road-to-ultimate.md`](archive/road-to-ultimate.md) after scope
review. External-sources CLI, global PyPI CLI, platform auto-detection,
upstream-sync automation, and config profiles were all rejected as
speculative — no signal of real demand, high maintenance cost.

Scope stays narrow on purpose:

- 3 targets, not 6.
- 1 secret backend (`env`), not 3.
- No Bitwarden dependency.
- No keychain support until someone asks.

**Guiding principle:** MCP is state-of-the-art and today hand-wired across
tool configs. A renderer that closes that gap is real value. A marketplace
for MCP servers, a UI, a secret vault — are not.

## Prerequisites

- [x] [`archive/road-to-9.md`](archive/road-to-9.md) Phase 1 landed (real minimal runtime, shipped in PR #11, 1.5.0).
- [ ] Read [`.agent-src.uncompressed/skills/mcp/SKILL.md`](../../.agent-src.uncompressed/skills/mcp/SKILL.md) — current MCP surface.
- [ ] Branch off `main` after 1.6.0.

## Problem

MCP is documented in our skill but not generated. Users hand-write
`claude_desktop_config.json`, `.cursor/mcp.json`, and Windsurf equivalents,
duplicating server definitions across 3+ files and leaking secrets into
plaintext configs.

## Scope

One source-of-truth `mcp.json` at repo root with `${env:VAR}` placeholders.
A renderer emits each tool's concrete format. Unresolved placeholders fail
loudly — never silent empty values.

- [ ] **1.1** `mcp.json` schema: `{ servers: { <name>: { command, args, env, cwd } } }` where string values accept `${env:VAR}`.
- [ ] **1.2** Substitution resolver — regex + recursive walk over dict/list/str. Reference implementation: [`kdcllc/agents_config` `app/agents_config/base.py`](https://github.com/kdcllc/agents_config/blob/master/app/agents_config/base.py). ~70 LoC port, idiomatic Python.
- [ ] **1.3** Renderer `scripts/mcp_render.py` emits:
      - `.cursor/mcp.json` (in-project, committed).
      - Windsurf equivalent (in-project, committed).
      - `~/.config/claude-desktop/claude_desktop_config.json` (user-scope, opt-in via `--claude-desktop`).
- [ ] **1.4** Unresolved placeholder → non-zero exit + human-readable report. Never writes partial output.
- [ ] **1.5** Taskfile entries: `task mcp:render` (write) and `task mcp:check` (dry-run, diff).
- [ ] **1.6** Docs: `docs/mcp.md` — schema, `${env:}` usage, worked example, failure modes.
- [ ] **1.7** Tests: fixture `mcp.json` + golden-file assertion per target + unresolved-secret failure path.

## Out of scope

| Feature | Reason |
|---|---|
| Keychain backend (`security`, `secret-tool`) | Add only when asked. `env` covers the vast majority of cases. |
| Bitwarden CLI dependency | Mandatory external tool. Users keep their own secret flow, piped into env. |
| More than 3 targets | Claude Code CLI, Codex, Cline can be added once their MCP shapes stabilize. |
| Reading pre-existing tool configs and diffing | Renderer is one-way: `mcp.json` → output. No round-trip. |
| `${ref:path.to.value}` internal references | Nice-to-have but orthogonal. Add only if a real config needs it. |

## Acceptance

- One `mcp.json` edit produces correct output for Claude Desktop + Cursor + Windsurf.
- Missing `${env:VAR}` → non-zero exit with a named report; no partial files written.
- Running the renderer twice with no source change is a no-op.
- `task ci` green.

## References

- Archived parent (explored & largely rejected): [`archive/road-to-ultimate.md`](archive/road-to-ultimate.md).
- Substitution reference impl: https://github.com/kdcllc/agents_config/blob/master/app/agents_config/base.py
- Source analysis: [`../analysis/compare-kdcllc-agents-config.md`](../analysis/compare-kdcllc-agents-config.md).
- Archived sibling (depth): [`archive/road-to-9.md`](archive/road-to-9.md).
