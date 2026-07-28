---
adr: 136
status: accepted
date: 2026-07-28
decision: provenance-governance-honesty-boundary
supersedes: —
superseded_by: —
phase: road-to-provenance-and-license-governance · Phase 4
type: structural
review_trigger: >-
  Reopen when (a) real-world false-positive evidence exists at the bar the
  council named — at least 10,000 real internal files with FP <= 1% — which
  is the only path back to a detection gate, (b) a detector appears whose
  rename-only recall is measured (not asserted) at or near 8/8, restoring the
  refuted principle 6, or (c) a third-party knowledge base gains a
  self-match filter that makes an unfiltered scan usable on a published
  package.
---

# ADR-136 — Provenance governance: the honesty boundary, and why there is no detection gate

## Status

Accepted 2026-07-28.

## Context

AI coding agents can emit code near-verbatim from training data, and the
output-side legal exposure is live. This package had no answer at the code
layer: content-originality linting guarded skills and docs, not generated
code; no rule told a worker what to do on a conscious borrow; no provenance
record existed for adapted third-party code.

`road-to-provenance-and-license-governance` planned a three-layer answer —
a behavioural layer (rule + skills), a deterministic detection layer
(offline clone detection + online fingerprint matching, warn-only with a
strict ratchet), and a provenance ledger — with a **pre-registered Gate G0**
deciding whether the detection layer was good enough to gate CI. The
thresholds were registered in `docs/CLAIMS.md` **before** any scanner ran,
in a commit that precedes the baseline commit.

## Decision

**1. There is no CI-facing provenance detection gate, and no advisory
annotation either.** Gate G0 was measured and MISSED: the false-positive
criterion (`<= 1/12`) came out at `2/12`, and the rename-only criterion
failed on both arms (fingerprint matching `0/8`, clone detection `4/8`).
The pre-registered consequence (K1) fired. A council debate
(claude-sonnet-4-5 + gpt-4o, 2 rounds) resolved the re-scope to the literal
K1 reading after round-2 convergence: an advisory annotation at roughly 17%
false positives is *illusory compliance* — it manufactures the appearance of
due diligence while alert response collapses, which is worse than no signal.
A split verdict (keeping only the arm that met the FP bound) was rejected as
cherry-picking a metric from the same small synthetic corpus that makes that
arm's recall unmeasurable.

**2. The scan capability lives only in an on-demand skill** a human invokes
deliberately, where every hit is investigated *because* the human asked. That
skill must filter self-matches by package origin — see consequence 3.

**3. The ledger is the anti-launder control, not a backstop to one.** The
roadmap asserted as a design principle that fingerprint winnowing
"normalizes away identifiers by construction, so a hit cannot be cleared by
renaming variables." **That claim is refuted by measurement** and is recorded
as refuted. Rename-only laundering is not detectable by either layer.
Therefore the control is the ledger: a borrow requires a record whose
transformation note survives a deterministic rename-only phrase rejection,
with a closed `cleared_by` enum and an outright failure on deny-class or
unknown licenses. The tooling checks the *record*; it does not detect the
laundering.

**4. Licensing compliance is declared, not stamped.** REUSE 3.3 path-glob
declaration achieves identical measured compliance (7102/7102 files) without
per-file headers across ~1,700 source files and their generated projections.

**5. The vocabulary boundary is enforced by a linter, not by intent.**
"Copyright-safe" and its variants are banned outright. Approved vocabulary
("provenance-governed", "license-policy-enforced", "audited borrow trail")
requires a co-located scope box in the same file, and the measured numbers in
that box are cross-checked against the claims ledger.

## Consequences

1. **No claim of detection capability may ever be made from this work.** The
   registered claim is scoped to what shipped: a derived license policy, a
   strict own-records ledger linter in CI, and an on-demand audit skill —
   explicitly not a detection gate, explicitly not a certification of the
   absence of copying, explicitly not rename-only-laundering detection.
2. **Unconscious reproduction from training data is out of reach at this
   layer, permanently.** No tool sees model training data. An agent cannot
   introspect whether output is recalled or derived, which is why the rule's
   self-interrogation clause is marked auxiliary and non-load-bearing and why
   no gate outcome may depend on it.
3. **Self-match noise is an operational hazard, discovered by dogfooding.**
   Scanning this repo's own source produced 552 hits of which 551 matched our
   *own published package* — the knowledge base has indexed our releases. An
   unfiltered gate would have flagged roughly 74% of `src/scripts` on day
   one. This is a third independent argument for the G0 verdict, found after
   the fact, and it shows the synthetic corpus *understated* the real
   false-positive surface.
4. **Canonical-algorithm convergence produces true-looking false positives.**
   Both corpus false positives, and the single genuine third-party hit in the
   self-audit, were canonical shapes (a debounce, secret-detection regex
   fixtures) matching indexed packages without any copying. Similarity is not
   provenance.
5. **The gate can return only on real-world evidence**, at the bar the
   council named, via a new roadmap — not by reviving a cancelled phase.

## Alternatives considered

- **Ship the detector warn-only anyway** (the roadmap's original plan).
  Rejected: the measured FP rate is above the level where alert response
  collapses; a warn nobody reads is illusory compliance.
- **Ship the detector advisory-only, no promotion path.** Rejected in council
  round 2 by the member who had proposed it, on the same alert-fatigue
  ground.
- **Keep the offline arm in CI because it measured 0/12 FP.** Rejected: the
  0/12 came from the same 12-sample synthetic corpus whose canonical shapes
  are unusually convergent, and the arm fails the rename-only criterion too —
  partitioning a system that failed on principle by the metric one arm passed
  is motivated reasoning, not evidence.
- **Re-found principle 6 on policy ("keep the intent, require human
  review").** Rejected as replacing a falsified claim about tool properties
  with an aspiration. The honest move is to state that the detection does not
  exist and name the ledger as the control.
- **Per-file SPDX headers across `src/`.** Rejected for zero compliance gain
  at unreviewable diff cost.

## References

- `agents/roadmaps/archive/road-to-provenance-and-license-governance.md` — the plan,
  the G0 verdict, the refuted principle 6, and the phase-by-phase record.
- `internal/bench/provenance/reports/baseline-2026-07-28.md` — both layers'
  measured numbers and the pre-declared sensitivity sweep.
- `internal/bench/provenance/reports/self-audit-2026-07-28.md` — the
  self-match finding and the sibling-repo state.
- `docs/CLAIMS.md` — the pre-registered thresholds and the shipped claim.
- `src/rules/code-provenance.md` — the behavioural layer.
- `provenance/borrows.jsonl` + `src/scripts/lint_provenance.ts` — the ledger
  and its strict gate.
