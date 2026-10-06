---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "The reach gate asks whether production code calls an instrument and is scoped, by its own comment, to the instruments one registry names. Outside that scope, 25 library modules are named by no production file and 57 are reached by none; twenty-three of the 25 are named in no open or deferred step of any live roadmap, one capability is registered as available on the strength of a module nothing calls, and one acceptance criterion was reopened for this class. No roadmap owns module-level reach. Folding the report into the roadmap that names eight of them under ticked steps or criteria was considered and rejected: it would be reporting on itself. Adds no gate script, no registry rows and no failing check."
estate_growth_exempt: "Grows active_roadmaps by one: the owner asked on 2026-10-05 for this round's roadmaps to land as ready in one change; no live roadmap owns module-level reach."
relates:
  - slug: road-to-adversarial-verification-and-long-runs
    relation: disjoint
    note: "Eight of the 25 are named under its ticked steps or criteria; this file reports them with that owner and edits none of its steps."
  - slug: road-to-typed-grants-that-persist
    relation: disjoint
    note: "One of the 25 is waited on by its deferred step 3.1, on which its step 4.3 depends; reported, not touched."
  - slug: road-to-tdd-phase-guard
    relation: disjoint
    note: "Stub. Owns the production caller of the red-run recorder that step 2.4 finds missing; 2.4 corrects one registry row and leaves the caller to it."
---
# Road to modules that something calls

> **Source:** an external comparison round against an autonomous-runtime tree
> (opaque id S1) in which the best-built tier — a staged compaction cascade,
> tier-based shedding, a set of alert rules — is tested, described to the agent
> as live, and instantiated nowhere. The same question was then put to this
> tree. Every anchor re-read and the census run at `main` @ `df377ca64` on
> 2026-10-05, then re-run twice by an independent pass. A second round on the
> same day, checking a parallel proposal for an evidence ledger and a typed
> authority kernel against the tree, found that several pieces those plans
> would have built exist here as modules nothing imports; that round added the
> import reading and the registry check. Class: external comparison corpus.
>
> Round `agents/tmp.old/inbox-2026-10-d/`. Re-verified anchor by anchor at
> `main` @ `975d03d01` on 2026-10-05 by five independent read-only passes;
> the one commit since the pin moved no anchor, and their corrections are in.

## Goal

For every library module that nothing in production references, one page says
which of four things it is: a check a contract test carries, work an open step
is waiting on, something a ticked step landed and nothing wired, or something
no live roadmap mentions. The last group is read module by module and leaves
it. No registry calls a capability available on the strength of a module that
nothing calls. The counts are printed on every gate run, and nothing
fails on them yet.

This file names no module on purpose: the page does, so that being listed here
cannot count as being waited on.

## Context

At `df377ca64`:

- The census: of 351 modules directly under `src/scripts/_lib/` (tests and
  declaration files excluded), **25** — 4,745 lines — have a name that appears
  in no file under `src/`, `taskfiles/`, `Taskfile.yml`, `.github/`,
  `package.json` or `docs/contracts/` other than the module itself and test
  files. Each has at least one test. The count is a floor: a module named only
  in a comment or a prose file counts as referenced.
- Name occurrence is the generous reading. Followed along import edges from
  non-test code, and counting a module a task, a workflow or the dispatcher
  runs by path as reached, **57** of the 351 modules — 11,553 lines — are
  reached by nothing: the 25, another 24 that a comment, a schema
  description, a registry or a prose file mentions without importing, and
  eight that only other unreached modules import. Two independent counts of
  this round agree on the 57 after reconciling three modules. Seven of the 57
  are imported by a test under `tests/contracts/`. The wider set is not all
  of one kind: one module has an entry point of its own and a user guide
  tells people to run it by path (`docs/guides/gated-platform-reads.md:93`);
  one is named by the loop registry as a surface's human gate and another
  carries two instruments that registry declares
  (`src/config/loop-surfaces.yaml:126`, `:170-185`). The count also takes
  every top-level script as live, and 18 of the 26 `report_` scripts have no
  task, workflow or dispatcher caller — so it is a floor in that direction.
