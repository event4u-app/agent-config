---
adr: 203
status: accepted
date: 2026-07-31
decision: narrow-the-safety-floor-lock
supersedes: —
superseded_by: —
phase: kernel-budget deadlock · operator tie-break on a split council
type: structural
review_trigger: >-
  Reopen when (a) the verifier's fuzzy matching is shown to admit a substantive
  edit — a passage "kept" at similarity ≥ 0.6 whose obligation actually changed
  — which would mean the exemption is wider than its stated contract; (b) a
  legitimate migration is blocked often enough that contributors start shaping
  diffs to satisfy the checker rather than the reader, the classic proxy-metric
  failure; or (c) the kernel bucket returns to green with headroom, at which
  point the exemption stops carrying weight and could be retired rather than
  maintained. Note that none of these reopen the ORIGINAL Q3=A framing — that
  lock's scoping roadmap is archived and its phase was reverted.
---

# ADR-203 — Narrow the safety-floor lock to substantive changes; wire the deciding gate into CI

## Status

**Accepted.** Operator tie-break on a split council. The narrowing and the CI
wiring merge together or not at all — that coupling is part of the decision, not
an implementation detail.

## Context

Three gates were in a state with no legal resolution:

- `lint-rule-budget` was RED: kernel-bucket **27,521 / 26,000**,
  `non-destructive-by-default` **4,770 / 4,000**, `verify-before-complete`
  **2,865 / 2,500**.
- **Both over-cap rules are safety-floor files.** No edit outside the guard's
  scope can fix a per-rule breach on a guarded file.
- `check_safety_floor_untouched` blocked every edit to those files, enforcing the
  Q3=A decision (council Round 3, 2026-05-03) that they are out of scope for
  Phase-2A slimming.

So the repo required an edit that another gate forbade. One council member named
the shape exactly: *"This isn't a lock. It's a deadlock generator."*

### Facts that changed since Q3=A was set

1. **The scoping roadmap is archived.** `road-to-structural-optimization.md` sits
   in `agents/roadmaps/archive/`.
2. **Phase 2A was attempted and reverted** on 2026-05-03. Its own guard task
   (2A.0) is marked skipped: *"safety-floor untouched by accident of revert, not
   by linter enforcement."*
3. **The guard was blind when the lock was set, and for months after.** It
   watched a retired path and reported a clean floor regardless of what changed.
   It became capable of failing on 2026-07-29.
4. **The kernel did not grow because the corpus grew.** Measured: the bucket
   counts only the 9 kernel rules; the 16 rules added since 8 July are all
   non-kernel and contribute nothing. Kernel growth is internal — 24,690 at the
   ADR-002 commit (2026-05-18) → 27,521, **+2,831**, against a cap that moved
   +1,000. **This falsifies the "grown corpus justifies a higher cap" argument**,
   which had been advanced (by the agent) in favour of option D and is recorded
   here as wrong rather than quietly dropped.

## The council, and why it did not settle it

Session 2026-07-30, claude-sonnet-4-5 + gpt-4o, 2 rounds, $0.0895. **Split:**

- **C — the lock is spent.** A CI-enforced lock guarding against a local-only
  failure is governance theatre. Rebutted B on enforceability: the git diff of a
  motive-based distinction is identical either way, so any exemption keyed on
  *why* the contributor acted is an honour system or a manual review — the very
  thing the lock was built to replace.
- **B — narrow the scope.** The protective intent survives its roadmap; future
  initiatives could pose the same risk. Narrowing resolves the case without
  discarding the protection.

Both converged on one point from opposite verdicts: **the CI-vs-local asymmetry
must be closed.**

Neither member marked any claim `unverified:` despite the question asking for it.
That instruction-following gap is recorded because it bears on how much the
verdicts should be leaned on: nothing in them was self-flagged as unchecked, and
that absence is not evidence of verification.

## Decision

**Narrow the lock. Do not revise the cap.**

1. **`check_safety_floor_untouched` blocks substantive changes and exempts
   preservation-conforming P4 migrations.** The exemption is decided by
   **verification, not attestation** — this is what answers C's enforceability
   objection, which would otherwise be decisive. There is no label, no commit
   phrase, no reviewer judgement call. `_lib/preservation_migration.ts` checks:

   - every paragraph, list item and fenced block present before is still present
     after — in the rule (fuzzy match, so telegraph condensation passes) or
     verbatim in a **declared** `load_context:` target;
   - the landing text was **added by this diff** — pre-existing context prose
     cannot launder a deletion;
   - the target is one the rule actually declares — dropping a passage into an
     undeclared file leaves it unreachable and counts as a loss;
   - Iron Law headings survive at their level and Iron Law fences byte-for-byte;
   - nothing genuinely new appears in the rule — a migration only removes.

   **Fail-closed:** anything unprovable is substantive and is blocked.

2. **`lint-rule-budget` is wired into `consistency.yml` in the same PR.** The
   deciding gate may not stay local-only while the blocking gate runs on every
   PR. **This is the condition attached to the narrowing:** the two ship
   together, because the narrowing without the wiring re-creates the asymmetry
   that made the lock incoherent.

3. **`actionlint` runs on the workflow files.** PR #1059 shipped a step carrying
   two `run:` keys and killed the whole REQUIRED Consistency check on `main`,
   while local `yaml.safe_load` validation reported OK — it keeps the last
   duplicate silently. Wiring a gate is worth nothing if the file that carries it
   can be malformed undetected.

4. **The cap is not revised.** The corpus-growth argument for D is falsified
   (see Context #4). Kernel rules grew 11.5 % while the cap moved 4 %; raising it
   now would ratify drift rather than correct a mismeasurement.

## Consequences

- The parked P4 migration (`chore/kernel-floor-rules-parked`) becomes mergeable,
  which is what returns the kernel bucket to green. It remains subject to the
  24 h kernel-rule soak window and the `bundled-always-rules-acknowledged` label.
- **The exemption's honesty rests on the verifier's matching thresholds.** A
  passage is "kept" at similarity ≥ 0.6 and "moved" at ≥ 0.9. Those are
  judgement calls, and a sufficiently clever rewrite could in principle stay
  above 0.6 while changing an obligation. The suite tests that direction
  explicitly, and the review trigger names it as the first reopening condition.
- **A narrower lock is a weaker lock.** This trades absolute protection for a
  protection with a machine-checked hole in it. Recorded plainly: the reason to
  accept the trade is that the absolute version produced a state with no legal
  resolution, not that the hole is free.
- The `must not merge alone` coupling is a property of this decision. Landing the
  narrowing without the wiring would restore exactly the incoherence C diagnosed.

## Alternatives considered

- **A — lock holds as written.** Rejected: it leaves no route to a green
  kernel-budget gate, since both breaching rules are guarded. Its own advocate
  could not answer that question.
- **C — retire the lock.** Rejected as over-broad. The changed facts undermine
  the lock's *scope*, not the case for protecting safety-floor rules from
  substantive edits. Its enforceability objection is answered by verifying rather
  than trusting, which is why the narrowing is admissible at all.
- **D — revise the cap.** Rejected on measurement: the premise was false.

## References

- `src/scripts/_lib/preservation_migration.ts` — the verifier.
- `src/scripts/check_safety_floor_untouched.ts` — the narrowed guard.
- `tests/scripts/preservation_migration.test.ts` — both directions asserted.
- `src/rules/preservation-guard.md` — the contract the verifier enforces.
- `docs/decisions/ADR-002-kernel-bucket-overrides.md` — the cap this declines to revise.
