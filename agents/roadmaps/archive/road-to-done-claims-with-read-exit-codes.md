---
complexity: lightweight
status: ready
tree_pin: 811cea61d6
review_by: 2026-12-21
execution:
  mode: autonomous
estate_growth_exempt: "Owner-directed 2026-11-21: the session retro's P0 measure 1 (done claims only with evidence) was asked to be planned and worked off as its own roadmap; the one roadmap that names part of it (road-to-a-stall-the-replay-measures, section 2) is a stub, not active work, and is extended rather than duplicated."
estate_offset_exempt: "road-to-done-claims-with-read-exit-codes is added on the owner's order of 2026-11-21 to plan every measure of that day's session retro as its own roadmap. No active roadmap is finished, so none was archived to offset it, and folding it into a parked later/ roadmap would hold asked-for work behind that roadmap's entry condition. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
relates:
  - slug: road-to-stop-hooks-that-count-own-edits
    relation: disjoint
    note: "Same-retro sibling (measure 6). Both edit `_lib/verification_command.ts`: this file owns exit masking and peeling `rtk` / `rtk proxy` in `DELEGATING_HEADS`; that file owns the container, path-script, Python and Taskfile/Makefile verify shapes in `segmentVerifies`. Whichever lands second re-applies its `DELEGATING_HEADS` edit on top of the first (Risk 4)."
  - slug: road-to-repo-knowledge-generated-not-written
    relation: disjoint
    note: "Same-retro sibling (measure 7). Its `testing-env` topic file and this file's `live-surfaces.json` both read compose files and Taskfile targets; that file owns the path-triggered knowledge text, this one owns the gitignored reachability map the verify skill reads. Neither reads the other's output as input."
  - slug: road-to-a-stall-the-replay-measures
    relation: extends
    note: "Carries its section 2 (pipe-masked exit codes) into active work and widens it to trailing `;` / `||` commands; its section 1 (rejectedTacticRepeat) stays with the stub."
  - slug: road-to-an-agent-the-owner-does-not-drive
    relation: extends
    note: "Its 6.1 owns a blocking live-surface probe for UI claims; this adds the generated reachability map and the explicit not-verified list, and does not wait on 6.1."
  - slug: road-to-one-verification-classifier
    relation: extends
    note: "Archived; its classifier reads the record's exit code but never asks whose exit code it is. This adds exit masking."
  - slug: road-to-single-line-estate-claims
    relation: disjoint
    note: "Probe keyword hit on 'claims': it is about block-scalar estate_growth_exempt parsing, not completion claims."
---
# Road to done claims with read exit codes

> **Source:** the owner's session retrospective of 2026-11-21 (about 380 Claude
> Code sessions, 643 extracted incidents, 23 chunks), pattern A "premature done
> and false green" (seen in at least 15 chunks), P0 measure 1. The AI council
> round of the same day (anthropic + openai, analysis mode, one round, 2 of 2
> present) ranked it the top problem from both seats. OpenAI's seat asked
> whether the session could reach the real app at all, and warned that a blanket
> `| tail` lint misses other ways of hiding a failure. Anthropic's seat asked
> for a mandatory human smoke test. The owner did not adopt that request.
> Tree facts were checked on 2026-11-21 against `811cea61d6`.

## Goal

A completion claim in this suite has to rest on an exit code that came from the
command that verified the work. The closing summary says what was verified and
lists what was not. Five things are true at the end:

- The run classifier stops reading `cmd | tail`, `cmd; echo` and `cmd || echo`
  as passes.
- Roadmap `verify:` clauses and `exec:` claim pointers cannot carry a masked
  command.
- A reply that reports N of M as complete is caught.
- A change to a live surface the repo can run, closed without a live check and
  without a "Not verified" line, is caught.
- No step of this roadmap asks the owner to smoke-test anything.

## Context

**Incidents (retro, pattern A).**

- agent-config 2026-11-20, twice: the agent reported "task ci green (exit 0)".
  The 0 came from an appended `echo`, and `| tail` ran several times without
  `pipefail`.
- elvau: a book was reported complete when about 165 of 405 pages had been
  covered.
- agent-config 2026-10-25: "all roadmaps done" when one step had been done.
- azeroth 2026-11-14: the harness was green and the game was wrong.
- agent-switch 2026-10-28: CI and 550 unit tests were green and almost nothing
  worked.

Root cause named in the retro: substitute evidence was taken as proof, and exit
codes were not read.

