---
name: copilot-agents
description: "[DEPRECATED 2026-05-09] Use /agents — routes init/optimize to the new /agents cluster."
superseded_by: agents
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Deprecation shim — surface /agents instead."
---

# /copilot-agents — DEPRECATED

> ⚠️  **This command was retired on 2026-05-09.** The `AGENTS.md` file
> family moved to the [`/agents`](agents.md) cluster. This file remains
> for one release as a routing shim; remove after the next minor bump.

## Migration

| Old invocation | New invocation |
|---|---|
| `/copilot-agents init` | [`/agents init`](agents/init.md) |
| `/copilot-agents optimize` | [`/agents optimize`](agents/optimize.md) |
| `/copilot-agents` (no sub) | [`/agents`](agents.md) (no sub) |

## Behavior when invoked

1. Emit a single-line warning:

   ```
   ⚠️  /copilot-agents is deprecated; use /agents instead.
   ```

2. Map the sub-command verbatim:
   - `init` → load [`commands/agents/init.md`](agents/init.md) and follow its `## Instructions`.
   - `optimize` → load [`commands/agents/optimize.md`](agents/optimize.md) and follow its `## Instructions`.
   - anything else (or empty) → load [`commands/agents.md`](agents.md) and let its dispatch handle the menu.

3. Do **not** announce the rename more than once per turn. The redirect
   is silent after the first warning.

## Why the rename

The old `/copilot-agents` namespace implied tool-specific (GitHub
Copilot) coupling. `AGENTS.md` is the universal contract for every
agent surface (Claude Code, Cursor, Cline, Windsurf, Augment, Gemini,
Codex). The new `/agents` cluster carries that semantics; the
`copilot-instructions.md` stub is still emitted by `/agents init` and
synced by `/agents optimize` — only the entry-point name changed.

## See also

- [`/agents`](agents.md) — current cluster (`init` · `optimize` · `audit`).
- [`docs/contracts/command-clusters.md`](../docs/contracts/command-clusters.md) — migration table + locked cluster surface.
- [`agents-md-thin-root`](../skills/agents-md-thin-root/SKILL.md) — Thin-Root contract enforced by `/agents optimize`.
