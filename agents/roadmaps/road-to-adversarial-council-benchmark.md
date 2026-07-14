---
complexity: structural
status: draft
---

# Road to resolving the adversarial-council finding-coverage claim (benchmark arm)

> **Draft — spawned follow-up.** The adversarial-verification-council *build*
> shipped (Mode 9 of `subagent-orchestration`, default-off, advisory-only;
> ADR-122). Only the pre-registered **finding-coverage benchmark** remained
> open, and it is blocked *by design* on two gates that this roadmap carries
> forward: a curated judge-survivable-subtlety corpus, and a maintainer-gated
> paid cross-vendor run. The predecessor roadmap was archived complete once its
> build phases landed; this roadmap owns the one deferred item.

## Provenance (durable pointers, not roadmap links)

- Decision record: [`docs/decisions/ADR-122-adversarial-verification-council.md`](../../docs/decisions/ADR-122-adversarial-verification-council.md).
- Benchmark design + corpus-validity bar: [`docs/design/adversarial-council-eval.md`](../../docs/design/adversarial-council-eval.md).
- Pre-registered claim entry: `adversarial-council-finding-coverage` (state `unbacked`
  until this arm resolves it).

## Goal

Resolve the pre-registered `adversarial-council-finding-coverage` claim with a
reproducible, two-stage benchmark on a **valid** corpus, and record the verdict
honestly: `backed` with evidence, **or** a documented honest-null that keeps the
Mode 9 surface default-off permanently. No false `backed` without a passing run;
running on an invalid (parity) corpus is forbidden — it would be the measurement
artifact the council warned against.

## The pre-registered claim (locked at pre-registration — no post-hoc shopping)

```
claim: adversarial-council-finding-coverage
On the RESIDUAL defect pool — planted defects that SURVIVE a single strong
cross-model judge — an adversarial panel of >=2 distinct-model (cross-vendor)
skeptics finds materially more of the residual defects than that single judge,
at a held-or-lower false-positive rate on a controversial-but-correct control.
Dual threshold (both must hold):
  (a) relative residual-recall lift >= +25%, AND
  (b) absolute residual-recall lift >= +8 percentage points
  AND false-positive rate on the controversial-clean control not worse than the
      single-judge baseline (within noise).
Honest-null (either threshold missed OR FP rate worse) => surface disabled by
default permanently, recorded like recursive-verification.
```

The threshold and the dual-gate shape are fixed. The corpus and protocol may be
refined *before* the registered run; the pass/fail numbers may not move after it.

## What already exists (build on these — do not rebuild)

- The dual-threshold gate in TS with tests:
  `src/scripts/_lib/adversarial_council_gate.ts` (`evaluateCouncilBench`,
  `RELATIVE_LIFT_THRESHOLD 0.25`, `ABSOLUTE_LIFT_THRESHOLD_PP 0.08`, FP-not-worse).
- The deterministic reconciliation core:
  `src/scripts/_lib/adversarial_reconcile.ts` (+ tests).
- The corpus-validity **assessment** (done): the existing
  `internal/bench/orchestration/corpus/` fails the judge-survivable-subtlety bar
  (built for cross-vendor parity, not residual-defect subtlety). Bar + required
  distribution documented in `docs/design/adversarial-council-eval.md`.
- The cross-vendor transport for the registered panel: `src/scripts/council_cli.ts`
  (artefact/diff-as-text, read-only).

## Phase 1 — Curate a judge-survivable residual-defect corpus

- [ ] Build a corpus of planted defects designed to **survive a single strong
      cross-model judge** (residual-defect subtlety), per the bar in
      `docs/design/adversarial-council-eval.md`. Each item: a real, non-obvious
      defect (subtle broken edge case / missing control / plausible-but-wrong
      logic), not a deliberately hollow impl.
- [ ] Include a **controversial-but-correct clean control** carrying real
      perf/security tradeoffs + uncommon-but-correct patterns, so panel
      false-positive rate is measured against single-judge FP on the same control.
- [ ] **Publish the subtlety distribution** (how many items at each subtlety
      tier, defect classes covered) alongside the corpus, so the corpus is
      auditable and the residual claim is falsifiable.
- [ ] Corpus-validity gate passes: an independent read confirms the corpus meets
      the judge-survivable bar and is not the parity corpus in disguise.

## Phase 2 — Registered run + claim resolution (maintainer spend-gated)

> **Hard Floor.** The registered arm is a maintainer-authorized **paid**
> cross-vendor run. It never fires autonomously — it waits for explicit
> this-turn maintainer spend approval, and only after Phase 1's corpus-validity
> gate passes.

- [ ] Run Stage 1: a strong single cross-model judge over the corpus; record the
      residual subset (defects that survive it).
- [ ] Run Stage 2: the cross-vendor adversarial panel (>=2 distinct providers via
      `council_cli.ts`) over the judge-passed residual subset; measure residual
      recall + false-positive rate on the controversial-clean control.
- [ ] Evaluate against the locked dual threshold via `evaluateCouncilBench`;
      record the reproducible verdict (inputs, seeds, provider set, per-stage
      counts).
- [ ] Resolve the `adversarial-council-finding-coverage` claim: `backed` with the
      recorded evidence, **or** a documented honest-null. On honest-null, confirm
      the Mode 9 surface stays default-off permanently (no settings change needed —
      it already ships off).

## Acceptance criteria

- A curated corpus exists with a **published subtlety distribution** and passes
  the judge-survivable-subtlety gate.
- The two-stage protocol runs cross-vendor; the dual-threshold gate is applied
  exactly as pre-registered; the verdict is reproducible.
- The claim is resolved to `backed` (with evidence) or a documented honest-null —
  never a false `backed`.
- The Mode 9 surface remains advisory / default-off regardless of outcome
  (Hard Floor honored).

## Risks / trade-offs

- **Paid cross-vendor spend** — bounded by the maintainer gate; the run is small
  (one corpus, two stages) and only fires on explicit approval.
- **Corpus effort is the real cost.** Curating genuinely judge-survivable defects
  is the hard part; a weak corpus produces a measurement artifact, not a signal —
  hence the explicit validity gate before any spend.
- **Honest-null is an accepted outcome**, not a failure: it keeps the surface
  inert-by-default, exactly like `recursive-verification`.
