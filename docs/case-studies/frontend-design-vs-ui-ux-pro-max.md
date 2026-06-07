# Competitive positioning — `frontend-design` pack vs. `ui-ux-pro-max`

> Ours-vs-theirs verdict per the `competitive-positioning` skill,
> closing `road-to-frontend-design-intelligence` Phase 8. Evidence:
> full-tree deep-dive of `nextlevelbuilder/ui-ux-pro-max-skill`
> @ `b7e3af80f6e331f6fb456667b82b12cade7c9d35` (2026-06-07) vs. this
> repo post-adoption (ADR-061).

## 1. Frame

- **Theirs:** "Make any AI agent produce professional UI" — a
  searchable design-knowledge corpus + BM25 engine + generative asset
  add-ons, installed per-tool via an npm CLI. Segment: any developer
  using an AI coding tool.
- **Ours:** a governed skill/rule/command suite where frontend design is
  one orchestrated capability among many — audit → design → apply →
  review → polish with hard gates, now **grounded in the same corpus**.
  Segment: teams standardizing AI-agent behavior across tools.

## 2. Axes

- **Design-knowledge grounding** — the differentiated capability that
  triggered this adoption.
- **Orchestration & gates** — who controls when knowledge is applied.
- **Accessibility depth** — audit method, not just data.
- **Stack coverage** — per-framework Do/Don't knowledge.
- **Token authoring** — DTCG system + generators.
- **Generative assets** — logo/CIP/banner generation.
- **Governance & provenance** — licensing, refresh, safety surfaces.

## 3. Verdict table

| Axis | Ours (post-adoption) | Theirs | Verdict | Adopt? | Rationale |
|---|---|---|---|---|---|
| Design-knowledge grounding | Same corpus (11 CSVs + 16 stack CSVs + reasoning map) behind a **generalized manifest engine** with confidence + evidence-gap on every output | Origin of the corpus; frontend-hardcoded scripts | **Parity-plus** | done | ADR-061 adoption; our engine adds structured filters, named retrievers, schema-agnostic manifests |
| Orchestration & gates | Directive set with audit gate, microcopy placeholder lock, a11y severity gate, polish ceiling | Skill prose + conventions; no enforced gates | **Ours** | — | Their corpus now feeds our gates — the combination argument inverts |
| Accessibility depth | `accessibility-auditor` (WCAG 2.2 AA method) + corpus a11y data (contrast-adjusted palettes, chart grades, 44pt rules) | Checklist rows + a11y-graded data, no audit method | **Ours** | done | Their data enriched our gate; method stays ours |
| Stack coverage | 16 stack corpora via `--stack` (Vue gap closed) + stack-dispatched executor skills | Same 16 CSVs | **Parity** | done | Verbatim adoption, one search mechanism |
| Token authoring | `design-tokens` skill — DTCG 3-layer + Python generate/validate/embed (no Node dep) | `.cjs` generators (Node required) | **Ours (slight)** | done | Port removes the Node runtime requirement; brand→token sync deferred (watch note) |
| Generative assets | **Not shipped** — gated by `domain-adoption-policy` (watch note); would adapt into `pack-ai-video` | Gemini logo/CIP/icon/banner/social suite | **Theirs** | gated | Heavy deps (`google-genai`, Chrome, API key) + no demand signal; revisit on trigger |
| Governance & provenance | ADR-061, ATTRIBUTION with SHA pins, owner + cadence per corpus, runtime-safety review, Apache §4b markings | MIT/Apache files present; no refresh discipline documented | **Ours** | — | The axis their 86k-star repo does not compete on |

## 4. Invariants (moats)

- **Orchestration & gates** — inversion: "would a consumer drop our suite
  for theirs?" Only if they wanted raw knowledge without enforcement;
  the placeholder lock, audit gate, and a11y floor do not exist upstream.
- **Governance & provenance** — refresh cadence + SHA pins + safety
  reviews are structural in this package; a knowledge dump cannot match
  them without becoming a governed suite itself.

## 5. Adoption queue

Empty — every `adopt? = done` row landed in
`road-to-frontend-design-intelligence` Phases 1–6. The single open
upstream capability (generative suite) is gated, not queued
(`agents/settings/contexts/domain-watch/generative-brand-assets.md`).

## 6. Unknowns

- Their npm CLI's 18-tool projection breadth vs. our generator's
  supported set: we verified parity for **our** targets
  (`.claude` / `.cursor` / `.clinerules` / `.windsurf` / `.augment` via
  `task generate-tools`); no claim about the 13 other tools they list —
  we do not target them.
- Real-session quality delta of grounded vs. ungrounded briefs — the
  council's change-my-mind anchor (≥10 real sessions) applies to our own
  Phase 9 expansion, and equally to claiming superiority here.

## Net

A consumer installing **our package alone** now gets the
`ui-ux-pro-max` design knowledge **plus** orchestration, hard gates,
a11y method, token authoring without Node, and provenance discipline.
The combination is unnecessary; the gated generative suite is the one
deliberate exception.

## Upstream-contribute consideration (Step 8.3)

Improvements worth proposing back (MIT obligations honored either way):
the BM25 dedupe (`core.py` / `slide_search_core.py` byte-identical),
the Python token toolchain (drops their Node dependency), and the
manifest/filters layer. **Decision: defer the upstream PR** until the
engine has soaked through one internal release cycle — proposing an
interface we might still move is noise for the maintainer. Revisit at
the first quarterly corpus refresh.
