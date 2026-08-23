# Frontend benchmark corpus

Registered by step 0.2 of
[`road-to-frontend-power`](../../../agents/roadmaps/road-to-frontend-power.md).
This directory is the frozen population every frontend measurement in that
roadmap is scored against.

## What it is

Twenty labelled cases plus three near-miss fixtures. Each case is a directory
holding a `case.yaml` (the prompt, the declared authority labels, and the
expected outcome) and the UI source files the prompt operates on. The near-miss
fixtures are the negative half: each one is a request that a naive detector or
router is expected to get *wrong*, and the fixture pins the correct answer.

## The authorship caveat — read this before citing a number

```
THIS CORPUS WAS AUTHORED BY THE SAME RUN THAT WROTE THE T7/T8 REGISTER SCOPE.
IT IS THEREFORE A ROUTING AND AUTHORITY POPULATION, NEVER A CLEAN-CORPUS
FALSE-POSITIVE MEASUREMENT. NO DETECTOR ROW MAY BE PROMOTED TO `backed`
AGAINST IT.
```

Risk 6 of the parent roadmap names exactly this failure: "One effort ships both
the engine and the corpus that scores it." The ordering mitigation the roadmap
specifies — the corpus hash commits before any engine commit — controls
*sequence* and not *authorship*, and sequence is the weaker of the two. So the
scope is stated here rather than left to a reader to infer:

- **Admissible** — routing labels (surface mode, change intent, reference
  maturity), authority-resolution expectations, and the three near-miss
  fixtures. These are declarations about what the right answer *is*, and they
  are falsifiable by inspection: a wrong label is visible in the case file.
- **NOT admissible** — any `M1 = 0` false-positive claim, and therefore any
  promotion of a `judgment-only` catalog row to `backed`. An FP rate measured
  on UI this run wrote to exercise the rules is a measurement of the author's
  intent, not of the rules.

The clean-corpus population for FP measurement already exists and is separate:
`internal/bench/corpora/design-slop-clean/`. Nothing here replaces it.

## Hashing

`CORPUS.sha256` is produced and verified by
[`src/scripts/frontend_corpus_hash.ts`](../../../src/scripts/frontend_corpus_hash.ts):

```bash
./scripts-run src/scripts/frontend_corpus_hash          # print the manifest
./scripts-run src/scripts/frontend_corpus_hash --write  # (re)write CORPUS.sha256
./scripts-run src/scripts/frontend_corpus_hash --check   # exit 1 on drift
```

The manifest covers every file under `cases/` and `near-miss/` and excludes
`CORPUS.sha256` itself. `tests/eval/frontend-corpus.test.ts` runs `--check`, so
an edit to a case without a rehash fails the suite rather than silently moving
the population under a published number.

## Case label vocabulary

Taken from the `ui_authority` contract
([`docs/contracts/ui-authority.md`](../../../docs/contracts/ui-authority.md)) —
this corpus does not define a second one.

| Field | Values |
|---|---|
| `surface_mode` | `persuade` · `operate` · `read` · `experience` |
| `register` | `brand` · `product` |
| `change_intent` | `preserve` · `extend` · `redesign` · `new-world` |
| `reference_maturity` | `wireframe` · `prototype` · `finished-comp` · `runnable-artifact` · `production-incumbent` · `null` |
