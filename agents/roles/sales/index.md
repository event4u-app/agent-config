---
role: sales
display_name: "Sales rep"
tagline: "Answer customer questions, draft offers, and prep discovery calls — voice-locked, structured, fast."
recommended_packs: [core, content, gtm-launch]
install_path_hint: "MCP recommended (Claude Desktop) — no terminal needed. CLI when your team owns custom CRM integrations."
recruit_session_ref: null
status: beta-internal
---

# Role experience — Sales rep

> Scaffold per `docs/contracts/role-experience.md`. First tasks are the
> maintainer's hypothesis for a B2B SaaS / services-team sales rep
> until a real recruit-session validates them. Promoted to
> `beta-internal` on an internal-authoring basis (see
> [`agents/roles/EVIDENCE_BASIS.md`](../EVIDENCE_BASIS.md)); a
> sales-shaped recruit-session is optional and would upgrade it to `beta`.

## Persona

You sell — usually with the deal half in your head and half in scattered notes from the last three meetings. You spend your day answering customer questions, drafting offers, and prepping discovery calls under time pressure. You want an assistant that holds the deal's voice, surfaces what the buyer already told you, and turns a one-paragraph brief into a ready-to-send draft.

## Three first tasks

1. **Answer a customer question with the right context** — paste the inbound message + a short note on what's already been agreed, get a reply that names the open question and proposes the next step without overcommitting. Prompt: [`prompts/answer-customer.md`](prompts/answer-customer.md).
2. **Draft an offer from a one-paragraph brief** — turn "Kunde will Paket A für 12 Monate, Discount ~ 10 %" into a structured offer with scope, deliverables, term, payment cadence, and an "out clause" the customer can live with. Prompt: [`prompts/draft-offer.md`](prompts/draft-offer.md).
3. **Prep a discovery call** — paste the LinkedIn + company-website excerpt, get a 5-question discovery deck plus three "what's the pain we're not seeing" probes. Prompt: [`prompts/prep-discovery-call.md`](prompts/prep-discovery-call.md).

## Recommended ready-made setups

- **`core`** — prompt refinement, voice locking, doc co-authoring. Always on for any drafting role.
- **`content`** — voice-and-tone-design, messaging-architecture. Sales-relevant because the same offer needs three different voices for buyer, procurement, and exec sponsor.
- **`gtm-launch`** — `competitive-positioning`, `funnel-analysis`, `customer-research`. The buyer-context scaffolding.

## Install path

**MCP recommended.** Claude Desktop opens, the package shows up as a tool, no terminal. See [`docs/mcp.md`](../../../docs/mcp.md). CLI install is for the engineer side of the team only.

> **Status:** `draft` — the three first tasks above are the maintainer's hypothesis; recruit-session for a sales rep will rank them against what they actually reach for first.
