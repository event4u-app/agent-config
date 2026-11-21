---
complexity: lightweight
status: ready
tree_pin: 811cea61d6
execution:
  mode: autonomous
estate_growth_exempt: "Owner asked on 2026-11-21 to plan and work off every learning of the session retro; this file adds one active roadmap and two open blockers for measure 19 (a session-count wait and the owner's default-flip scope). No existing roadmap owns a cross-key inventory of opt-in gates or a pilot that measures them: the carried update roadmap owns update.mode only, and the four default-flip stubs each own one named key."
estate_offset_exempt: "Same owner request of 2026-11-21. The work cannot fold into later/road-to-an-update-that-installs-itself-only-when-it-is-safe-carried (parked on a ring-0 count of four releases, and scoped to update.mode under ADR-291) nor into one of the per-key stubs (each is a drain-run transfer of one flip, not a mechanism). Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
relates:
  - slug: road-to-an-update-that-installs-itself-only-when-it-is-safe-carried
    relation: extends
    note: "reuses its staged shape (pilot on maintainer machines first, existing installs never flipped without an answer, ADR-291) for every opt-in key other than update.mode; its step 4.3 and the ring-0 record stay untouched, and the inventory here marks update.mode as owned by it"
  - slug: road-to-an-episode-ledger-with-cost-per-control
    relation: depends
    note: "the pilot reading (3.4) sums episodes per control through its `sessions:episodes --by-control`; this file builds no second transcript parser"
  - slug: road-to-a-lite-profile-pilot
    relation: disjoint
    note: "owns a narrower rule set in one repo under an opt-in profile key; this file owns settings defaults and install flags, and never touches rule_scope or discipline profiles"
  - slug: road-to-a-session-start-under-the-host-limit
    relation: disjoint
    note: "its 3.2 already made the thinned rule layer the install default, which closed the retro's `--enrol` complaint; this file lists `install --enrol` as owned by it and changes nothing there"
  - slug: road-to-honest-graph-freshness
    relation: disjoint
    note: "owns the code-graph auto-refresh marker and its D2 refuses an automatic opt-in; the marker is not a settings key or install flag, so the inventory here does not read it"
  - slug: road-to-settings-and-profiles-in-sync
    relation: disjoint
    note: "owns which settings files are live and how far behind they are (settings:status, profiles:drift); both files add an `agent-config doctor` row, neither changes how values merge except this file's pilot overlay"
  - slug: road-to-discipline-default-flip
    relation: disjoint
    note: "stub owning one shipped-default flip under drain rule 3; the inventory marks its key as owned and leaves it there"
  - slug: road-to-frontend-power-default-flip
    relation: disjoint
    note: "stub owning one pack-scoped default-ON flip; marked owned, untouched"
  - slug: road-to-a-page-check-on-by-default
    relation: disjoint
    note: "stub owning web_launch_readiness.enabled behind a claim trigger; marked owned, untouched"
  - slug: road-to-demand-gate-audience-default
    relation: disjoint
    note: "stub owning project.audience; marked owned, untouched"
depends:
  - road-to-an-episode-ledger-with-cost-per-control
# relates: probe — `roadmap:context --roadmap road-to-defaults-on-after-pilot --relates`
# (2026-11-21): scanned 1308 roadmap file(s), 0 sibling hits (slug-keyword axis).
# The rows above come from the semantic half: grep -rlE over agents/roadmaps for
# 'default-on|default flip|on by default|enrol' plus the retro's own pointer, bodies read.
---
# Road to defaults on after a pilot

> Every package improvement that today works only after an opt-in is found by a
> generated inventory, tried on the maintainer machine through one reversible
> pilot switch, read against thresholds fixed before the pilot, and handed to
> the owner as a measured default-flip list.

