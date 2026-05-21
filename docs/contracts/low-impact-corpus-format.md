---
stability: beta
keep-beta-until: 2026-08-13
---

# `low-impact-decisions.md` — corpus format contract (step-9 P4)

Parser-visible invariants for `agents/decisions/low-impact-decisions.md` and any
upstream seed at the same path. The hardened parser lives in
[`scripts/ai_council/low_impact_corpus.py`](../../scripts/ai_council/low_impact_corpus.py)
and ships in two modes:

| Mode | Entry point | Behaviour on drift |
|---|---|---|
| **Lenient** (routing hot-path) | `load_validated_phrases(path)` | Silently drops the offending line. Routing never blocks on a malformed corpus. |
| **Strict** (CI lint + intake) | `parse_corpus_strict(path)` | Raises `CorpusParseError` with a typed `reason` and 1-based `line` on the first anomaly. |

## Required sections

```
## On Probation

<!-- intake-anchor: probation -->

…

## Validated

<!-- intake-anchor: validated -->

…

## Anti-Examples (Always Ask User)

…
```

- Heading level **MUST** be `##` (two hashes). `###` → `heading_drift`.
- Trailing punctuation on a heading (`## Validated:`) → `heading_drift`.
- Sections may appear in any order; missing sections are tolerated by
  both modes (an empty corpus is valid).
- The intake-anchor HTML comments **MUST** be present for the two
  intake-bearing sections (`probation`, `validated`) once any section
  body is present. Strict mode raises `missing_anchor` otherwise; the
  lenient shim ignores anchors (anchors are for the intake writer, not
  the routing reader).

## Bullet shape

```
- "<phrase>" — optional trailing metadata
```

Strict invariants:

| Drift | `reason` | Example |
|---|---|---|
| Curly opening quote (`U+201C` / `U+2018`) | `curly_quotes` | `- “foo bar”` |
| Single-quoted phrase | `single_quotes` | `- 'foo bar'` |
| Non-dash list marker (`*`, `+`, `1.`) | `non_dash_bullet` | `* "foo bar"` |
| Opening `"` with no matching close on the same line | `unclosed_quote` | `- "foo bar — meta` |
| Phrase normalises to empty (whitespace / punctuation only) | `empty_phrase` | `- "   …"` |

Trailing metadata (everything after the closing `"`) is preserved on
the `CorpusEntry.trailing_metadata` field but is **not** consulted for
routing — only the normalised phrase is.

## Phrase normalisation

A phrase is normalised before equality / similarity comparison:

1. Lowercase.
2. Replace every non-`[\w\s]` character with a single space.
3. Collapse runs of whitespace.
4. Strip leading / trailing whitespace.

This normalisation runs in both modes and is stable across the
routing classifier (`classify_impact_with_corpus`), the intake module
(`low_impact_intake`), and the probation gate.

## Failure-mode fixtures

The seven canonical failure cases ship as fixtures under
[`tests/fixtures/corpus-robust/`](../../tests/fixtures/corpus-robust/),
one file per `reason`. The strict-mode suite
[`tests/test_low_impact_corpus_robustness.py`](../../tests/test_low_impact_corpus_robustness.py)
asserts each fixture trips the matching `CorpusParseError.reason` and
that the lenient shim degrades silently for per-bullet drift.

## Cross-references

- Privacy floor — `.augment/rules/low-impact-corpus-privacy-floor.md`
- Routing — `scripts/ai_council/necessity.py § classify_impact_with_corpus`
- Intake — `scripts/ai_council/low_impact_intake.py`
- Promotion / pruning — `scripts/ai_council/probation_gate.py`
