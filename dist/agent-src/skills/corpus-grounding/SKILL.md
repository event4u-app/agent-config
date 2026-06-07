---
model_tier: inherit
name: corpus-grounding
description: "Shared corpus-grounding engine — BM25 + structured filters + decision rules over CSV corpora via a domain manifest. Use when a skill needs grounded pre-action option-space constraints."
source: package
domain: engineering
workspaces:
  - engineering
packs:
  - engineering-base
lifecycle: active
trust:
  level: professional
  confidence: high
  human_review_required: false
install:
  default: true
  removable: true
execution:
  type: manual
---

# corpus-grounding

> The reusable grounding layer from ADR-061: one pure-stdlib engine
> (BM25 retrieval + structured pre-filters + decision-rule evaluation)
> that any domain plugs into via a **manifest** — frontend design is its
> first consumer ([`design-intelligence`](../design-intelligence/SKILL.md)).
> A corpus **grounds** (pre-action, constrains the option space); it never
> replaces mid-action reference (RAG), post-action validation (rules), or
> the method itself (a framework skill).

Engine provenance: ported from `nextlevelbuilder/ui-ux-pro-max-skill`
@ `b7e3af80f6e331f6fb456667b82b12cade7c9d35` (MIT, last checked
2026-06-07) — BM25 de-duplicated, slide-only paths stripped, every
frontend-hardcoded axis moved into the manifest. Full license obligations:
[`design-intelligence/ATTRIBUTION.md`](../design-intelligence/ATTRIBUTION.md).

## When to use

- A skill needs **pre-action selection** grounded in curated knowledge
  ("which layout pattern / threat class / index strategy applies here").
- You are authoring a **new domain corpus** — write a manifest + CSVs,
  validate with `ground.py validate`, never fork the engine.
- You need stack-scoped Do/Don't guidance (`--stack react …`).

## Do NOT

- Do NOT use the corpus for mid-task fact lookup — that is reference
  (`references/` docs / RAG).
- Do NOT use it for output validation — write a rule/linter.
- Do NOT build a corpus that fits in 5 lines of an always-on rule.
- Do NOT fork the engine per domain — plug in via a manifest.
- Do NOT merge a manifest without owner + refresh cadence (validator
  refuses it anyway).

## Procedure: Consult a corpus

1. Locate the domain manifest (`<domain-skill>/data/manifest.json`).
2. Run `search` (one domain / stack axis) or `ground` (reasoning plan).
3. Read `confidence` + `evidence_gap` before trusting any row.
4. Propose grounded options; the human confirms (Tier-1 default).

### Invocation (consumer runtime)

Scripts resolve all paths **skill-relative** (per
[`docs/contracts/skill-bundled-assets.md`](../../../docs/contracts/skill-bundled-assets.md))
— they work from any cwd:

```bash
python3 <skills-root>/corpus-grounding/scripts/ground.py search \
  --manifest <skills-root>/<domain-skill>/data/manifest.json \
  "fintech dashboard" [--domain style] [--stack react] \
  [--filter "Severity=HIGH"] [--max-results 3] [--json]

python3 <skills-root>/corpus-grounding/scripts/ground.py ground \
  --manifest <skills-root>/<domain-skill>/data/manifest.json \
  "luxury e-commerce" [--context '{"data_heavy": true}'] [--persist DIR]

python3 <skills-root>/corpus-grounding/scripts/ground.py validate --manifest …
```

`<skills-root>` is wherever skills are deployed (`~/.claude/skills/` for
Claude Code installs; `src/skills/` inside this repo).

## Output format — interface contract v1 (stability promise)

Per ADR-061 §2 ("Opus condition"), this interface is **versioned**; domains
may depend on it. Breaking any item below requires a major bump
(`manifest_version: 2`), a migration note here, and updates to every
consuming skill in the same PR. Additive fields are allowed anytime.

Stable v1 surface:

1. **Modules + public names** — `bm25_search.{BM25, load_csv, apply_filters,
   search_rows, RETRIEVERS}`, `decision_engine.{detect_domain, search_domain,
   search_stack, evaluate_rules, ground, persist_grounding}`,
   `schema_validator.{load_manifest, validate_manifest, resolve_data_path,
   ManifestError, MANIFEST_VERSION, TIERS}`.
2. **CLI** — `ground.py {search|ground|validate}` with the flags shown above.
3. **Result shape** — search: `{domain|stack, query, file, count, results,
   scores, filtered_from, confidence{label,score}, evidence_gap[]}`;
   ground: `{domain, query, category, rule, rules_evaluation{matched,
   unmatched}, selections{<domain>: {best, alternatives, confidence}},
   confidence{label,score}, evidence_gap[]}`.
