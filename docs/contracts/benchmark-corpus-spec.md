---
stability: beta
keep-beta-until: 2026-08-14
---

# Benchmark Corpus Spec — step-4 Phase 1

Parser-visible contract for the golden corpus consumed by
[`scripts/bench_runner.py`](../../scripts/bench_runner.py) and the
upcoming `scripts/lint_bench_corpus.py`. Defines composition, schema,
and validation invariants.

## Path decision

Roadmap `step-4-measurement-and-benchmark.md`
Phase 1 Step 2 names `bench/corpus.yaml`. The existing benchmark
infrastructure (runner + non-dev corpus + `task bench`) lives under
`tests/eval/` and `scripts/bench_runner.py` hardcodes that directory.
**Canonical location:** `tests/eval/corpus-<id>.yaml`. The `bench/`
directory is reserved for **reports + pricing** (Phase 2 deliverables).
Migration to `bench/corpus.yaml` is a no-op rename if downstream Phase
2 work proves the consolidation is worth the diff cost.

## Composition (25 prompts)

| Bucket | Count | Purpose |
|---|---|---|
| **Routing-canonical** | 10 | One prompt per major skill cluster — exact-match scoring |
| **Ambiguous** | 8 | Multiple plausible skills — set-intersection ≥ 0.7 scoring |
| **Destructive / security carve-out** | 5 | Triggers a safety floor — selection must surface the floor skill |
| **Long-context** | 2 | ≥ 4 k input tokens — exercises retrieval under context pressure |

The 10 routing-canonical prompts MUST cover the kernel + tier-1 skill
clusters used by the dev profile (`developer.yml`). The 8 ambiguous
prompts MUST each declare ≥ 2 acceptable skills in `expected_skills`.
The 5 destructive / security prompts MUST declare an
`expected_carve_outs` value (e.g. `security-sensitive-stop`,
`non-destructive-by-default`).

## Schema

```yaml
version: 1                              # corpus format version (int)
corpus_id: <id>                         # short kebab-case identifier
selection_accuracy_target: 0.60         # 0.0–1.0; runner exits non-zero below
prompts:
  - id: <bucket>-<NN>                   # e.g. canonical-01, ambiguous-03
    category: <bucket>                  # canonical | ambiguous | destructive | long-context
    user_type_candidates: [<slug>, ...] # optional; informational
    language: en                        # en | de — per language-and-tone
    prompt: "<text>"                    # the agent-facing prompt
    expected_skills: [<slug>, ...]      # ≥ 1 entry; non-empty
    expected_carve_outs: [<slug>, ...]  # required when category == destructive
    rubric:                             # optional structural assertion
      must_include: ["<phrase>", ...]   # all phrases must appear in output
      must_not_include: ["<phrase>", ...]
      length_words: { min: 0, max: 0 }
    quality_assertion: "<regex>"        # optional regex over agent output
```

### Invariants (lint-bench gate)

| Drift | `reason` | Example |
|---|---|---|
| Missing top-level `version` / `corpus_id` / `prompts` | `missing_top_level` | — |
| `version` not in `{1}` | `unsupported_version` | `version: 2` |
| `selection_accuracy_target` outside `[0.0, 1.0]` | `target_out_of_range` | `1.5` |
| Duplicate `id` across prompts | `duplicate_id` | two `canonical-01` |
| `id` does not match `^[a-z][a-z0-9-]*-\d{2}$` | `bad_id_format` | `Canonical_1` |
| `category` not in `{canonical, ambiguous, destructive, long-context}` | `bad_category` | `category: misc` |
| `language` not in `{en, de}` | `bad_language` | `language: fr` |
| `expected_skills` empty / missing | `empty_expected` | `expected_skills: []` |
| `expected_skills` references an unknown skill slug | `unknown_skill` | `expected_skills: [imaginary]` |
| `category == destructive` without `expected_carve_outs` | `missing_carve_out` | — |
| Prompt text empty / whitespace-only | `empty_prompt` | — |

The linter MUST run with `--quiet` honour per the script-output
convention and emit one violation per line in non-quiet mode.

## Composition gates (25-prompt-complete state)

Once `corpus-dev.yaml` reaches the 25-prompt target, the linter
additionally enforces the per-bucket counts above. Until then, the
linter only enforces per-prompt invariants — partial corpora are
valid during Phase 1 build-out.

The composition gate is opt-in via `--require-full` to keep the
reduced 10-prompt suite (Phase 1 Step 4) usable during development
without tripping CI.

## Cross-references

- Runner — [`scripts/bench_runner.py`](../../scripts/bench_runner.py)
- Linter — `scripts/lint_bench_corpus.py` (Phase 1 Step 3)
- Existing non-dev corpus — [`tests/eval/corpus-non-dev.yaml`](../../tests/eval/corpus-non-dev.yaml)
- Language gate — [`language-and-tone`](../../.agent-src.uncompressed/rules/language-and-tone.md)
- Report schema — `docs/contracts/benchmark-report-schema.md` (Phase 2 Step 4)
