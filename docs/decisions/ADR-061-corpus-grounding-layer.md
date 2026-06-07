---
adr: 061
status: accepted
date: 2026-06-07
decision: corpus-grounding-layer
supersedes: —
superseded_by: —
phase: frontend design intelligence (road-to-frontend-design-intelligence, Phase 0)
type: structural
---

# ADR-061 — Reusable corpus-grounding layer; frontend is its first instance

## Status

**Accepted** · 2026-06-07. Records the AI-council convergence
(anthropic/claude-sonnet-4-5 + anthropic/claude-opus-4-5 + openai/gpt-4o,
deep 3-round debate, 2026-06-03 — no split, no tie-break) plus the four
implementation forks resolved 2026-06-07 (anthropic/claude-sonnet-4-5 +
openai/gpt-4o, converged).

## Context

The package's UI directive set (`audit → design → apply → review → polish`)
produces design briefs from agent judgment plus the `fe-design` heuristics —
there is no queryable design-knowledge corpus. The MIT-licensed
`nextlevelbuilder/ui-ux-pro-max-skill` repository ships exactly that: ~15
tabular CSVs (161-row `ui-reasoning` with JSON decision rules, WCAG-adjusted
color token sets, typography pairings, chart-selection knowledge, 16
per-framework best-practice files) plus a dependency-free pure-stdlib BM25
engine. The owner's escalated goal — *"real knowledge + real orchestration in
every domain, as flexible and good as possible"* — reshaped the adoption from
"copy a frontend corpus" into "build a reusable grounding layer; frontend is
its first instance."

## Decision

### 1. Four-operation routing — never one corpus for everything

Each domain's knowledge is split across four mechanisms; conflating them is a
named failure mode ("grounding theater"):

| Operation | When | Mechanism |
|---|---|---|
| **Grounding** | *before* action — constrains the option space | curated corpus + decision rules |
| **Reference** | *during* action — factual lookup | on-demand `references/` / RAG, not the corpus |
| **Validation** | *after* action — constraint check | rules / linters |
| **Method** | the procedure itself | framework skill |

A corpus **grounds** (pre-action). Mid-action lookup is reference; post-action
checking is a rule; the procedure stays a skill.

### 2. One shared engine, invoked not inherited

A generic engine lives at `src/skills/_lib/corpus-grounding/`
(`bm25_search.py`, `decision_engine.py`, `schema_validator.py`) with a
**versioned interface-stability contract** documented in its README before any
domain adopts it. Domains plug in via a manifest; the engine is grep-able,
never a hidden god-dependency. Retrieval: BM25 default with a structured
`filters` pre-filter from day one; retriever selected by name
(`bm25`/`structured`/`hybrid`); embeddings only on measured recall failure,
never network-by-default.

### 3. Schema-agnostic plug-in contract — explicitly NOT uniform

Each domain declares its own axes via a manifest (corpus files, search
columns, output columns, reasoning-map location) and an output tier:
**lookup-only → conditional-grounding (decision rules) → constraint-emission**.
Forcing the frontend schema onto other domains is a named failure mode. Every
corpus output carries a **confidence score + an evidence-gap line** by
contract (prevents false precision / authority inflation).

### 4. Grounding default = lightweight consultation

Default integration: a skill consults the corpus → proposes grounded options
with confidence + evidence-gap → human confirms. Directive-engine integration
is reserved for mature, naturally-sequential domains (frontend keeps its
directive engine — Tier 2); "directive engines everywhere" is rejected as
orchestration envy. `directives/ui/design.py` never imports the engine — the
corpus call lives in the skill layer (`ui-design-brief` /
`design-intelligence`), keeping the engine an optional dependency.

### 5. Qualification by decision-rule utility, NOT row count

A domain qualifies when (i) its selection/constraint decision is
externalizable as auditable rules that beat the agent's priors, and (ii)
grounding happens before action. Verdicts:

- **Strong**: security/threat-modeling (MITRE-derived), accessibility
  (WCAG/ARIA patterns), API design, DB-query tuning.
