---
role: galabau
display_name: "Galabau owner"
tagline: "Drafting customer offers and project briefs without a project manager between you and the document."
recommended_packs: [core, content]
install_path_hint: "MCP recommended (Claude Desktop) — no terminal needed. CLI only if you also write code in this repo."
recruit_session_ref: null
status: draft
---

# Role experience — Galabau owner

> Scaffold per `docs/contracts/role-experience.md`. First tasks are seeded from the maintainer's domain hypothesis; recruit-session 01 will replace this seeding with verbatim findings. Status flips to `beta` after the first session lands.

## Persona

You run or co-run a small Garten-und-Landschaftsbau shop. You draft customer offers, customer emails, and project briefs every week — usually after dinner, on the laptop, because the day was on site. You want a writing assistant that knows your tone, holds it across customers, and turns a one-paragraph project sketch into a structured document you can send the next morning without rewriting.

## Three first tasks

1. **Offer drafting from a one-paragraph brief** — turn "neue Terrasse, ~ 40 m², Granitplatten, Kunde will im Mai" into a structured offer with scope, materials, time estimate, payment terms. Prompt: [`prompts/offer-from-brief.md`](prompts/offer-from-brief.md) *(scaffolded in follow-up impl PR)*.
2. **Customer-email reply with the right tone** — paste the customer's e-mail, tell the agent the desired tone (warm-but-firm, neutral, apology), get a reply that reads as if you wrote it on a good day. Prompt: [`prompts/customer-email-reply.md`](prompts/customer-email-reply.md) *(scaffolded in follow-up impl PR)*.
3. **Project-brief refinement before the team meeting** — fuzzy customer notes in, structured project brief with assumptions + open questions out, ready to walk the on-site lead through. Prompt: [`prompts/project-brief-refine.md`](prompts/project-brief-refine.md) *(scaffolded in follow-up impl PR)*.

## Recommended ready-made setups

- **`core`** — the always-on skill kernel: prompt refinement, voice locking, doc co-authoring. Everything below depends on it.
- **`content`** — the editorial-craft setup: tone-by-context matrix, voice-and-tone-design, messaging-architecture. Galabau-relevant because the same offer goes to a private homeowner and to a property-management firm with very different voice expectations.

## Install path

**MCP recommended.** Claude Desktop opens, the package shows up as a tool, no terminal needed. The five-minute install lives at [`docs/mcp.md`](../../../docs/mcp.md). CLI install ([`docs/installation.md`](../../../docs/installation.md)) is the right path only if you also sit in this repo with code-shaped work.

> **Status:** `draft` — the three first tasks above are the maintainer's hypothesis. Recruit-session 01 (`agents/recruit-sessions/01-galabau-owner.md`) will either confirm them or rewrite them. The prompts themselves are deferred to the follow-up impl PR; the scaffold here pins the **shape** so the launcher in Phase 4 can read it. <!-- ref-ignore -->
