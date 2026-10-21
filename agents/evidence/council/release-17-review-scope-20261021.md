<!-- evidence-type: analysis -->

# What "a self-review that actually completed" covers for the 17.0.0 cut

**Date:** 2026-10-21 · **Members:** `anthropic`, `openai` (CLI transport, nothing billed) · one round
**Prompt:** `release-17-review-scope-20261021.question.md`, beside this file.

## Verdict — convergent on option 2

Both seats chose **option 2**: review to completion every byte that ships
behaviour or instructions — shipped executable code and the skills, rules,
commands and packs (~4.6 MB of the 26.2 MB span, ~11 requests) — and record the
rest out of scope by class. Both rejected option 3, because skills and rules are
executable instructions for an agent and leaving them out is not a behavioural
review. Both rejected option 1 as a disposition load that would collapse
disposition quality.

## The conditions both seats attached

- **Pin the reviewed state.** One commit, a manifest of in-scope files; a file
  changed after review is re-reviewed.
- **Generated output is covered through its source only where a gate proves
  the generation.** `dist/agent-src` is held byte-for-byte to `rewrite(src)` by
  `check_condensation` in CI, and the install bundle by its freshness gate, so
  the exclusion of generated projections rests on those, named here.
- **Test code runs in CI** (`openai`): `tests/` is executable, so the test
  scripts are in scope; fixtures are data and stay out.
- **Disposition is defined up front:** `fixed` with its commit, `false_positive`
  with the reason, `accepted_risk` only by an owner decision — delegated to the
  council by the owner on 2026-10-21.
- **Non-determinism is a stopping problem, not a coverage claim.** One completed
  traversal is the bar for this cut; earlier runs' findings on the same files are
  merged into the ledger by finding id rather than re-rolled.