4. **Contract invariants** — every output carries `confidence` **and**
   `evidence_gap`; retrievers are name-selected (`bm25` default,
   `structured`, `hybrid`); no network, no subprocess, read-only except
   the opt-in `--persist DIR`.

## Manifest contract (schema-agnostic plug-in)

Each domain ships `data/manifest.json` beside its CSVs — declaring its
**own** axes; the engine never assumes the frontend schema:

```json
{
  "manifest_version": 1,
  "domain": "frontend-design",
  "tier": "conditional-grounding",
  "data_dir": ".",
  "retriever": "bm25",
  "default_domain": "style",
  "domains": {
    "style": {
      "file": "styles.csv",
      "search_cols": ["Style Category", "Keywords"],
      "output_cols": ["Style Category", "Best For"],
      "max_results": 3,
      "filters": {}
    }
  },
  "detect": { "style": ["minimalism", "glassmorphism"] },
  "stacks": { "react": "stacks/react.csv" },
  "stack_cols": { "search_cols": ["…"], "output_cols": ["…"] },
  "reasoning": {
    "file": "ui-reasoning.csv",
    "category_domain": "product",
    "category_column": "Product Type",
    "match_column": "UI_Category",
    "rules_column": "Decision_Rules",
    "priority_column": "Style_Priority",
    "priority_domain": "style",
    "name_columns": { "style": "Style Category" },
    "plan": { "style": 3, "color": 2 },
    "rules_module": "rules.py"
  },
  "owner": "package-maintainer",
  "refresh_cadence": "quarterly",
  "upstream": { "repo": "…", "sha": "…", "last_checked": "YYYY-MM-DD" }
}
```

- `tier` ∈ `lookup-only | conditional-grounding | constraint-emission`;
  `reasoning` is only legal above lookup-only.
- `owner`, `refresh_cadence`, `upstream{repo,sha,last_checked}` are
  **required** — provenance discipline per ADR-061 §6; an unowned corpus
  is not merged.
- `rules_module` (optional Python escape hatch where JSON rules cap out)
  must live beside the manifest — absolute paths and `..` are refused.
- Decision rules are surfaced as `matched` **and** `unmatched` — the full
  rule space stays auditable, never a hidden gate.

## Procedure: Author a new domain corpus

1. Pass the qualification rubric (ADR-061 §5): decision-rule utility beats
   row count; grounding must happen **before** action; "fits in 5 lines →
   it's a rule, not a corpus".
2. Write `data/manifest.json` + CSVs in your domain skill; run
   `ground.py validate`.
3. Name an owner + refresh cadence in the manifest, pin the upstream SHA.
4. Cite this skill from your domain skill; consult via the CLI (Tier-1
   consultation default — propose grounded options, human confirms).

## Gotchas

- An empty result is a legitimate outcome — surface the evidence gap and
  proceed on priors; never silently widen filters to force a hit.
- The structured `filters` pre-filter matches case-insensitive
  substrings; an over-specific value silently filters everything out —
  check `filtered_from` vs `count` when results look thin.
- `detect` keyword routing falls back to `default_domain`; product-shaped
  queries route best ("fintech dashboard"), generic words land on the
  default.
- BM25 tokenizer drops tokens ≤2 chars — "UI", "a11y" style queries need
  longer companions.

## Runtime-safety review (Step 1.6 record)

- **Read-only by default** — the engine opens corpus CSVs under the
  manifest's directory only (`resolve_data_path` refuses absolute paths
  and `..` escapes).
- **Single write surface** — `--persist DIR` (opt-in) writes markdown
  under the caller-chosen `DIR`; nothing else writes.
- **No network, no subprocess, no secrets** — pure stdlib; embeddings /
  remote retrievers are intentionally not implemented (ADR-061 §2).
- `rules_module` executes manifest-adjacent Python — same trust domain as
  the skill that ships the manifest; containment enforced by
  `resolve_data_path`.

## See also

- [`design-intelligence`](../design-intelligence/SKILL.md) — first consumer
  (frontend corpus + manifest).
- [ADR-061](../../../docs/decisions/ADR-061-corpus-grounding-layer.md) —
  architecture, qualification rubric, fork resolutions.
- [`docs/contracts/skill-bundled-assets.md`](../../../docs/contracts/skill-bundled-assets.md)
  — how bundled `scripts/` + `data/` reach consumer runtime.
- Tests: `tests/test_corpus_grounding_engine.py`,
  `tests/test_skill_bundled_assets.py`.