- One registry treats such a module as a delivered capability.
  `src/config/assurance-capability-registry.json` lists `test-red-evidence` as
  `"state": "available"` with the evidence "`src/scripts/_lib/test_red_state.ts`
  + … (22 tests)"; that module's recorder has no production caller, and the
  file it would write, `agents/runtime/state/test-results.json`, has no
  production reader. A ticked step records the module as discharging that
  registry condition
  (`agents/roadmaps/archive/road-to-evidence-gated-change.md:480-496`); the
  caller belongs to a stub that says "No hook concern was registered"
  (`agents/roadmaps/stubs/road-to-tdd-phase-guard.md:17`). The registry's
  vocabulary is closed, and its suite requires a `degraded` row to name its
  limitations (`tests/scripts/assurance_capability_registry.test.ts:195-203`; vocabulary at `:162`).
- Read against the tests and the live roadmap estate (active, parked, stubs) at
  the same commit, the 25 fall into four groups:
  - **5** (856 lines) are imported by a test under `tests/contracts/`. They are
    checks the suite carries, not dead code; the contract test of one is cited by a shipped
    guideline as the deterministic half of a rule clause
    (`docs/guidelines/agent-infra/minimal-safe-diff-mechanics.md:239`).
  - **2** (595 lines) are named in an open or deferred step — one in a parked
    roadmap, one in step 3.1 of `road-to-typed-grants-that-persist`.
  - **8** (1,066 lines) are named in a live roadmap but in no open step: seven
    are named under ticked steps or criteria of
    `road-to-adversarial-verification-and-long-runs` (one, `test_provenance`,
    under criteria only), one is a cell in a stub's table. An eighth module of
    that roadmap, `typed_op_grant`, sits under its ticked step 7.3 and counts
    in the second group for its deferred step elsewhere.
  - **10** (2,228 lines) are named in no live roadmap. At least four of those
    still do something for a test: one is listed among a suite's core modules,
    one is imported by a second suite, one calls itself the executable half of
    a contract in `docs/contracts/evidence-artifact-types.md`, one backs a
    fixture directory.
- The reach axis exists and is scoped away from all of them on purpose:
  "Deliberately scoped to the instruments named in `loop-surfaces.yaml` rather
  than to every `_lib` export. Measured on `loop_guards.ts`, the unscoped
  version reports nine of fourteen exports dead; a gate whose signal is a
  minority of its own output gets allowlisted rather than answered"
  (`src/scripts/check_gate_reachability.ts:257-261`). That objection is to
  export granularity. At module granularity the same question returns 25 of
  351, and 5 of those are not dead at all.
- The class has already cost a closed criterion: AC-5 of
  `road-to-adversarial-verification-and-long-runs` was "REOPENED the same day
  … because the new checker has no production caller" (`:87-90`), and re-closed
  on 2026-10-01 by the named command (`:1295`).
- The gate's own sentence for the state: "A built instrument nothing calls is
  not built" (`check_gate_reachability.ts:297`).
- No module-level reach check exists: no dead-code tool is configured, and the
  linter's unused-variable rule does not see an exported module.
- The estate gate already prints a count it does not enforce — draft roadmaps,
  "reported, not gated" — on every run (`src/scripts/check_estate_count.ts:1314`).

## Phase 1 — The census, in four groups

- [x] **1.1 A report, not a gate.** A `report_` script lists every module
      directly under `_lib` that no non-test code imports and no task,
      workflow or dispatcher runs by path — `src/scripts/_dispatch.bash`
      included, without which the count is 58 instead of 57. Per module it prints the line
      count, the importing tests, whether any production file names it,
      whether it has an entry point of its own, and whether a registry
      declares it. Each of the modules no production file names is placed in
      one group: imported by a contract test; named in an open or deferred
      step of an active, parked or stub roadmap; named in such a roadmap
      outside any open step; named in none — with the step or file that puts
      it there. It skips the roadmap groups when `agents/roadmaps/` is absent,
      as it is in the published package. It exits 0.
      verify: `npx vitest run tests/scripts/report_module_reach.test.ts` -> 0
- [x] **1.2 The reading is a page.** Run it and write the four tables and the
      list of the wider set with its marks, with the command, to
      `agents/evidence/analysis/module-reach-2026-10.md`, carrying its
      `evidence-type` marker.
      verify: `grep -c 'named in no live roadmap' agents/evidence/analysis/module-reach-2026-10.md` -> /^[1-9]/

