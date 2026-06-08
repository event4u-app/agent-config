---
role: content-creator
display_name: "Content creator"
tagline: "From a one-line idea to a stitched short — voice-locked, character-locked, provider-agnostic."
recommended_packs: [core, content, ai-video]
install_path_hint: "MCP recommended (Claude Desktop) — no terminal needed. CLI when you sit in a code repo for adapter work."
recruit_session_ref: null
status: beta-internal
---

# Role experience — Content creator

> Scaffold per `docs/contracts/role-experience.md`. The AI-video pipeline is the most differentiated surface of the package; this scaffold pins the role's shape so the launcher in Phase 4 reads it. Promoted to `beta-internal` on an internal-authoring basis (see [`agents/roles/EVIDENCE_BASIS.md`](../EVIDENCE_BASIS.md)); recruit-session 02 is optional and would upgrade it to `beta`, replacing the seeded first tasks with verbatim findings.

## Persona

You ship short-form video, marketing copy, or release announcements — solo, or with a small team. You hold a defined brand voice across surfaces (newsletter, social, video) and you spend most of your time in Claude Desktop / ChatGPT, not in a terminal. The package gives you a cinematic-blueprint pipeline (12-block scene plan, character lock, provider-agnostic prompts) plus the editorial scaffolding the writing side needs.

## Three first tasks

1. **One-line idea → 4-shot storyboard** — `/video:from-script "kurzes Werbevideo für ein Galabau-Projekt"` expands the idea into a 12-block blueprint, locks the character identity, and prints the provider-tuned prompt set. Prompt scaffold deferred to follow-up impl PR; the `/video:from-script` command itself ships today.
2. **Voice-consistent post copy across three surfaces** — paste the announcement intent, get newsletter + LinkedIn + Twitter copy that reads as the same voice with the cadence each platform expects. Prompt: [`prompts/voice-consistent-copy.md`](prompts/voice-consistent-copy.md) *(scaffolded in follow-up impl PR)*.
3. **Series consistency check before publishing** — paste the next episode's draft + a link to the existing series style guide, get a tone-drift audit before the post goes live. Prompt: [`prompts/series-consistency-audit.md`](prompts/series-consistency-audit.md) *(scaffolded in follow-up impl PR)*.

## Recommended ready-made setups

- **`core`** — prompt refinement, voice locking, doc co-authoring. Always on.
- **`content`** — voice-and-tone-design, messaging-architecture, editorial-calendar. The writing scaffolding around the video pipeline.
- **`ai-video`** — `/video:from-script`, `/video:scene`, `/video:storyboard`, `/video:stitch`, `character-consistency`, `pixar-storyteller`, `scene-expander`. The cinematic pipeline itself. `AIV_DRYRUN=true` is the mandatory default — no provider call, no spend until you opt in.

## Install path

**MCP recommended.** Claude Desktop is the lowest-friction entry; no terminal required. See [`docs/mcp.md`](../../../docs/mcp.md). CLI is needed only when you build a custom adapter against a new video provider — `provider-lifecycle-discipline` (experimental → stable → deprecated) is the rule for that.

> **What this is not:** the package does **not** host a video model. It chains prompts against the provider you select (Veo, Kling, Sora, Runway, …). The reliability score is the provider adapter's lifecycle tier. You pay the provider directly; the package never sees your API key.

> **Status:** `draft` — the three first tasks above are the maintainer's hypothesis. Recruit-session 02 will rank them against what creators actually reach for first. Prompts deferred to the follow-up impl PR.
