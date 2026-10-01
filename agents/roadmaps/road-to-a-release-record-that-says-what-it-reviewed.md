---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Four release-record defects verified against the merged 16.2.0 head that no active roadmap owns — a disposition gate whose success line counts 20 of 20 while 18 rows carry no status, a review field dropped at ingest, a coverage figure no reader states, and a breaking-changes index seven majors behind. The two later/ neighbours (release-finding ordering, release holds) own a different question each, and parking live work to buy the slot would trade a verified defect for an unverified one."
estate_growth_exempt: "Measured by check_estate_count on the committed round: open_blockers 47 to 50. Two of the three are here (a spend decision on the review ceiling, and the ADR-087 follow-up on the container install test); the third is the legal user-type product call in road-to-a-trunk-whose-own-gates-are-green. All three are owner-reserved by the records they cite, so no agent step can retire them first."
relates:
  - slug: road-to-release-finding-ordering
    relation: disjoint
    note: That later/ roadmap owns WHEN the ledger is read inside the pull-request workflow. This one owns WHAT the ledger and its gate say once read.
  - slug: road-to-release-holds-that-refuse
    relation: disjoint
    note: Holds stop publication of a broken intermediate state; nothing here stops publication.
---
# Road to a release record that says what it reviewed

> **Source:** `agents/tmp.old/inbox-2026-10-a/` — a round of sixteen external
> reviews of the 16.2.0 release plus a supplied scorecard rescore. Every claim
> below was re-checked against `main` at `9bc8cd4f2` on 2026-10-01; the
> disposition file is `agents/evidence/analysis/inbox-2026-10-a-disposition.md`.

## Goal

The release record for a cut states, in its own output, how much of the change
it reviewed and what became of every finding — not only the blocking ones — and
the breaking-changes index carries one row per major. Done means: the 16.2.0
ledger holds zero rows without a terminal status, `check_finding_dispositions`
reports non-blocking findings by count instead of folding them into an
"all dispositioned" line, `fact_claims` survives ingest, the record says
`partial` when the review read 65 of 678 files, and a major missing from
`BREAKING_CHANGES.md` fails a gate.

## Context

Reproduced on 2026-10-01, not read:

- `./scripts-run src/scripts/check_finding_dispositions --release 16.2.0` →
  `✅ all 20 recorded finding(s) for 16.2.0 dispositioned (blocking ones
  completely)`, exit 0. The ledger `agents/evidence/release-findings/16.2.0.json`
  carries a `status` on **2 of 20** rows. `isBlocking`
  (`check_finding_dispositions.ts:240-248`) admits only `claim`/`security` at
  `high`/`critical`, so two `high correctness` rows — one of them the fractional
  timeout that `forge_reader.ts:139-147` already fixes — sit with no status
  while the line says all twenty are dispositioned.
- `INTEGRITY_FIELDS` (`check_finding_dispositions.ts:142-149`) carries six keys;
  `self_review_gate.ts:1220` writes a seventh, `fact_claims`, and ingest drops it.
