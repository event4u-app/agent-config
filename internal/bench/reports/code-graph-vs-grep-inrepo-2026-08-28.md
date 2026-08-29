# Code-graph vs grep — in-repo corpus, 2026-08-28

> **NOT COMPARABLE to the 2026-07-28 run.** Different corpus, different
> question set, different build, different bars. No delta may be computed
> between the two in either direction. That run is untouched and remains the
> only measurement of the registered external corpora.

Pre-registered in `internal/bench/code-graph/PREREGISTRATION-inrepo-2026-08-28.md` before this run.
Corpus `inrepo-corpus-2026-08-28.yaml` bound by SHA-256 `52d69c1bd994cb32…`; the runner refuses on mismatch.

**Measured commit:** `c454648af6996db2affa6f76c86c349677cee703` (2026-08-28) — postdates the 2026-08-22 extractor repair, asserted by the runner rather than read by eye.

## Per-class verdicts — the pre-registered bars

Bar per class: recall delta ≥ +10 pp **and** precision within 5 pp.

| Class | n | grep R | graph R | Δ recall (pp) | grep P | graph P | precision ok | registered verdict | validity |
|---|---|---|---|---|---|---|---|---|---|
| `callers` | 3 | 1 | 1 | +0 | 0.611 | 0.258 | no | NULL | **VALID** |
| `transitive-impact` | 3 | 0.611 | 0.5 | -11.1 | 1 | 0.467 | no | NULL | **VALID** |
| `path-between` | 3 | 0 | 0 | +0 | 0 | 0 | yes | TIE | **VOID — INSTRUMENT FAILURE** |
| `references` | 3 | 1 | 0.333 | -66.7 | 1 | 0.333 | no | NULL | **VALID** |

Two columns, deliberately. **Registered verdict** is the runner's arithmetic under the pre-registered bars, preserved verbatim. **Validity** is whether that arithmetic measured anything. Neither replaces the other.

> **`path-between` — VOID — INSTRUMENT FAILURE.** Both arms returned the empty set on every question in this class, so nothing was measured. The registered verdict above is the runner's arithmetic and is preserved; it is not a defensible substantive interpretation.

**Negative controls** (n=4): grep recall 1, graph recall 0 — floor (graph ≥ 0.9 × grep) **FAILED**.

**Classes won (valid classes only):** none.
**Classes void:** `path-between` — measured nothing, excluded from any win count.

## Negative controls — the floor failed, and what that does and does not mean

The four controls are literal-string searches (a config key, a log filename, an env var name, a comment fragment). This engine indexes SYMBOLS and call relations, not string literals, so it scores 0.000 on all four by construction. The pre-registered floor is reported FAILED because it was registered and cannot be discarded after the fact — but a reader must not read it as an implementation defect. AI council 2026-08-28 split on this and resolved it by naming the claim: if the claim were "graph retrieval replaces grep for repository investigation" the controls are valid and the failure matters; if the claim is "graph retrieval improves structural code questions" the controls sit outside that construct. This benchmark makes only the second claim. A v2 registration must separate IN-DOMAIN negative controls (symbol-shaped probes whose correct answer is empty, testing false positives) from CAPABILITY-BOUNDARY tests (literals, filenames, config keys), reported separately.

## No overall engine verdict is derived from this run

No overall engine verdict is derived from this run. Two of five classes measured the instrument rather than the engine: path-between is VOID, and the negative-control floor tests a construct this benchmark does not claim. The defensible statement is "zero classes met the pre-registered win criterion", NOT "grep proved superior across all classes". A v2 registration is a NEW confirmatory experiment, never a repaired continuation of this one.

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