**Tree facts (verified 2026-11-21).**

- **The classifier trusts whatever exit code the record carries.**
  `classifyRun` (`src/scripts/_lib/verification_evidence.ts:315`) ends with
  "exit 0 → `PASS_EVIDENCE_OK`" (`:390-393`). Probe run today with
  `exit_code: 0` and a `tsc` error in the output: `npx tsc --noEmit | tail -5`,
  `task ci; echo "exit=$?"`, `task ci 2>&1 | tail -20`, `task ci || echo failed`
  and `set -o pipefail; task ci | tail -5` all classify `PASS_EVIDENCE_OK`. The
  last one is correct. The first four are false greens.
- **The segment splitter already sees the separators.** `Segment.nextSep` is
  `'&&' | '||' | ';' | '|'` (`src/scripts/_lib/verification_command.ts:128`).
  `failureIsDiscarded` (`:223-227`) only recognises a `true` or `:` after `;` or
  `||`. Nothing reads `|` as masking, and nothing reads a trailing `echo` as
  masking.
- **`rtk`-wrapped runs get no verdict.** `rtk vitest run` with exit 1 classifies
  `not_a_verification_command`, because `rtk` is missing from `DELEGATING_HEADS`
  (`verification_command.ts:98-104`). The owner's global setup rewrites
  commands through `rtk`.
- **Detector D catches only one kind of completion claim.**
  `detectCompletionClaim` (`src/scripts/hooks/turn_end_gate_hook.ts:588`) fires
  only when CI was read and is unsettled (`:593`). Nothing compares a claimed
  ratio against its own total.
- **Six detectors are registered.** `DETECTOR_IDS` sits at
  `src/scripts/_lib/turn_end_refusals.ts:77`. Each one has pre-registered bars
  in `docs/contracts/turn-end-detector-demotion.md`.
- **`verify-before-complete` is a kernel rule** (`docs/contracts/kernel-membership.md:149`).
  This roadmap leaves it alone (D1).
- **`report_verification_record_coverage.ts` exists** and reports instrument
  gaps per host. This is where the stub's section 2 asked for the masked-exit
  count.

**Scope.** The stub `road-to-a-stall-the-replay-measures` section 2 already
names the pipe half as unscheduled work. This roadmap does that work, adds the
trailing-command half, and leaves the stub's section 1 alone.
`road-to-an-agent-the-owner-does-not-drive` 6.1 (parked in `later/`) keeps the
stricter rule that UI claims must carry a probe. Out of scope:

- Recognising Taskfile- or config-declared verify commands as verification
  belongs to P0 measure 6 of the same retro and has its own roadmap.
  The only verify-command change here is the `rtk` prefix, because it decides
  whether the exit code that was read gets classified at all.

**Owner constraint (2026-11-21).** The reachability map in Phase 4 is generated
from repo files by a command. Nobody writes it by hand, and no owner-written
context file is added.

## Phase 1: Exit masking in the run classifier

Exit: 1.1's cases are green and the coverage report prints the new reason.
Rollback: revert the `verification_command.ts` and `verification_evidence.ts`
hunks. The detector reads the same records as before.

- [x] **1.1 Red first: masked-exit cases in `tests/scripts/verification_evidence.test.ts`.** <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      Add one case per shape:
      - The four masked commands from Context, each with `exit_code: 0` and a
        failing `tsc` line in `stdout_tail`. Each expects
        `{ kind: 'INVALID_RUN', reason: 'exit_masked' }`.
      - Three controls that must keep their current verdict:
        `set -o pipefail; task ci | tail -5`, `task ci && echo ok`, and
        `task ci; echo "exit=$?"` with `exit=0` in the output (the echoed real
        code is read).
      - One case with `exit=1` in that echoed output. It expects
        `nonzero_exit_without_test_failure`.

      Run the file and record the red count in the Done note.
      verify: `npx vitest run tests/scripts/verification_evidence.test.ts` -> /exit_masked/
      **Done 2026-11-21:** Ten cases added across the four masked shapes, the
      three controls, the echoed `exit=1` case, the gap pin and the finding
      text; seen red before the fix (31 red across this file and the 1.2 file,
      10 of them in this file). Amended by D8: the two echoed-code controls now
      expect `exit_masked`.