- The 16.2.0 ledger's own `coverage` block reads `filesReviewed: 65,
  filesTotal: 678` under `MAX_REVIEW_CHUNKS = 6` (`self_review_gate.ts:642`);
  only the writer reads `filesReviewed`. `self-review-gate.yml:96-109` skips a
  re-review once a ledger exists, so commits after the cut are never read.
- `BREAKING_CHANGES.md` § Breaking changes by major starts at 9.0.0; the
  archived changelogs hold 10.0.0 through 16.0.0. The source counts this as its
  twentieth mention; no roadmap in any estate directory ever carried it.

## Phase 1 — The disposition gate reports what it checked

- [x] **1.1 Split the success line.** `check_finding_dispositions` prints the
      blocking count and the non-blocking count separately — `blocking 2/2
      dispositioned · non-blocking 0/18 carry a status` — and never the word
      "all" over a set it did not require. Exit semantics unchanged: only
      blocking rows can fail the gate. Test first: a fixture ledger with one
      dispositioned blocking row and one statusless non-blocking row, seen red
      on the current message.
      **Done 2026-10-01.** `disposition_tally` counts the two populations apart
      and `disposition_summary` renders them; the live line now reads `20
      recorded finding(s) for 16.2.0 — blocking 2/2 dispositioned · non-blocking
      18/18 carry a terminal status`. One word more precise than the sketch
      above: `carry a terminal status`, because `open` is in the schema as the
      INITIAL state and does not count — counting it would make the tally
      reachable without anyone re-reading a finding. `TERMINAL_STATUSES` adds
      `still_open` and is deliberately NOT `DISPOSITION_STATUSES`, so a BLOCKING
      row marked `still_open` reports as an unknown status and keeps the gate
      red. Seen red first on the fixture pair (one dispositioned blocking row,
      one statusless non-blocking row), plus the `open` and unrecognised-status
      cases, which are what stop the count from being satisfiable by habit.
      verify: `npx vitest run tests/scripts/check_finding_dispositions.test.ts` -> 0
- [x] **1.2 Give every 16.2.0 row a terminal status against the merged head.**
      Re-read each of the 18 statusless rows against `9bc8cd4f2` and write one
      of `fixed` (with the commit), `false_positive`, `accepted_risk` or
      `still_open`, each with a `rationale` and a `verified_by` command. Row
      `9cf754edc878` is `fixed` only if `forge_reader.ts:139-147` still floors
      the timeout when re-read; rows `8deecc5724c6` (no tests for `originUrl` /
      `forgeProtectionJsonFor`) and `c6367568cb1a` / `77e3912664b9`
      (`doctor --json` spawns before output) are checked against the tree, not
      against the review text.
      **Done 2026-10-01.** 14 `fixed`, 1 `accepted_risk`, 3 `still_open` — the
      spread is the point, since the cheapest route to zero statusless rows is
      `accepted_risk` on everything. Every row carries a `verified_by` command
      that was run on this tree. The two rows the step names by id both resolve
      `fixed`: `9cf754edc878` because `callTimeout` still floors the timeout AND
      keeps a 1 ms minimum (flooring alone would have made `timeout: 0` install
      no kill timer, i.e. the ceiling failing open), and `8deecc5724c6` because
      `originUrl` and `forgeProtectionJsonFor` are now reached through a `deps`
      seam in `tests/scripts/doctor_forge_block.test.ts`. The three `still_open`
      rows share one root — `_emit_json` calls `forgeProtectionJsonFor`
      unconditionally, including on the single-check path, with two environment
      variables as the only escape — and that is checked against the tree, not
      the review text. Every fix landed in `4e803d620`, which is INSIDE 16.2.0:
      the self-review read the whole release span and reported defects a later
      commit in the same span had already closed.
      verify: `node -e "const d=require('./agents/evidence/release-findings/16.2.0.json');process.exit(d.findings.filter(f=>!f.status).length)"` -> 0
- [x] **1.3 Carry `fact_claims` through ingest.** Add it to `INTEGRITY_FIELDS`
      and assert in a test that an ingested artifact carrying it lands in the
      ledger. Seen red before the one-line change.
      **Done 2026-10-01.** `INTEGRITY_FIELDS` is now the six plus `fact_claims`.
      One decision the step did not specify: the ingest WARNING keeps the old
      six-field set (`SCHEMA_INTEGRITY_FIELDS`), because that message says
      `check_review_schema` derives `acceptance_status` and `assurance` from
      `review_independence` — a sentence that is simply untrue of `fact_claims`,
      and naming it there would have made the warning wrong to buy one shorter
      list. Three cases, red first, including that a second ingest does not
      overwrite the first run's count.
      verify: `npx vitest run tests/scripts/check_finding_dispositions.test.ts -t fact_claims` -> 0

## Phase 2 — Coverage is a stated property of the record

- [x] **2.1 State partial coverage where the record is read.** When
      `coverage.filesReviewed < coverage.filesTotal`, the `--release` success
      line and the release's Known-limitations derivation both print
      `self-review read 65 of 678 changed files (partial)`. A label, never a
      floor that refuses: the ceiling is a spend decision (2.2).
      **Done 2026-10-01.** `_lib/review_coverage.ts` owns the one sentence, so
      the two readers cannot spell it differently. `check_finding_dispositions`
      appends it to the success line — including the zero-findings line, which is
      where "no findings" is least informative on its own — and
      `check_release_highlights` prints it beside the Known-limitations field,
      where partial coverage belongs and where the ledger for `--version` already
      exists (the self-review ingests on the same release PR).
      **It is wired on the WRITER side only, and that is what keeps D1 true.**
      `derive_categories` is untouched, so `highlight_contradictions` has no new
      evidence to refuse on and no exit code moves. Had the label been made a
      derived category instead, a human editing the field down to `_none_` would
      have redded the cut — the spend decision of 2.2 arriving through the back
      door, which is exactly what D1 and risk 2 record as rejected.
      Sensitivity probed by sabotage: removing the `reviewed >= total` guard reds
      exactly the two full-coverage cases and nothing else.
      verify: `npx vitest run tests/scripts/check_finding_dispositions.test.ts -t partial` -> 0
- [~] <!-- blocked-by: review-ceiling-is-spend | asked: no — non-interactive inbox run; the question is carried in the round disposition Owner decisions block --> **2.2 Decide what the post-cut
      delta gets.** Either review the commits after the ledger's recorded head
      when `self-review-gate.yml` finds an existing ledger, or keep the skip and
      say in the workflow notice that the post-cut delta is unreviewed. Raising
      `MAX_REVIEW_CHUNKS` is not on the table as the primary fix — the source
      names that explicitly, and the contradiction check of 16.1 is the
      cheaper shape.
      verify: `grep -n 'post-cut' .github/workflows/self-review-gate.yml` -> /post-cut/

## Phase 3 — Every major has a row in the breaking-changes index

- [x] **3.1 Write the seven missing rows.** One row each for 10.0.0, 11.0.0,
      12.0.0, 13.0.0, 14.0.0, 15.0.0 and 16.0.0, taken from the `BREAKING
      CHANGES` sections of the archived changelogs, each linking its source
      section. A major whose section states nothing a consumer must do says so
      in the Migration cell.
      **Done 2026-10-01.** Each row is written from its changelog `BREAKING
      CHANGES` bullets AND the commit body behind each bullet, and links both —
      risk 3's mitigation, applied: the bullets are one line each and would not
      have supported an accurate What-broke cell on their own. Four majors ask a
      consumer nothing and the Migration cell says why rather than printing a
      dash: 14.0.0 moved package-internal symbols, 13.0.0 removed functions with
      zero production callers, 16.0.0 touched this repository's own CI config,
      and 11.0.0 / 10.0.0 ignore-and-report their removed keys so the migration
      IS the ignore. 15.0.0 carries the correction its changelog already records
      — the second BREAKING entry was reverted inside the same release, so there
      is no migration for a removal that never shipped.
      verify: `./scripts-run src/scripts/lint_major_migration_sections` -> 0
- [x] **3.2 Make a missing row a failing gate.** Extend
      `lint_major_migration_sections` so a major with a `BREAKING CHANGES`
      section owes a `BREAKING_CHANGES.md` row as well as a `docs/MIGRATION.md`
      heading — the same floor, the same pending-entry path
      (`pendingMajorFinding`) so a cut cannot add a major the index lacks.
      Fixture first: a changelog with a major and an index without it, seen red.
      **Done 2026-10-01.** `indexVersions` reads the FIRST table cell only, and
      that is load-bearing rather than a parsing convenience: the live Migration
      cells end in pointers like "See [CHANGELOG 8.0.0]", so a whole-line scan
      would hand the index rows it does not have — in the direction that makes
      the gate green, which is the direction a reader cannot detect. An absent
      `BREAKING_CHANGES.md` reds rather than skipping the index half; a missing
      comparand that silently narrows the comparison is how a gate reports
      "nothing wrong" about a question it stopped asking. The cross pair —
      migration present with the row absent, and the reverse — is what proves the
      two obligations are independent rather than one check wearing two names.
      The real-tree case named exactly the seven missing majors before 3.1
      landed. Self-test 8/8, 4 rejecting.
      verify: `npx vitest run tests/scripts/lint_major_migration_sections.test.ts` -> 0

## Phase 4 — The container install test, decided

- [x] **4.1 Correct the stale scenario label.** `tests/fixtures/installer-e2e/run-scenarios.sh:27`
      echoes `install.py` while line 40 runs `install.ts`; the Python installer
      was removed. Label only, no behaviour change.
      **Done 2026-10-01.** Two occurrences, not one: the scenario-A echo at line
      27 and a comment at line 69 naming "the server-spawned install.py". Both
      now say `install.ts`; neither scenario changed.
      verify: `grep -c 'install.py' tests/fixtures/installer-e2e/run-scenarios.sh` -> /^0$/
- [~] <!-- blocked-by: container-e2e-promotion | asked: no — non-interactive inbox run; the question is carried in the round disposition Owner decisions block --> **4.2 Wire or declare the
      container test.** Either add `tests/fixtures/installer-e2e.Dockerfile` as a
      release-validation job, or state in ADR-087's follow-up that it stays
      manual. The upgrade-preserve scenario the source asks for already runs
      in-process (`tests/scripts/install.preserve.roundtrip.test.ts`) and is not
      duplicated in the container.
      verify: `grep -rn 'installer-e2e' .github/workflows docs/decisions/ADR-087-installer-e2e-test-strategy.md` -> /installer-e2e/

## What this roadmap deliberately does not do

- It does not raise `MAX_REVIEW_CHUNKS` as the answer to partial coverage. More
  model requests per cut is the cost the source warns against; a mechanical check
  over objective tree claims is the shape this tree already prefers.
- It does not make a non-blocking finding block a release. Every row needs a
  terminal status; `still_open` is one.

## Gap table

| Source item | Verdict | Where |
|---|---|---|
| Release gate red, release packed anyway | already-fixed by `7763fc686` | Context |
| 18 findings never dispositioned, gate says all | KEEP | 1.1, 1.2 |
| `fact_claims` dropped at ingest | KEEP | 1.3 |
| Coverage 65/678 with no floor | FOLD — label, not floor | 2.1, 2.2 |
| Raise the chunk ceiling | CUT as primary fix | 2.2 |
| Seven missing index rows | KEEP | 3.1, 3.2 |
| Container install test as blocking pre-release gate | owner decision | 4.2 |
| Preserve-on-upgrade scenario | already-satisfied in-process | 4.2 |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Coverage is printed as a label, never enforced as a floor | A floor that refuses forces the spend decision of 2.2 by the back door; the label costs nothing and is what the source asks for first | A cut ships with partial coverage and no reader sees the label |
| D2 | reversible-technical | evidence | The index check extends `lint_major_migration_sections` instead of adding a second gate | Same floor, same changelog parser, same pending-entry path; a second gate would be a second copy of `findMajorSections` | The two obligations need different floors |
| D3 | spend-exhaustion | owner | Post-cut delta review and container test promotion stay with the owner | Both are spend or infra the records name as owner follow-ups (ADR-087, the review ceiling) | — |
| D4 | deterministic | evidence | Closure-scan C1 and C2 (steps 2.2 and 4.2 read as unfalsifiable) are resolved: each step's `verify:` sits on its continuation line and carries an expectation (`-> /post-cut/`, `-> /installer-e2e/`) | `roadmap_verify_share` counts thirteen of thirteen clauses in this file as naming an expectation — nine when D4 was written, plus the four acceptance-criteria clauses the execution run added, each given an expectation rather than left as a bare command | The scanner is taught to read continuation lines |
| D5 | spend-exhaustion | owner | Closure-scan C3 (AC-5 offers two outcomes) is the owner choice recorded in `review-ceiling-is-spend`, not an unpicked alternative | The blocker names both options and a recommendation | — |

## Blockers

### blocker: review-ceiling-is-spend
- **Status:** open
- **Probed:** 2026-10-01 — `grep -n 'post-cut\|delta\|unreviewed'
  .github/workflows/self-review-gate.yml` returns nothing, exit 1. The workflow
  neither runs a delta review nor prints an unreviewed-delta notice, so the
  resolved-when condition does not hold and this stays owner-reserved.
- **Owner:** owner
- **Blocks:** 2.2
- **What to do:** pick exactly one — (a) authorize a delta review of the
  commits after the ledger head when a ledger already exists (one more paid
  request per cut), or (b) keep the skip and have the workflow notice name the
  post-cut delta as unreviewed.
- **Resolved when:** `.github/workflows/self-review-gate.yml` either runs a
  delta review or prints the unreviewed-delta notice.
- **Recommendation:** (b) — it is free, it is honest, and 16.1's contradiction
  check shows a mechanical check beats more model requests.
- **If you do nothing:** every commit after a cut stays unreviewed and nothing
  in the record says so.

### blocker: container-e2e-promotion
- **Status:** open
- **Probed:** 2026-10-01 — `grep -rn 'installer-e2e' .github/workflows
  docs/decisions/ADR-087-installer-e2e-test-strategy.md` exits 0, and the hits
  are a FALSE POSITIVE on the literal string: all nine are inside ADR-087 naming
  the fixture files, `.github/workflows` contributes none, and ADR-087 line 77
  says in full *"The wiring into the required CI gate is a follow-up decision,
  kept out of scope here."* The ADR therefore does not carry the follow-up
  decision — it defers it by name — so neither limb of the resolved-when holds
  and this stays owner-reserved.
- **Owner:** owner
- **Blocks:** 4.2
- **What to do:** pick exactly one — (a) promote the container install test to a
  release-validation job (CI minutes, a Docker build per release), or (b) record
  in ADR-087 that it stays manual and opt-in.
- **Resolved when:** a workflow names `installer-e2e`, or ADR-087 carries the
  follow-up decision.
- **Recommendation:** (a) — the source's history of install regressions that
  reached a release is the class this test exists for.
- **If you do nothing:** the test stays unwired and a reviewer keeps reporting
  it as running in CI when it does not.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Dispositions are written to make the count zero | implementation | Step 1.2 has a numeric target, and the cheapest way to reach zero is `accepted_risk` on everything; the ledger then looks closed while saying nothing. | Each row needs a `verified_by` command that was run against the merged head, and `still_open` is a legal terminal status, so zero statusless rows does not require zero open findings. | Phase 1 — The disposition gate reports what it checked |
| 2 | The coverage label becomes a floor by habit | product | Once `partial` is printed, a later change may make it refuse, which spends review budget nobody authorized. | Decision D1 records the label-not-floor choice with its revisit condition; the spend half sits in an owner blocker. | Phase 2 — Coverage is a stated property of the record |
| 3 | The index rows paraphrase changelogs wrongly | implementation | Seven rows written from archived prose can misstate what broke. | Each row links its source changelog section, and the extended lint reads the same sections the rows came from. | Phase 3 — Every major has a row in the breaking-changes index |

## Acceptance Criteria

- [x] AC-1 — The 16.2.0 ledger carries no row without a terminal status, and
      each status carries a `verified_by` command.
      <!-- met 2026-10-01: 20/20 rows carry a status, a rationale and a
      verified_by that was run on this tree. 14 fixed, 1 accepted_risk, 3
      still_open — the spread is what shows the count was not reached by writing
      accepted_risk over everything, which risk 1 names as the cheap route. -->
      <!-- verify: node -e "const d=require('./agents/evidence/release-findings/16.2.0.json');process.exit(d.findings.filter(f=>!(f.status&&f.verified_by)).length)" -> 0 -->
- [x] AC-2 — A fixture ledger holding a statusless non-blocking row is reported
      by count, and the success line no longer says "all".
      <!-- met 2026-10-01: the live line reads "20 recorded finding(s) for
      16.2.0 — blocking 2/2 dispositioned · non-blocking 18/18 carry a terminal
      status". The fixture pair asserts the count AND that the rendered line does
      not contain "all"; the CLI case asserts the old sentence is gone rather
      than merely joined. -->
      <!-- verify: ./scripts-run src/scripts/check_finding_dispositions --release 16.2.0 -> /blocking 2\/2 dispositioned/ -->
- [x] AC-3 — `fact_claims` written by the self-review gate survives ingest.
      <!-- met 2026-10-01: INTEGRITY_FIELDS carries it, and three cases pin the
      round trip, the membership and that a second ingest does not overwrite the
      first run's count. -->
      <!-- verify: npx vitest run tests/scripts/check_finding_dispositions.test.ts -t fact_claims -> 0 -->
- [x] AC-4 — Every major carrying a `BREAKING CHANGES` section has a
      `BREAKING_CHANGES.md` row, and a fixture missing one fails the lint.
      <!-- met 2026-10-01: seven rows written (10.0.0 through 16.0.0), and the
      gate refuses a fixture whose index lacks the row even with the migration
      section present. The real-tree case listed exactly those seven before the
      rows landed, so the gate is known to have been red on this tree. -->
      <!-- verify: ./scripts-run src/scripts/lint_major_migration_sections --self-test -> 0 -->
- [~] AC-5 — <!-- blocked-by: review-ceiling-is-spend | asked: no — non-interactive inbox run; the question is carried in the round disposition Owner decisions block --> The post-cut delta is
      either reviewed or named as unreviewed in the workflow output.
