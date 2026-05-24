---
adr: 023
status: accepted
date: 2026-05-24
decision: host-agent-protocol
supersedes: —
superseded_by: —
phase: v3.x · employee-product-and-external-proof Phase 4
type: forward-looking
---

# ADR-023 — Host-agent protocol — CLI shell-out, three-tier fallback

## Status

**Accepted** · 2026-05-24. First of three sub-ADRs created by
[`ADR-022`](ADR-022-daily-workspace-decomposition.md). Locks the
protocol boundary between the daily workspace and the host agents
(Claude Code, Codex, Gemini, Augment, Cursor, Cline, Windsurf,
others). ADR-024 and ADR-025 follow this decision.

Companion artefacts:

- Contract: [`docs/contracts/host-agent-protocol.md`](../contracts/host-agent-protocol.md)
- Council question: [`agents/decisions/open-questions/daily-workspace-shape.md`](../../agents/decisions/open-questions/daily-workspace-shape.md)
- Predecessor ADR: [`ADR-022`](ADR-022-daily-workspace-decomposition.md)

## Context

The council critique on the original Phase 4 chrome question
identified the host-agent protocol as the blocking unknown. The
workspace must (a) launch a conversation in the host with a
pre-filled prompt and (optionally) a pre-selected skill, and (b)
read structured tool / model output back without parsing the host's
UI. Either capability missing forces the workspace into "render a
banner and ask the user to paste" territory.

The inventory in `host-agent-protocol.md` enumerates what each
named host agent exposes today. The convergent finding:

- **Claude Code, Codex, Gemini** — first-party CLIs with documented
  stdin / stdout JSON envelopes. Both surfaces present, with caveats.
- **Augment, Cursor, Cline, Windsurf** — IDE / extension hosts. Hook
  trampolines exist for post-event observation but neither surface
  exists at the protocol layer.

No vendor-stable RPC, MCP-driven agent control, or shared SQLite
exists across this set. Building against any single non-CLI host
locks the workspace to one IDE; building against the CLI set covers
the most users without vendor coordination.

## Decision

Adopt a **CLI shell-out protocol** as the workspace's only
host-agent integration mechanism in v0, with a **three-tier**
fallback policy:

### Tier 1 — first-class CLI host

Workspace spawns `claude -p "<prompt>" --output-format json` (or the
Codex / Gemini equivalent) as a subprocess. The JSON envelope is the
contract; parsing is by named keys; session id is preserved across
turns. Claude Code is the only Tier-1 host with a stable
skill-resolution surface today.

### Tier 2 — degraded CLI host

Reserved for hosts that gain one of the two surfaces but not both
(e.g. launch with no trace, or trace with no launch). No host
occupies this tier today; the slot exists so vendor changes don't
force a binary tier 1 / tier 3 reclassification.

### Tier 3 — observe-only host (inbox handoff)

For hosts without either surface (Augment, Cursor, Cline, Windsurf,
JetBrains, others), the workspace writes the rendered prompt + skill
context into `~/.event4u/agent-config/workspace/inbox/<id>.md` and
surfaces a one-line copy-to-clipboard banner. The user opens the
host themselves. No tighter integration is attempted in v0. Hook
trampolines (`scripts/hooks/*-dispatcher.sh`) remain available for
passive recording but do not initiate conversations.

### Stability & fail-closed

A host-agent CLI release that breaks the JSON envelope demotes the
host to Tier 3 with a workspace banner until
[`host-agent-protocol.md`](../contracts/host-agent-protocol.md) is
updated. No silent stdout reparse, no positional-key fallback.

## Consequences

**Positive**

- The workspace can ship against the existing CLI surface today; no
  vendor coordination required.
- Tier-3 hosts get a documented, honest fallback rather than a
  half-built integration that breaks under the next vendor release.
- The protocol surface is small enough to test end-to-end in CI
  (subprocess + JSON parse).

**Negative**

- IDE / extension hosts are second-class until vendors expose a
  launch / trace surface. The workspace cannot drive Cursor or
  Augment in v0 except via inbox handoff.
- Codex and Gemini are Tier 1 but lack skill resolution; the
  workspace must pre-render skill context into the prompt body.
  ADR-024 covers this.
- The session-state model is per-host: closing the workspace mid-turn
  does not stop the host CLI subprocess.

**Reversal cost** — low at the protocol layer (the contract file is
single-source); medium at the workspace if features have been built
against assumed Tier-1 capabilities for hosts that drop a surface.

## Open questions (next-ADR-deferred)

- v0 floor: which features survive in the no-skill-surface case
  (Codex / Gemini)? ADR-024 will answer.
- Chrome: does the workspace ship as a browser tab against the
  installer GUI, an Electron / Tauri app, or a TUI? ADR-025 will
  answer, informed by what ADR-024 demands.

## Cross-references

- Protocol contract: [`docs/contracts/host-agent-protocol.md`](../contracts/host-agent-protocol.md)
- Council CLI precedent: [`ai-council` skill](../../.agent-src/skills/ai-council/SKILL.md) — same subprocess + JSON-envelope pattern, in production.
- Hook architecture: [`docs/contracts/hook-architecture-v1.md`](../contracts/hook-architecture-v1.md) — Tier-3 observe-only surface.
- Predecessor ADR: [`ADR-022`](ADR-022-daily-workspace-decomposition.md).