- [x] **1.2 Add `exitMasking(command)` to `src/scripts/_lib/verification_command.ts`, built on `splitSegments`.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/verification_command.ts -->
      It returns `'pipe' | 'trailing' | null`:
      - `pipe`: a verifying segment's `nextSep` is `|`, and the same line does
        not first set `pipefail` (`set -o pipefail` or a combined `set -…o pipefail`)
        and does not read `PIPESTATUS`.
      - `trailing`: a verifying segment is followed by `;` or `||` and then a
        segment whose head is not a verifier and not `true` or `:`.
        `failureIsDiscarded` keeps owning the discard case.

      Unit cases go in `tests/scripts/verification_command_anchoring.test.ts`,
      red first.
      verify: `npx vitest run tests/scripts/verification_command_anchoring.test.ts` -> 0
      **Done 2026-11-21:** `exitMasking` returns `pipe` / `trailing` / null;
      `cmd || exit 1`, `cmd; exit $?` and `task sync; task ci` stay unmasked. 18
      unit cases in the anchoring file, red first.
- [x] **1.3 Wire masking into `classifyRun`.** Add `exit_masked` to <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/verification_evidence.ts -->
      `InvalidRunReason`. Place the check after the failing-summary check
      (`verification_evidence.ts:354`), because printed failures still win, and
      before the exit code is read.
      - When the output carries an echoed `$?` / `${PIPESTATUS[n]}` value of the
        form `exit=N` or `exit code: N`, that value replaces the record's exit
        code and the masking verdict is dropped.
      - Add `exit_masked` to `INSTRUMENT_GAP_REASONS` (`:82`), so it records and
        does not refuse until Phase 5 decides.

      1.1 turns green.
      verify: `npx vitest run tests/scripts/verification_evidence.test.ts` -> 0
      **Done 2026-11-21:** `exit_masked` is in `InvalidRunReason` and
      `INSTRUMENT_GAP_REASONS`; an echoed `exit=N` / `exit code: N` replaces the
      masked code. The pinned gap-set test now names three reasons. Amended by
      D8: the echoed-code reading is gone; a masked run classifies
      `exit_masked`, and masking is consulted only where the exit code decides.
- [x] **1.4 Name the repair in the finding.** `describeRecordFinding` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/verification_evidence.ts -->
      (`verification_evidence.ts:617`) gets an `exit_masked` branch naming both
      repairs: `set -o pipefail`, or the runner's own filter flag instead of a
      pipe. Add one assertion on the text to the 1.1 file.
      verify: `npx vitest run tests/scripts/verification_evidence.test.ts` -> 0
      **Done 2026-11-21:** `describeRecordFinding` names `set -o pipefail;` and
      the runner's own filter flag when `exit_masked` is among the reasons.
- [x] **1.5 Classify `rtk`-wrapped runs.** Red first: `rtk vitest run` with <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/verification_command.ts -->
      exit 1 expects `FAIL_EVIDENCE` or `nonzero_exit_without_test_failure`, not
      `not_a_verification_command`. Then peel `rtk` and `rtk proxy` in
      `DELEGATING_HEADS` (`verification_command.ts:98`) and in
      `COMMAND_PREFIXES` (`verification_evidence.ts`).
      verify: `npx vitest run tests/scripts/verification_command_anchoring.test.ts tests/scripts/verification_evidence.test.ts` -> 0
      **Done 2026-11-21:** `rtk` peeled in `DELEGATING_HEADS` (with `rtk proxy`)
      and in `COMMAND_PREFIXES`; `rtk gain` stays non-verifying. Red first.
- [x] **1.6 Count masked records per host.** `report_verification_record_coverage.ts` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/report_verification_record_coverage.ts -->
      prints an `exit_masked` column with its denominator (records per host),
      following the stub's section 2 bullet 1. Red first: a fixture witness
      record in `tests/scripts/report_verification_record_coverage.test.ts`
      carrying a masked command.
      verify: `npx vitest run tests/scripts/report_verification_record_coverage.test.ts` -> 0
      reach exempt: a maintainer-run measurement report over the local witness store with no shipped invoker by design; its own main() calls computeCoverage and renderText, and step 5.1 ran it by hand
      **Done 2026-11-21:** New `exit_masked` field per host and a column printed
      as `N of records`; two red-first cases. The 21 test files that import the
      classifier, the recorder or the turn-end gate pass (668 tests, exit 0).

## Phase 2: Masked commands in claimed verification

Exit: the lint is green on the tree and red on its planted fixture, and it is
wired into the fast CI tier. Rollback: drop the task entry. The lint is
standalone.

