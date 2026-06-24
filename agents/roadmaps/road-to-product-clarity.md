---
complexity: structural
status: draft
---

# Road to product clarity — simple/expert mode, explainability, connectors

> **Draft.** The larger product/UX bets from the 7.1.0 reviewer feedback
> (`agents/tmp/legal-and-feedback.txt`). Held as `draft` (hidden from the
> dashboard) because each is a real product decision that wants its own AI-council
> round before execution — unlike the legal + governance roadmaps, these are not
> yet council-resolved. Promote to `ready` per-phase as decisions land.

## Phase 1 — Simple / Expert mode

> Recurring P0: the suite is powerful but overwhelming for non-power-users; the
> full kernel + router + packs surface intimidates newcomers.

- [ ] **1.1 — Decide the axis** (council) — is "simple mode" a reduced profile (fewer always-on rules + a curated pack set) or a UX layer over the same engine? Resolve before building.
- [ ] **1.2 — Define the two modes** — simple = minimal kernel + 1–2 packs + plain-language prompts; expert = current full surface. Map onto existing profiles (`balanced`/`full`) where possible rather than a new mechanism.
- [ ] **1.3 — Wizard wiring** — mode selection in the setup wizard; persisted to settings.

## Phase 2 — Subagent explainability

> Reviewers: when a subagent/workflow runs, the user can't see *why* it did what
> it did. Surface the reasoning trail (within the notes-first / reasoning-in-notes
> discipline — conclusions + evidence to the user, not raw chain-of-thought).

- [ ] **2.1 — Decide the surface** (council) — post-hoc "what each agent concluded + which artefacts it consulted" summary vs a live trace. Respect `reasoning_extraction` constraints.
- [ ] **2.2 — Implement** the chosen explainability surface for Agent/Workflow runs.

## Phase 3 — Knowledge connectors

> P1: connect the suite to where teams actually keep knowledge (Jira/Confluence,
> GitHub, Drive, CRM). Existing watch-note: `enterprise-knowledge-connectors`.

- [ ] **3.1 — Scope** (council + domain-adoption-policy gates) — which connectors clear the 3 adoption gates (demand, owner, CI). MCP-first (reuse existing MCP surface) vs bespoke.
- [ ] **3.2 — Pilot one connector** end-to-end as the N=1 before generalizing.

## Phase 4 — Release-story & process hardening

> Smaller process gaps reviewers flagged; can land independently of the bigger bets.

- [ ] **4.1 — Curated release story** — a human-readable "what changed + why it matters" per release (the `benchmark.md` summary + changelog curation), not just the raw changelog.
- [ ] **4.2 — Branch protection + trunk-drift pre-PR hook** — codify the main-protection already enforced socially; a pre-PR check that the branch isn't behind origin/main (the recurring drift this session hit).
- [ ] **4.3 — Version single-source** — confirm one authoritative version origin; lint any duplication.
- [ ] **4.4 — Pre-release consumer-install smoke** — an automated `npx`/install smoke against a clean consumer before tagging.

## Acceptance criteria (per-phase, on promotion to ready)

- Each phase's design decision is council-resolved before its build steps run.
- Simple/expert mode reuses existing profiles where possible (no new orthogonal mechanism).
- Explainability respects the reasoning-in-notes discipline.
- Connectors pass the domain-adoption gates; pilot N=1 before generalizing.
