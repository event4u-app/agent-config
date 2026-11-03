---
complexity: lightweight
status: ready
tree_pin: b234d08480
execution:
  mode: phase-checkpoints
review_by: 2026-12-10
estate_growth_exempt: "+1 active_roadmaps, owner-directed 2026-11-03 (agents/evidence/owner-directives/2026-11-03-strike-round-process-full.md): the invocation asked for this round's roadmap to be executed with /roadmap:process-full in the same run, the one exception the WIP cap of five names."
estate_offset_exempt: "Owner search at b234d08480 (grep -rlF -e fix_loop_max -e context_hygiene_hook -e canVerify -e failureIsDiscarded -e strike over agents/roadmaps, later, stubs) hit later/road-to-adversarial-verification-and-long-runs, which owns the fix-loop ladder but is parked on two human-only blockers (AC-4 kernel edit, AC-6 kill-switch); landing executable steps there would park them behind those blockers. The steps here are the ladder's missing counter and its prose repairs, cross-referenced from that roadmap's Arrivals line; no active roadmap is archived to offset it."
relates:
  - slug: later/road-to-adversarial-verification-and-long-runs
    relation: extends
    note: "Owns the fix-loop ladder (execution.fix_loop_max) and AC-4. This roadmap adds the counter the ladder has never had and removes the count→ask paraphrases AC-4 believed gone. AC-4's own kernel edit stays there."
---
# Road to a strike the session keeps

> **Source:** `agents/tmp.old/inbox-2026-11-m/` (T1 supplied plan v3 + chat + earlier plan; T2 proposal on stall and discarded failures).
> **Arrivals:** 2 — `inbox-2026-11-m` T1 (2026-10-24) and T2 (2026-10-28), two independent rounds naming the same count→ask defect in `context-hygiene`.

## Goal

The fix-loop ladder (`execution.fix_loop_max`, bands 1-3 / 4-6 / 7-10) has a
counter that survives a turn and a compact, and every text that names a retry
budget either points at the ladder or declares why it carries its own number.
No count maps to a question to the user. A verification whose failure the
shell discarded (`|| true`, `|| :`, `; true`) is never pass-evidence.

Verified at the pin (Phase 4 of the round):

| # | Defect | Evidence at `b234d08480` |
|---|---|---|
| F1 | The ladder has no counter: `mission_record.attempt_count` has no production writer, and red runs are turn-scoped (`_reset_turn` clears `verification_runs`) | `src/scripts/_lib/mission_record.ts:49`; `src/scripts/before_complete_hook.ts:690-699` |
| F2 | Three texts map a count to a question, against `fix-loop-ladder` | `src/rules/context-hygiene.md:60,66,74`; `src/skills/systematic-debugging/SKILL.md:165`; `src/skills/bug-analyzer/SKILL.md:139-140,266` |
| F3 | The hook header claims to keep "the 3-failure stop"; its state has no such field | `src/scripts/context_hygiene_hook.ts:9-11` vs `:13-19` |
| F4 | A generic skill ships one project's root causes | `src/skills/bug-analyzer/SKILL.md:144` ("Common root causes in this project") |
| F5 | The record path ignores the discard detection the transcript path has | `src/scripts/_lib/verification_evidence.ts:143-151` (`canVerify` re-splits, never calls `failureIsDiscarded`, `verification_command.ts:219`) |
| F6 | The test guarding the ladder looks for literals in one file | `tests/e2e/adversarial-verification-fixtures.test.ts` |

Already fixed at the pin (not planned): the stale `N=3` reference in
`terminal-states.md` now names `execution.fix_loop_max`.

## Phase 1 — One ladder, one wording

- [ ] **1.1 `context-hygiene` follows the ladder.** The 3-Failure Rule becomes a
      pointer to the ladder in `autonomous-execution` (three failed strategies →
      new epoch: state dump, fresh context; a count is never a reason to ask).
      Failure identity and the hard-blocker classes stay — hard blockers are the
      one place a surface to the user is right, and they are not a count.
      verify: `grep -cE 'ask for a different approach|new hypothesis, ask|Can.t proceed → ask the user' src/rules/context-hygiene.md` → `0`.
- [ ] **1.2 The rule says what the hook carries.** Hook header drops "the
      3-failure stop"; the rule's enforcement header says the hook carries the
      call counter and freshness milestones, and the 3-failure / tool-loop
      clauses are model-carried.
      verify: a test reads the state fields the rule header names and finds each in `_empty_state()`.
