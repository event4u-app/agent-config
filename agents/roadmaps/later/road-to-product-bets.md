---
complexity: structural
status: later
parent_roadmap: road-to-product-clarity
---

# Road to product bets — simple/expert mode, explainability, connectors

> **Blocked until:** a real external user signal naming rule count or surface
> count as the adoption blocker is recorded under `agents/evidence/`.
> **Why this half:** blocker `simple-expert-mode-demand-evidence` gates Phase 1
> on exactly that artefact, and Phase 3's own gate — a named external adopter
> under `domain-adoption-policy` — cannot be produced from this tree either.
> Naming both would be a conjunction the resume probe cannot read; the evidence
> artefact is the one a script can test. Parked 2026-08-19 by
> `road-to-estate-drawdown` Phase 2 batch 1, verdict PARK-PROBEABLE.

> **Parked — deferred product bets from `road-to-product-clarity`.** A 2-round AI
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

## Blockers

### blocker: simple-expert-mode-demand-evidence
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 1 — Simple / Expert mode
- **What to do:**
  1. Collect at least one credible user signal that the *rule/surface count*
     itself — not an unclear value proposition or install friction — is what
     stops adoption. A support ticket, a user quote, or a churn-interview
     note naming rule count specifically all count; a hunch does not.
  2. Record the signal inline in Phase 1 (quote + source + date).
  3. Only then flip `1.1` to done and start `1.2` (reduced-profile vs UX
     layer decision).
- **Resolved when:** Phase 1 step `1.1` carries a cited, credible signal
  naming rule/surface count as the adoption blocker.

**Note:** this roadmap is `status: draft` and stays hidden from the
dashboard until promoted to `ready` — see `road-to-blocker-visibility.md`
Phase 3 sweep. Phases 2–4 carry their own softer "Council: DEFER /
DECIDE-THEN-BUILD" scoping gates in prose; only Phase 1's gate is crisp
enough (a single named evidence signal) to warrant the structured form.
