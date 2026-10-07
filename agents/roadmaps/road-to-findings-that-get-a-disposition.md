---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "The 16.3.0 release-findings ledger holds 45 findings and 44 carry no disposition, because the gate only demands one for security or claim findings at critical or high, and none of the 45 is both. No live roadmap owns dispositioning a release's non-blocking findings. Archiving or parking another roadmap leaves the ledger as it is; merging into road-to-release-finding-ordering or road-to-a-release-record-that-says-what-it-reviewed-carried was considered and rejected: both are parked, the first owns the order findings are presented in and the second the review-coverage floor, and neither owns what happens to a finding after it is recorded."
estate_growth_exempt: "Grows active_roadmaps by one: the owner asked on 2026-10-06 for this round's roadmaps to land as ready in one change; both nearest owners are parked on other questions."
relates:
  - slug: road-to-release-finding-ordering
    relation: disjoint
    note: "Owns how findings are ordered and presented; this file only records what became of each."
  - slug: road-to-a-release-record-that-says-what-it-reviewed-carried
    relation: disjoint
    note: "The coverage floor and its spend blocker stay there; nothing here raises what a review reads."
  - slug: road-to-adversarial-verification-and-long-runs
    relation: disjoint
    note: "Its Phase 3.2 supersession put the forge read into doctor --json; blocker doctor-network-default here asks the owner whether to reverse that default, and edits none of its steps."
---
# Road to findings that get a disposition

> **Source:** an external review round (opaque id inbox-2026-10-e), round
> `agents/tmp.old/inbox-2026-10-e/`. Every anchor below was re-read at `main` @
> `a75bb3210` on 2026-10-06; finding counts were read from the ledger at the
> same commit.

## Goal

Every finding in the 16.3.0 ledger ends in a recorded state — fixed with its
commit, false positive, accepted risk with a reason, or still open with the
roadmap that carries it. Whether a medium security finding should block a
release is decided once, with a record. `doctor --json` gains an offline path
that spawns nothing, and whether offline becomes the default is put to the
owner, because it reverses a recorded supersession.

## Context

- `agents/evidence/release-findings/16.3.0.json` holds 45 findings; one,
  `4a7127f47609`, carries a status (`false_positive`, commit `c901b631b`).
  By kind and severity: 15 claim/medium, 12 claim/low, 3 security/medium,
  3 security/low, 3 correctness/medium, 5 correctness/low, 1 correctness/high,
  3 style/low.
- `isBlocking` is `(security | claim) × (critical | high)`
  (`src/scripts/check_finding_dispositions.ts:286-294`). No finding in the
  ledger meets it: all six security findings are medium or low, and the one
  high is a correctness finding. The gate is green with 44 rows open by
  construction. Its vocabulary is `fixed`, `false_positive`, `accepted_risk`,
  with `still_open` as a fourth terminal state (`:85`, `:107`), and `fixed`
  requires a commit (`:324`).
