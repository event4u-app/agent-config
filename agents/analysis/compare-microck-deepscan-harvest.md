# Microck Deep-Scan Harvest (2026-05-05)

**Sibling to** `compare-microck-ordinary-claude-skills.md` (which
rejected Microck as a *methodology* source). This doc records the
**content-level harvest**: which of the 415 unique Microck skills are
worth porting into our 134-skill suite and at what tier.

**Scoring frame:** Impact (0–10) × Confidence (0–10) ÷ Effort
(0–10). Numbers are calibrated against our existing skill set, not
theoretical max.

## Method

1. Fetched the Microck git tree (recursive, 1 call) → 415 unique
   skills across `skills_all/` and `skills_categorized/`.
2. Filtered out-of-scope categories (bioinformatics, mysticism,
   astronomy-physics, scientific-computing, smart-contracts,
   academic, gaming, lab-tools) → dropped ~80 skills.
3. Removed exact-name duplicates with our 134 (5) and fuzzy-name
   duplicates (2) → 301 unique in-scope candidates.
4. Sampled 35 SKILL.md files spanning eng / debug / testing /
   infra / AI-LLM / docs / business → quality variance is **10×**
   between top tier (17–20 KB, Iron Laws, gate functions, real
   code) and bottom tier (1–3 KB stubs).
5. Curated short-list of 50 → council vote
   (`agents/council-responses/microck-harvest-prioritization.json`,
   $0.0424 actual). Both members agreed on a **5-skill cap per
   six-week plate** and on the Reference-Guideline Sunset Policy.

## ADOPT — Phase 1 (six-week plate, hard cap 5)

| # | Skill | Score | Effort | Rationale |
|---|---|---:|---:|---|
| 1 | `defense-in-depth` | I:8 · C:9 · E:2 → **36** | 0.5 d | 130-line four-layer validation pattern; fills gap `judge-bug-hunter` doesn't cover (runtime detection ≠ structural prevention). Council unanimous. |
| 2 | `testing-anti-patterns` | I:8 · C:8 · E:2 → **32** | 0.5 d | Iron Laws + gate functions for mock abuse / test-only methods. Complements `judge-test-coverage`; ours catches misses, this prevents them. |
| 3 | `repomix` | I:6 · C:9 · E:1 → **54** | 0.25 d | Pure tool wrapper, zero overlap, lowest-risk quick win. Enables codebase-snapshot workflows. |
| 4 | `mcp-builder` | I:9 · C:7 · E:4 → **15.75** | 1.5 d | 13 KB MCP server authoring guide; complements existing `mcp` consumer skill. External file refs need adapter pass — biggest effort in plate. |
| 5 | `error-handling-patterns` (CHUNKED) | I:8 · C:7 · E:5 → **11.2** | 1.5 d | 638 lines monolithic; **adopt as 200-line core skill + externalized pattern catalogue** per Sunset Policy below. Multi-language win (PHP + Python + JS). |

**Plate total: ~4.25 dev days** — comfortable inside the six-week
visible window with room for portability + lint + integration.

## ADOPT — Phase 2 (out-of-horizon, gated on Phase 1 evidence)

Promoted only if Phase 1 lands clean and the Sunset Policy holds.

| Skill | Tier | Why deferred |
|---|---|---|
| `async-python-patterns` | A | 18 KB, multi-pattern; Sunset-Policy candidate. Ship after the catalogue framework proves out. |
| `code-review-excellence` | S→A | 13 KB; council split. Marginal delta over our six `judge-*` + two `requesting/receiving-code-review` skills unclear without diff. Audit before adopt. |
| `secrets-management` | B | 7.6 KB Vault/AWS/native; check overlap with `aws-infrastructure` and `security-audit`. |
| `slo-implementation` | B | 8 KB SRE framing; valuable but requires `observability` context first. |
| `distributed-tracing` | B | 10 KB Jaeger/Tempo; queue behind `observability` plate. |
| `prompt-engineering-patterns` | A | 7 KB; portability question — generic enough to keep stack-agnostic. |
| `llm-evaluation` | A | 13 KB; ties into the eval-gate work in `road-to-better-skills-and-profiles` Block D. |
| `rag-implementation` | A | 11 KB; out-of-scope until/unless we ship a RAG pattern in the suite. |
| `cost-optimization` | B | 6 KB cloud cost hygiene; nice-to-have. |

