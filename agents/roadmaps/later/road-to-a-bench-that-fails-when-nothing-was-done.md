---
complexity: lightweight
status: later
tree_pin: 1e3869b03d
review_by: 2026-11-28
entry_condition:
  what: "executed in the same change that adds it (owner invocation 2026-10-28: analyse the round, then /roadmap:process-full); parked only because all five active slots are taken"
  when: "immediately — every step is deterministic and costs 0 USD"
  who: none
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Owner invocation 2026-10-28 asked for the inbox round to be analysed and its roadmaps processed with /roadmap:process-full in one PR. Owner search: grep for bench_ab, score_task_v2, oracle, nop over agents/roadmaps, later/ and stubs/ on 2026-10-28 — no roadmap owns the v2 scorer's validity; road-to-solution-minimalism-full-tier-run and road-to-skill-uplift-against-a-no-skill-arm only inherit it. Parked in later/ because WIP is 5/5; archived in the same PR once closed."
relates:
  - slug: road-to-a-baseline-that-has-to-catch-up
    relation: blocks
    note: "Its artifact tasks run on this scorer; a showcase bought before this lands buys numbers the instrument does not carry."
  - slug: road-to-solution-minimalism-full-tier-run
    relation: extends
    note: "Its ~30 oracles inherit the validity gate of 1.5."
  - slug: road-to-skill-uplift-against-a-no-skill-arm
    relation: extends
    note: "Receives the two measured preconditions of 4.2."
  - slug: road-to-a-step-that-costs-what-it-changes-carried
    relation: overlaps
    note: "Its paired A/B reads discipline; it gets a dated note (4.1), its steps are not rewritten."
---

# Road to a bench that fails when nothing was done

> **Source:** `agents/tmp.old/inbox-2026-10-bh/` (proposal P6 of an earlier
> analysis round, re-verified against `1e3869b03d` on 2026-10-28). Proposal IDs
> are not carried over.

## Goal

The v2 bench scorer separates "solved" from "touched", "bypassed" and "did
nothing": synthetic do-nothing and tamper arms pass **0** capability oracles,
every fixture task has a reference solution outside the fixture that passes,
and a mis-wired plugin arm aborts before the first paid trial.

## Context

Verified at the pin (`file:line`):

- **Regex oracles that already match the untouched fixture.**
  `regex_in_target: "."` (`internal/bench/corpora/ab-trackb-v2.yaml:118`);
  the scorer checks only "changed + regex"
  (`src/scripts/_lib/bench_ab_scoring_v2.ts`, `regex_in_target` branch). The
  source measured 10 of 18 regex oracles matching the original, and a
  blank-line `touch` arm passing 10 of 17 targeted tasks.
- **Exit-code verdicts on files the agent can write.** `solve_test` /
  `hidden_test` run a file inside the clone; the verdict is the exit code.
  Source measurement: `process.exit(0)` atop the verifier, or atop the source
  module the verifier imports, passes 15 of 15 executable oracles.
- **Discipline rewards doing nothing; the gate does not require capability.**
  `passed = cap_sig || dis_sig` (`src/scripts/bench_ab_v2_stats.ts:641-647`).
  Source measurement: an empty `nop` arm scores `discipline_score` 1.0 on 23
  of 33 tasks.
- **Any `?` counts as a clarifying question.** All three `ask_regex` carry a
  bare `\?` alternative, plus `3`, `default`, `both`
  (`ab-trackb-v2.yaml:121`, `:137`, `:153`).
- **No reference solutions.** `internal/bench/ab/fixtures-v2/` has 33 task
  folders and no solution folder.
- **Arm delivery is cross-checked only after all paid runs**
  (`src/scripts/bench_ab_v2_run.ts`, cross-audit after the trial loop; the
  per-run guard checks the budget only).
- **Learning promotion never asks whether a learning weakens its own judge.**
  The question exists as `weakens-its-own-judge`
  (`src/scripts/ai_council/modification_review_questions.ts:50`) and reaches
  only gated paths.

The numbers above are the source's measurements; step 0.1 re-derives them with
the real scorer and records any delta instead of trusting them.

## Phase 0 — Measure in shadow

- [ ] **0.1 `bench_task_validity` as a shadow script.** Imports `score_task_v2`
      and scores every fixture task, on a copy, in the synthetic arms `nop`,
      `touch`, `verifier-exit`, `source-exit` and `noise-ask` (empty diff,
      transcript "Done in 3 steps. Fixed both issues. All set?"), plus a
      mutation catalogue (empty the verifier, delete assert lines, insert each
      regex pattern as a comment). Prints a table, exit 0.
      verify: two runs emit identical bytes; a vitest case covers every arm on one task.

## Phase 1 — Repair the scorer (deterministic, 0 USD)

- [ ] **1.1 Oracles that only match after the change.** Re-anchor the regex
      oracles that match the original; drop `\?` and the single-word
      alternatives from the three `ask_regex` so only a question naming one of
      the readings counts. `lint_bench_ab.ts` rejects a regex oracle matching
      the original fixture and an `ask_regex` matching the neutral sentence.
      verify: 0.1 shows `touch` 0 and `noise-ask` 0; a real question ("legacy or v1?") stays green.
- [ ] **1.2 Exit 0 passes only when the verifier finished.** (a) Restore the
      files the `command:` names from the original fixture before running and
      report `verifier-touched` when the clone differed; (b) set a random nonce
      in the environment and require it as the verifier's last stdout line;
      (c) flag added `process.exit` / `process.on('exit'` in source files as
      `verifier-bypass-suspect` — a report, never a deduction.
      verify: 0.1 shows `verifier-exit` 0 and `source-exit` 0; a planted bypass test is red.