## Phase 2 — The group no live roadmap mentions

This phase acts on the 25 that no production file names, and within them on
the fourth group — ten modules at the pin. The other 32 of the wider set are
reported and counted, and nothing here moves or deletes one.

- [x] **2.1 Each one is read before anything is removed.** For every module in
      the fourth group, the page gains one line stating what a reading of the
      module and of its tests found: a test-carried check that belongs beside
      its test; a helper with a production use that was never connected; or
      code whose only caller is its own unit test. Each line begins with the
      word `reading:` and the module's name.
      verify: `grep -c '^reading:' agents/evidence/analysis/module-reach-2026-10.md` -> /^[1-9]/
- [x] **2.2 The reading is acted on, one module per commit.** A test-carried
      check moves under `tests/` with the suite that uses it. A helper with a
      real use gains its consumer. Code whose only caller is its own unit test
      is deleted with that test. After the step, the report's fourth group is
      empty.
      verify: `npx vitest run tests/scripts/module_reach_fourth_group_empty.test.ts` -> 0
- [x] **2.3 The third group is handed to its owner, not decided.** The page
      lists, for each module named outside any open step, the ticked step that
      landed it. One dated note under the acceptance criteria of the roadmap
      that names seven of them names the page. No step, criterion or decision
      of that roadmap is edited.
      verify: `grep -c 'module-reach-2026-10' agents/roadmaps/road-to-adversarial-verification-and-long-runs.md` -> /^[1-9]/

- [ ] **2.4 A registry row does not rest on a module nothing calls.** The
      report lists every row of a capability or assurance registry under
      `src/config/` whose evidence names an unreached module. At `df377ca64`
      that is one row. `test-red-evidence` becomes `degraded`, with a
      limitation that says the recorder is built and tested and that no run
      produces its record, and that names the stub which owns the caller. The
      module's own header and the stub, which both describe the row as
      discharged, gain one dated line each, and so do the three places that
      cite the recorder as an instrument (`docs/CLAIMS.md:231` — followed by a
      `build_proof` run — `docs/proof.md:433`,
      `src/config/continuity-surface.json:404-407`), so that whoever wires the caller
      sets it back.
      verify: `grep -A8 '"test-red-evidence"' src/config/assurance-capability-registry.json | grep -c '"state": "available"'` -> /^0$/
      Positive control: the same command returns 1 at `df377ca64`.

## Phase 3 — The counts are in front of every change

- [ ] **3.1 Five numbers on each gate run, enforcing nothing.**
      `check_gate_reachability` prints the four group counts and the total of
      modules reached by nothing, from the report's library, beside its
      existing verdicts, marked as reported and not gated, the way the estate
      gate prints its draft count. A change that adds a module nothing imports
      shows up as a number that moved in that change's own gate output,
      whether or not some file mentions it.
      verify: `npx vitest run tests/scripts/check_gate_reachability_module_counts.test.ts` -> 0

## What this roadmap deliberately does not do

- No failing axis. Whether the third or fourth group should ever fail a build
  is a decision for after one release of printed counts.
- No export-level axis. The gate measured that and declined it.
- No per-module rows with dates, and nothing written to the existing
  exemptions file, which is keyed on task targets and reads an unknown key as a
  stale row.
- No deletion decided by the scan. 2.2 follows a recorded reading per module.
- No change to modules that a contract test imports or an open step names.

## Acceptance Criteria

- [ ] AC-1 — One command prints, for every unreferenced module, its group and
      the test, step or file that puts it there.
- [ ] AC-2 — No unreferenced module is named in no live roadmap.
- [ ] AC-3 — The gate's output carries the five counts; a fixture module with
      a test and no consumer changes the fourth and the total, one that a
      comment mentions changes the total only, and neither changes the exit
      code.
- [ ] AC-4 — The count of gate scripts, and of rows in
      `src/config/gate-reachability-exemptions.json`, is unchanged.
- [ ] AC-5 — No registry row under `src/config/` states a capability as
      available whose evidence is a module no production code imports.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | Module granularity; the report reads import edges and run-by-path, and prints name occurrence beside them; Phase 2 acts on name occurrence only | 57 of 351 by import and 25 by name, against 9 of 14 exports in one file; one of the 57 is a script a guide tells users to run | A second module is found that is reached only through prose |
