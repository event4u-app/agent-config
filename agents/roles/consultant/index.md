---
role: consultant
display_name: "Consultant / advisor"
tagline: "Client briefs, investor memos, and deck outlines — refined before the meeting, not rewritten after."
recommended_packs: [core, founder-strategy, content]
install_path_hint: "MCP recommended (Claude Desktop) — no terminal needed. CLI when you keep a working repo of client artefacts."
recruit_session_ref: null
status: draft
---

# Role experience — Consultant / advisor

> Scaffold per `docs/contracts/role-experience.md`. The consultant role sits at the intersection of strategy work (founder-strategy pack) and writing discipline (content pack); the scaffold pins both. Recruit-session 03 will replace the seeded first tasks with verbatim findings.

## Persona

You advise founders, exec teams, or investment committees. Your week is a switching cost between client briefs, internal investor memos, board-deck outlines, and the occasional competitive-positioning audit. You need defensible reasoning more than depth-first specialist output — the deliverable has to survive a partner-meeting cross-examination. You spend most of your time in Claude Desktop / a writing surface, not in a code editor.

## Three first tasks

1. **Client-brief refinement before the kickoff call** — fuzzy intake form in, structured brief with assumptions surfaced and open questions enumerated out, ready to walk the client through. Prompt: [`prompts/client-brief-refine.md`](prompts/client-brief-refine.md) *(scaffolded in follow-up impl PR)*.
2. **Investor memo from a draft thesis** — paste the one-paragraph thesis + the two strongest objections you anticipate, get a memo that addresses the objections head-on before they're raised. Prompt: [`prompts/investor-memo.md`](prompts/investor-memo.md) *(scaffolded in follow-up impl PR)*.
3. **Deck outline from a board ask** — "the board wants a 20-minute view on X" in, structured outline (problem → evidence → options → recommendation → risks) out, with the speaker notes the partner needs. Prompt: [`prompts/deck-outline.md`](prompts/deck-outline.md) *(scaffolded in follow-up impl PR)*.

## Recommended packs

- **`core`** — prompt refinement, doc co-authoring, customer-research. Always on.
- **`founder-strategy`** — competitive-positioning, fundraising-narrative, market-entry-analysis, unit-economics-modeling. The reasoning kernel for advisory work.
- **`content`** — voice-and-tone-design, messaging-architecture. The writing scaffolding so the memo reads as the consultant, not as a generic LLM.

## Install path

**MCP recommended.** Claude Desktop is the lowest-friction entry; no terminal required. See [`docs/mcp.md`](../../../docs/mcp.md). CLI is the right path if you keep a versioned repo of client artefacts and want commit history on every memo iteration.

> **Status:** `draft` — the three first tasks above are the maintainer's hypothesis, derived from the founder-strategy pack's existing skill set. Recruit-session 03 will validate them against what consultants actually reach for first. Prompts deferred to the follow-up impl PR.