- [x] **2.1 Red first: `tests/scripts/lint_verify_exit_masking.test.ts`.** <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      Fixtures:
      - a roadmap whose `verify:` clause is `` `task ci | tail -3` -> 0 ``;
      - one whose clause is `` `task test; echo done` -> 0 ``;
      - a `docs/CLAIMS.md`-shaped file with an `exec:` pointer carrying `| head`;
      - a clean control with `set -o pipefail;`.

      The test expects three findings and zero on the control. It fails because
      the script does not exist yet.
      verify: `npx vitest run tests/scripts/lint_verify_exit_masking.test.ts` -> 1 (red: the script does not exist yet)
      **Done 2026-11-21:** Fixture under `tests/fixtures/lint-verify-exit-
      masking/` (two masked roadmap clauses, one masked `exec:` pointer, a
      pipefail control and a clean pointer); the test file was red on the
      missing module (exit 1) before 2.2.
- [x] **2.2 Write `src/scripts/lint_verify_exit_masking.ts`.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/lint_verify_exit_masking.ts -->
      - It reads `verify:` clauses through `parseVerifyClause`
        (`src/agent-src/scripts/verify_clause.ts:228`). It does not parse them a
        second time.
      - It reads `exec:` pointers the way `check_claims.ts` reads them.
      - It runs `exitMasking` from 1.2 on each command.
      - Scope: `agents/roadmaps/{*.md,later,stubs}` and `docs/CLAIMS.md`.
        Archive is excluded because archived files are spent.
      - Exit 1 on a finding.

      Before wiring it, fix each finding the tree has today in its source file
      and list the count in the Done note.
      verify: `./scripts-run src/scripts/lint_verify_exit_masking` -> 0
      **Done 2026-11-21:** The first tree run found 3 masked clauses, all fixed
      in their source files: `road-to-a-static-context-under-budget` 4.4 and
      `later/road-to-stacks-beyond-php` got `set -o pipefail;` in front;
      `later/road-to-originality-gate-and-contributor-funnel` Phase 0 dropped
      its `; echo "exit=$?"` and names `-> 0` (measured exit 0). Tree run after
      the sweep: 358 files, exit 0.
- [x] **2.3 Wire the lint into `taskfiles/ci-fast.yml`** next to <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=unrecognised path shape: taskfiles/ci-fast.yml -->
      `lint_decision_classes` (`:1223`), with the same `{{.QUIET_FLAG}}` shape.
      Positive control: the 2.1 fixture run through the CLI exits 1.
      verify: `./scripts-run src/scripts/lint_verify_exit_masking --root tests/fixtures/lint-verify-exit-masking` -> 1
      **Done 2026-11-21:** Task `lint-verify-exit-masking` sits after `lint-
      decision-classes` in `taskfiles/ci-fast.yml` and in the `ci` list of
      `Taskfile.yml`; `task lint-verify-exit-masking` exits 0 on the tree, the
      fixture run exits 1.

## Phase 3: Partial completion reported as complete

Exit: the new detector records findings on its fixtures and refuses nothing.
Rollback: remove the id from `DETECTOR_IDS` and the detector from
`runDetectors`.

- [x] **3.1 Red first: coverage cases in `tests/scripts/turn_end_gate_hook.test.ts`.** <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      Cases that must produce a finding:
      - "Fertig — 165 von 405 Seiten bearbeitet."
      - "Done. 1 of 9 steps processed."
      - "All done: 40/41 checks passed."

      Cases that must not:
      - "Fertig: 405 von 405 Seiten."
      - a ratio under a `Not verified:` / `Nicht verifiziert:` line;
      - a negated line ("noch nicht fertig, 165 von 405"); <!-- md-language-check: ignore -->
      - a ratio inside a fenced block or a table.

      Each case expects detector `coverage` with reason `partial_ratio`.
      verify: `npx vitest run tests/scripts/turn_end_gate_hook.test.ts` -> /coverage/
      **Done 2026-11-21:** Three finding cases, seven silent cases (full ratio,
      `Not verified:` and `Nicht verifiziert:` lists, negated line, fence,
      table, no claim), a never-refuses case and an end-to-end run; 12 red
      before 3.2 (exit 1).
