# Code-graph vs grep — in-repo corpus, 2026-08-28

> **NOT COMPARABLE to the 2026-07-28 run.** Different corpus, different
> question set, different build, different bars. No delta may be computed
> between the two in either direction. That run is untouched and remains the
> only measurement of the registered external corpora.

Pre-registered in `internal/bench/code-graph/PREREGISTRATION-inrepo-2026-08-28.md` before this run.
Corpus `inrepo-corpus-2026-08-28.yaml` bound by SHA-256 `52d69c1bd994cb32…`; the runner refuses on mismatch.

**Measured commit:** `c454648af6996db2affa6f76c86c349677cee703` (2026-08-28) — postdates the 2026-08-22 extractor repair, asserted by the runner rather than read by eye.

## CORRECTED 2026-08-29 — this report published a false root cause

**No number below changed.** This run's arithmetic was faithful to its own
pre-registration, which defines arm B as `affected` + `query` and hands both
arms one probe token. What was false was the *explanation*.

This report said of `path-between`: *"Both arms returned the empty set on every
question in this class."* **That is false for the graph arm.** The engine
answered all three questions. The runner's relevance filter compared each
returned node's symbol segment against the entire probe string
`"cmdBuild -> getParser"` — a string no symbol contains — and discarded every
correct relation. The class was never symmetric silence: grep genuinely had no
text to find, and the graph found the answer and had it thrown away by the
scorer.

Two further scorer defects, recorded here and repaired in v2 rather than here:

1. This run **never invoked the shipped `path <a> <b>` verb**. Its graph arm ran
   only `affected` and `query` — the two verbs that do not answer the class.
2. It **counted unresolved `symbol:` pseudo-nodes as files**. `p.split('#')[0]`
   on `symbol:DatabaseSync` returns the whole token, which the scorer added to a
   set it treats as files; the `code_graph` root alone carries 152 such
   endpoints. `callers` was ruled `NULL` **on the precision floor alone**, with
   recall tied at 1.000/1.000 — so that verdict is harness-caused too.

