# Road to: `llm-provider-knowledge` skill

## Goal

Add a package skill that extends the discipline of Claude Code's bundled
`product-self-knowledge` (verify product facts against **official docs**,
never memory) to **all major LLM providers** — Anthropic, OpenAI, Google
Gemini, and others. The skill is a **signpost, not a library**: it routes the
agent to each provider's authoritative docs and forces a source-cited answer;
it never caches volatile provider specs (models, prices, rate limits).

## Council convergence (2026-07-14)

Multi-model debate, anthropic/claude-sonnet-4-5 + openai/gpt-4o (2 rounds):

- **Shape → Option A: ONE unified skill with a per-provider routing table.**
  Decisive Round-2 argument: the skill *routes, it does not cache*. Option C
  (per-provider `references/*.md` depth files) would embed model matrices /
  prices / rate limits that go stale immediately — recreating the "from memory"
  failure the skill exists to prevent. Signpost, not library. Matches the
  existing `image-provider-routing` precedent + the anti-sprawl canon
  (`size-enforcement`). If the table ever splits into `references/`, those files
  may hold **routing pointers only**, never cached specs.
- **Anthropic included** — portability: non-Claude hosts (Cursor, Windsurf,
  Cline, …) have no harness skill. On Claude Code both may fire; benign
  redundancy (same Anthropic docs) — no unenforceable cross-skill precedence hack.
- **Scope** — API/developer docs + API reference + one product-support link per
  provider (routes plan/limit questions); no embedded details.
- **Providers v1** — Anthropic, OpenAI, Google Gemini, Mistral, xAI Grok,
  DeepSeek, Cohere, Meta Llama. Hosted surfaces (Azure OpenAI, AWS Bedrock,
  Vertex AI) → route to the underlying vendor + the cloud's own docs.
- **Name** → `llm-provider-knowledge`. **Freshness** → link to stable doc
  ROOTS only + an offline well-formedness lint; no flaky live-network CI call
  (the signpost design absorbs provider-side page churn as the agent reads live).

## Verified docs entry points (research 2026-07-14)

| Provider | Docs root | API reference | Product / support |
|---|---|---|---|
| Anthropic | docs.claude.com/en/docs (+ /en/docs_site_map.md) | docs.claude.com/en/api/overview | support.claude.com |
| OpenAI | platform.openai.com/docs | platform.openai.com/docs/api-reference | help.openai.com |
| Google Gemini | ai.google.dev/gemini-api/docs | ai.google.dev/api | support.google.com (Gemini app) |
| Mistral | docs.mistral.ai | docs.mistral.ai/api | help.mistral.ai |
| xAI Grok | docs.x.ai | docs.x.ai/docs/api-reference | x.ai |
| DeepSeek | api-docs.deepseek.com | api-docs.deepseek.com/api | platform.deepseek.com |
| Cohere | docs.cohere.com | docs.cohere.com/reference | dashboard.cohere.com |
| Meta Llama | llama.developer.meta.com/docs | llama.developer.meta.com/docs/api | llama.com |

(Roots are re-confirmed live during Phase 1; only stable roots land in the skill.)

## Phase 1 — Author the skill

- [x] Create `src/skills/llm-provider-knowledge/SKILL.md` with conforming
  frontmatter (`name`, `description`, `source`, `domain: process`,
  `model_tier: inherit`, `packs: [meta]`, broad `workspaces`, `trust`,
  `install`, `execution: {type: manual}`). Description ≤ 220 chars, trigger
  phrased to fire on a **factual product claim about any LLM provider** and NOT
  on ordinary SDK usage.
- [x] Body sections: `## When to use`, `## When NOT to fire`, `## Core
  principles` (accuracy-over-memory, distinguish products, source everything,
  route-don't-cache), `## Provider routing table` (the verified roots),
  `## Procedure`, `## Output format` (≥ 2 requirements: product+source-URL,
  freshness caveat), `## Gotcha`.
- [x] Re-confirm each provider's stable docs root live (WebFetch) before it
  lands; drop or note any that 404/redirect cross-host.

## Phase 2 — Evals

- [x] `src/skills/llm-provider-knowledge/evals/triggers.json` — ≥ 6
  should-trigger (context window / pricing / rate-limit / model-id / plan-limit
  claims across ≥ 3 providers) + ≥ 5 should-NOT-trigger near-misses (writing
  SDK code that asserts no product fact; `prompt-engineering-patterns`;
  `model-recommendation` model-choice; `image-provider-routing`; a fact the
  user already supplied).

## Phase 3 — Discovery wiring + downstream surface

- [x] Confirm `packs: [meta]` + workspace set surface the skill on the intended
  hosts; align with the discovery contract.
- [x] Sweep the plain-skill downstream surface (counts / index / consistency)
  per the package's add-a-skill checklist.

## Phase 4 — Condense + sync + validate (targeted; remote CI is the gate)

- [x] `/condense` the new skill (`src/` → `dist/agent-src/`), hashes recorded.
- [x] `task sync` — regenerate `dist/agent-src/` + `.augment/`; counts in sync.
- [x] `task generate-tools` if the projection surfaces (`.claude/` etc.) need it.
- [x] Targeted `lint-skills` on the new skill — green (schema, size, Gotcha,
  ≥ 2 Output reqs, evals present).
- [x] `check_references` — no broken references from the new file.

## Phase 5 — Freshness guard

- [x] Document the stable-roots freshness policy inside the skill (routes to
  roots; agent reads live; no cached specs). Add an offline lint only if the
  package already has a table-well-formedness pattern to extend — otherwise the
  stable-roots discipline + `check_references` is the guard. No live-network CI.

## Acceptance criteria

- [x] `src/skills/llm-provider-knowledge/SKILL.md` exists, lint-green, `meta` pack.
- [x] Evals: ≥ 6 should-fire + ≥ 5 should-not-fire, all correctly classified.
- [x] Routing table covers the v1 providers with live-confirmed stable roots.
- [x] `dist/agent-src/` + `.augment/` regenerated; counts + hashes in sync.
- [x] `check_references` clean; skill is a signpost (zero cached provider specs).
- [x] Final PR opened against `main`.
