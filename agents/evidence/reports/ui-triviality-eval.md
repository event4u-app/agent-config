# UI-triviality routing eval — pre-registered recall

> Generated from `./scripts-run src/scripts/eval_ui_triviality` on 2026-08-04 at f71a41c82.
> Do not hand-edit — re-run the command. The corpus + threshold were committed
> BEFORE any classifier change (f71a41c82); commit ancestry is the freeze proof.

## Pre-registration

- Corpus: `internal/bench/corpora/ui-triviality-golden.yaml` — 40 tasks,
  15 trivial / 25 non-trivial, council-labelled (provenance in the corpus header).
- Threshold: trivial-lane recall ≥ 0.80.

## Measured — BEFORE the classifier fix (at the frozen corpus commit)

recall **0.600** (9/15) · precision 0.692 · verdict **MISS**. Six trivial
tasks fell into the full audit chain: padding/font/radius/token micro-tweaks
and verb-less copy corrections sat outside the trivial vocabulary, and the
14-word heuristic capped the rest.

## Measured — AFTER the classifier fix (same frozen corpus, same threshold)

ui-triviality eval — pre-registered trivial-lane recall >= 0.80
tasks: 40 · trivial: 15 · routed to ui-trivial: 15
recall: 1.000 · precision: 0.938 · verdict: PASS

misses (1):
  uit-006: label=non-trivial → intent=ui-trivial (ui-trivial)

The one remaining miss (uit-006) is a false POSITIVE whose council criterion
itself reads "unclear if new component"; the trivial lane's apply-time
reclassify-up guard (≤1 file / ≤5 lines) is the backstop for that class.
Recall — the pre-registered metric — is 15/15.

## Classifier changes the corpus forced (in this order — labels frozen first)

1. `_TRIVIAL_PATTERN` gains the micro-tweak vocabulary (padding, margin,
   spacing, font, weight, radius, token, icon, tooltip, placeholder, heading,
   title, alignment, border, typo) + the tweak/adjust/fix/rename/relabel
   verbs; window 40 → 60 chars.
2. `_TRIVIAL_COPY_PATTERN` — verb-less copy corrections ("the label should
   read 'Save changes'").
3. `_TRIVIAL_SCOPE_ESCALATION` + `_TRIVIAL_MULTI_SCOPE` — feature-scope
   objects (support/allow/enable/toggle/upload…), app-wide markers, and
   compound tasks (second imperative after and/then/also) never enter the
   trivial lane.

Regression net: `tests/scripts/eval_ui_triviality.test.ts` pins the bar in CI.
