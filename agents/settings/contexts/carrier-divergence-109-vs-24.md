# Carrier divergence — 109 prose-identical, 24 actionable

Durable home for a correction that kept being re-derived wrongly. The figure
"109 divergent carrier pairs, binding undefined" circulated through **six**
independent release reviews as the single largest piece of technical debt in the
tree. It is wrong, and it was wrong by 78%. The correction previously existed
only in a transient roadmap and in one analysis file, so every fresh reader
re-derived the original number from the report's own output. This is the stable
surface it lacked.

**The sixth circulation added a target, and the target is the part to reject.**
The 9.30→9.35 review span asks, as a P0, to "bring divergent carrier pairs to 0".
There is nothing to bring to zero: all 109 pairs carry byte-identical prose, so
convergence is already total on every governed sentence. The number that can
move is **24** — the pairs disagreeing on `paths:` — and it was blocked on
`carrier-install-paths-decision` (owner: maintainer), not on engineering effort.
A plan phrased as "divergence → 0" therefore describes no work; it reads as 109
units of debt where 24 units of *decision* exist.

**Resolved 2026-08-13 —
[`ADR-228`](../../../docs/decisions/ADR-228-global-install-does-not-emit-paths.md):
the 24 stay, as accepted over-delivery.** At least six of them are safety or
governance floors carrying an Iron Law, and path-scoped rules are not re-injected
after `/compact` (`ADR-227`), so emitting `paths:` globally would convert a safe
over-delivery into a silent under-delivery. The 24 are now a recorded acceptance;
`report_carrier_divergence` still labels them ACTIONABLE and that label should be
read against this record.

Correction to the sentence above, kept rather than silently rewritten: it located
the blocker in `road-to-carrier-layer-convergence.md`, where it never existed —
the only definition was in `road-to-inbox-harvest-2026-08-b-release-integrity.md`.
A pointer to the wrong owner is why a decision can sit unmade while two documents
each believe the other holds it.

## What was measured (2026-08-10)

The suite reaches an agent through two carriers: a machine-global install
(`~/.claude/rules/`) and the package's own per-project projection
(`dist/agent-src/rules/`). A machine holding both loads the shared rules twice.

- **All 109 pairs carry byte-identical prose.** The entire difference is the
  frontmatter block. No governed text differs, nothing is binding-ambiguous, and
  there is no claim one copy retracts that the other re-asserts.
- **24 of the 109 disagree on `paths:`** — the one frontmatter key this host
  reads. It decides *when* a rule loads: with `paths:`, on a matching-file read
  and without `/compact` re-injection; without it, unconditionally at launch. In
  all 24 the project copy is scoped and the global copy is not, so the global
  copy **un-scopes** what the project layer deliberately scoped.
- **The direction is over-delivery, never a missing obligation.** A rule loads
  more often than intended, never less. That is why the defect is real and small
  rather than real and urgent.
- **The original figure came from an instrument bug.** A metadata-only
  difference was classified as body divergence — that is, as the one class the
  report tells a reader to act on. Fixed in `c48b6c88c`; the report now prints
  the `paths:` subset separately, under the frontmatter-only count.

## What this does NOT decide

Whether `install.ts` should emit `paths:` at all. That is consumer-visible
install behaviour and a default flip, so it is an ADR question and a maintainer
decision — it is deliberately open, and neither this note nor the report closes
it.

## Why the number keeps coming back wrong

The condition is **transient and maintainer-dependent**: it appears when the
checkout runs ahead of the installed release and disappears at the next
reinstall. So any single measurement ages out, and a reader who re-runs the
report sees a fresh count with no memory of the classification. Read the count
through the classes, never as one number:

- `body-diff` — different prose. The only class that needs a decision. Measured
  **0** after the instrument fix.
- `frontmatter-only` — identical prose, metadata differs. Inert **except** its
  `paths:` subset.
- `paths:` subset — actionable, 24 of 109.
- `provenance-only`, `one-carrier-only` — structural and expected.

## Sources

- `src/scripts/report_carrier_divergence.ts` — the re-runnable report and the
  class definitions, which are the normative version of the list above.
- `agents/evidence/analysis/carrier-layer-divergence-classification.md` — the
  classification run, the cited host-precedence answer, and why two earlier
  readings of one commit disagreed.
- `agents/evidence/analysis/claude-code-rules-dir-contract.md` — the host
  behaviour the "binding undefined" half rests on (both copies load at launch at
  equal priority, with no precedence marker between them).
