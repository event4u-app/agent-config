# Council question — Microck harvest prioritization

## Context

`event4u/agent-config` is a governed multi-department skill suite (134
skills, 55 rules, ~63 commands today) with a project-agnostic floor
(`augment-portability`) and four wings (Engineering, Product, GTM,
Money). We already analysed the Microck repo in
`agents/analysis/compare-microck-ordinary-claude-skills.md` and
**rejected it as a methodology source** (non-curated mirror, broken
paths, no linter). One specific skill — `markitdown` — was lifted into
`agents/roadmaps/road-to-markitdown-adoption.md`.

The user (Matze) now asks for the **full harvest**: deep-scan the 600+
Microck skill base, surface every skill we should adopt or adapt, and
produce a phased roadmap (template:
`agents/roadmaps/road-to-better-skills-and-profiles.md` — six-week
visible plate, ICE-scored, out-of-horizon backlog, kill-switch on
budget breaches). User explicitly said autonomy is fine, max tokens
OK, only escalate on real blockers.

I have already inventoried, deduplicated, and category-filtered:

- Microck skills: 415 unique
- After dropping out-of-scope categories (bioinformatics,
  divination-mysticism, astronomy-physics, scientific-computing,
  smart-contracts, etc.) and exact/fuzzy duplicates with our 134:
  **301 in-scope candidates** across 35 categories
- Sampled 35 SKILL.md files for quality calibration. Quality varies
  10× across the sample: serious engineering content (17–20 KB,
  Iron Laws, gate functions, real code) sits next to 1–3 KB stubs
  (e.g. `analyzing-financial-statements`, `agile-product-owner`,
  `product-strategist`).

## Curated short-list (my draft, ~50 candidates)

These are the survivors after one quality pass + portability filter
(no vendor-locked wrappers like shopify-*, woocommerce-*, paypal,
benchling-integration, latchbio-integration, positron-*, gerrit etc.,
which violate `augment-portability`). I want your scoring + cuts.

### Tier S — likely ADOPT, high impact, low effort (engineering wing)

- `defense-in-depth` — four-layer validation pattern, 130 lines,
  clean code. We have `judge-bug-hunter` but not this guideline.
- `testing-anti-patterns` — Iron Laws + gate functions for mock
  abuse and test-only methods. Complements our `judge-test-coverage`.
- `error-handling-patterns` — 638 lines, multi-language. Oversized
  but rich. Adapt as guideline + skill that cites it.
- `debugging-strategies` — 12 KB, root-cause workflow. Overlaps
  partly with our `systematic-debugging` rule — verify gap before
  adopting.
- `mcp-builder` — 13 KB MCP server authoring guide (FastMCP +
  TypeScript SDK). Complements our existing `mcp` skill (consumer
  side). Has external file refs that need adapter work.
- `repomix` — 5.6 KB tool wrapper for `repomix` CLI. Pure adoption,
  no overlap.
- `code-review-excellence` — 13 KB, complements `requesting-code-
  review`, `receiving-code-review`, `judge-*`.

### Tier A — engineering depth, ADAPT (sizing + portability)

- `microservices-patterns` (17 KB), `architecture-patterns` (size
  unknown), `nodejs-backend-patterns`, `bash-defensive-patterns`
  (11 KB), `async-python-patterns` (18 KB), `modern-javascript-
  patterns` (20 KB), `typescript-advanced-types` (17 KB),
  `python-packaging` (18 KB), `prompt-engineering-patterns` (7 KB),
  `llm-evaluation` (13 KB), `rag-implementation` (11 KB).

### Tier B — infra/devops, ADAPT (overlap check needed)

- `gitops-workflow` (6 KB, ArgoCD/Flux), `helm-chart-scaffolding`,
  `k8s-security-policies` (7 KB), `slo-implementation` (8 KB),
  `distributed-tracing` (10 KB Jaeger/Tempo), `secrets-management`
  (7.6 KB), `terraform-module-library`, `cost-optimization` (6.4 KB),
  `error-tracking`, `sast-configuration`, `pair-programming`.

### Tier C — document/data ingest (markitdown-adjacent)

- `pdf-processing` (3 KB pdfplumber), `docx` (10 KB OOXML), `xlsx`
  (10 KB), `excel-analysis` (5 KB). **Note:** must verify these
  don't fully overlap with the markitdown roadmap before adopting.
  My read: keep one general `office-document-toolkit` reference
  guideline citing markitdown as the default conversion path.

### Tier D — Wing-2/3/4 cognition (non-engineering, scrutinize harder)

- Wing 4 (Money): `creating-financial-models` (5 KB), `analyzing-
  financial-statements` (2.5 KB — too thin?), `financial-document-
  parser`, `billing-automation`, `sales-comp-plan-designer`.
- Wing 3 (GTM): `competitive-ads-extractor` (8 KB), `lead-research-
  assistant` (6.6 KB), `objection-pattern-detector`, `enablement-
  kit`, `in-app-messaging-kit`.
- Wing 2 (Product): `agile-product-owner` (1 KB — too thin),
  `product-strategist` (1 KB — too thin). My read: **drop**, ours
  are deeper.

### Tier E — meta/skill-authoring (likely DROP, we're upstream)

- `skill-developer`, `skill-builder`, `skill-creator`, `skill-
  writer`, `template-skill`, `create-skill`, `create-skill-file`,
  `skill-development`, `mcp-management`, `command-development`,
  `command-name`. Our `skill-writing`, `rule-writing`, `command-
  writing`, `description-assist`, `skill-quality` rule, and
  `lint-skills` are higher quality.

## Questions for you (each answer ≤ 200 words)

1. **Prioritization.** Look at Tiers S, A, B, C, D. Which 5 are
   highest leverage to adopt **first** (Phase 1, six-week plate),
   and why? Anything in S you would demote? Anything outside S
   you would promote?

2. **Cuts.** Which Tier-A or Tier-B candidates would you outright
   drop because the lift over our existing rules/skills is unclear,
   or the size/portability burden outweighs the win?

3. **Wing 2/3/4 cognition.** Are any Tier-D candidates worth
   adopting if we already plan deeper Wing 2/3/4 roadmaps
   (`road-to-unified-senior-roles`, `road-to-gtm-and-growth`,
   `road-to-money-strategy-ops`)? Or do we adopt nothing here and
   defer to the wing-specific roadmaps?

4. **Phasing.** A six-week plate of how many adoptions feels
   credible (without burning the maintenance budget)? 3? 5? 8?
   Hard cap?

5. **Single biggest risk** in this harvest, and the structural
   mitigation you would write into the roadmap.

Be opinionated. We will not blindly accept; we will use your
scoring to break ties on the agent's draft.