## DROP — explicit non-adopts

| Skill / category | Why dropped |
|---|---|
| `nodejs-backend-patterns`, `modern-javascript-patterns`, `typescript-advanced-types` | Out-of-stack (we are PHP/Laravel + Python tooling). Adopt only if a polyglot agent track ships. |
| `microservices-patterns`, `architecture-patterns` | Vague catalogues; sample suggests pattern-library bloat. Sunset Policy makes the maintenance liability explicit — drop. |
| `terraform-module-library`, `helm-chart-scaffolding` | Scaffolding skills bitrot fast; link to upstream docs from existing infra skills instead. |
| `agile-product-owner` (1 KB), `product-strategist` (1 KB), `analyzing-financial-statements` (2.5 KB stub), `creating-financial-models` (5 KB), `financial-document-parser`, `sales-comp-plan-designer`, `objection-pattern-detector`, `enablement-kit` | Wing-2/3/4 cognition. Defer to wing-specific roadmaps (`road-to-unified-senior-roles`, `road-to-gtm-and-growth`, `road-to-money-strategy-ops`) which design these as **roles + rules**, not atomized skills. Adopting Microck thin-stubs now pre-empts wing design. |
| `skill-developer`, `skill-builder`, `skill-creator`, `skill-writer`, `template-skill`, `create-skill`, `create-skill-file`, `skill-development`, `mcp-management`, `command-development`, `command-name`, `rule-identifier`, `hook-development` | Meta/skill-authoring overlap. Our `skill-writing` + `rule-writing` + `command-writing` + `description-assist` skills + `skill-quality` rule + `lint-skills` are higher quality. |
| All vendor wrappers (shopify-*, woocommerce-*, paypal-*, stripe-* concrete, benchling, latchbio, labarchive, positron-*, gerrit, denario, hypogenic, fabric, archon, gemini-imagegen, codex-skill, kiro-skill, spec-kit-skill, cloudflare-manager, etc.) | Violate `augment-portability` (project-agnostic floor). Belong in consumer-project overrides if at all. |
| `pdf-processing`, `docx`, `xlsx`, `excel-analysis` | **Superseded by `road-to-markitdown-adoption`** (Phase 1 ready). markitdown-mcp covers all four formats with one tool. Adopting these would create double-maintenance. |
| `competitive-ads-extractor` | Strong skill (8 KB) but belongs in `road-to-gtm-and-growth` Wing-3 plate, not the engineering harvest. Cross-referenced there. |

## Reference Guideline Sunset Policy (council mitigation)

Council surfaced the **biggest harvest risk**: adopting 5 ≥400-line
"pattern catalogues" creates 5 mini-wikis to maintain forever. PHP
8.4 lands → who diffs `error-handling-patterns`?

**Policy** (lifted into the roadmap as a hard rule):

> Any skill > 400 lines or labeled `patterns` / `guidelines` MUST:
> 1. **Externalize the catalogue** — link to authoritative external
>    docs (php.net, Symfony, MDN, Python docs) for the pattern
>    library. The skill keeps the *decision framework* (when X vs Y),
>    not the encyclopedia.
> 2. **Refresh trigger** — define the event that triggers a rewrite
>    (e.g. "≥30% of examples reference deprecated APIs", or "the
>    upstream framework cuts a major").
> 3. **Sunset criterion** — when external docs improve to where the
>    guideline is redundant, archive the body, replace with a
>    50-line pointer skill ("for X, see [authoritative link]").

Applies to `error-handling-patterns` on adoption (Phase 1) and to
every Phase-2 catalogue skill.

## Provenance

- Tree fetch: `https://api.github.com/repos/Microck/ordinary-claude-skills/git/trees/main?recursive=1` (415 SKILL.md blobs).
- Sampled SKILL.md cache: `/tmp/microck-samples/` (35 files, ~280 KB).
- Council question: `agents/council-questions/microck-harvest-prioritization.md`.
- Council responses: `agents/council-responses/microck-harvest-prioritization.json` (claude-sonnet-4-5 + gpt-4o, $0.0424 actual, 2026-05-05).
- Implementation roadmap: `agents/roadmaps/road-to-microck-harvest.md`.
