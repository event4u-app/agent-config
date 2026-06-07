# Getting started — by role

> Pick the entry that matches what you do day-to-day. Each section names the three skills you will reach for first and shows whether MCP (no terminal) or CLI (terminal) is the simpler install path for that role.

`agent-config` ships ~210 skills, ~67 rules, and ~124 commands. You do not need all of them. Each role below filters to the slice that pays back in week one; the rest stays available and shows up on demand when a task references it.

> **Quickstart for every role.** Run `npx -y @event4u/agent-config init` — the browser wizard auto-launches and walks you through role, ready-made setup, and identity. Headless install path lives at [`docs/wizard.md`](wizard.md#headless--ci--no-browser). The wizard writes `.agent-settings.yml`, `.augment/`, and `.claude/` atomically; nothing leaves your disk.

> **Eval-gated messaging note.** Until `task bench --corpus non-dev` reports `selection_accuracy >= 0.60` (step-12 Phase 1 exit), this page is documentation, not marketing. The skills listed below are the candidates the corpus tests against; their description quality is what the eval validates.

> **Deployment posture.** Single-user workspace today (one machine, one user — `npx @event4u/agent-config init`). Small team today (3–10 people) via shared `agents/overrides/` Git repo + shared NAS for knowledge — recipe: [`docs/deploy/small-team-recipe.md`](deploy/small-team-recipe.md). Organization mode (SSO · central policy · team context · internal connectors) is **not started** — tracked under [`agents/roadmaps/stubs/`](../agents/roadmaps/stubs/README.md) with explicit gating (recruited customer + funded audit + maintainer ADR). Rationale: [`docs/deploy/team-deployment-posture.md`](deploy/team-deployment-posture.md).

---

## Creator (writer, marketer, indie content shop)

> **Tailored role experience available →** [`agents/roles/content-creator/`](../agents/roles/content-creator/index.md) — three first tasks, priority-ordered skill shortlist, prompt scaffolds. Status `draft` until recruit-session 02 lands.

**You want this if:** you draft blog posts, marketing emails, launch copy, or release announcements and want a writing assistant that holds a defined brand voice across surfaces. You need brand-voice discipline more than code-quality enforcement. You will spend most of your time in Claude Desktop / ChatGPT, not in a terminal.

- [`voice-and-tone-design`](../dist/agent-src/skills/voice-and-tone-design/SKILL.md) — define and audit brand voice (voice attributes, tone-by-context matrix).
- [`messaging-architecture`](../dist/agent-src/skills/messaging-architecture/SKILL.md) — primary message + supporting proofs + audience-by-message matrix.
- [`editorial-calendar`](../dist/agent-src/skills/editorial-calendar/SKILL.md) — evergreen vs campaign vs reactive cadence across channels.

### AI Video Pipeline

Cinematic-blueprint approach: the agent expands your script into a 12-block scene plan, locks a character identity, then drives the rendering provider you have chosen. Provider-agnostic and dry-run-by-default.

- [`/video:from-script`](../dist/agent-src/commands/video/from-script.md) — end-to-end pipeline: script → character-locked image → motion+audio prompt → provider render → stitched clip.
- [`/video:storyboard`](../dist/agent-src/commands/video/storyboard.md) — expand a one-line idea into the 12-block Cinematic Scene Blueprint (provider-agnostic).
- [`/video:scene`](../dist/agent-src/commands/video/scene.md) — render a single scene from an existing blueprint against the configured provider adapter.
- [`/video:stitch`](../dist/agent-src/commands/video/stitch.md) — assemble rendered scenes into the final clip via ffmpeg.
- [`character-consistency`](../dist/agent-src/skills/character-consistency/SKILL.md) — lock identity tokens (silhouette, palette, wardrobe, prop) so a character stays visually identical across scenes.

`AIV_DRYRUN=true` is the mandatory default — no provider call, no spend until you opt in.

**Worked example — one-line idea to stitched cut, four commands:**

1. `/video:from-script "kurzes Werbevideo für ein Galabau-Projekt"` — agent expands the one-line idea into a 12-block blueprint, locks the character identity, and prints the provider-tuned prompt set.
2. `/video:storyboard` — review the 12-block scene plan before any provider call; edit blocks inline (camera, lighting, blocking, motion) until the storyboard reads as intended.
3. `/video:scene` — render one scene at a time against the configured provider adapter; iterate on the motion + audio prompt without paying for the full clip.
4. `/video:stitch` — assemble the rendered scenes into the final clip via ffmpeg, with the character-lock JSON enforcing identity across cuts.

**Try the first win →** [`pack-ai-video/FIRST_WIN.md`](../src/domains/ai-video/FIRST_WIN.md) — one-line idea to a provider-tuned motion prompt in ~12 minutes.

> **What this is not:** the package does **not** host a video model. It orchestrates prompts against the provider you select (Veo, Kling, Sora, Runway, …). Trust level is set by the provider's adapter lifecycle tier — see [`provider-lifecycle-discipline`](../dist/agent-src/rules/provider-lifecycle-discipline.md). You pay the provider directly, the package never sees your API key.

**Install path:** **MCP recommended.** Claude Desktop is the lowest-friction entry; no terminal required. See [`docs/mcp.md`](mcp.md). CLI install works too if you already use a code editor.

---

## Founder (early-stage operator wearing every hat)

**You want this if:** you switch between investor pitch, hiring decision, product spec, and unit-economics modeling in the same week. You need cross-domain skills that respect your time budget, not depth-first specialists. Decisions need to be defensible to a board.

- [`runway-cognition`](../dist/agent-src/skills/runway-cognition/SKILL.md) — cash runway, burn shape, fundraise triggers, cut-vs-grow.
- [`unit-economics-modeling`](../dist/agent-src/skills/unit-economics-modeling/SKILL.md) — CAC, LTV, payback, contribution margin per customer.
- [`fundraising-narrative`](../dist/agent-src/skills/fundraising-narrative/SKILL.md) — why-now / why-us / why-this framing, market-size reasoning.

**Try the first win →** [`pack-founder-strategy/FIRST_WIN.md`](../src/packs/founder-strategy/FIRST_WIN.md) — investor question reshaped into a defensible memo in ~10 minutes.

**Install path:** **MCP for advisor work, CLI when you touch code.** Claude Desktop covers strategy / finance / narrative; CLI is needed only when you sit in the repo with the dev team.

---

## Developer (the original audience)

**You want this if:** you write code daily — Laravel, Symfony, Next.js, Node, or stack-agnostic — and want testing / quality / git / CI guardrails baked into the agent's behavior. You will use commands like `/work`, `/commit`, `/create-pr`, `/quality-fix` constantly.

- [`laravel`](../dist/agent-src/skills/laravel/SKILL.md) — Laravel-flavored PHP (Eloquent, Artisan, FormRequests, jobs, policies). See [`docs/getting-started-laravel.md`](getting-started-laravel.md) for the deep dive.
- [`nextjs-patterns`](../dist/agent-src/skills/nextjs-patterns/SKILL.md) — App Router, Server Components, Server Actions, caching.
- [`quality-tools`](../dist/agent-src/skills/quality-tools/SKILL.md) — PHPStan, Rector, ECS error triage and fix loop.

**Install path:** **CLI.** Run `npx @event4u/agent-config init --tools=claude-code,cursor` in the project root. MCP works too but loses git / file-system tooling that the IDE-integrated path gives you.

---

## Consultant (advisor, freelance, fractional)

> **Tailored role experience available →** [`agents/roles/consultant/`](../agents/roles/consultant/index.md) — three first tasks (client-brief refinement, investor memo, deck outline), priority-ordered skill shortlist. Status `draft` until recruit-session 03 lands.

**You want this if:** you sell discovery, positioning, competitive analysis, or roadmap audits. Output is briefs and slide content for a client, not code. You need defensible methodology behind every deliverable.

- [`discovery-interview`](../dist/agent-src/skills/discovery-interview/SKILL.md) — switch-event JTBD guides, bias audit, falsifiable hypothesis.
- [`competitive-moat-analysis`](../dist/agent-src/skills/competitive-moat-analysis/SKILL.md) — moat reasoning, where-to-play / where-not-to-play.
- [`stakeholder-tradeoff`](../dist/agent-src/skills/stakeholder-tradeoff/SKILL.md) — per-lens framing, trade-off matrix with cost per choice.

**Install path:** **MCP recommended.** Most consulting work is doc + slide drafting; the terminal adds friction without payback. Switch to CLI only if you also write code for the client.

---

## Sales rep (B2B individual contributor)

> **Tailored role experience available →** [`agents/roles/sales/`](../agents/roles/sales/index.md) — three first tasks (answer customer · draft offer · prep discovery call), 5 named prompts, priority-ordered skill shortlist. Status `draft` until a sales-shaped recruit-session lands.

**You want this if:** you sell — usually with the deal half in your head and half in scattered notes from the last three meetings. You spend your day answering customer questions, drafting offers, and prepping discovery calls under time pressure.

- [`voice-and-tone-design`](../dist/agent-src/skills/voice-and-tone-design/SKILL.md) — lock the deal voice across buyer / procurement / exec sponsor.
- [`customer-research`](../dist/agent-src/skills/customer-research/SKILL.md) — frame the buyer's likely concern from LinkedIn / website / inbound context.
- [`competitive-positioning`](../dist/agent-src/skills/competitive-positioning/SKILL.md) — surface the ours-vs-theirs delta when the buyer names a competitor.

**Install path:** **MCP recommended.** Claude Desktop opens, the package shows up as a tool, no terminal. See [`docs/mcp.md`](mcp.md).

---

## Support agent (customer success / technical support)

> **Tailored role experience available →** [`agents/roles/support/`](../agents/roles/support/index.md) — three first tasks (summarise ticket · draft reply · escalation analysis), 5 named prompts, priority-ordered skill shortlist. Status `draft` until a support-shaped recruit-session lands.

**You want this if:** you answer tickets — usually under SLA, often as the only person on a thread that turned into eight back-and-forth messages over two weeks. You want an assistant that summarises threads before you reply and flags escalation risks early.

- [`voc-extract`](../dist/agent-src/skills/voc-extract/SKILL.md) — pulls verbatim customer language from threads for downstream triage.
- [`voice-and-tone-design`](../dist/agent-src/skills/voice-and-tone-design/SKILL.md) — lock the support voice so every customer thread reads as one team.
- [`churn-prevention`](../dist/agent-src/skills/churn-prevention/SKILL.md) — when the escalation-risk analysis flags churn-signal language.

**Install path:** **MCP recommended.** Support workflows live in the ticketing tool + chat; Claude Desktop is the natural home.

---

## Team leader (engineering manager, function lead, fractional)

> **Tailored role experience available →** [`agents/roles/leadership/`](../agents/roles/leadership/index.md) — three first tasks (weekly status · risk-analysis memo · decision record), 5 named prompts, priority-ordered skill shortlist. Status `draft` until a leadership-shaped recruit-session lands.

**You want this if:** you run a team or a function. Each week you write the same three things: a status summary, a risk memo before a decision, and a decision record after. You want an assistant that turns fuzzy notes into structured documents — without inventing certainty you do not have.

- [`decision-record`](../dist/agent-src/skills/decision-record/SKILL.md) — ADR-shaped output the team's record system already understands.
- [`scenario-modeling`](../dist/agent-src/skills/scenario-modeling/SKILL.md) — best / base / downside frame when the risk memo demands a sweep.
- [`stakeholder-tradeoff`](../dist/agent-src/skills/stakeholder-tradeoff/SKILL.md) — when the call has product / ops / exec sponsor pulling in different directions.

**Install path:** **MCP recommended.** Leadership writing is doc-heavy; Claude Desktop is the natural home.

---

## Galabau owner (Garten- und Landschaftsbau, small-business operator)

> **Tailored role experience available →** [`agents/roles/galabau/`](../agents/roles/galabau/index.md) — three first tasks (offer drafting, customer-email reply, project-brief refinement), priority-ordered skill shortlist. Status `draft` until recruit-session 01 lands.

**You want this if:** you run or co-run a small Garten-und-Landschaftsbau shop and draft customer offers, customer emails, and project briefs every week — usually after the on-site day is done. You want a writing assistant that knows your tone, holds it across customers, and turns a one-paragraph project sketch into a structured document you can send the next morning.

- [`refine-prompt`](../dist/agent-src/skills/refine-prompt/SKILL.md) — tighten fuzzy customer briefs before any drafting so the agent does not invent scope.
- [`voice-and-tone-design`](../dist/agent-src/skills/voice-and-tone-design/SKILL.md) — lock the shop tone so offers and emails read consistent across customers.
- [`doc-coauthoring`](../dist/agent-src/skills/doc-coauthoring/SKILL.md) — section-by-section drafting for longer offers; never one giant generation.

**Install path:** **MCP recommended.** Claude Desktop opens, the package shows up as a tool, no terminal required. See [`docs/mcp.md`](mcp.md). CLI install is the right path only if you also sit in this repo with code-shaped work.

---

## Go-To-Market (sales, marketing ops, RevOps)

**You want this if:** you own pipeline shape, forecast accuracy, launch sequencing, or post-launch comms. You need deal-level rigor (MEDDIC, exit criteria) and narrative skills (release comms, messaging) in the same agent.

- [`pipeline-strategy`](../dist/agent-src/skills/pipeline-strategy/SKILL.md) — stage exit criteria, per-cell conversion, leak diagnosis.
- [`deal-qualification-meddic`](../dist/agent-src/skills/deal-qualification-meddic/SKILL.md) — MEDDIC slots with evidence, inversion test, disqualification heuristic.
- [`release-comms`](../dist/agent-src/skills/release-comms/SKILL.md) — value-not-feature framing, audience-segmented surfaces.

Use the AI Video skills (see [Creator → AI Video Pipeline](#ai-video-pipeline)) when you need a launch asset, not a documentary — 8-second hero clips, social cutdowns, or feature-announcement teasers.

**Try the first win →** [`pack-gtm-sales/FIRST_WIN.md`](../src/packs/gtm-sales/FIRST_WIN.md) — single deal to a MEDDIC scorecard with inversion test in ~7 minutes.

**Install path:** **MCP recommended.** GTM artifacts are documents, decks, and Notion pages; Claude Desktop is the natural home.

---

## Finance / Ops (CFO, controller, ops lead, founder-finance)

**You want this if:** you build forecasts, model scenarios, and review data-handling for compliance. You need the agent to keep accounting / regulatory framing straight, not invent numbers.

- [`forecasting`](../dist/agent-src/skills/forecasting/SKILL.md) — top-down vs bottom-up shape, confidence bands, retro-loop.
- [`scenario-modeling`](../dist/agent-src/skills/scenario-modeling/SKILL.md) — base / upside / downside, three-statement modeling, sensitivity.
- [`privacy-review`](../dist/agent-src/skills/privacy-review/SKILL.md) — GDPR / CCPA / HIPAA fit, cross-border transfer, breach-impact triage.

Outputs are flagged for human-accountant review by default — the agent surfaces a trust banner on every forecast / scenario reply so downstream readers see the human-in-the-loop expectation. See [`finance-safety-floor`](../dist/agent-src/rules/finance-safety-floor.md).

**Try the first win →** [`pack-finance-basic/FIRST_WIN.md`](../src/packs/finance-basic/FIRST_WIN.md) — runway question to a base/upside/downside narrative with trust banner in ~8 minutes. People-leaders running 1:1s: [`pack-ops-people/FIRST_WIN.md`](../src/packs/ops-people/FIRST_WIN.md) — 1:1 cadence audit to a concrete recommendation in ~6 minutes.

**Install path:** **MCP recommended.** Finance / ops workflows are spreadsheet- and document-heavy; the CLI buys nothing here unless you also export models into a code repo.

---

## What is the same regardless of role

A short universal-skills allowlist (`git`, `refine-ticket`, `proofread`, `threat-model`, etc.) loads in every profile. The list will live at `docs/contracts/universal-skills.md` once step-12 Phase 3 lands; until then the package loads all skills and the host agent's semantic search picks what the prompt needs.

## What this page does not promise

This page lists **candidate** skill / role pairings. Whether each skill's `description:` is sharp enough for the agent to retrieve it without manual hint is exactly what `tests/eval/corpus-non-dev.yaml` tests. If a prompt in your role above falls flat, that is a skill-description bug — file an issue or open a PR with a sharper description, do not work around it by naming the skill manually.