| D6 | reversible-technical | agent | The one row is corrected to `degraded`; the caller is left to the stub that owns it | The registry suite defines `degraded` as a state that names what is missing; the row's own `revisit_if` already says the record proves a red "on THIS machine" only | The caller lands, or a second registry is found reading that state as a gate input |
| D2 | deterministic | evidence | An import from `tests/contracts/` counts as a use | Five of the 25 are live contract checks; treating them as dead would have deleted a check a shipped guideline cites | A contract test is found importing a module only to keep it alive |
| D3 | reversible-technical | agent | Waited-on means named in an open or deferred step, not mentioned anywhere | A mention in a kill register or a context paragraph never expires; this file would otherwise own every module it lists | A roadmap is found opening a step only to hold a module |
| D4 | reversible-technical | agent | Read, then move, wire or delete — one module per commit | Four of the ten already turn out to serve a test in a way the scan cannot see | A deleted module is asked for again within one release |
| D5 | contested-technical | evidence | Print the counts; gate nothing | The archived reach roadmap's first risk, that a noisy axis "drives broad allowlisting" (`agents/roadmaps/archive/road-to-reachable-loop-instruments.md:301`); the estate gate's reported-not-gated precedent | One release of counts shows the fourth group staying at zero |

## Kill register

| ID | Proposal | Killed by | Note |
|---|---|---|---|
| K1 | Fail on every unused export | `check_gate_reachability.ts:257-261` | Measured noise |
| K2 | A second gate for module reach | The same file at `:253-255`: a separate gate "would then be the thing this family exists to detect" | — |
| K3 | A dated exemption row per module | The exemptions file's shape; `road-to-reachable-loop-instruments.md:301` | Second draft of this round planned it |
| K4 | Wire or delete thirteen modules by scan result | Two of the thirteen were live contract checks, four more serve a test | Third draft planned it |
| K5 | A failing axis keyed on a mention in a live roadmap | Self-satisfying: the roadmap proposing it named all 25 | Third draft planned it |
| K6 | One evidence ledger that every gate reads | "no parallel ledger", said there of requirements traceability (`agents/roadmaps/later/road-to-ten-across-the-board.md:178`); "deliberately not a migration" (`docs/contracts/evidence-artifact-types.md:28-34`); the enforcing arm was parked on measured non-adoption | Planned in the parallel proposal; two of its pieces are among the 57 |
| K7 | A canonical action envelope and a policy evaluator every hook calls | The parked evaluator roadmap's one remaining entry condition is "a named consumer demand signal" for policy verdicts (`agents/roadmaps/later/road-to-policy-evaluation-core.md:30-34`); a guard that interprets intent is "a categorically different mechanism" and stays refused (`docs/decisions/ADR-123-*.md`, § 2) | Same; three typed-authority modules are among the 57 and belong to an owner-blocked draft |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A module is used through a name the scan cannot see | implementation | A dynamic import, a path built from strings or a test-side registry reads as no reference. | 2.1 is a reading of each module and its tests before 2.2 touches it; every removal is its own commit with the suite green. | Phase 2 — The group no live roadmap mentions |
| 2 | Printed counts are ignored | product | A number nobody has to answer can drift. | D5 names the reading that would justify a gate; 2.3 puts the largest group in front of the roadmap that produced it. | Phase 3 — The counts are in front of every change |
| 3 | Moving a check under `tests/` changes what ships | implementation | `src/scripts/` is in the published file set; `tests/scripts/` is not (only `tests/fixtures/hooks/` ships). | Phase 2 acts only on the 25 that no production file names, so nothing a consumer can call leaves the package. | Phase 2 — The group no live roadmap mentions |
| 4 | The import reading over-counts | implementation | A module an agent is told to run by a command's prose has no import edge. | The report prints both readings per module; 2.1 reads each module of the fourth group before 2.2 touches it. | Phase 1 — The census, in four groups |
| 5 | A corrected registry row reads as a capability lost | product | "available" becomes a narrower word. | 2.4 changes the row only where no run produces the evidence, and names the roadmap that could wire it. | Phase 2 — The group no live roadmap mentions |
