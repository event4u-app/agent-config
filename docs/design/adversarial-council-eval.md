# Adversarial verification council eval — two-stage residual-detection design

> Design artifact for `road-to-adversarial-verification-council` Phase 4. It
> pins the benchmark that resolves the pre-registered `adversarial-council-
> finding-coverage` claim (docs/CLAIMS.md, ADR-122). Writing this design is
> autonomous; **curating the corpus and running the paid cross-vendor arm is a
> maintainer cost decision**, gated on the corpus-validity check below.

## What the claim is — and is not

- **Is:** does a cross-vendor skeptic panel find materially more of the defects
  that **survive a single strong judge** (the residual pool), at a false-positive
  rate no worse than that judge on a controversial-but-correct control?
- **Is not:** whether the council beats a solo model on *decision quality* — that
  is the separate, `unbacked`, spend-gated `council-vs-solo-baseline`
  (docs/design/council-vs-solo-baseline.md), explicitly out of scope.

## The council's load-bearing critique (folded in)

The AI-council debate (2026-07-14, anthropic/claude-sonnet-4-5 + openai/gpt-4o)
converged on one real risk: the existing `cross-model-parity` corpus was built
to show that different vendors catch different **obvious** things (parity), not
to simulate the **residual** state after a competent first pass. Running the
registered claim on it would force an honest-null as a *measurement artifact*,
not a mechanism result. This design answers that with a two-stage protocol, a
corpus-subtlety bar, a dual threshold, and a controversial-clean FP control.

## Two-stage protocol

1. **Stage 1 — single strong judge.** A single cross-model judge runs on every
   planted-defect change. The defects it CATCHES are removed from scope.
2. **Stage 2 — the panel on the residual.** Only the changes that PASS stage 1
   (defect not caught) proceed to the Mode 9 panel. Recall is measured on this
   **judge-passed residual pool** — the production-relevant quantity.

This makes "residual detection" explicit rather than implicit in corpus
selection.

## Corpus-validity gate (blocks the registered run)

The corpus must contain **judge-survivable subtleties**, published as a
distribution before the registered run:

- multi-file interaction defects,
- subtle logic inversions that read as plausible,
- security masked by correct-looking patterns,
- edge cases in complex state.

Publish the severity/subtlety distribution (share single-file <5 LoC vs
multi-file interaction). A corpus skewed to trivially-detectable defects fails
this gate — the registered run does not proceed until it passes.

### Assessment of the existing corpus (2026-07-14)

`internal/bench/orchestration/corpus/` (5 tasks: orch-01..03, pv-01 hollow,
pv-02 control) was purpose-built for the parity signal and for A3
production-validator Gate-A. `pv-01` is a deliberately **obvious** hollow impl
(a floor sanity check), and none of the five tasks is designed as a
judge-survivable residual defect. **Conclusion: this corpus does NOT meet the
subtlety bar** — so the registered run is **blocked** pending a curated
residual-defect corpus. The claim stays `unbacked` until then (no false
`backed`).

## Controversial-but-correct FP control

The clean control includes correct-but-non-obvious cases (real perf/security
design tradeoffs, uncommon patterns) — not only obviously-clean code — so the
red-team posture's true FP cost is measured. Panel FP is compared to the
single-judge FP on the SAME control.

## Panel = cross-vendor

The registered run and the opt-in high-risk tier use >=2 distinct **providers**
(e.g. anthropic + openai), via the council transport (`council_cli.ts`,
artefact/diff-as-text, read-only). The backed `cross-vendor-parity` signal is
provider-level; same-vendor model diversity is insufficient for the claim.

## The gate (locked at pre-registration)

Encoded in [`src/scripts/_lib/adversarial_council_gate.ts`](../../src/scripts/_lib/adversarial_council_gate.ts)
(`evaluateCouncilBench`), covered by `adversarial_council_gate.test.ts`:

- (a) relative residual-recall lift >= **+25%**, AND
- (b) absolute residual-recall lift >= **+8 pp**, AND
- panel FP not worse than single-judge FP within the noise margin.

Both recall thresholds are required — the dual gate guards the base-rate
compression the council flagged (a high single-judge baseline makes relative
lift easy but absolute must still clear). Threshold values are **locked**;
corpus/protocol may be refined *before* the registered run, never the threshold
after seeing results.

## Outcome handling

- **Pass** → flip `docs/CLAIMS.md#adversarial-council-finding-coverage` to
  `backed` with the report pointer; document the recommended cross-vendor config.
- **Honest-null** → record it (ADR-122 addendum + `docs/benchmark.md`), keep the
  surface `off` by default permanently, mark the roadmap null-but-shipped-inert
  (like recursive-verification).

## Status

- Gate logic: **built + tested** (deterministic TS).
- Corpus-validity gate: **assessed — existing corpus fails the subtlety bar.**
- Registered paid cross-vendor run: **deferred**, blocked on curating a
  judge-survivable-subtlety corpus. Claim remains `unbacked`.
