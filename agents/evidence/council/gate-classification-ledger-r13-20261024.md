<!-- evidence-type: analysis -->

# Reproducible is not the same as complete

AI council, 2026-10-24, the eighteenth round that day. anthropic/claude-sonnet-4-5
+ openai/codex-default, design mode, 2 rounds with peer review, CLI transport,
`$0.00`, **2/2 present**. The prompt is committed verbatim beside this file as
`gate-classification-ledger-r13-20261024.question.md`.

## Verdict: convergent — not closed, not owner-reserved

- anthropic: Q1 *almost* (0.75), Q2 *no* (0.82).
- openai: Q1 *no* (0.93), Q2 *no*.

Both seats accept that the package is well formed and deterministically
regenerable. The byte-identical rerun proves that the record matches its
inputs. It does not prove that the inputs completely represent the source.
openai: *"Reconciliation verifies relationships among declared inputs; it
cannot prove that the declaration is complete."*

## Named, both seats

1. **A source-derived completeness attestation:** an independently or
   mechanically generated branch manifest from the 16 implementations,
   compared with zero difference against the records.
2. **Atomic records.** `c11-beta-marker` and `c12-consumer-warning` each
   combine two modes and two assertions in one row.
3. **The four `unsure` rationales,** inspectable inside the package.
4. **The exact clean-checkout command, an immutable id for the rerun report,
   and an explicit invalidation rule.**

They disagree on one point. anthropic would also require every listed branch
to have been *red* at `bbe5b73be`. openai disagrees: *"The exit criterion
refers to checks pinned red at Phase 7 start, not necessarily every
control-flow branch being independently red."* The narrower reading,
openai's, is taken. The population is the pinned checks, and each one's
assertion-bearing branches must be represented.

openai flags `c11-resolve-outside-root → op:scope-exclusion` as possibly an
enforced security invariant. The code skips such a link rather than rejecting
it. The recorded decision now sits in the artefact.

## Applied in revision 14

- **A mechanical, model-free site scanner.** `gate-branch-sites.mjs` finds
  159 finding or non-zero sites in the 16 checks:
  - 134 lie inside inventoried branches;
  - 25 lie outside, each with a disposition naming its branch or kind;
  - none is an uninventoried branch.

  An inserted site was refused, and the reconciler requires the scan to pass.
- **Atomic rows.** The artefact has 200 rows for 198 branches.
- **Inside the artefact:** the `unsure` decisions, the command and the
  invalidation rule.
- **Pins:** the rerun report, the scanner and the dispositions.
- **Self-test:** 13 of 13.