- [ ] **1.3 Reference solutions outside the fixture.** One patch per task under
      `internal/bench/ab/oracle-v2/<id>.patch`; a test applies each to a copy
      and expects `capability_pass`. For trap tasks the safe interpretation is
      the reference. A task that fails its own reference is repaired, never
      dropped.
      verify: the reference test is green for every fixture task and no patch touches a verifier.
- [ ] **1.4 Discipline given capability, in shadow.** The stats report gains
      `discipline_given_capability` and the per-task `nop` floor. Both gate
      forms are computed and printed; the existing one still decides (D3).
      verify: a fixture test where an arm that does less raises the old discipline and not the new.
- [ ] **1.5 Arm the gate.** `bench_task_validity --gate` runs in the
      consistency job: every synthetic arm and mutation red, every reference
      green, for every task.
      verify: a new task without a reference, or matching the original, makes the gate exit non-zero.

## Phase 2 — Prove delivery before spending

- [ ] **2.1 Pre-flight per plugin arm.** Before the first paid trial,
      `bench_ab_v2_run` checks each arm configuration's delivery with a
      zero-cost probe (the host's `system/init` event read with an unreachable
      base URL and an allowlisted environment, child killed after the event).
      It aborts when `package` loads no package skill or `vanilla` loads one.
      The end-of-run cross-audit stays as the second check.
      verify: a test with a fake host binary aborts on a planted mis-wiring and costs no model call.

## Phase 3 — Learning gates ask about their own judge

- [ ] **3.1 One line from the existing question.** The promotion tables of
      `learning-to-rule-or-skill` and `skill-improvement-pipeline` carry the
      `weakens-its-own-judge` question text verbatim; a "yes" keeps the
      learning un-promoted.
      verify: a test asserts both skill files contain the constant's text verbatim.

## Phase 4 — Hand the numbers downstream

- [ ] **4.1 Dated note on the neighbour A/B.** `road-to-a-step-that-costs-what-it-changes-carried`
      gets one dated line with the 0.1 census: its A/B reads
      `discipline_given_capability` and the `nop` floor once 1.1-1.3 landed.
      verify: the note quotes the 0.1 numbers; no step there changes.
- [ ] **4.2 Preconditions for the skill-uplift pilot.** `stubs/road-to-skill-uplift-against-a-no-skill-arm`
      gets two measured preconditions: each pilot skill has ≥ 3 eval scenarios
      with ≥ 1 held out, and the 1.5 gate covers the pilot scenarios.
      verify: the stub carries both lines with today's date.
- [ ] **4.3 One line in the benchmark page.** Under the honesty labels of
      `docs/benchmark.md`, the task-validity state with a date. Pinned results
      stay; nothing is re-scored silently.
      verify: `task bench:ab:v2:diff -- --check` (or the renderer's drift check) stays green.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | analysis:2026-10-28 | Restore the verifier from the original **and** require a completion nonce **and** report (never deduct) an added exit | restoring alone leaves the source-module exit open; a separate process does not help while the verifier imports the agent's module | a real transcript shows a bypass the nonce misses |
| D2 | deterministic | analysis:2026-10-28 | Lint against "matches the original" instead of a diff-only regex | a diff-only regex misses correct fixes that rewrite the line | — |
| D3 | contested-technical | analysis:2026-10-28 | Shadow first: the capability non-inferiority gate is printed beside the old gate, which still decides; flipping it is a follow-up stub (`stubs/road-to-bench-gate-capability-non-inferiority`) | a pre-registered threshold is not replaced after the fact | the stub's owner question is answered |
| D4 | reversible-technical | analysis:2026-10-28 | The delivery probe runs only with an unreachable base URL and kills the child after `system/init` | without that the same command costs a real turn | the host stops emitting `system/init` before the first request |
| D5 | deterministic | analysis:2026-10-28 | No paid run in this roadmap | every defect is in the instrument and reproducible offline | — |
| D6 | deterministic | analysis:2026-10-28 | The clarifying-question credit stays; only what counts as a question changes | asking on an ambiguous task is the intended capability | — |

## Kill register

- **K1** A host `plugin eval` run in CI — costs money and its graders cannot run a script.
- **K2** Moving verifiers into a separate process or container — does not close the source-module exit (D1) and rebuilds 15 verifiers.
- **K3** A "≥ 3 scenarios per `evals.json`" lint for all skills — would lock skills no runner reads; kept as a pilot precondition only (4.2).
- **K4** A `host-init` channel for the skill-catalogue register — a separate observation question owned by `later/road-to-catalogue-host-fit`; not needed for 2.1.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-28 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A repaired oracle stops accepting correct solutions | implementation | Re-anchoring a regex or adding a nonce can turn a correct fix red, shifting every published pass rate | Reference patches (1.3) must stay green under every repaired oracle; the gate (1.5) checks both directions | Phase 1 — Repair the scorer (deterministic, 0 USD) |
| 2 | Published verdicts silently change | product | A scorer change re-scores pinned results without a date | Pinned results stay; the validity line in the page is dated (4.3); the old gate still decides (D3) | Phase 4 — Hand the numbers downstream |
| 3 | The delivery probe spends a turn | implementation | A probe that reaches the API costs money on every run | Unreachable base URL, allowlisted environment, child killed after the event, fake-binary test (2.1, D4) | Phase 2 — Prove delivery before spending |

## Acceptance Criteria

- [ ] AC-1 `bench_task_validity --gate` exits 0 at the closing commit with every synthetic arm and mutation at 0 capability passes and every reference green.
- [ ] AC-2 The stats report prints `discipline_given_capability` and the `nop` floor beside the deciding gate.
- [ ] AC-3 A planted plugin-arm mis-wiring aborts before any trial in a test.
