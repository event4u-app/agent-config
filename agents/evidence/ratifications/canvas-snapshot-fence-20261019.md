---
proposed_by: claude-opus-5.5/drain-road-to-a-canvas-the-code-owns-snapshot-fence-20261018
implemented_by: claude-opus-5.5/pr-sweep-2471-2026-10-19
reviewed_by: council/anthropic+openai-2026-10-19-snapshot-fence-round6
providers: [anthropic, openai]
subject: d53d9eb6bcac9d3ca50168cb564c5fcdc099ab9ed2cd3b7924f2a785b4a58984
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the snapshot fence in block_config_weakening

Covers branch `drain/road-to-a-canvas-the-code-owns-snapshot-fence-20261018` (PR #2471):
step 7.1 of `road-to-a-canvas-the-code-owns`. The only gated file is
`src/scripts/hooks/block_config_weakening.ts`; the subject digest covers it alone.

## Decision

Both seats, round 6, CLI subscription transport, `confirmed-non-expanding`: no input
the hook blocked before now warns or allows, and no input it allowed before now
blocks. Two input classes move from ALLOW to WARN — a shell call running Playwright or
test-storybook with an enabled `--update-snapshots`, and an edit-tool write to a
snapshot-only path. The loop classifies with `classify_config`, the pre-diff
classification logic, so a snapshot-only path takes the same skip it took before and
only leaves a deferred warning; every warning is emitted after all path decisions, so
a block still wins.

## How it got here

Six rounds, prompts committed under `agents/evidence/council/snapshot-fence-review*`:

- Rounds 1–3 (2026-10-18): two ordering downgrades, a dependency on shell and edit
  tools being disjoint, and a skipped entry-count step — each fixed.
- Round 4 (2026-10-19): anthropic `confirmed-non-expanding`; openai `request-changes`
  because the command warning was discarded when a shell name is also an edit tool.
  Fixed with a deferred `cmdWarn`; the overlap test was seen red with the old code.
- Round 5: anthropic `confirmed-non-expanding`; openai `request-changes` claiming a
  snapshot path could reach a blocking check. That seat had only diff hunks; no such
  check existed between classification and `decide()`. Its structural recommendation
  — keep snapshot detection out of the governance classification — was adopted
  anyway, because it makes the non-expansion argument a line-by-line comparison.
- Round 6: the whole `evaluate()` was in the prompt; both seats concur.

## Residue

openai suggested more negative tests for the command regex (quoted arguments,
`--update-snapshots false`, runner names inside `echo`). These are false-warning
risks on a warn-only path, not authority defects; not done in this change.

Spend: six rounds on subscription seats, $0.00.
