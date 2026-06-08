---
stability: experimental
---

# Host-Agent Protocol Contract

> **Status** · v0 / inventory · 2026-05-24. The daily workspace shells out to
> a host agent for every model interaction; it never re-implements one. This
> contract names which surfaces each host agent exposes today, where the
> workspace can rely on them, and what the fallback is when a surface is
> missing. Governs ADR-023 / ADR-024 / ADR-025 — see
> [`ADR-022`](../decisions/ADR-022-daily-workspace-decomposition.md).

## Required capabilities

The workspace v0 requires exactly two surfaces from a host agent:

1. **`launch(prompt, skill?, cwd)`** — start a new conversation in the host
   agent with `prompt` pre-filled and (optionally) `skill` pre-selected, in
   the named working directory. Must be invocable from a non-interactive
   shell. Return shape: success / failure; the conversation runs inside the
   host's own UI from there.
2. **`emit_trace(session) → ndjson`** — append-only, structured event stream
   for the running conversation: model id, tool calls, citations,
   explain-trace envelope (per
   [`memory-explain-v1`](memory-explain-v1.md) when memory is involved).
   Must be readable by tail-style consumers without polling the host's UI.

Both surfaces must be **stable** — documented by the vendor, covered by
their semver, not derived from unstable stdout parsing.

## Today's inventory (2026-05-24)

| Host agent | `launch` surface | `emit_trace` surface | Effective tier |
|---|---|---|---|
| **Claude Code (CLI)** | `claude -p "<prompt>" --output-format json` (subprocess; documented). Slash commands resolved against `.claude/commands/`. | JSON envelope on stdout per turn; session id preserved; no live append stream. | **Tier 1** — only host with both surfaces today. |
| **OpenAI Codex CLI** | `codex exec --json` consumes stdin; documented. No slash-command surface (skills not first-class). | NDJSON event stream on stdout — `turn.completed`, `item.completed`, tool envelopes. | **Tier 1**, no skill surface — workspace must pre-render the prompt with skill context inlined. |
| **Gemini CLI** | `gemini --output-format json` consumes stdin; documented. | JSON envelope on stdout per turn. OAuth grant required once. | **Tier 1**, no skill surface (same as Codex). |
| **Augment (IDE)** | None documented. Hook trampolines exist (`scripts/hooks/augment-dispatcher.sh`) — post-event only, cannot initiate a conversation. | None — hook payloads cover events, not model output. | **Tier 3** — observe-only. |
| **Cursor (IDE)** | `cursor://` deep links open files / chats but cannot pre-fill a prompt with skill context from a non-Cursor process. Hooks (`.cursor/hooks.json`) are post-event. | None at the protocol layer. | **Tier 3** — observe-only. |
| **Cline (VS Code ext)** | None. Hooks (`~/Documents/Cline/Hooks/`) are post-event. | None at the protocol layer. | **Tier 3** — observe-only. |
| **Windsurf (Cascade)** | None. Hooks (`.windsurf/hooks.json`) are post-event. | None at the protocol layer. | **Tier 3** — observe-only. |

> **Detection (ADR-068).** This table is mirrored by `HOST_INVENTORY` in
> `src/cli/python/workspace_hosts.py`; `tests/test_workspace_hosts.py` asserts
> the two agree, so this markdown stays the source of truth. `workspace_hosts.py
> detect <id>` returns a host's **effective tier** (its inventory tier, demoted
> to 3 if the Tier-1 CLI is absent from PATH — fail-closed), side-effect-free
> (PATH probe only, never spawns a host CLI). `POST /api/v1/workspace/launch`
> reports it (`effective_tier` / `cli_present` / `mode`); it does **not** drive
> the host (the Tier-1 drive loop is unbuilt).

## Tier definitions

- **Tier 1 — first-class.** Both `launch` and `emit_trace` are stable.
  Workspace can build full features against the host.
- **Tier 2 — degraded.** One of the two surfaces exists; workspace can
  partially drive but degrades a named feature (e.g. no inline citations).
  *(No host agent occupies this tier today.)*
- **Tier 3 — observe-only.** Neither surface exists at the agent boundary.
  The workspace falls back to (a) user-paste of a generated prompt, or (b)
  inbox-file handoff (writes `~/.event4u/agent-config/workspace/inbox/<id>.md`,
  user opens the host themselves). Hook trampolines remain available for
  passive event recording but do not initiate conversations.

## v0 scope

- The workspace v0 ships against **Claude Code** as the single Tier-1 host.
  Codex and Gemini are wired but secondary (no skill surface — see ADR-024).
- Tier-3 hosts get the **inbox handoff** fallback only: workspace writes the
  rendered prompt + skill body into the inbox file and surfaces a one-line
  copy-to-clipboard banner. No tighter integration is attempted in v0.
- The CLI shell-out is the **only** mechanism. No HTTP RPC, no MCP-driven
  agent control, no shared SQLite — those are deferred to v1+ when at least
  one Tier-3 host moves up.

## Stability & change policy

- The vendor-published JSON envelope shapes are the contract. Workspace
  parses by named keys, never by positional fields.
- A new host-agent CLI release that breaks the envelope **fails closed** —
  the workspace surfaces a banner and degrades to Tier 3 (inbox handoff)
  until this contract is updated.
- This file is the source of truth for host-agent tier. Adding a host or
  promoting a tier requires (a) a vendor-link in the inventory row,
  (b) at least one integration test under
  `tests/integration/host-agent-protocol/`.

## Cross-references

- ADR: [`ADR-022`](../decisions/ADR-022-daily-workspace-decomposition.md) ·
  [`ADR-023`](../decisions/ADR-023-host-agent-protocol.md) ·
  [`ADR-024`](../decisions/ADR-024-workspace-v0-feature-floor.md) ·
  [`ADR-025`](../decisions/ADR-025-workspace-chrome.md).
- Skill: [`ai-council`](../../dist/agent-src/skills/ai-council/SKILL.md) — uses
  the same CLI subprocess shape (claude / codex / gemini) for council
  members; the workspace inherits the proven invocation paths.
- Hooks: [`hook-architecture-v1`](hook-architecture-v1.md) — covers the
  post-event surface for all hosts including Tier-3.
- Daily workspace surface: [`daily-workspace`](daily-workspace.md) — UI
  contract that consumes this protocol.