> **Source:** the owner's session retrospective of 2026-11-21 (about 380 Claude
> Code sessions, 643 extracted incidents in 23 chunks), measure 19 of its P2
> list ("default-on instead of opt-in, staged: first only `update` really
> installs, the rest after a pilot"), and the AI council round of the same day
> (analysis mode, one round, members anthropic and openai, 2 of 2 answered).
> Both members flagged rollout without opt-in as carrying unexamined risk given
> the system's churn; that is why the rest waits on a pilot. The owner's own
> words in the retro's evidence: "then nobody who only runs upgrade gets it —
> everyone should benefit automatically from the good things".

## Goal

`agent-config update` installs what it pins (stage 1, already in the tree, kept
by a regression run). A generator lists every settings key and install flag that
holds a package improvement off by default, with its class and the roadmap or
ADR that already owns it. Unowned candidates run on this machine under one pilot
switch that changes no settings file and comes off in one command. A generated
result states, per candidate, whether it passed thresholds fixed in this file
before activation. The flip itself is the owner's answer on a blocker carrying
that result.

## Prerequisites

- [ ] The stage-1 tests pass on the starting tree.
      verify: `npx vitest run tests/scripts/_cli/cmd_update.test.ts` -> 0

## Context

Verified against the tree at `811cea61d6`:

- **Stage 1 is landed.** `cmd_update.ts:542-563` runs `agent-config upgrade`
  to the target version when `installed.lock` is older, and writes the pin only
  after that succeeds; offline it refuses (`:548-555`). Tests:
  `tests/scripts/_cli/cmd_update.test.ts:263` (`describe('cmd_update — keeps the
  pin and the global install in step')`, case "installs the pinned version
  globally BEFORE writing the pin" at `:289`). Docs agree:
  `docs/installation.md:19-24`. Landed in #2675 (merged 2026-10-25). The retro's
  "update only set the pin" incident predates it (retro chunk agent-config-04).
- **The retro's `--enrol` complaint is closed elsewhere.** The installer thins
  the rule layer by default (`road-to-a-session-start-under-the-host-limit`
  3.2); `install --enrol` now only opens a session-time promotion route
  (`src/install/userPin.ts:56-63`). Nothing to do here.
- **Remaining opt-in surfaces are not listed anywhere.** The settings schema
  is `src/server/schemas/settings.ts`, flattened by `flattenSurface`
  (`src/shared/settingsSurface.ts:90`); classes come from
  `docs/contracts/settings-classes.md` via `parseSettingsClassRows`
  (`src/shared/settingsClasses.ts:107`) — 119 leaves, 11 A / 4 B / 104 C
  (`settings-classes.md:249-254`). Boolean install flags are the
  `'--full': 'full', '--enrol': 'enrol'` map at `src/scripts/install.ts:3584`.
  No command reports which of these hold an improvement off.
- **Class B can never flip.** `lint_settings_classes.ts` check 4 (`:15`,
  `:456`) requires a B key's template default to be the conservative value;
  the inventory excludes B keys as `consent-locked`.
- **Defaults merge in one place.** `load_agent_settings`
  (`src/scripts/_lib/agent_settings.ts:922`) lays template defaults below every
  real layer (`:955-962`). A pilot overlay between the defaults and the
  user-global layer changes no file and loses to any value a user wrote. 41
  source files call `load_agent_settings(` or `template_defaults(`; one reads
  `template_defaults()` directly (`src/scripts/_lib/git_convention.ts:209`).
- **A default flip is an owner act.** Drain rule 3
  (`agents/evidence/council/drain-blocker-dispositions-a.md:24-28`): a
  shipped-default flip takes `B`, never `D`. ADR-291
  (`docs/decisions/ADR-291-existing-installs-are-asked-never-flipped.md`) ruled
  for `update.mode` that an existing install is asked, never flipped. This file
  therefore measures and recommends; the flip waits on blocker
  `default-flip-scope`.
- **Pilot receipt pattern exists.** `install --enrol` writes an `enrolment`
  field into the install receipt (`src/install/userPin.ts:65-85`); `--full`
  wins over it (`:87-91`).
- **Owned elsewhere, out of scope:** `update.mode` (carried update roadmap,
  ADR-291); the four per-key stubs in `relates:`; the code-graph auto-refresh
  marker (`src/scripts/code_graph/auto_refresh.ts:22-30`, owned by
  `road-to-honest-graph-freshness` D2).

## Phase 1 — Stage 1 kept, the rest listed by a generator

- [ ] **1.1 Replay stage 1.** Run the update suite and the install doc check;
      no code change. A red result here stops the run as quality-red.
      verify: `npx vitest run tests/scripts/_cli/cmd_update.test.ts -t 'keeps the pin and the global install in step'` -> 0
      verify: `grep -c "runs \`agent-config upgrade\` to that version" docs/installation.md` -> /^1$/
- [ ] **1.2 Failing test first: the inventory.** New
      `tests/scripts/report_opt_in_gates.test.ts` with a fixture schema (a boolean
      `false`, an enum defaulting to `off`, an enum defaulting to `notify`, a
      boolean `true`), a fixture class table (one A, one B, one C), a fixture
      install-flag map and a fixture roadmap dir naming one key. Assert: the `true`
      key is absent; the B key is `excluded: consent-locked`; the key named in the
      roadmap dir is `owned_by: [<that file>]`; the others are `candidate`; output
      keys are sorted. Run red (the script does not exist).
      verify: `npx vitest run tests/scripts/report_opt_in_gates.test.ts` -> 1
- [ ] **1.3 Implement `src/scripts/report_opt_in_gates.ts`.** Inputs: the zod
      schema through `flattenSurface`, the class rows through
      `parseSettingsClassRows`, and the install boolean-flag map (export it from
      `install.ts:3584` as a named constant, no behaviour change). Off side:
      boolean `false`, or an enum default in the script's `OFF_SIDE` constant
      (`off`, `none`, `disabled`, `notify`, `manual`, `ask`). `owned_by`: every
      file under `agents/roadmaps/{*.md,later,stubs}` and `docs/decisions/` that
      contains the dotted key or flag literally. Writes
      `agents/evidence/analysis/opt-in-gates.json`; `--check` regenerates to
      memory and exits 1 on drift. Register `--check` in `task ci` next to
      `generate_settings_reference --check`.
      verify: `npx vitest run tests/scripts/report_opt_in_gates.test.ts` -> 0
      verify: `./scripts-run src/scripts/report_opt_in_gates --check` -> 0
- [ ] **1.4 Positive control on the real tree.** The generated file lists
      `update.mode` as owned (by the carried update roadmap and ADR-291) and
      `--enrol` as owned; a run with `--roadmaps-dir` pointed at an empty
      directory lists both as `candidate`.
      verify: `node -e "const j=require('./agents/evidence/analysis/opt-in-gates.json');const r=j.rows.find(x=>x.key==='update.mode');process.exit(r&&r.owned_by.length>0?0:1)"` -> 0
- [ ] **1.5 Classify the candidates — council first.** First action:
      `agent-config council:status`; with two or more providers, put the
      `candidate` rows to the council with one question per row: held-back
      improvement, or deliberate brake (spend, egress, data leaving the machine,
      consent, safety floor). A brake is never piloted. Record the verdict as D4
      listing the pilot keys. Council unreachable → D4 resolved by `agent` with
      every row whose description names spend, egress, network, upload,
      telemetry, secret or consent classed as a brake, and revisit-if "council
      available".
      verify: `grep -cE '^\| D4 \|' agents/roadmaps/road-to-defaults-on-after-pilot.md` -> /^1$/

## Phase 2 — One pilot switch, no settings file touched

- [ ] **2.1 Pick the pilot carrier — council first.** First action:
      `agent-config council:status`; question: (a) a `pilot_defaults` field in
      the install receipt beside `enrolment`, written by
      `agent-config global --no-ui --pilot-defaults on|off`; (b) an environment
      variable read by `load_agent_settings`. Constraint stated in the question:
      a value any user wrote in any layer wins; CI (`CI` set) and a missing
      receipt resolve to no overlay; `install.ts` sits under a pinned pack size.
      Record as D5. Council unreachable → D5 = (a) by `agent`, revisit-if
      "council available".
      verify: `grep -cE '^\| D5 \|' agents/roadmaps/road-to-defaults-on-after-pilot.md` -> /^1$/
- [ ] **2.2 Failing test first: the overlay.** New
      `tests/scripts/settings_pilot_overlay.test.ts`: with the D5 carrier on and
      a fixture pilot list of one key, an absent key resolves to the pilot value;
      a user-global value for the same key wins; a project value wins; with `CI=1`
      or the carrier off, the result is byte-identical to
      `load_agent_settings` without the overlay; a key not on the pilot list is
      never changed. Run red.
      verify: `npx vitest run tests/scripts/settings_pilot_overlay.test.ts` -> 1
- [ ] **2.3 Implement the overlay.** In `load_agent_settings`
      (`agent_settings.ts:955-957`), merge the pilot values for the D4 keys right
      after `template_defaults`, before the user-global layer. The pilot values
      come from the generated `opt-in-gates.json` (`pilot_value` per D4 row, the
      on side of the enum or `true`), never from a hand-written list. Update the
      direct `template_defaults()` reader at `git_convention.ts:209` only if a D4
      key lives under `git.`.
      verify: `npx vitest run tests/scripts/settings_pilot_overlay.test.ts tests/scripts/settings_renamed_keys.test.ts tests/scripts/work_engine/_lib_agent_settings.test.ts` -> 0
- [ ] **2.4 The way back is one command, test-first.** A case in
      `settings_pilot_overlay.test.ts` turns the carrier on, then off, and asserts
      the merged settings equal the pre-pilot snapshot and the receipt holds no
      pilot field. `agent-config doctor` names an active pilot and its keys in
      one line (assert in the same test).
      verify: `npx vitest run tests/scripts/settings_pilot_overlay.test.ts -t 'way back'` -> 0
- [ ] **2.5 Docs and projections.** Document the switch in
      `docs/installation.md` next to `--enrol`, regenerate the settings reference
      and the projections.
      verify: `./scripts-run src/scripts/generate_settings_reference --check` -> 0
      verify: `bash src/scripts/condense.sh --changed` -> /^$/

## Phase 3 — The pilot

- [ ] **3.1 Baseline before activation.** Run
      `agent-config sessions:episodes --by-control --since <today-14d> --json`
      and store its output as `agents/evidence/metrics/defaults-pilot-baseline.json`
      (generated, not edited). Needs the episode ledger's Phase 4 landed.
      verify: `node -e "JSON.parse(require('fs').readFileSync('agents/evidence/metrics/defaults-pilot-baseline.json','utf8'))"` -> 0
- [ ] **3.2 Activate on this machine.** Turn the D5 carrier on for the
      maintainer install and record the activation date in the receipt.
      verify: `agent-config doctor` -> /pilot defaults on/
- [ ] **3.3 Collect the window.** <!-- blocked-by: defaults-pilot-sample -->
      Sessions accrue in normal work; nothing is written by hand.
      verify: the blocker's Run command prints a session count of at least 15.
- [ ] **3.4 Generate the result, test-first.** Add `--pilot-result` to
      `report_opt_in_gates.ts` with a fixture test first (red, then green): per
      D4 key it reads the baseline, a fresh `sessions:episodes --by-control`
      window since activation, hook `exitCode != 0` counts for the concern the
      key enables, and whether the key appears with an explicit value in any
      user layer (an opt-out). It writes
      `agents/evidence/metrics/defaults-pilot-result.json` with PASS, FAIL or
      INCONCLUSIVE per key against D6.
      verify: `npx vitest run tests/scripts/report_opt_in_gates.test.ts -t 'pilot result'` -> 0
      verify: `./scripts-run src/scripts/report_opt_in_gates --pilot-result` -> 0

## Phase 4 — The flip list on the owner's blocker

- [ ] **4.1 Route the flip question, then write the recommendation.** First
      action: `agent-config council:status`; with two or more providers, put the
      PASS list and the three scope options to the council and record its
      routing in the blocker's `Routed:` line as `council <date> ESCALATE —
      product-owned` (or its answer, if it rules the question technical). Then
      update blocker `default-flip-scope`: its Recommendation lists the PASS keys
      and cites the result file; FAIL and INCONCLUSIVE keys stay opt-in and are
      named.
      verify: `grep -c "defaults-pilot-result.json" agents/roadmaps/road-to-defaults-on-after-pilot.md` -> /^[2-9]/
- [ ] **4.2 Apply the owner's answer, test-first.** <!-- blocked-by: default-flip-scope | asked: no — the question needs 3.4's result, which does not exist until the pilot window fills -->
      For each key the answer approves: a failing upgrade test first (fixture
      install at the previous version, key absent) asserting the answered scope —
      new installs get the new default; existing installs either keep the old
      value written explicitly by the installer before the default moves, or move,
      per the answer. Then change the schema default and the template, and
      re-run the generator.
      verify: `npx vitest run tests/scripts/report_opt_in_gates.test.ts tests/scripts/settings_pilot_overlay.test.ts` -> 0
      verify: `./scripts-run src/scripts/report_opt_in_gates --check` -> 0
- [ ] **4.3 Turn the pilot off.** After 4.2, the D5 carrier goes off on this
      machine; the flipped keys now come from the defaults.
      verify: `agent-config doctor` -> /pilot defaults off|no pilot/

<!-- Release holds — none declared.

     guarded: the overlay (Phase 2) is inert without the D5 carrier, and the
     carrier is off on every install but the maintainer's; CI resolves to no
     overlay (asserted in 2.2). No template or schema default changes before
     4.2, which runs only on the owner's answer, so every intermediate state is
     publishable.
-->

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | Stage 1 (`update` installs what it pins) is done; this file only replays its tests | `cmd_update.ts:542-563`, `cmd_update.test.ts:263-305`, #2675 | a release ships `update` writing a pin ahead of the global install |
| D2 | reversible-technical | agent | The inventory reads only the settings schema and the install boolean-flag map; marker files and per-pack switches are out | marker opt-ins are owned by `road-to-honest-graph-freshness`; pack switches by the stubs | a retro incident names an opt-in on neither surface |
| D3 | deterministic | evidence | No shipped default moves inside this file without the owner's answer on `default-flip-scope`; the agent measures and recommends | drain rule 3 (`drain-blocker-dispositions-a.md:24-28`); ADR-291 | the owner answers the blocker |
| D6 | reversible-technical | agent | A key PASSES when, over at least 15 pilot sessions: zero hook invocations with exit code != 0 from the concern the key enables, its by-control episode count is not above the baseline rate per session, and no user layer sets it back explicitly. Any one failing → FAIL; fewer than 15 sessions → INCONCLUSIVE | council 2026-11-21 asked for traced evidence per control before changing defaults | the episode ledger's attribution coverage (its 2.2) is below 95 % |

## Blockers

### blocker: defaults-pilot-sample
- **Status:** open
- **Owner:** external
- **Class:** 0
- **Run:** `agent-config sessions:episodes --since <activation date> --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(new Set(JSON.parse(s).rows.map(r=>r.session_id)).size))"`
- **Blocks:** Phase 3 — step 3.3, and through it 3.4 and Phase 4
- **Question:** none — this waits on sessions, not on a decision.
- **Recommendation:** keep working on this machine as usual; the window fills by itself.
- **If you do nothing:** the pilot never reaches its sample and every candidate stays opt-in, which is today's behaviour.
- **What to do:**
  1. Work as on any day with the pilot on (`agent-config doctor` shows `pilot defaults on`).
  2. Nothing to report; `agent-config sessions:episodes` reads the transcripts.
- **Resolved when:** the Run command prints at least 15.

### blocker: default-flip-scope
- **Status:** open
- **Owner:** owner
- **Routed:** pending — the question carries step 3.4's per-key result, which does not exist until the pilot window fills; step 4.1 routes it through the council first. Expected reserved row: product-owned, since a shipped-default flip is externally visible (drain rule 3) and ADR-291 already ruled existing installs are asked, never flipped, for `update.mode`.
- **Blocks:** step 4.2
- **Question:** for the PASS keys in `agents/evidence/metrics/defaults-pilot-result.json`: (a) new default for new installs only, existing installs keep their old value written explicitly; (b) new default for every install that upgrades, named in the release notes; (c) none — keep them opt-in.
- **Recommendation:** written by step 4.1 from `defaults-pilot-result.json`.
- **If you do nothing:** every key stays opt-in; installs behave as today and the pilot keeps running only on this machine.
- **What to do:**
  1. Read `agents/evidence/metrics/defaults-pilot-result.json`.
  2. Answer (a), (b) or (c), per key or for all.
- **Resolved when:** an owner directive naming the answer exists under `agents/evidence/owner-directives/`.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A brake piloted as an improvement | product | A key that holds spend, egress or consent off is turned on by the overlay and acts on the maintainer machine | 1.5 classifies every candidate before the pilot; brakes are never in D4; class B is excluded mechanically | Phase 1 — Stage 1 kept, the rest listed by a generator |
| 2 | The overlay leaks beyond the pilot | implementation | A reader outside `load_agent_settings`, or CI, picks up pilot values | 2.2 asserts byte-identity with the carrier off and under `CI=1`; 2.3 checks the one direct `template_defaults()` reader | Phase 2 — One pilot switch, no settings file touched |
| 3 | A thin pilot read as a pass | product | One machine and 15 sessions under-sample a key that fails elsewhere | D6 yields INCONCLUSIVE below the sample; the owner decides the scope on 4.1's per-key result, never the agent | Phase 3 — The pilot |
| 4 | Silent flip on existing installs | product | Moving a schema default changes every install whose key is absent | 4.2 runs only on the owner's answer and starts with an upgrade test asserting the answered scope | Phase 4 — The flip list on the owner's blocker |
| 5 | The inventory rots | implementation | A new key or flag lands without a row | `report_opt_in_gates --check` in `task ci` (1.3) fails on drift | Phase 1 — Stage 1 kept, the rest listed by a generator |

## Acceptance Criteria

- [ ] AC-1 — `cmd_update.test.ts` passes: `update` installs the version it pins before writing the pin (1.1).
- [ ] AC-2 — `agents/evidence/analysis/opt-in-gates.json` is generated, its `--check` is green in `task ci`, and it marks `update.mode` and `--enrol` as owned (1.3, 1.4).
- [ ] AC-3 — With the pilot carrier off or under `CI=1`, merged settings are byte-identical to today; with it on, only D4 keys change and only where no layer sets them (2.2, 2.4).
- [ ] AC-4 — `defaults-pilot-result.json` states PASS, FAIL or INCONCLUSIVE for every D4 key against D6 (3.4).
- [ ] AC-5 — No schema or template default changes before the owner's answer on `default-flip-scope` (D3).
- [ ] All quality gates pass: `task ci`.
