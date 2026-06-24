---
complexity: structural
status: draft
parent_roadmap: road-to-product-clarity
---

# Road to product bets — simple/expert mode, explainability, connectors

> **Draft — deferred product bets from `road-to-product-clarity`.** A 2-round AI
> council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-06-24) reviewed the
> product-clarity scope and **deferred** these as genuine product bets that must
> not be half-built. Each needs its own evidence / decision before promotion to
> `ready`. `road-to-product-clarity` shipped the cheap process wins; these wait.

## Phase 1 — Simple / Expert mode

> Council: **DEFER**. No N=2 evidence that rule-count is the adoption blocker
> (vs unclear value prop or install ceremony). The "profile subset vs UX layer"
> fork itself shows the problem is undefined; a UX layer risks the "no runtime"
> constraint. Promote only with a real demand signal.

- [ ] **1.1 — Gather evidence** — ≥1 credible user signal that the rule/surface count (not value prop / install) is the blocker. Without it, do not build.
- [ ] **1.2 — If evidenced** — decide reduced-profile (map to existing `balanced`/`full`) vs UX layer; build the profile path only (no runtime).

## Phase 2 — Subagent explainability (full)

> Council: a **minimal** durability line already shipped in product-clarity
> (subagent-boundary: return carries why+evidence in the artefact). The fuller
> cross-session audit linkage is deferred.

- [ ] **2.1 — Cross-session reasoning linkage** — a durable, host-independent path from a downstream artefact back to the upstream subagent's why (without reassembling provider chat logs). Decide the file/contract shape first.

## Phase 3 — Knowledge connectors (Jira/Confluence/GitHub/Drive/CRM)

> Council: **DEFER**. Gated by `domain-adoption-policy` (demand · named owner ·
> CI). No gate is cleared; a connector without an adopter is maintenance debt.

- [ ] **3.1 — Clear the three adoption gates** for one connector (named adopter + owner + CI), then pilot that one end-to-end (MCP-first) before generalizing.

## Phase 4 — Pre-release consumer-install smoke

> Council: **DECIDE-THEN-BUILD** — "consumer = what?" is undecided (npx-into-temp
> vs a fixture project vs a matrix). Decide the consumer definition, then build.

- [ ] **4.1 — Decide the consumer shape** + build a single smoke (clean install → assert the install surface) before tagging a release.

## Acceptance criteria (per phase, on promotion to ready)

- Each phase promotes to `ready` only with its evidence/decision recorded.
- No runtime layer; profile/contract paths only.
- Connectors pass `domain-adoption-policy`; pilot N=1 before generalizing.
