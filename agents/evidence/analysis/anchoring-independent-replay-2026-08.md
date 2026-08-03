# Anchored-keyword matcher — independent recall replay (2026-08-03)

Answers external-review Finding 3 on PR #1133: the −12.5% unintended-census
measurement ran over the matrix-DERIVED corpus, and 6 German matrix
positives were re-authored in the same commit — the measurement corpus was
co-edited during measurement. This replay removes that circularity.

## Method

Both matcher arms (OLD: case-insensitive unanchored substring; NEW:
`keyword_matches_anchored`, shipped) replayed over every labelled prompt in
the corpora that were NOT derived from the routing matrices and NOT edited
by the anchoring change:

- `tests/eval/corpus-dev.yaml`, `tests/eval/corpus-non-dev.yaml`
- `internal/bench/corpora/router-coverage/{agent-docs-edits, framework-routing,
  git-surface, roadmap-ops, slash-commands}.yaml`

(`routing-matrix-derived.yaml` deliberately excluded — it IS the co-edited
corpus.) `phrase`/`path_prefix` semantics identical in both arms; verdicts
against `dist/router.json` at the PR-#1133 merge state.

## Result

| Metric | old (substring) | new (anchored) |
|---|---:|---:|
| Prompts replayed | 49 | 49 |
| Intended-trigger labels | 17 | 17 |
| Intended hits (recall) | 15 (0.882) | 15 (0.882) |
| Labels LOST by anchoring | — | **0** |
| Unintended activations | 110 | 99 (−10.0%) |

The two intended misses are identical in both arms (pre-existing gaps for
prompts whose rules activate by description, not lexically) — they are not
anchoring losses.

## Reading

- **Recall on un-edited real-corpus labels: unchanged, zero losses.** The
  matrix-corpus census ("zero intended positives lost") is therefore NOT an
  artifact of the co-edit; the independent corpus reproduces it.
- **Precision direction reproduced independently:** −10.0% unintended here
  vs −12.5% on the derived corpus.
- Honest scope note: 17 labels is a small sample; the derived corpus (302
  prompts / 97 rule ids) remains the primary coverage instrument — this
  replay's job is only to break the circularity, which it does.

Reproduction: one-shot tsx replay (both arms inline over
`router_telemetry.keyword_matches_anchored` + a substring twin); numbers
above are the committed record.
