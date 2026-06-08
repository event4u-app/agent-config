---
role: leadership
display_name: "Team leader"
tagline: "Summarise weekly status, write the risk memo, structure the decision before the meeting."
recommended_packs: [core, content, founder-strategy]
install_path_hint: "MCP recommended (Claude Desktop) — no terminal needed."
recruit_session_ref: null
status: beta-internal
---

# Role experience — Team leader

> Scaffold per `docs/contracts/role-experience.md`. First tasks reflect
> the leadership-shaped writing the maintainer hears from peers: status
> summaries before the leadership meeting, risk memos before the
> decision, decision records after the decision. Promoted to
> `beta-internal` on an internal-authoring basis (see
> [`agents/roles/EVIDENCE_BASIS.md`](../EVIDENCE_BASIS.md)); a
> leadership-shaped recruit-session is optional and would upgrade it to `beta`.

## Persona

You run a team or a function. Each week you write the same three things: a status summary for whoever you report to, a risk memo for the call that's about to be made, and a decision record after the call so the team can act on it. You want an assistant that turns fuzzy notes into structured documents — without inventing certainty you do not have.

## Three first tasks

1. **Weekly status summary** — paste the week's notes (Slack threads, meeting takeaways, blockers), get a 1-page summary structured as: what shipped, what's at risk, what changed about the plan, what you need from the reader. Prompt: [`prompts/weekly-status-summary.md`](prompts/weekly-status-summary.md).
2. **Risk-analysis memo** — paste a one-paragraph context + the decision on the table, get a structured memo with three frames (best case, base case, downside), the named bet, and the inversion check ("this fails if X"). Prompt: [`prompts/risk-analysis-memo.md`](prompts/risk-analysis-memo.md).
3. **Decision-record draft** — paste the discussion notes + the decision made, get an ADR-shaped draft (status, context, decision, consequences, alternatives, references) ready to drop into `docs/decisions/` or your team's record system. Prompt: [`prompts/decision-record-draft.md`](prompts/decision-record-draft.md).

## Recommended ready-made setups

- **`core`** — prompt refinement, doc co-authoring, decision-record. Always on for any leadership writing.
- **`content`** — voice-and-tone-design, messaging-architecture. Leadership writing carries the team voice into upward and outward audiences.
- **`founder-strategy`** — adr-create, stakeholder-tradeoff, scenario-modeling. The frame-the-trade-off skills.

## Install path

**MCP recommended.** Claude Desktop opens, the package shows up as a tool, no terminal. See [`docs/mcp.md`](../../../docs/mcp.md).

> **Status:** `draft` — the three first tasks above are the maintainer's hypothesis; a leadership-shaped recruit-session will rank them against what gets reached for first.