- [x] **3.2 Implement `detectCoverageGap` in `turn_end_gate_hook.ts`.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/turn_end_gate_hook.ts -->
      - The trigger is the existing `_COMPLETION_RE` (`:557`) plus
        `_NEGATED_CLAIM_RE` (`:578`). No new completion keywords, per the
        2026-08-12 council bound quoted at `:568-576`.
      - Over `visibleProse`, a `N (of|von|/) M` ratio with `N < M` that does not
        sit under a not-verified heading is a finding.
      - Add `coverage` to `DETECTOR_IDS` (`turn_end_refusals.ts:77`) and to the
        `DetectorId` union. Update the header count the test pins.
      - The detector records its finding in the refusal counters and does not
        refuse. A test asserts it never refuses.

      verify: `npx vitest run tests/scripts/turn_end_gate_hook.test.ts tests/scripts/measure_turn_end_gate.test.ts` -> 0
      reach exempt: the flagged symbols belong to measure_turn_end_gate, a maintainer-run replay report over the local transcript store with no shipped invoker by design; the shipped detector is reached from src/scripts/hooks/turn_end_gate_hook.ts through the dispatcher
      **Done 2026-11-21:** The detector body lives in
      `src/scripts/_lib/coverage_claim.ts`, with a three-line
      `detectCoverageGap` wrapper in the hook: the hook sat at 1,495 of its
      1,500-line ceiling and `check_source_size_budget` refused the first in-
      file version (+7). The completion trigger and negation moved there with
      it, so D and G share one trigger. `coverage` joined `DetectorId`,
      `DETECTOR_IDS` and the dispatch-censored set; `refusingFindings` drops it
      from the verdict and `markRecordOnly` counts it in `<key>.recorded.json`,
      which the pruner ages on `last_at` and the rollup skips. 3 test files, 235
      tests, exit 0; typecheck exit 0.
- [x] **3.3 Pre-register `coverage`'s bars in `docs/contracts/turn-end-detector-demotion.md`.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      "The six detectors" becomes seven. The bar and the sample floor are
      copied in shape from detector F's rows and give this detector's own
      numbers. The contract requires bars to exist before a detector can refuse.
      verify: `grep -c "coverage" docs/contracts/turn-end-detector-demotion.md` -> /[1-9]/
      **Done 2026-11-21:** Heading and table now read seven; G takes the bar row of F
      (40 %, 3) with a stated reason, and its sample floor reads recorded
      findings until armed.

## Phase 4: Verified and not verified, with a generated reachability map

Exit: the map is generated for three fixture repos, the skill states the split,
and the detector records an unlisted surface. Rollback: revert the skill and
context edits and delete the script. The map is gitignored state.

- [x] **4.1 Red first: `tests/scripts/derive_live_surfaces.test.ts`.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=dependency manifest: tests/fixtures/live-surfaces/vite/package.json -->
      Fixture repos go under `tests/fixtures/live-surfaces/`:
      - `tauri/`: `tauri.conf.json` with a window of 1040×620;
      - `vite/`: `package.json` with `dev` and `preview` scripts, plus a
        `playwright.config.ts` with a `baseURL`;
      - `none/`: a library with only `test`.

      Expected: each runnable surface with its start command, size or URL, and a
      `derived_from` file:line, and `[]` for `none`.
      verify: `npx vitest run tests/scripts/derive_live_surfaces.test.ts` -> 1 (red: the script does not exist yet)
      **Done 2026-11-21:** Three fixture repos under `tests/fixtures/live-
      surfaces/` (`tauri`, `vite`, `none`), copied to a temp dir per case so the
      map is never written into a fixture; red on the missing module (exit 1)
      before 4.2.
- [x] **4.2 Write `src/scripts/derive_live_surfaces.ts` and register it in `src/cli/registry.ts`.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/derive_live_surfaces.ts -->
      The CLI name is `verify:surfaces`, registered next to `roadmap:context`
      (`:89`).
      - It reads `package.json` scripts (`dev|start|preview|serve`),
        `tauri.conf.json`, `playwright.config.*`, `docker-compose*.yml` ports
        and Taskfile `dev|run|serve` tasks.
      - It writes `agents/state/live-surfaces.json`, which is gitignored
        (`.gitignore:274`).
      - Every entry is derived. The script reads no hand-written input, and it
        regenerates when an input file's mtime is newer than the output.

      verify: `npx vitest run tests/scripts/derive_live_surfaces.test.ts` -> 0
      **Done 2026-11-21:** `derive_live_surfaces.ts` reads the five input kinds,
      names `file:line` for each entry, and regenerates `agents/state/live-
      surfaces.json` when an input is newer or new. `verify:surfaces` is
      registered in `src/cli/registry.ts` and wired in `_dispatch.bash`, where
      the global `--root` arrives as `AGENT_CONFIG_PROJECT_ROOT`; checked by
      hand on a copy of the vite fixture (3 surfaces, exit 0). 5 tests, exit 0.
