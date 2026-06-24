# Domain-eval anti-pattern — manufactured false objectivity at N=1

> A retrospective from the legal pack (council round 3). It exists so the next
> domain does not repeat the mistake. The short version: **do not call a
> self-labeled regression harness an "objective" correctness gate.**

## The anti-pattern

Gating skill ship on *"≥X% match to expert ground-truth"* and calling it "the
objective replacement for reviewer sign-off" — when:

1. **The ground-truth is unsourced or self-generated.** If the maintainer guesses
   what an expert would flag, the eval measures "does the skill match the
   maintainer's guess," i.e. reviewer subjectivity wearing a quantitative costume.
2. **Expert agreement is not truth.** Even an attorney-validated gold set at
   inter-annotator agreement ≥0.7 is *inter-subjective expert consensus*, not
   ground truth — `0.7 ≠ 1.0` admits the domain is contested ~30% of the time.
   The honest goal is **measurement objectivity** (reliably detect change), not
   **ground-truth objectivity** (the labels are correct).
3. **Model capability caps below the threshold.** Clause-extraction caps at
   ~F1 0.62; any passable threshold therefore measures "not worse than a mediocre
   baseline," i.e. regression detection — never correctness.
4. **The statistical language is borrowed from infra that does not exist.**
   Calibrating a threshold "from cross-model distributions" requires a built
   cross-model-parity layer. Borrowing the vocabulary before the layer exists is
   false precision.

## The honest alternative

- **Ship a regression / consistency harness.** Self-labeled fixtures, explicitly
  marked "regression-only, not correctness, not objective." It catches "did a
  change make a skill worse than its own baseline."
- **Keep correctness with the human.** Licensed-expert review on material use,
  baked into the skill's output, not a footnote.
- **Make the objective eval a separate, gated track.** Attorney/expert-validated
  gold set + inter-annotator ≥0.7 is real but expensive; gate it on **validated
  demand + funding**, not on a phase timeline — and note it is classification, so
  it does **not** depend on a cross-model-parity keystone.

## The false-blocker corollary

When you scope an eval, check what it *actually* depends on. The legal eval was
briefly gated on the cross-model-parity keystone; the full critique round showed
that was wrong — legal fixture matching is **classification** (clause
present/absent/ambiguous), not the finding-count distributions that keystone
calibrates. The real dependency was labeled-gold-set tooling, buildable in-pack.
A false structural blocker is as much an error as false objectivity.

## See also

- [ADR-107 — Legal domain-pack adoption](../../decisions/ADR-107-legal-domain-pack-adoption.md)
- `domain-pack-architecture.md` — the retrospective sequence this is part of.
- `src/domains/legal/evals/README.md` — the regression harness in practice.
