---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
---
# Road to hook guards that hold — the three 17.0.0 findings shipped as accepted risk

> **Source:** the local self-review of the 17.0.0 release span (2026-10-21; its
> findings ledger is the one the 17.0.0 release commits). Six
> findings blocked the cut. Three were fixed before it; the owner accepted the
> other three as risk for 17.0.0 on 2026-10-21 and asked for this roadmap so
> they are fixed afterwards rather than carried indefinitely.

## Goal

The three `fail_closed` hook guards (`block-no-verify`,
`block-kernel-rule-writes`, `block-plumbing-writes`) refuse what they claim to
refuse on every install shape: a prefix of `--no-verify` is refused, a
dispatcher planted in a project tree is never preferred over the
package-owned staged runtime, and a missing dispatcher makes a `pre_tool_use`
guard refuse rather than exit 0. The three ledger entries for 17.0.0 move from
`accepted_risk` to `fixed` in the release that ships the fixes.

## Phase 1 — the `--no-verify` prefix bypass (finding `bc83fb66c55d`, high)

- [ ] **1.1 Land the held prefix fix for `block_no_verify`.** Git accepts any
      unambiguous prefix of `--no-verify` (`--no-verif`, `--no-ver`, …), and the
      guard matches the literal only (`agents/evidence/analysis/short-n-change-held-2026-10-20.md`).
      The fix exists on a local WIP branch and waits for a two-seat ratification;
      run that ratification and land it.
      verify: a test that runs the guard against `git commit --no-verif -m x` and
      `git push --no-ve` and sees both refused, shown red against the current
      guard first.

## Phase 2 — a planted project-local dispatcher (finding `feaebdef733b`)

- [ ] **2.1 Stop the Claude hook command from preferring a project-tree
      `dispatch.js` over the staged runtime.** Today the command execs
      `$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js`
      or `$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js` before
      `~/.event4u/agent-config/runtime/current`, so a cloned repository can
      plant either path and run its own code as the user's hook. Decide the
      order (staged runtime first, or a provenance check on the project-local
      file) and change the generated command.
      verify: a fixture project with a planted `dist/hooks/dispatch.js` whose
      hook invocation still reaches the staged runtime, shown running the
      planted file before the change.

## Phase 3 — a missing dispatcher fails open (finding `bb6ab0f5f37d`)

- [ ] **3.1 Make the non-plugin hook wrapper fail closed for `pre_tool_use`.**
      The written command ends in `command -v "$BIN" … || exit 0`, so with no
      reachable dispatcher every guard is skipped silently; 487 of 4,190
      invocations hit exit 127 during an `upgrade` swap
      (`agents/evidence/analysis/mid-session-swap-probe-2026-10-18.md`). A
      `pre_tool_use` event with no dispatcher must deny, the other events may
      stay fail-open.
      verify: a test that removes the dispatcher and sees a `pre_tool_use`
      invocation refuse with a message naming the missing binary, while a
      `stop` invocation still exits 0.

## Phase 4 — the leftovers of the same review

- [ ] **4.1 Redact the remaining absolute home paths in evidence prose.** The
      17.0.0 fix redacted one; 13 more tracked files under `agents/evidence/`
      carry `/Users/<name>/…`. Review-input packages (`*.review-input/`) are
      bound to their recorded verdicts and stay as they are; analysis and
      investigation prose gets `<repo>/…`.
      verify: `rg -l -F '/Users/' agents/evidence --glob '!*.review-input/**'`
      lists no file.
- [ ] **4.2 Restrict the `production-visibility` environment to `main`.** The
      workflow now gates its admin-token step on `github.ref`, but a branch can
      edit the workflow it dispatches. An environment deployment-branch rule is
      the control a branch cannot rewrite; it is a repository setting, so it is
      the owner's to set.
      verify: `gh api repos/event4u-app/agent-config/environments/production-visibility`
      shows a deployment branch policy that admits `main` only.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A fail-closed wrapper locks the user out | implementation | Phase 3 turns a missing binary into a refusal on every tool call, so a broken install can no longer run any tool until repaired | The refusal names the missing binary and the repair command, and only `pre_tool_use` refuses | Phase 3 — a missing dispatcher fails open (finding `bb6ab0f5f37d`) |
| 2 | The prefix fix stays held | implementation | Phase 1 needs a two-seat ratification, and a seat being down is why it is held today | Run the round as the phase's first act and record a degraded round rather than waiting | Phase 1 — the `--no-verify` prefix bypass (finding `bc83fb66c55d`, high) |

## Acceptance Criteria

- [ ] AC-1 — `git commit --no-verif` and `git push --no-ve` are refused by
      `block-no-verify` on every host that binds `pre_tool_use`.
- [ ] AC-2 — A project tree that plants a `dispatch.js` cannot run it as the
      user's Claude hook in place of the staged runtime.
- [ ] AC-3 — A `pre_tool_use` invocation with no reachable dispatcher refuses
      instead of exiting 0.
- [ ] AC-4 — The 17.0.0 ledger entries `bc83fb66c55d`, `feaebdef733b` and
      `bb6ab0f5f37d` are dispositioned `fixed` in the release that ships these.
