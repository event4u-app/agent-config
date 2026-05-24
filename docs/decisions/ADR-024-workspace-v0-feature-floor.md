---
adr: 024
status: accepted
date: 2026-05-24
decision: workspace-v0-feature-floor
supersedes: —
superseded_by: —
phase: v3.x · employee-product-and-external-proof Phase 4
type: forward-looking
---

# ADR-024 — Workspace v0 feature floor

## Status

**Accepted** · 2026-05-24. Second of three sub-ADRs created by
[`ADR-022`](ADR-022-daily-workspace-decomposition.md), depends on
[`ADR-023`](ADR-023-host-agent-protocol.md). Locks the minimum
viable shell that recruit-session participants will evaluate.

## Context

The original Phase 4 roadmap proposed a three-rail workspace (role
launcher · conversation pane · knowledge-source rail) with persistent
session history, citations, explain-trace, and per-user document
store. The council flagged this as unachievable in the stated ≤ 6
weeks given a single-engineer budget — and observed that the
recruit-session signal (Phase 1) is not yet collected, so the v0
scope cannot be over-fitted to assumed user needs.

ADR-023 narrows the host-agent surface to Tier-1 CLI shell-out
(Claude Code, Codex, Gemini) plus a Tier-3 inbox-handoff fallback.
The v0 floor must be the smallest surface that exercises both tiers
end-to-end so the recruit sessions can falsify the workspace
premise.

## Decision

The v0 ships **three features only**:

### 1. Role-keyed task launcher

- Reads `agents/roles/<role>/skills.yml` + per-role prompts directory.
- One-click launcher: pick role → pick task → renders the prompt
  with skill context inlined (so it works on Codex / Gemini too).
- Routes to the active host:
  - **Tier 1** → spawns `claude -p` / `codex exec` / `gemini` subprocess
    per [`ADR-023`](ADR-023-host-agent-protocol.md).
  - **Tier 3** → writes the rendered prompt into the inbox file and
    surfaces a copy-to-clipboard banner.
- No skill execution happens inside the workspace itself.

### 2. Per-user conversation log

- Single append-only JSONL per session at
  `~/.event4u/agent-config/workspace/sessions/<yyyy-mm-dd>/<session-id>.jsonl`.
- Captures: launcher input (role, task, rendered prompt), host-agent
  envelope output (Tier 1) or inbox-handoff marker (Tier 3),
  timestamps. No PII in filenames. Encryption deferred.
- No remote sync. No cross-user view. Local-only.

### 3. Knowledge-pane stub

- Reads from the Phase 2 `knowledge:` memory namespace (when
  populated) and renders source citations *next to* the launcher
  output. Does **not** parse Tier-1 envelopes for inline citations
  in v0 — that's a v1 ask.
- When the knowledge namespace is empty, the pane shows a
  one-line "no sources yet" message and links to the
  ingestion contract.

### Hard cuts from the original Phase 4 scope

The following are **deferred** to v1+ and explicitly out of scope
for v0:

- Inline citations inside the conversation pane.
- Plain-mode explain-trace (Phase 6 dependency; reads same JSON
  envelope but is its own surface).
- Document-store integration (Phase 5; would force a v0 schema
  decision before recruit sessions inform it).
- Multi-host concurrency (one host CLI at a time per workspace).
- Accessibility audit (deferred to post-recruit-session because the
  chrome decision in ADR-025 changes the surface).

### Budget

- Single engineer, **8 weeks** (revised from the original 6 weeks
  per the council critique). Stretch goal: 6 weeks if recruit
  sessions defer the knowledge-pane stub.

## Consequences

**Positive**

- Smallest possible surface that exercises the Tier-1 + Tier-3
  protocol split. Recruit-session signal is interpretable.
- Codex / Gemini work end-to-end via inlined skill context — no host
  is structurally excluded.
- The three artefacts (launcher, JSONL log, knowledge stub) are
  testable in isolation and ship-able incrementally.

**Negative**

- Phase 5 (documents) and Phase 6 (plain-mode explain) cannot start
  until v0 lands. Three months of strict sequencing.
- "No inline citations" will read as a regression vs the original
  roadmap pitch; needs to be flagged in recruit-session prep.
- The inbox-handoff fallback is rough by design; Tier-3 users will
  feel second-class until v1.

**Reversal cost** — low. The three features are decoupled; any can
be dropped or expanded without rewriting the others.

## Open questions (next-ADR-deferred)

- The chrome: browser-tab against installer GUI · Electron / Tauri ·
  TUI-first. ADR-025 answers, informed by what these three features
  actually need from a UI.

## Cross-references

- Predecessor ADRs: [`ADR-022`](ADR-022-daily-workspace-decomposition.md), [`ADR-023`](ADR-023-host-agent-protocol.md).
- Knowledge ingestion contract: [`docs/contracts/local-knowledge-ingestion.md`](../contracts/local-knowledge-ingestion.md).
- Role experience contract: [`docs/contracts/role-experience.md`](../contracts/role-experience.md).
- Roadmap: [`agents/roadmaps/road-to-employee-product-and-external-proof.md`](../../agents/roadmaps/road-to-employee-product-and-external-proof.md) Phase 4.
