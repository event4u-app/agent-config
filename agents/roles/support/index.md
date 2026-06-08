---
role: support
display_name: "Support agent"
tagline: "Summarise the ticket, draft the reply, flag the escalation — without rewriting the customer's words."
recommended_packs: [core, content]
install_path_hint: "MCP recommended (Claude Desktop) — no terminal needed."
recruit_session_ref: null
status: beta-internal
---

# Role experience — Support agent

> Scaffold per `docs/contracts/role-experience.md`. First tasks are the
> maintainer's hypothesis for a B2B SaaS support team until a real
> recruit-session validates them. Promoted to `beta-internal` on an
> internal-authoring basis (see
> [`agents/roles/EVIDENCE_BASIS.md`](../EVIDENCE_BASIS.md)); a
> support-shaped recruit-session is optional and would upgrade it to `beta`.

## Persona

You answer tickets — usually under SLA, often as the only person on a thread that turned into eight back-and-forth messages over two weeks. You want an assistant that summarises the thread before you reply, drafts the reply in your voice without inventing facts, and flags the moment the case crosses the escalation line so engineering or the AM sees it early.

## Three first tasks

1. **Summarise a ticket thread** — paste the full thread, get a 5-line summary covering: who is asking, what's been agreed, what's still open, what the customer's last ask was, what they sound like emotionally. Prompt: [`prompts/summarise-ticket-thread.md`](prompts/summarise-ticket-thread.md).
2. **Draft a reply in the team voice** — paste the customer's last message + the desired tone (warm-but-firm / neutral / apology), get a reply that names what's solved, what's open, and what the next step is. No hallucinated commitments. Prompt: [`prompts/draft-reply.md`](prompts/draft-reply.md).
3. **Escalation-risk analysis** — paste the thread, get a flag if any of: SLA breach risk, named exec stakeholder mentioned, churn-signal language, regulatory / compliance trigger. Each flag links to the next move. Prompt: [`prompts/escalation-risk-analysis.md`](prompts/escalation-risk-analysis.md).

## Recommended ready-made setups

- **`core`** — prompt refinement, voice locking, doc co-authoring. Always on.
- **`content`** — voice-and-tone-design, customer-research. Support replies need a defended voice across thousands of tickets.

## Install path

**MCP recommended.** Claude Desktop opens, the package shows up as a tool, no terminal. See [`docs/mcp.md`](../../../docs/mcp.md).

> **Status:** `draft` — the three first tasks above are the maintainer's hypothesis; recruit-session for a support agent will rank them against what they reach for first.