- Two low security findings, `7efdf81cb478` and `a78536c88317`, concern
  literal workspace scope entries following symlinks in
  `src/agent-src/templates/scripts/work_engine/stack/runner.ts`. That file now
  uses `lstatSync` for literal entries (`:1091-1094`), landed by `00612c1f2`
  (#2144), which is contained in the 16.3.0 tag. Neither row records it.
- `doctor --json` reads the forge unconditionally:
  `payload['forge_protection'] = forgeProtectionJsonFor(...)`
  (`src/scripts/_cli/cmd_doctor.ts:3012`), including on a single `--check`
  run; the only opt-out is an environment variable
  (`src/scripts/_lib/forge_reader.ts:103`, `AGENT_CONFIG_DOCTOR_NO_FORGE` or
  `AGENT_CONFIG_OFFLINE` set to `1`). No `--check` id reads the forge block.
  Three 16.2.0 findings remain `still_open` on this (`c6367568cb1a`,
  `77e3912664b9`, `8605e9fc59cd` in `agents/evidence/release-findings/16.2.0.json`)
  and 16.3.0 adds `eff3d4ed3fee` (no migration note), undispositioned.
- The network read is the outcome of a recorded supersession, reached after a
  2/2 council pass
  (`agents/roadmaps/road-to-adversarial-verification-and-long-runs.md:124-140`).
  Reversing its default is an owner decision, not a fix.
- The coverage label is deliberately not a floor
  (`src/scripts/_lib/review_coverage.ts:16-27`, "A LABEL, NEVER A FLOOR", tied
  to a spend decision). Out of scope here.

## Phase 1 — Every 16.3.0 finding ends somewhere

- [x] **1.1 The two symlink findings are closed against the fix.** Re-read
      `runner.ts:1091-1094` against each finding's text; when it covers the
      finding, record `fixed` with commit `00612c1f2`.
      verify: `node -e 'const j=require("./agents/evidence/release-findings/16.3.0.json");process.exit(j.findings.filter(f=>["7efdf81cb478","a78536c88317"].includes(f.finding_id)&&f.status).length===2?0:1)'` -> 0
      Done 2026-10-07: both rows record `status: fixed`, `commit: 00612c1f2`
      — the literal-entry branch now uses `lstatSync`, matching the glob
      branch, confirmed by reading the live line range.
- [x] **1.2 The rest are read and dispositioned.** Each remaining row gains a
      status and a rationale: `fixed` with commit, `false_positive`,
      `accepted_risk` with its reason, or `still_open` naming the roadmap that
      carries it. Rows owned by a sibling roadmap of this round are
      `still_open` with that roadmap's slug.
      verify: `node -e 'const j=require("./agents/evidence/release-findings/16.3.0.json");console.log(j.findings.filter(f=>!f.status).length)'` -> /^0$/
      Done 2026-10-07: all 44 remaining rows carry a status. 31 `fixed`
      (several already landed on `main` by `00612c1f2`, `fc1bdec4f` and
      `93a192bbd` before or during this roadmap's run — re-read and cited
      rather than re-done), 4 `accepted_risk` (a deliberate, disclosed
      design choice each, with a revisit-if), 9 `still_open` (honestly
      left open; 2 of the 9 name an owning roadmap — `2c9959f7262d` →
      road-to-release-evidence-that-reproduces,
      `ee95ff4aca5f` → road-to-blocking-time-by-cause — the other 7 are
      genuine orphans, see AC-2). Tally corrected 2026-10-07 by an
      independent R2 completion review (findings 1 and 3,
      `drain-findings-disposition-20261007.findings.md`): the first-pass
      note here undercounted `fixed` and overcounted `still_open` because
      it was written before the merge from `origin/main` that brought in
      three more already-landed fixes.
- [x] **1.3 The gate agrees.**
      verify: `./scripts-run src/scripts/check_finding_dispositions --release 16.3.0` -> 0
      Done — green: `blocking 3/3 dispositioned · non-blocking 42/42 carry a
      terminal status`.

## Phase 2 — Whether a medium security finding blocks

- [x] **2.1 Implement the decision of `medium-security-is-blocking`.** Under
      (a), `isBlocking` admits `security × medium`, with tests for the new
      blocking row and for `claim × medium` staying non-blocking. Under (b),
      the decision and its reason are recorded as a row in this file's
      `## Decisions` table and nothing in the gate changes.
      verify: `npx vitest run tests/scripts/check_finding_dispositions.test.ts` -> 0
      Done 2026-10-07: council (anthropic claude-sonnet-4-5 + openai
      codex-default, 2/2 convergent) picked (a). `classifyBlocking`
      (`src/scripts/self_review_gate.ts`) and its mirror `isBlocking`
      (`src/scripts/check_finding_dispositions.ts`) now admit `security ×
      medium`; `claim × medium` is unchanged (non-blocking). Both `fixed`
      dispositions remain required to carry a commit; `accepted_risk` and
      `false_positive` also unblock, per the council's point that the gate
      enforces a recorded decision, not mandatory remediation. Red-first:
      `missing_dispositions([finding({kind:'security',severity:'medium'})])`
      asserted `toHaveLength(1)` and failed (0 problems) before the fix,
      passed after.

## Phase 3 — A doctor that can stay offline

- [x] **3.1 An offline flag, additive.** `doctor --no-forge` (alias
      `--offline`) skips the forge read; `--check <id>` skips it too, since
      no check id reads it. A test injects a runner and asserts no `gh` and
      no `git remote` call is made on either path; the default is unchanged.
      verify: `npx vitest run tests/scripts/doctor_offline_flag.test.ts` -> 0
      Done — already landed on `main` in `fc1bdec4f` ("feat(doctor): an
      offline flag, and the 16.3.0 findings' doc and test fixes (partial)",
      #2243), before this drain session started. Re-verified here: the test
      file exists with 8 passing cases.
- [x] **3.2 The migration note.** `docs/MIGRATION.md` gains an entry naming
      the network read, the two environment switches and the new flag.
      verify: `grep -c 'no-forge' docs/MIGRATION.md` -> /^[1-9]/
      Done — landed in the same commit `fc1bdec4f`. `docs/MIGRATION.md`
      § 16.2.0 names `--no-forge`/`--offline`, `--check <id>`, and the two
      environment switches, and explicitly defers the default question to
      this roadmap's `doctor-network-default` blocker.
- [ ] **3.3 Implement the decision of `doctor-network-default`, then close
      the four rows.** Under (a), offline becomes the default and `--online`
      opts in; under (b), the default stays. Either way `c6367568cb1a`,
      `77e3912664b9`, `8605e9fc59cd` (16.2.0) and `eff3d4ed3fee` (16.3.0)
      gain a terminal status that matches the decision.
      verify: `npx vitest run tests/scripts/doctor_network_posture.test.ts` -> 0

## What this roadmap deliberately does not do

- No coverage floor and no change to what a review reads.
- No reordering of findings in the ledger or in the release notes.
- No `accepted_risk` written to make a count reach zero; `still_open` with a
  named roadmap is the honest state for work not done.
- No change to the doctor default without the owner's answer.

## Acceptance Criteria

- [x] AC-1 — No row of the 16.3.0 ledger lacks a status.
      `jq '[.findings[] | select(.status==null)] | length'` -> 0.
- [ ] AC-2 — Each `still_open` row names a roadmap that exists.
      NOT met, stated rather than ticked over: 2 of 9 `still_open` rows
      (`2c9959f7262d` -> road-to-release-evidence-that-reproduces,
      `ee95ff4aca5f` -> road-to-blocking-time-by-cause) name an owning
      roadmap; the other 7 are genuine orphans — no roadmap owns that
      narrow residual today, and step 1.2's own instruction only asks for
      the name where a sibling roadmap owns the row. Inventing a roadmap
      per orphan finding is a separate, larger decision this task does not
      make. Corrected 2026-10-07 by an independent R2 completion review
      (finding 2): the first-pass text named `bfe1d6e6d8ca` as the second
      roadmap-owning row, but that finding is `status: fixed` (commit
      `93a192bbd`), landed by a parallel lane after this roadmap's own
      first pass counted it; the real second roadmap-owning row is
      `2c9959f7262d`.
- [x] AC-3 — The medium-security question has a recorded decision, and the
      gate's tests reflect it.
      Council 2026-10-07, 2/2 convergent on (a); `tests/scripts/check_finding_dispositions.test.ts`
      and `src/scripts/self_review_gate.test.ts` both updated and green.
- [x] AC-4 — A `doctor` invocation with the offline flag spawns no forge or
      remote read, shown by an injected-runner test.
      `tests/scripts/doctor_offline_flag.test.ts`, 8 passed (landed on
      `main` before this roadmap ran; re-verified here).
- [ ] AC-5 — The four forge findings carry a status consistent with the
      recorded default.
      NOT met — there is no recorded default yet (`doctor-network-default`
      stays open, owner-only). `eff3d4ed3fee` (16.3.0) is `fixed` on its own
      narrower terms (flag + doc gap, not the default question); the three
      16.2.0 siblings are untouched and out of this roadmap's scope.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | `still_open` with a named roadmap is preferred over `accepted_risk` for unfinished work | The gate's own comment warns that `accepted_risk` is the cheapest way to make a count reach zero (`check_finding_dispositions.ts:91-99`) | — |
| D2 | reversible-technical | agent | The offline flag ships before the default question is answered | Additive; it changes nothing for anyone who does not pass it | The owner chooses (a) and the flag becomes redundant |
| D3 | reversible-technical | council:medium-security-is-blocking | `isBlocking`/`classifyBlocking` admit `security × medium`; `claim × medium` stays non-blocking | 2026-10-07, anthropic claude-sonnet-4-5 + openai codex-default, 2/2 convergent on (a). Both named the gate's existing `accepted_risk` terminal state as what keeps this a review gate rather than a remediation mandate; anthropic additionally asked that "medium" be defined in this project's severity taxonomy and that triage happen continuously rather than at release time — neither is this roadmap's to do, both are named here for the next reader | A later release ships a `security × medium` finding routinely left `still_open` for longer than one release cycle, suggesting the floor is being gamed rather than used |

## Blockers

### blocker: medium-security-is-blocking
- **Status:** resolved — council ran 2026-10-07 (anthropic claude-sonnet-4-5 +
  openai codex-default, 2/2 present, $0 metered via subscription CLI),
  convergent on (a). See Decision D3.
- **Owner:** council
- **Blocks:** 2.1
- **What to do:** pick exactly one — (a) add `security × medium` to `isBlocking` in `src/scripts/check_finding_dispositions.ts` with tests, or (b) keep the predicate and record the reason in this file's `## Decisions` table.
- **Resolved when:** the council's verdict is recorded under this blocker with date and seats.
- **Recommendation:** (a) — widening a floor is a strengthening, and 16.3.0 shipped six security findings of which none needed an answer.
- **If you do nothing:** medium security findings keep shipping with no recorded disposition.

### blocker: doctor-network-default
- **Status:** open
- **Owner:** owner
- **Blocks:** 3.3
- **What to do:** pick exactly one — (a) make `agent-config doctor --json` offline by default with `--online` to opt in, or (b) keep the forge read on by default and record why in this file's `## Decisions` table.
- **Resolved when:** the owner's answer is recorded under this blocker with date.
- **Recommendation:** (a) — a health command that reaches the network on every run, including a single-check run, is the surprising default; 3.1 already covers anyone who wants the read.
- **If you do nothing:** the four forge findings stay open and 3.3 stays blocked; 3.1 still ships.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-07 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Dispositions written to empty the ledger | product | A row marked `false_positive` or `accepted_risk` without a reading hides real work. | 1.2 requires a rationale per row; D1 prefers `still_open` with a roadmap. | Phase 1 — Every 16.3.0 finding ends somewhere |
| 2 | A wider blocking predicate stalls a release | product | Option (a) turns a medium security finding into a release blocker. | The disposition vocabulary already admits `accepted_risk`; a release can answer, not wait. | Phase 2 — Whether a medium security finding blocks |
| 3 | The offline test passes on a stub | implementation | A test that injects a runner may not exercise the real composition root. | `forgeProtectionJsonFor` already takes `deps`; the test goes through it, not below it. | Phase 3 — A doctor that can stay offline |
| 4 | Reversing a council-reached default without the owner | product | The default was set by a recorded supersession. | The default change sits behind an owner blocker; only the additive flag ships without it. | Context |
