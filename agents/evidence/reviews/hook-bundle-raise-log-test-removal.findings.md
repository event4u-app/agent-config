# Findings: hook-bundle-raise-log-test-removal
<!-- evidence-type: original-review -->

This is an independent verdict on the net assertion loss from deleting
`tests/scripts/hook_bundle_raise_log.test.ts` (53 assertions net-removed) on
branch `analysis/inbox-2026-11-hb`. `check_test_weakening` requires it.

- **Reviewer:** a fresh general-purpose subagent instance, read-only, run 2026-11-21.
  - Same provider as the implementer: this is the *team* fallback of `evaluator-independence`, not a cross-provider review.
  - The council's two-provider ratification of the same diff did not converge (see the PR). The underlying policy question, owner directive D1, is escalated to the owner there.
- **Prompt, in summary:**
  - It named the deleted file, the owner directive, the old and new budget files, and the composition gate and its tests.
  - It asked, for each asserted behaviour, whether the behaviour still exists, whether it is still covered, and whether a recorded decision covers its removal.
  - It stated no expected outcome.

## Verdict: partly legitimate

| Old test lines | Behaviour | Disposition |
|---|---|---|
| 49–131 | raise-log rule, raise-entry completeness, per-chunk ceilings and their raise rule | Code removed. D1 (`agents/evidence/owner-directives/2026-11-20-hook-bundle-budget-and-hook-economy.md`) ends `raise_log` and the per-chunk ceilings explicitly. Legitimate. |
| 133–203 | chunk-group ceilings, their coverage and their raise rule | Code removed. D1 ends the chunk-group ceilings. Legitimate. |
| 229–234, and the two-ceiling half of 236–244 | a chunk without a ceiling, and a ceiling naming no chunk or naming one chunk twice | Meaningful only while per-chunk ceilings exist. Legitimate under D1. |
| the defined-twice half of 236–244 | a chunk defined more than once in `hook_chunks.mjs` is a finding | A definition-consistency check that does not depend on the budget. It was removed with no decision and no replacement. **Not legitimate as removed.** |
| chunk-build group | build script, byte measurement, digest sidecars, unknown-entry refusal | Moved intact to `tests/scripts/hook_bundle_composition.test.ts`. Not lost. |

The real-tree checks of the old file are replaced by:
- the package-allowlist tests (a second YAML reader is refused);
- the backstop-ceiling tests and the CLI exit-code tests against the committed budget;
- `tests/scripts/hook_load_set.test.ts`.

The ratchet's absence is itself asserted: `shrink_only`, `raise_log`, `chunks`, `chunk_groups` and `max_yaml_packages` must not reappear in the committed budget.

## Resolution of the one gap

`tests/scripts/hook_bundle_composition.test.ts` now asserts that every `HOOK_CHUNKS` entry and outfile is unique. It was red against a `hook_chunks.mjs` carrying a duplicated `svg_rules` row, and green against the real file. With that test in place, every behaviour of the deleted file is retired by D1, moved, or replaced.
