# Feature: Skill Linter — Execution Governance

> **Status:** ✅ Complete (Phases 1-5 implemented, nice-to-haves deferred)

## Problem

The skill linter validates structure (required sections, frontmatter) but does not enforce
**execution quality** — whether skills actually make agents work like real developers.
This leads to skills that pass linting but produce poor agent behavior: guessing instead of
analyzing, skipping verification, loading full datasets, brute-forcing solutions.

## Goal

Extend the linter from schema validation to **three-layer governance**:

1. **Schema Quality** — required sections, structure, formal completeness (✅ exists)
2. **Execution Quality** — analysis-before-action, real verification, efficient tooling, anti-bruteforce
3. **Governance Quality** — type boundaries (rule vs skill vs guideline), packaging consistency

## Design Principles

- **Start simple** — keyword/structure heuristics first, not semantic parsing
- **Warnings before errors** — observe, then harden
- **High signal, low noise** — only checks that produce real quality gains
- **CI-ready** — deterministic, fast, explainable
- **Explainable output** — every message says what's missing, why it matters, how to fix it

## Phases

### Phase 1: Execution Quality Foundation ✅

7 checks implemented (2 errors, 5 warnings). See `scripts/skill_linter.py`.
Detection via file-name signals + content threshold. Commands/guidelines excluded.

**Current stats:** 128 pass, 78 warn, 8 fail across 214 artifacts.

### Phase 2: Fix Failing Artifacts + Harden Heuristics

Fix the 8 skills that fail `missing_analysis_before_action`. Reduce false positives
by expanding signal synonyms. Add section-based detection as complement to keywords.

### Phase 3: Type Boundary Enforcement

Ensure clean separation between rule/skill/guideline/command. Detect misuse:
rules that are too procedural, guidelines with executable procedures, pointer-only skills.

### Phase 4: Verification Maturity

Map task types to expected verification methods. Backend → curl/Postman,
Frontend → Playwright, CLI → command execution, DB → query verification.

### Phase 5: Governance & Packaging Consistency

Compressed/uncompressed pairs, hash consistency, duplicate detection,
cross-file dependency checks, baseline/ratchet mode for CI.

## Rollout Strategy

1. **Observe** — new checks as warnings, visible in CI, no build blockers
2. **Protect new changes** — block only changed files, tolerate legacy
3. **Ratchet** — save baseline, forbid new violations, reduce legacy gradually
4. **Enforce** — promote selected warnings to errors

## Risks

| Risk | Mitigation |
|---|---|
| False positives | Strong/weak signal separation, tests with real repo examples |
| Keyword overfitting | Signal groups, not single keywords; good/bad examples |
| Legacy friction | Ratchet, not big bang; changed files first |
| Boundary drift | Phase 3 early; clear type rules documented |

## Roadmaps

- [`agents/roadmaps/linter-execution-governance.md`](../roadmaps/archive/linter-execution-governance.md) — Implementation roadmap

## Out of Scope (V1)

- Semantic deep parsing / ML classification
- Automatic skill rewrites
- Runtime observability
- Tool execution inside the linter