- [x] **4.3 State the split in `src/skills/verify-completion-evidence/SKILL.md`, with a pointer from `src/agent-src/contexts/communication/rules-auto/reply-close-mechanics.md`.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      A closing summary after a change carries two parts:
      - `Verified:`: each command, with the exit code that was read (never one
        from an appended `echo` or `tail`).
      - `Not verified:`: each changed surface from the 4.2 map that got no live
        check, with the reason (no derived surface, or no tool that can drive it
        in this session).

      Where a surface is reachable, the skill runs it through its derived start
      command, or `ui:render` for web, before claiming. Nothing asks the owner
      to smoke-test (D3).
      verify: `./scripts-run src/scripts/check_references` -> 0
      **Done 2026-11-21:** New `Verified and not verified` section in the skill,
      one pointer bullet in `reply-close-mechanics`; projections regenerated
      (`task sync`, `task generate-tools`, both exit 0). `check_references` exit
      0.
- [x] **4.4 Red first, then a second reason for detector `coverage`: `unlisted_surface`.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/turn_end_gate_hook.ts -->
      The case: a reply with a completion claim, a turn that edited a file
      under a surface root from the 4.2 map, no tool call that ran that surface,
      and no `Not verified:` / `Nicht verifiziert:` line.
      - This gives a finding.
      - Two controls give none: the same turn with a `Not verified:` line naming
        the surface, and the same turn with a `ui:render` call.
      - It records and does not refuse.

      verify: `npx vitest run tests/scripts/turn_end_gate_hook.test.ts` -> 0
      **Done 2026-11-21:** `unlistedSurfaceIn` in `_lib/coverage_claim.ts`
      derives the map in memory (the Stop path writes nothing into a consumer
      repo) and accepts a start command, URL, `ui:render` or `playwright test`
      as driving. Five cases, two red before the fix; the hook stays at 1,497
      lines. 5 test files, 250 tests, exit 0.

## Phase 5: Arming by measurement and council

Exit: a recorded council verdict per reason, applied with its tests. Rollback:
the verdict's revert is one constant (`INSTRUMENT_GAP_REASONS`) and one switch
(the refusal flag on `coverage`).

- [x] **5.1 Measure before asking.** Run the classifier and `detectCoverageGap` <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      over every witness record and transcript in the local store that
      `report_verification_record_coverage` reads. Report per reason:
      - how often it fires;
      - how many fires are on a `pipefail` command, which must be 0;
      - how many fires are on a reply that does say what is not verified;
      - the store window.

      Write the result to `agents/evidence/analysis/done-claims-arming-<date>.md`.
      verify: `ls agents/evidence/analysis/ | grep -c done-claims-arming` -> /[1-9]/
      **Done 2026-11-21:** Written to `agents/evidence/analysis/done-claims-
      arming-2026-11-21.md`: 42 witness records over 2 days (3 `exit_masked`, 0
      on a `pipefail` line) and 1,504 transcript turns over 24 days (5 trigger
      matches, 0 `partial_ratio`, 1 `unlisted_surface`, 0 fires on a reply with
      a not-verified list).
- [x] **5.2 Run the council on the arming question:** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      `/council` with the 5.1 numbers and the demotion contract's bars. The
      question: should `exit_masked` refuse a turn, should `partial_ratio`, and
      should `unlisted_surface`? Record one Decisions row per reason, resolved
      `council:<date>`.
      verify: `grep -cE "^\| D[5-7] " agents/roadmaps/archive/road-to-done-claims-with-read-exit-codes.md` -> /3/
      **Done 2026-11-21:** Council `council:run --prompt-mode analysis --rounds
      1`, question and numbers as a file; openai seat answered, anthropic seat
      failed with exit 1, quorum 1 of 2 met but degraded. Verdict for all three:
      record-only, with per-reason revisit conditions; recorded as D5-D7.
- [x] **5.3 Apply the verdicts, with tests first.** For each armed reason: <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      - remove it from `INSTRUMENT_GAP_REASONS`, or set `coverage`'s refusal
        flag;
      - add a refusal test, red first.

      A reason that stays unarmed keeps its shadow test and gets a `revisit if`
      that names a sample size.
      verify: `npx vitest run tests/scripts/verification_evidence.test.ts tests/scripts/turn_end_gate_hook.test.ts` -> 0
      **Done 2026-11-21:** No reason was armed, so nothing left
      `INSTRUMENT_GAP_REASONS` and the refusal flag on `coverage` stays off. The
      shadow tests stay (gap-set pin, `refusingFindings` cases); each of D5-D7
      names a sample size in `revisit if`. The two files: 227 tests, exit 0.