- **Conditional (evidence-gated)**: finance *method selection*,
  architecture-pattern selection — thin pre-action selection corpora only;
  land only if a corpus measurably beats the existing framework skill over
  ≥10 real sessions (the council's change-my-mind anchor).
- **Reject as corpus**: anything that is really reference (→ RAG), really
  validation (→ rule), volatile/culturally-specific (people/org fads), or a
  thin corpus that doesn't beat priors. Test: *if it fits in 5 lines of an
  always-on rule, it's a rule, not a corpus.*

### 6. Provenance / freshness — the upstream-source line is part of DoD

Every adopted asset carries an inline upstream-source line: upstream repo +
commit SHA + last-checked date. Per-corpus header additionally names a
maintainer + refresh cadence + last-validated date (domain-adoption Gate 2).
CI link-checks; volatile content is tiered by rot velocity or marked
reference-only. **Definition of done for every adoption phase includes this
line** (refresh stays mechanical, not archaeological).

### 7. Licensing

Root corpus + scripts: MIT (Next Level Builder, 2024) → retain notice.
`ui-styling`-derived material: **Apache-2.0** (vendored "claudekit"; the
dedicated `LICENSE.txt` wins over the MIT frontmatter claim) → retain notice,
mark modified files (§4b), ship the license copy alongside derived assets.
Recorded in `src/skills/design-intelligence/ATTRIBUTION.md`.

### 8. Implementation forks (council-resolved 2026-06-07)

| Fork | Resolution |
|---|---|
| Pack placement | **New `frontend-design` pack** (ADR-013 amendment, same PR). `requires: [engineering-base]`, `suggests: [react, nextjs]` — corpus is stack-agnostic data, React never required. Keeps ~1 MB of design data out of `engineering-base`. |
| `google-fonts.csv` (745 KB, 1923 rows) | **Skip.** Redundant with the public Google Fonts API; `typography.csv` (73 curated pairings) carries the pairing decision. Document the API fallback for fonts outside the curated set. |
| Stack-corpus surfacing | **`--stack <name>` search domain** on the one grounding engine — single mechanism, no 16-way prose-staleness vector. |
| Brand→token pipeline | **Defer** with a watch note pinning the upstream commit SHA; adopt on first consumer demand. |

### 9. Out of scope (explicit)

- The upstream slide/presentation engine (out of frontend scope).
- The Gemini generative brand-asset suite (logo/CIP/icon/banner/social) —
  gated by `domain-adoption-policy`; see the domain-watch note. If gates
  pass later, it adapts into `pack-ai-video` (no second image-gen stack).
- Business-pack corpora (people/org, GTM, founder-strategy verdicts) —
  rejected per the qualification rubric; reference belongs to RAG,
  validation to rules.

## Consequences

- A new domain ships a manifest + data + a named owner — not a forked engine.
- `engineering-base` stays lean; design intelligence is opt-in via the
  `frontend-design` pack.
- The skill-bundled `scripts/` + `data/` delivery path becomes a sanctioned,
  tested pattern (delivery-mechanism gate, Phase 1) — load-bearing for every
  later domain corpus.
- Corpus maintenance is a standing cost: named owner + cadence per corpus, or
  the corpus is not merged.

## Alternatives considered

- **One corpus for everything (CSV per domain)** — rejected; conflates the
  four operations, produces grounding theater + maintenance bloat.
- **Fold the corpus into `fe-design`** — rejected 2-of-3; size discipline.
  `fe-design` stays heuristics and *invokes* `design-intelligence`.
- **Directive engines for every domain** — rejected; consultation default.
- **Keep `.cjs` token generators on Node** — rejected unanimously; ported to
  Python (no Node runtime dependency for core flows).
- **Adopt `google-fonts.csv`** — rejected; public-API-redundant bloat.

## References

- `agents/roadmaps/archive/road-to-frontend-design-intelligence.md` —
  implementing roadmap, archived 2026-06-07 (full source analysis + phase
  plan + per-step evidence notes).
- [ADR-013 — Discovery frontmatter contract](ADR-013-discovery-frontmatter-contract.md)
  — `frontend-design` pack amendment (2026-06-07).
- `src/skills/design-intelligence/ATTRIBUTION.md` — upstream provenance +
  license obligations.
- `agents/settings/contexts/domain-watch/generative-brand-assets.md` — gated
  Gemini-suite watch note.
- Upstream: `nextlevelbuilder/ui-ux-pro-max-skill` @
  `b7e3af80f6e331f6fb456667b82b12cade7c9d35` (last checked 2026-06-07).