- [ ] **1.3 Skills keep their method, lose the count→ask.**
      `systematic-debugging` (`:165`) and `bug-analyzer` (`:139-140`, `:266`)
      point at band 2 / band 3 of the ladder instead of "discuss with the user".
      verify: `grep -nE 'Surface the question to the user|Discuss with the user before attempting more fixes|Stop and discuss' src/skills/systematic-debugging/SKILL.md src/skills/bug-analyzer/SKILL.md` → no output.
- [ ] **1.4 `bug-analyzer` ships no project's root causes.** The "in this
      project" list becomes generic categories plus the existing `retrieve`
      step as the source of project-specific causes.
      verify: `grep -c 'in this project' src/skills/bug-analyzer/SKILL.md` → `0`.
- [ ] **1.5 Own-number register.** `fix-loop-ladder.md` lists every surface
      that keeps its own retry number (`verify-repair-loop` 3,
      `subagent_steering` 2-consecutive stop, work-engine `SELF_FIX_CEILING` 3)
      with one line on why, so a paraphrase cannot pass as a second ladder.
      verify: each named surface links back to `fix-loop-ladder`.
- [ ] **1.6 The guard sees paraphrases.** The ladder test scans `src/rules`,
      `src/skills` and `src/agent-src/contexts` for count→ask phrasings, not
      only the literal in one file; red before 1.1-1.3, green after.
      verify: `npx vitest run tests/e2e/adversarial-verification-fixtures.test.ts` → 0.

## Phase 2 — A discarded red is not green

- [ ] **2.0 Discard never counts as pass.** `canVerify` consults the same
      segment predicate the transcript path uses (export it; no second list).
      verify: fixtures `tsc --noEmit || true`, `tsc --noEmit; true`,
      `eslint . || :` (exit 0, error output) are not `PASS_EVIDENCE_OK`;
      `vitest run || exit 1` still is. Test red before the fix.

## Phase 3 — The counter, in shadow

- [ ] **3.1 Failure signature.** `failureSignature(run)`: runner + failing
      summary counts + first error line, normalised (durations, timestamps,
      hex addresses, temp paths, line numbers out), hashed.
      verify: same red with a different duration → same signature; a
      different failing test → a different one.
- [ ] **3.2 Strike ledger.** `agents/state/strike-ledger.json`, written beside
      the run record from the same capture (one capture, two readers): per
      target `{sig, streak, verdict: SAME|NEW|FIXED|FLAKY, edits_between,
      last_at, platform}` keyed by agent and target. Hashes and counts only —
      never output text. Survives turn reset and session change; entries older
      than 7 days drop.
      verify: red→red with an edit between → `SAME`, streak 2; red→green →
      `FIXED`, streak 0; red/green/red without an edit → `FLAKY`, no strike;
      a second session within 7 days inherits the streak.
- [ ] **3.3 Shadow posture.** Nothing reaches the model; the ledger is read by
      tests and by the stubs below. The rule text says so.
      verify: no emission path references the ledger outside tests and its writer.

## Decisions

| # | Decision | Owner | Reason | Revisit-if |
|---|---|---|---|---|
| D1 | A new session on the same target inherits the streak, TTL 7 days | council-decidable, taken here | Without it the cross-session loop the source names stays open; shadow makes it reversible | shadow shows inherited streaks that were unrelated work |
| D2 | The ledger counts attempts (ladder unit); `SAME` is the evidence of "no new strategy" | taken here | The ladder counts attempts | — |
| D3 | Ledger written at the recorder, in its own file, not a sibling hook | taken here | A sibling would re-parse the same stdin; one capture, two readers holds either way | ledger write measurably slows the hook |
| D4 | `mission_record.attempt_count` writer deferred to the speaking stub | taken here | Writing it before the ledger is validated in shadow would make a dead field a wrong one | — |
| D5 | Pipe-masking (`cmd \| head`) is not armed here | taken here | Ambiguous (a summary in the tail is correct); needs a shadow window — stub | — |

## Risk register

| Risk | Mitigation |
|---|---|
| Signature too coarse: real progress counted `SAME` | 3.1 fixtures; shadow only |
| Signature too fine: line drift reads `NEW` | normalisation in 3.1 |
| Ledger leaks output into a cross-session file | shape is hashes and counts; test asserts no string field carries output |
| Worktrees sharing one root | ledger lives under the payload's consumer root, like the run record |

## Out of scope — where the rest went

- Ledger speaks at band boundaries, learnings from fixed strikes, `attempt_count` writer → `stubs/road-to-a-strike-that-speaks.md`.
- Pipe-masking shadow and arming; `rejectedTacticRepeat` wire-or-delete before its 2026-12-12 expiry → `stubs/road-to-a-stall-the-replay-measures.md`.
- Guard against edits to the consumer's generated files; unattended `AskUserQuestion` parking → `later/road-to-generated-files-and-unattended-asks.md`.
