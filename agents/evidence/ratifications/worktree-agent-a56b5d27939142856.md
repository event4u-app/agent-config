---
proposed_by: claude-opus-5/worktree-agent-a56b5d27939142856
implemented_by: claude-opus-5/worktree-agent-a56b5d27939142856
reviewed_by: fresh-subagent/independent-review-2026-09-30-stop-that-holds
providers:
  - anthropic
verdict: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the verification record, and one gate over a table

Covers the branch that implements Phase 1, 3.1–3.2 and 5.1 of
`road-to-a-stop-that-holds`, plus `check_kill_switch_table` and the two
governance files its registration touches. Named for the branch rather than a
PR number, because the pre-push gate reads this file before the PR exists.

## Why `confirmed-non-expanding` and not `ratified`

```
NOTHING HERE EXPANDS ANY AUTHORITY.
ONE GATE IS ADDED THAT CAN ONLY REFUSE.
NO CEILING, FLOOR OR BASELINE MOVES.
NO ENFORCING SURFACE BECOMES NON-ENFORCING.
NO KERNEL RULE IS TOUCHED.
```

`ratified` records approval of an authority-EXPANDING change. The two governance
files in this diff are touched in exactly one direction each:

- **`src/config/gate-coverage.yml`** gains one row,
  `check_kill_switch_table`, `status: enforced`, `min_scanned: 3`. No existing
  row is edited, no `min_scanned` is lowered, no `status` is downgraded, and no
  `no_canary_reason` is rewritten. Verified by
  `git diff origin/main...HEAD -- src/config/gate-coverage.yml`: the diff is
  additive, 6 lines, one block.
- **`.github/workflows/consistency.yml`** gains two steps, both invoking the new
  gate (once plain, once `--self-test`). No existing step is removed, reordered,
  or made conditional. No permission block, no `on:` trigger, no concurrency
  group and no job-level setting is touched.

No kernel rule is in the diff: `src/rules/` is untouched, and
`block_kernel_rule_writes` is neither retired, weakened nor rebound —
`grep -c block-kernel-rule-writes src/scripts/hook_manifest.yaml` returns the
same value it returns at the base revision.

## The one direction that deserves scrutiny, stated rather than glossed

The branch makes a **blocking** turn-end concern refuse in cases it previously
allowed. That is not an authority expansion — the concern's `severity: blocking`
and its `EXIT_BLOCK` path both predate this branch, and the manifest entry is
unchanged — but it IS a behavioral widening of a control that can stop a user's
turn, and a reader of this artifact should see it named.

What the widening is, precisely:

- Detector C refuses a turn whose recorded runs contain no passing run after the
  last edit. It previously allowed any turn whose transcript showed a command
  matching a regex, which `echo test` matches.
- Detector F refuses a completion claim over production code where the turn
  WROTE a new test file and no recorded red preceded the green.

What bounds it, and each bound is a fixture in this diff rather than a promise:

1. **An instrument gap never refuses.** No exit code, or a record nothing can
   place, falls back to the transcript verdict — the behavior that predates the
   record path. `readRunEvidence`'s `instrumentGap` is the branch both detectors
   take.
2. **A host that does not record cannot be refused by the record path.**
   `readTurnRunState` returns `null` unless `edits_this_turn >= 1`, the one
   field only a `post_tool_use` event can raise.
3. **Detector F's clause fires only on a `Write` to a test path.** An existing
   test adjusted alongside production code keeps the old escape untouched.
4. **The red half accepts more than a parsed failure count** — a load failure and
   a non-zero exit both count, so the canonical TDD first red (`Cannot find
   module`) is a red.
5. **A load-failure phrase never overrides a clean summary**, so a green suite
   that merely printed the words `fatal error` is not refused.

Bounds 3, 4 and 5 exist BECAUSE of the review this artifact names: each was a
false-refusal path the first implementation carried, and each is now a fixture.

## What the review found, and why the artifact records it

The independent review was dispatched on the pushed branch with a neutral
prompt, and it recommended **do not merge on the then-current evidence**. Two
blockers, both measured against 1,077 real tool results in this machine's own
transcripts rather than argued:

1. Claude Code's Bash result carries **no exit-code field** — success is an
   object, failure is the string `Error: Exit code N\n…` — so every recorded run
   had `exit_code: null` and the whole record path was inert on the only host
   that binds the gate.
2. The recorder JSON-stringified an object response, and every parser is
   line-anchored, so no summary could ever be parsed from the success shape.

Both are fixed in this diff, and the fix carries the test that would have caught
them: `tests/scripts/verification_record_roundtrip.test.ts` drives the real
recorder with both real payload shapes and reads what the real classifier makes
of the output. 13 of its 16 cases fail against the pre-fix recorder, which is
the sensitivity proof and also the measurement of how much the hand-written
fixtures were hiding.

## Scope of this ratification — read this before citing it

It covers the two governance files named above, on this branch, for this change.
It is **not** a standing approval for:

- any later edit to `gate-coverage.yml` or to a workflow;
- lowering `check_kill_switch_table`'s floor or changing its `status`;
- arming `obligation-settle` — that is gated on the pre-registered
  `obligation-settle-shadow-bar` reading, whose window this branch RESET, and no
  verdict here touches it;
- the steps this branch left open (1.4's owner decision, Phase 2, 3.3, 3.4,
  4.1).

## Evidence

- `check_gate_coverage`: `check_kill_switch_table: scanned 419 ≥ 3`, no failing row.
- `check_kill_switch_table`: 29 switches in 419 files, 29 table rows, sets equal.
- `check_kill_switch_table --self-test`: 6/6 cases behaved, 4 rejecting, floor 6.
- The gate was observed RED before the table row was added, naming
  `AGENT_CONFIG_TOOL_BYTE_CENSUS` as the missing row — the exact drift the review
  found by hand.
- `npm run typecheck` exit 0; the six affected test files green.
