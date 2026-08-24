---
model_tier: inherit
name: llm-provider-knowledge
description: "Before stating any specific fact about an LLM provider's product — models, pricing, limits, context windows, SDK/API — for OpenAI, Gemini, Claude & others, verify against official docs, not memory."
domain: process
personas: []
workspaces:
  - agent-config-maintainer
  - engineering
  - product
  - founder
  - small-business
  - gtm
  - ops
packs:
  - meta
trust:
  level: experimental
install:
  removable: true
scope:
  write: []
  verification_reason: "execution declares no handler, so this skill runs nothing of its own — every write is the calling agent's, under the rules that govern it. No command can prove a scope the skill never executes."
execution:
  type: manual
---

# llm-provider-knowledge

Verify LLM-provider product facts against **official documentation**, never
memory. This skill is the multi-provider sibling of Claude Code's bundled
`product-self-knowledge` — extended to OpenAI, Google Gemini, Anthropic,
Mistral, xAI, DeepSeek, Cohere, and Meta Llama, and portable to every host this
package projects to (not just Claude Code).

**This skill is a signpost, not a library.** It routes you to the authoritative
source and forces a source-cited answer. It does **not** cache model IDs,
context windows, prices, or rate limits — those churn constantly, and a cached
copy is exactly the stale "from memory" answer this skill exists to prevent.

## When to use

- Your reply would state a specific fact about a provider's product: a model ID
  or its context window, token pricing, a rate/quota limit, an SDK/API detail
  (endpoint, parameter, auth, batch, streaming, function-calling shape), or a
  consumer-app plan limit (ChatGPT/Gemini/Claude app tiers).
- Coding against a provider SDK where a wrong model name, parameter, or limit
  would break at runtime.
- Content or comparisons that assert provider capabilities or pricing.
- Any time you would otherwise answer such a fact from training data — it may be
  outdated or wrong.

## When NOT to fire

- Ordinary SDK code that asserts **no** product fact (wiring a call whose model
  and params the user already gave).
- The user already supplied the verified fact — use it; don't re-litigate.
- Writing provider-specific prompt grammar → `prompt-engineering-patterns`.
- Choosing which model to use for the host → `model-recommendation` (never
  recommend another vendor's model over the host's; this skill only reports
  facts, it does not steer model choice).
- Image-provider selection → `image-provider-routing`.

## Core principles

1. **Accuracy over guessing** — if unsure, route to the docs; never assert.
2. **Distinguish products** — a provider's API, its developer platform, and its
   consumer app are separate surfaces with separate facts and separate docs.
3. **Source everything** — every product fact in the reply carries an official
   URL. No URL → not verified → don't state it as fact.
4. **Route, don't cache** — hand off to the live docs; do not transcribe
   volatile specs into the reply as if durable.

## Provider routing table

Route to the **stable root** and read live from there — do not deep-link to
pages that churn. Prefer a provider's machine-readable index where one exists.

| Provider | Docs root | API reference | Product / support |
|---|---|---|---|
| **OpenAI** (GPT) | `platform.openai.com/docs` | `platform.openai.com/docs/api-reference` | `help.openai.com` |
| **Google Gemini** | `ai.google.dev/gemini-api/docs` | `ai.google.dev/api` | `support.google.com` (Gemini app) |
| **Anthropic** (Claude) | `docs.claude.com/en/docs` (index: `/en/docs_site_map.md`) | `docs.claude.com/en/api/overview` | `support.claude.com` |
| **Mistral** | `docs.mistral.ai` | `docs.mistral.ai/api` | `help.mistral.ai` |
| **xAI** (Grok) | `docs.x.ai` | `docs.x.ai/developers` | `x.ai` |
| **DeepSeek** | `api-docs.deepseek.com` | `api-docs.deepseek.com/api` | `platform.deepseek.com` |
| **Cohere** | `docs.cohere.com` (index: `docs.cohere.com/llms.txt`) | `docs.cohere.com/reference` | `dashboard.cohere.com` |
| **Meta Llama** | `llama.com` (dev docs: `ai.developer.meta.com/docs`) | `ai.developer.meta.com/docs` | `llama.com` |

**Claude Code specifics** (install, Node.js requirement, MCP, config):
`docs.anthropic.com/en/docs/claude-code/claude_code_docs_map.md`.

**Hosted access** (not a distinct vendor): Azure OpenAI, AWS Bedrock, and
Google Vertex AI resell the underlying vendor's models. Route to BOTH the
underlying vendor's row above AND the cloud's own docs (`learn.microsoft.com`,
`docs.aws.amazon.com/bedrock`, `cloud.google.com/vertex-ai`) — model IDs,
quotas, and regions differ from the vendor's direct API.

## Procedure

1. **Identify the provider and the surface** — API / developer platform /
   consumer app. A ChatGPT-Plus limit is not an OpenAI-API rate limit.
2. **Pick the row + column** from the table; go to the stable root.
3. **Read the live docs** for the exact fact (navigate from the root; follow
   the provider's own index / `llms.txt` where present).
4. **State the fact with its source URL.** If the docs can't be reached or are
   ambiguous, say so and point the user at the root rather than guessing.
5. **Never transcribe a volatile spec as durable** — frame it as "per <URL> as
   of now"; the source is authoritative, the reply is a pointer.

## Output format

Every reply that states a provider product fact MUST include:

1. **The fact, scoped to the product surface** — name the provider AND which
   surface (API / platform / consumer app) it applies to.
2. **The official source URL** — the specific docs page the fact came from (or
   the stable root when you're directing the user to read it themselves).
3. **A freshness caveat when the fact is volatile** (pricing, limits, model
   availability): "verify at <URL> — these change without notice."

## Do NOT

- **Do NOT** state a model ID, context window, price, or rate limit from
  memory — route to the docs and cite the URL, or say you're unsure.
- **Do NOT** transcribe a volatile spec (pricing, limits, model availability)
  into the reply as if durable — frame it as "per <URL> as of now".
- **Do NOT** conflate a provider's API with its consumer app — they carry
  different limits and different docs.
- **Do NOT** steer the user to another vendor's model over the host's — that is
  `model-recommendation`; this skill reports facts neutrally.
- **Do NOT** cache a provider's docs into this skill. When a root URL moves,
  fix the one table row; a mismatch a user reports is a signal to correct the
  row, never to start transcribing pages here.

## Gotcha

- **Provider docs URLs churn** (Meta's Llama dev-docs host redirected during
  this skill's authoring). That is *why* the skill links to stable roots and
  reads live — a deep-linked page memorised here would rot. If a root itself
  moves, fix the one table row; never start caching pages to compensate.
- **Do not conflate surfaces.** "Gemini" the app and the Gemini API have
  different limits and different docs; the same for ChatGPT vs the OpenAI API
  and Claude.ai vs the Claude API.
- **Redundant with the harness on Claude Code.** Claude Code's own
  `product-self-knowledge` also fires for Anthropic facts — both route to the
  same Anthropic docs, so the overlap is harmless. On every other host this is
  the only such skill.