## Acceptance Criteria

- [x] AC-1: Each of the four masked commands in Context classifies
      `exit_masked`, or takes the code it echoed itself. The `pipefail` control
      stays `PASS_EVIDENCE_OK` (1.1, 1.3).
- [x] AC-2: `lint_verify_exit_masking` runs in the fast CI tier. It exits 0 on
      the tree and 1 on its fixture (2.2, 2.3).
- [x] AC-3: "165 of 405 … done" and "1 of 9 steps … done" each produce a
      `coverage` finding. "405 of 405" and a ratio under `Not verified:` produce
      none (3.1, 3.2).
- [x] AC-4: `verify:surfaces` regenerates `agents/state/live-surfaces.json` from
      repo files alone, and no hand-written input exists (4.2).
- [x] AC-5: Each reason has a council-resolved arming row backed by a 5.1
      measurement (5.2), and each armed reason has a red-then-green refusal test
      (5.3).
- [x] AC-6: No step or skill text this roadmap adds asks the owner to run,
      smoke-test or approve anything. Check:
      `grep -niE "owner (runs|verifies|smoke)|smoke[- ]test by" src/skills/verify-completion-evidence/SKILL.md`
      returns 0 matches. Positive control: the same grep on a copy with
      "owner smoke-tests the app" planted returns 1.
      Checked 2026-11-21: the skill returns 0 matches, the planted copy 1.
      Measurement: `agents/evidence/analysis/done-claims-arming-2026-11-21.md` (5.1) — the closing split the skill now asks for is backed by three record-only reasons; none fired often enough to arm (D5-D7).

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | The verified / not-verified split goes into the `verify-completion-evidence` skill and `reply-close-mechanics`, not the kernel rule `verify-before-complete`. | `docs/contracts/kernel-membership.md:149`; kernel-rule edits need their own PR and a soak (`scope-control`) | a kernel-budget revision opens a slot for it |
| D2 | reversible-technical | agent | Every new reason records and does not refuse until Phase 5 arms it. | the demotion contract requires per-detector bars before refusal; a mis-firing refusal teaches operators to switch the gate off (`verification_evidence.ts` header) | 5.2 records the verdict |
| D3 | product-owned | owner | There is no mandatory owner smoke test. Live checks run where the agent can reach the surface, and otherwise the reply lists what is not verified. | owner's session retro 2026-11-21, P0 measure 1 ("no mandatory smoke test by you"); council 2026-11-21 OpenAI seat | the owner reinstates a human smoke test |
| D4 | reversible-technical | agent | One detector id, `coverage`, carries both `partial_ratio` and `unlisted_surface`. | one bar set to register and measure instead of two; both reasons answer "is the claim as wide as the evidence" | 5.1 shows the two reasons need different arming |
| D5 | reversible-technical | council:2026-11-21 | `exit_masked` stays record-only: it remains in `INSTRUMENT_GAP_REASONS` and refuses nothing. | 5.1: 3 fires in 42 witness records, one host, a 2-day window, 0 on a `pipefail` line, no labelled ground truth (`agents/evidence/analysis/done-claims-arming-2026-11-21.md`); council analysis round of 2026-11-21, openai seat present, anthropic seat failed (exit 1), quorum 1 of 2 met but degraded: keep record-only, discovery first | ≥ 100 `exit_masked` findings over ≥ 50 sessions and ≥ 30 days, with the candidates labelled against the verifier's real exit status and effective shell settings, including an rc-file `pipefail` |
| D6 | reversible-technical | council:2026-11-21 | `partial_ratio` stays record-only: detector `coverage` keeps its refusal off. | 5.1: 0 fires over the 5 closings the completion trigger matched in 1,504 turns over 24 days; same council round and seats as D5: keep record-only, a zero over five opportunities says nothing about precision | ≥ 100 `partial_ratio` findings over ≥ 50 sessions and ≥ 30 days, each labelled for whether the ratio is unfinished work the claim covers, plus a sample of non-firing closings for misses |
| D7 | reversible-technical | council:2026-11-21 | `unlisted_surface` stays record-only: detector `coverage` keeps its refusal off. | 5.1: 1 fire over the same 5 closings, measured on today's surface map rather than the turn's; same council round and seats as D5: keep record-only, and the replay needs a turn-time surface map before its count can be trusted | the surface map is captured at turn time, and ≥ 100 `unlisted_surface` findings over ≥ 50 sessions and ≥ 30 days are labelled for whether the edit touched the surface and the turn drove it |
| D8 | reversible-technical | council:2026-11-21 | A masked exit code is never replaced by an `exit=N` line from the output: a masked run classifies `exit_masked`, and masking is consulted only where the exit code would decide (after printed failures, load failures and empty suites). This reverses the echoed-code reading of step 1.3. | The bundle-raise ratification rounds 1-6 of 2026-11-21 (anthropic + openai seats): every round the openai seat refused on a new way the echoed line could belong to another command (a filter's `PIPESTATUS`, a later echo, a constant `printf`, a skipped `|| echo`, a redirected echo), each able to pass a failed run or refuse a clean one; the command text cannot establish where the echo's output went. Dropping the reading costs nothing against origin/main, where those lines read the echo's own 0 | shell-backed run records carry the verifier's own status (a wrapper that captures it), so provenance no longer has to be inferred from the command text |
| D9 | reversible-technical | council:2026-11-21 | Masking replaces only a recorded exit code of 0: a masked run with a nonzero recorded code keeps the verdict it had before this roadmap. So `exit_masked` can turn a pass into an instrument gap (both unrefusable) and can never demote a refusal. | Bundle-raise ratification round 7 of 2026-11-21: the openai seat showed shell paths where the masking reading attributes a verifier's own nonzero status to a filter (`tsc && task ci \| tail`, `set -e; tsc; echo done`) and so would demote a real failure; requiring the recorded 0 removes that whole class rather than one shape at a time | records carry the verifier's own status (D8's condition), or a measured case shows a nonzero filter code refusing honest work often enough to matter |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Masking check refuses honest work | implementation | A `pipefail` set in a sourced script or an rc file is invisible on the command line, so `cmd \| tail` could read as masked when it is not. | Reason starts as an instrument gap (D2); 5.1 counts fires on `pipefail` lines; masking never overrides a printed failure, load failure or empty suite (D8). | Phase 5: Arming by measurement and council |
| 2 | Ratio detector fires on prose that is not a claim | implementation | "2 of 3 options" in a reply that also says "fertig" is a ratio and a claim with no link between them. | Same-trigger discipline as D (`_COMPLETION_RE` + negation); records only; 5.1 measures the false share before any arming. | Phase 3: Partial completion reported as complete |
| 3 | Reachability map misses a real surface | product | A repo whose app starts through a script the deriver does not know reads as having no surface, so the reply owes no live check. | The not-verified list still applies to every changed surface the map names; misses show up as `none` in 4.2's output and get a fixture when found. | Phase 4: Verified and not verified, with a generated reachability map |
| 4 | Overlap with measure 6's verify-command roadmap | implementation | Both touch `verification_command.ts`; parallel edits to `DELEGATING_HEADS` collide. | Scope stated in Context: only the `rtk` prefix here; `roadmap:context` reruns before 1.5. | Phase 1: Exit masking in the run classifier |
| 5 | The tree carries masked `verify:` clauses today | implementation | Wiring the lint before the sweep reds CI for unrelated roadmaps. | 2.2 fixes every finding before 2.3 wires the task. | Phase 2: Masked commands in claimed verification |

<!-- Release holds: none.

     guarded: every new reason ships as a non-refusing finding (exit_masked in
     INSTRUMENT_GAP_REASONS, detector coverage with refusal off) until Phase 5
     arms it, so every intermediate tree state is publishable without a hold.
-->

## Notes

- The stub `road-to-a-stall-the-replay-measures` section 2 asked to arm only
  after 20 hand-judged masked records. 5.1 replaces the hand judgement with a
  measurement over the local store, and the council decides from that.
- This roadmap does not touch the stub. Once Phase 1 closes, its section 2 has
  been carried here.
- Follow-up named by the 2026-11-21 arming council (finding F4): the demotion
  contract registers bars for studying a demotion, not a rule for arming a
  record-only reason. Before any of D5-D7 is revisited, that promotion rule
  (acceptable false-refusal rate, evidence per reason) has to be written into
  `docs/contracts/turn-end-detector-demotion.md`; the D7 revisit also needs a
  turn-time surface map.