**Measured-commit reachability.** `c454648af…` is **not an ancestor of `main`**;
it survives only on the local branch `drain/code-graph-evidence-that-exists`, so
the pointer below resolves to nothing in a fresh clone. The measured *content*
is reachable at `6a5670b78` (the squash merge of PR #1705, on `main`): all three
measured roots and the corpus file are byte-identical there, and the scoring
functions did not change between the two commits, so this run reproduces at
`6a5670b78`. Tree hashes, which survive a squash merge:

| Measured path | tree |
|---|---|
| `src/scripts/code_graph` | `e55fc87c7081359e1c0e2bf8263f17358de2e315` |
| `src/shared` | `dcdc68073e0f2340b3734678cc4e82f34c241dba` |
| `src/scripts/ai_council` | `778a493ba915795159adcb0bb789e93b89d6a86a` |

**The repaired measurement is a new registration, not an edit of this one:**
`internal/bench/reports/code-graph-vs-grep-inrepo-v2-2026-08-29.md`.

## Per-class verdicts — the pre-registered bars

Bar per class: recall delta ≥ +10 pp **and** precision within 5 pp.

| Class | n | grep R | graph R | Δ recall (pp) | grep P | graph P | precision ok | registered verdict | validity |
|---|---|---|---|---|---|---|---|---|---|
| `callers` | 3 | 1 | 1 | +0 | 0.611 | 0.258 | no | NULL | **VALID** |
| `transitive-impact` | 3 | 0.611 | 0.5 | -11.1 | 1 | 0.467 | no | NULL | **VALID** |
| `path-between` | 3 | 0 | 0 | +0 | 0 | 0 | yes | TIE | **VOID — INSTRUMENT FAILURE** |
| `references` | 3 | 1 | 0.333 | -66.7 | 1 | 0.333 | no | NULL | **VALID** |

Two columns, deliberately. **Registered verdict** is the runner's arithmetic under the pre-registered bars, preserved verbatim. **Validity** is whether that arithmetic measured anything. Neither replaces the other.

> **`path-between` — VOID — INSTRUMENT FAILURE.** Every metric read zero for both arms in this class, so this run measured nothing here — but NOT symmetrically, and the two arms did not fail for the same reason. CORRECTED 2026-08-29, replacing a note that claimed both arms returned the empty set: on `path-between` the grep arm genuinely found nothing (a word-boundary search for a token containing " -> " matches no text), while the GRAPH ARM ANSWERED ALL THREE QUESTIONS and this runner's relevance filter discarded the answer, because it compares each returned symbol against the whole two-endpoint probe string. The defect is in this scorer, not in the engine. The registered verdict above is this runner's arithmetic and is preserved unchanged; the repaired measurement is a separate registration, `PREREGISTRATION-inrepo-v2-2026-08-29.md`.

**Negative controls** (n=4): grep recall 1, graph recall 0 — floor (graph ≥ 0.9 × grep) **FAILED**.

**Classes won (valid classes only):** none.
**Classes void:** `path-between` — measured nothing, excluded from any win count.

## Negative controls — the floor failed, and what that does and does not mean

The four controls are literal-string searches (a config key, a log filename, an env var name, a comment fragment). This engine indexes SYMBOLS and call relations, not string literals, so it scores 0.000 on all four by construction. The pre-registered floor is reported FAILED because it was registered and cannot be discarded after the fact — but a reader must not read it as an implementation defect. AI council 2026-08-28 split on this and resolved it by naming the claim: if the claim were "graph retrieval replaces grep for repository investigation" the controls are valid and the failure matters; if the claim is "graph retrieval improves structural code questions" the controls sit outside that construct. This benchmark makes only the second claim. A v2 registration must separate IN-DOMAIN negative controls (symbol-shaped probes whose correct answer is empty, testing false positives) from CAPABILITY-BOUNDARY tests (literals, filenames, config keys), reported separately.

## No overall engine verdict is derived from this run

No overall engine verdict is derived from this run. Two of five classes measured the instrument rather than the engine: path-between is VOID — and CORRECTED 2026-08-29, because of a defect in THIS RUNNER rather than a symmetric silence, the graph arm having answered and been discarded by the scorer — and the negative-control floor tests a construct this benchmark does not claim. The defensible statement is "zero classes met the pre-registered win criterion", NOT "grep proved superior across all classes". A v2 registration is a NEW confirmatory experiment, never a repaired continuation of this one; it exists at PREREGISTRATION-inrepo-v2-2026-08-29.md and its result is at internal/bench/reports/code-graph-vs-grep-inrepo-v2-2026-08-29.md.

## Macro average — reported only, NOT a pass criterion

Printed so a reader can see the aggregate the old run would have reported. No verdict is derived from it, by the pre-registration's own terms.

| Arm | precision | recall |
|---|---|---|
| grep | 0.653 | 0.653 |
| graph | 0.265 | 0.458 |

## Per-question rows

| id | class | root | grep P/R | graph P/R | graph missed |
|---|---|---|---|---|---|
| `cg-callers-01` | callers | code_graph | 0.667/1 | 0.125/1 | — |
| `sh-callers-01` | callers | shared | 0.667/1 | 0.4/1 | — |
| `ac-callers-01` | callers | ai_council | 0.5/1 | 0.25/1 | — |
| `cg-impact-01` | transitive-impact | code_graph | 1/0.5 | 0.4/0.5 | `build.ts`, `cli.ts` |
| `sh-impact-01` | transitive-impact | shared | 1/0.333 | 0/0 | `settingsClasses.ts`, `settingsAsks.ts`, `settingsConsent.ts` |
| `ac-impact-01` | transitive-impact | ai_council | 1/1 | 1/1 | — |
| `cg-path-01` | path-between | code_graph | 0/0 | 0/0 | `cli.ts`, `build.ts`, `extract.ts`, `loader.ts` |
| `ac-path-01` | path-between | ai_council | 0/0 | 0/0 | `orchestrator.ts`, `pricing.ts`, `_default_prices.ts` |
| `ac-path-02` | path-between | ai_council | 0/0 | 0/0 | `low_impact.ts`, `low_impact_corpus.ts` |
| `cg-references-01` | references | code_graph | 1/1 | 0/0 | `types.ts`, `build.ts` |
| `sh-references-01` | references | shared | 1/1 | 0/0 | `settingsClasses.ts`, `settingsAsks.ts`, `settingsConsent.ts` |
| `ac-references-01` | references | ai_council | 1/1 | 1/1 | — |
| `cg-negative-01` | negative-control | code_graph | 1/1 | 0/0 | `cli.ts` |
| `sh-negative-01` | negative-control | shared | 1/1 | 0/0 | `settingsSurface.ts` |
| `ac-negative-01` | negative-control | ai_council | 1/1 | 0/0 | `budget_guard.ts` |
| `ac-negative-02` | negative-control | ai_council | 1/1 | 0/0 | `config.ts` |

## Build times

- `code_graph` — 408 ms
- `shared` — 749 ms
- `ai_council` — 701 ms

## What this result may and may not change

It may change **routing** — which classes the code-intelligence skill and the
`external-code-graph-interop` rule name as graph-first. It may **not** change
permission: no setting default moves and no dependency moves between
`devDependencies` and `dependencies`. That is ADR-246's question, and reopening
it is a separate change under `decision-revisit-gate`.

