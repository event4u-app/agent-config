---
adr: 022
status: accepted
date: 2026-05-24
decision: daily-workspace-decomposition
supersedes: —
superseded_by: —
phase: v3.x · employee-product-and-external-proof Phase 4
type: forward-looking
---

# ADR-022 — Daily workspace — decomposition

## Status

**Accepted** · 2026-05-24. Phase 4 Step 1 of
[`road-to-employee-product-and-external-proof.md`](../../agents/roadmaps/road-to-employee-product-and-external-proof.md).
Records the council's verdict on the original "workspace shape"
question — that the question was malformed — and replaces a single
chrome decision with three sequenced sub-decisions.

The numeric reservation note in
[`ADR-021`](ADR-021-deployment-shape.md) (ADRs 022–025 held for the
internal-AI-OS-deployment roadmap) is retired: that roadmap is
archived ([`agents/roadmaps/archive/road-to-internal-ai-os-deployment.md`](../../agents/roadmaps/archive/road-to-internal-ai-os-deployment.md))
and the active strategy after release `3.1.1` is the
employee-product / external-proof roadmap. ADR-022 claims the
number under the new strategy.

Companion artefacts:

- Roadmap: [`agents/roadmaps/road-to-employee-product-and-external-proof.md`](../../agents/roadmaps/road-to-employee-product-and-external-proof.md)
- Council question: [`agents/decisions/open-questions/daily-workspace-shape.md`](../../agents/decisions/open-questions/daily-workspace-shape.md)
- Council verdict: `agents/runtime/council/responses/daily-workspace-shape.json` (gitignored) <!-- council-ref-allowed: ADR decision trace -->
- Predecessor ADRs: [`ADR-014`](ADR-014-gui-framework-choice.md) (installer chrome), [`ADR-016`](ADR-016-installer-architecture.md) (installer architecture), [`ADR-020`](ADR-020-global-only-consumer-scope.md) (consumer scope).

## Context

Phase 4 of the post-`3.1.1` roadmap proposes a persistent daily
workspace — left rail (role + task launcher), centre pane (active
conversation with the host agent), right rail (knowledge sources +
explain-trace) — as the missing daily-use surface for non-developer
roles (galabau owner, content creator, consultant).

The original Step 1 framed the decision as a four-way chrome pick:
extend the GUI installer · separate Electron/Tauri app · browser tab
· TUI-first. The council was asked to choose one.

## What the council said

Both council members (claude-sonnet-4-5, gpt-4o) **rejected the
question as malformed** after a two-round debate. The convergent
verdict, in their own words:

> *"The ADR masquerades as a UI choice when it is actually three
> entangled, unsequenced decisions: (1) the protocol boundary to
> host agents, (2) the v0 feature scope that validates 'non-developers
> prefer this', (3) the chrome that wraps that scope."*
> — Anthropic

> *"Without a stable, documented protocol between the workspace and
> host agents, the ADR's proposition lacks substance and could be
> shelved until a reliable, documented, and tested protocol is
> defined."* — OpenAI

The load-bearing critique is that the workspace contract requires
two capabilities the host agents (Claude Code, Augment, Cursor,
Cline, Windsurf) have not been confirmed to expose:

1. A stable RPC / IPC surface for **launching a conversation with a
   pre-filled prompt + pre-selected skill** (not just CLI flags that
   drift per Hyrum's Law).
2. Structured **explain-trace emission** (not "parse stdout and hope").

Until both are proven for at least one host agent, no chrome option
can be implemented — each inherits the same fatal coupling risk.

## Decision

Split Phase 4 Step 1 into three sequential sub-decisions, each its
own ADR:

1. **ADR-023 — Host-agent protocol contract** *(blocking)*. Inventory
   the surface each named host agent exposes today, name the
   fallback for missing surfaces, write `docs/contracts/host-agent-protocol.md`.
   Status today: **drafted, not started**.
2. **ADR-024 — Workspace v0 feature floor** *(depends on ADR-023)*.
   Define the minimum viable shell that recruit-session participants
   can evaluate. Pare back from "left rail + centre pane + right rail"
   to whatever the protocol from ADR-023 can actually drive end-to-end.
3. **ADR-025 — Workspace chrome** *(depends on ADR-024)*. The original
   four-way pick (installer-extension · Electron/Tauri · browser tab ·
   TUI), narrowed by what ADR-024 needs and what ADR-023 makes
   feasible.

The roadmap is updated accordingly: Phase 4 grows two new gating
steps (ADR-023 + ADR-024) ahead of the chrome decision. The
"≤ 6 weeks for one engineer" budget assumption from the original
roadmap is preserved as a working figure — both council members
flagged it as ambitious. ADR-024 will tighten it.

## Consequences

**Positive**

- The blocking risk (host-agent protocol feasibility) is surfaced
  as its own ADR with its own go/no-go gate, not buried under a
  chrome debate.
- Phase 4 cannot accidentally ship a chrome built on an unproven
  integration substrate.
- Recruit sessions (Phase 1) get a clearer signal of *what* to
  validate: "does the v0 feature floor solve the daily-use gap?"
  rather than "do you prefer this UI?"

**Negative**

- Phase 4 ships two additional ADRs before any code lands. Adds
  governance overhead; the autonomous-execution rule narrows the
  ask-tax but doesn't remove it.
- The chrome decision (ADR-025) is deferred at least one council
  round behind ADR-023 + ADR-024.

**Reversal cost** — low. If ADR-023 proves the protocol is trivially
stable, ADR-024 can collapse to a one-line "we re-adopt the
original v1 scope" decision and ADR-025 proceeds against the
original four-way pick.

## Open questions (next-ADR-deferred)

- Whether the host-agent protocol investigation should be
  council-gated again or treated as a research artefact (ADR-023
  will say).
- Whether "host agent" remains plural or narrows to one supported
  host for v0 (ADR-024 will say).

## Cross-references

- Council question file: [`agents/decisions/open-questions/daily-workspace-shape.md`](../../agents/decisions/open-questions/daily-workspace-shape.md)
- Role identity scaffolds (Phase 3 output): [`agents/roles/`](../../agents/roles/)
- Knowledge-ingestion contract (Phase 2 input): [`docs/contracts/local-knowledge-ingestion.md`](../contracts/local-knowledge-ingestion.md)
