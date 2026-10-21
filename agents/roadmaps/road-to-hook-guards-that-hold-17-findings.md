---
complexity: lightweight
status: draft
estate_offset_exempt: "The 17.0.0 cut is held on this roadmap by owner decision of 2026-10-21; nothing active is finished or parkable to offset it, and archiving an unrelated roadmap to make room would be a disposition taken for the gate rather than for its work."
execution:
  mode: phase-checkpoints
---
# Road to hook guards that hold — what 17.0.0 needs before it is cut

> **Source:** the local self-review of the 17.0.0 release span (2026-10-21; its
> findings ledger is the one the 17.0.0 release commits) and the owner's
> verdict on the first cut: *not releasable in this form.* 17.0.0 headlines that
> the `fail_closed` guards now actually run; three findings show that is not yet
> true on every install shape. A major is the place to make it true, so they are
> release blockers, not accepted risk.

## Goal

17.0.0 is cut only when the three `fail_closed` hook guards
(`block-no-verify`, `block-kernel-rule-writes`, `block-plumbing-writes`)
refuse what they claim on every install shape, the window an `upgrade` opens is
proven closed, the admin-token workflow is fenced to `main` by a rule a branch
cannot rewrite, and a self-review that actually completed has every finding
dispositioned in the ledger.

## Phase 1 — the `--no-verify` semantic bypass (finding `bc83fb66c55d`, high)

- [ ] **1.1 Refuse every spelling git reads as `--no-verify`.** Git accepts any
      unambiguous prefix (`--no-verif`, `--no-ver`, …) and `-n` on `commit`;
      the guard matches the literal only
      (`agents/evidence/analysis/short-n-change-held-2026-10-20.md`). A fix is
      written and held on a local WIP branch for want of a two-seat
      ratification; land it through that ratification, or a fresh one.
      verify: a test that runs the guard against `git commit --no-verif -m x`,
      `git commit -n -m x` and `git push --no-ve`, sees all refused, and was
      seen red against the current guard first.

## Phase 2 — trusted staged runtime before project code (finding `feaebdef733b`)

- [ ] **2.1 The Claude hook command reaches the package-owned staged runtime
      before any project-tree `dispatch.js`.** Today it execs
      `$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js`
      or `$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js` first, so a cloned
      repository can plant either file and run its code as the user's hook.
      Reorder, or gate the project-local file on provenance; the maintainer
      checkout's own development path is the case to keep working.
      verify: a fixture project with a planted `dist/hooks/dispatch.js` whose
      hook invocation reaches the staged runtime, shown running the planted
      file before the change.

## Phase 3 — a missing dispatcher denies `pre_tool_use` (finding `bb6ab0f5f37d`)

- [ ] **3.1 The non-plugin hook wrapper fails closed for `pre_tool_use`.** The
      written command ends in `command -v "$BIN" … || exit 0`, so with no
      reachable dispatcher every guard is skipped silently. A `pre_tool_use`
      event with no dispatcher denies with a message naming the missing binary
      and the repair; the other events stay fail-open.
      verify: a test that removes the dispatcher and sees `pre_tool_use` refuse
      and `stop` exit 0.

## Phase 4 — the upgrade swap, proven safe

- [ ] **4.1 Re-run the mid-session swap probe against the Phase 2 and 3
      command.** `agents/evidence/analysis/mid-session-swap-probe-2026-10-18.md`
      measured 490 failures in 4,190 invocations during an `upgrade`, 487 of
      them exit 127, each a silent pass of every guard. The same probe, same
      volume, on the new wrapper.
      verify: the new reading records zero `pre_tool_use` invocations that
      exited 0 without a dispatcher; any exit-127 window shows as a refusal.

## Phase 5 — fences outside the code

- [ ] **5.1 Restrict the `production-visibility` environment to `main`.** The
      workflow gates its admin-token step on `github.ref` (fixed with
      `d3b3935f74de`), but a branch can edit the workflow it dispatches; an
      environment deployment-branch rule is the control a branch cannot rewrite.
      verify: `gh api repos/event4u-app/agent-config/environments/production-visibility/deployment-branch-policies --jq '[.branch_policies[].name]|join(",")'` -> /^main$/
- [ ] **5.2 Redact the remaining absolute home paths in evidence prose.** One
      was redacted with `3628431c5f51`; 13 more tracked files under
      `agents/evidence/` carry them. Review-input packages stay as recorded.
      verify: `rg -c -F '/Users/' agents/evidence --glob '!*.review-input/**' | wc -l` -> /^\s*0$/

## Phase 6 — a review that completed, and a ledger with nothing open

- [ ] **6.1 Cut 17.0.0 and run a fresh self-review to completion.** The CI
      review runs NEUTRAL without API credit, and the local run reached 6 of 71
      requests at the per-run ceiling. Run until every chunk of the span is
      reviewed, and record coverage with the ledger.
      verify: the review log names no `UNREVIEWED` path for the span.
- [ ] **6.2 Disposition every finding of that review.** `fixed` with its
      commit, `false_positive` with the reason, `accepted_risk` only by the
      owner; the release proceeds only on an empty undispositioned list.
      verify: `./scripts-run src/scripts/check_finding_dispositions --release 17.0.0` -> 0

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A fail-closed wrapper locks the user out | implementation | Phase 3 turns a missing binary into a refusal on every tool call, so a broken install cannot run a tool until repaired | Only `pre_tool_use` refuses, and the message names the missing binary and the repair command | Phase 3 — a missing dispatcher denies `pre_tool_use` (finding `bb6ab0f5f37d`) |
| 2 | The full review never completes | implementation | 71 requests at a ceiling of 6 per run, and each fresh run of an earlier cut found a different set of findings | Raise the ceiling for this run or run it in batches over the same cut, and disposition across batches by finding id | Phase 6 — a review that completed, and a ledger with nothing open |
| 3 | The prefix fix stays held | implementation | Phase 1 needs a two-seat ratification, and a seat being down is why it is held today | Run the round as the phase's first act and record a degraded round rather than waiting | Phase 1 — the `--no-verify` semantic bypass (finding `bc83fb66c55d`, high) |

## Acceptance Criteria

- [ ] AC-1 — `git commit --no-verif`, `git commit -n` and `git push --no-ve` are
      refused by `block-no-verify` on every host that binds `pre_tool_use`.
- [ ] AC-2 — A project tree that plants a `dispatch.js` cannot run it as the
      user's Claude hook in place of the staged runtime.
- [ ] AC-3 — A `pre_tool_use` invocation with no reachable dispatcher refuses
      instead of exiting 0, also during an `upgrade` swap.
- [ ] AC-4 — The admin-token workflow can only deploy from `main`.
- [ ] AC-5 — 17.0.0 ships with a completed self-review and no undispositioned
      finding in its ledger.
