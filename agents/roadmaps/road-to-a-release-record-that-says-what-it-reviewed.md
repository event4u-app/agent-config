---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Four release-record defects verified against the merged 16.2.0 head that no active roadmap owns — a disposition gate whose success line counts 20 of 20 while 18 rows carry no status, a review field dropped at ingest, a coverage figure no reader states, and a breaking-changes index seven majors behind. The two later/ neighbours (release-finding ordering, release holds) own a different question each, and parking live work to buy the slot would trade a verified defect for an unverified one."
estate_growth_exempt: "Adds two owner blockers (a spend decision on the review ceiling and the ADR-087 follow-up decision on the container install test) and one exemption-carrying roadmap set from inbox round inbox-2026-10-a; both blockers are owner-reserved by the records they cite, so no agent step can retire them first."
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

- [ ] **1.1 Split the success line.** `check_finding_dispositions` prints the
      blocking count and the non-blocking count separately — `blocking 2/2
      dispositioned · non-blocking 0/18 carry a status` — and never the word
      "all" over a set it did not require. Exit semantics unchanged: only
      blocking rows can fail the gate. Test first: a fixture ledger with one
      dispositioned blocking row and one statusless non-blocking row, seen red
      on the current message.
      verify: `npx vitest run tests/scripts/check_finding_dispositions.test.ts` -> 0
- [ ] **1.2 Give every 16.2.0 row a terminal status against the merged head.**
      Re-read each of the 18 statusless rows against `9bc8cd4f2` and write one
      of `fixed` (with the commit), `false_positive`, `accepted_risk` or
      `still_open`, each with a `rationale` and a `verified_by` command. Row
      `9cf754edc878` is `fixed` only if `forge_reader.ts:139-147` still floors
      the timeout when re-read; rows `8deecc5724c6` (no tests for `originUrl` /
      `forgeProtectionJsonFor`) and `c6367568cb1a` / `77e3912664b9`
      (`doctor --json` spawns before output) are checked against the tree, not
      against the review text.
      verify: `node -e "const d=require('./agents/evidence/release-findings/16.2.0.json');process.exit(d.findings.filter(f=>!f.status).length)"` -> 0
- [ ] **1.3 Carry `fact_claims` through ingest.** Add it to `INTEGRITY_FIELDS`
      and assert in a test that an ingested artifact carrying it lands in the
      ledger. Seen red before the one-line change.
      verify: `npx vitest run tests/scripts/check_finding_dispositions.test.ts -t fact_claims` -> 0

## Phase 2 — Coverage is a stated property of the record

- [ ] **2.1 State partial coverage where the record is read.** When
      `coverage.filesReviewed < coverage.filesTotal`, the `--release` success
      line and the release's Known-limitations derivation both print
      `self-review read 65 of 678 changed files (partial)`. A label, never a
      floor that refuses: the ceiling is a spend decision (2.2).
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

- [ ] **3.1 Write the seven missing rows.** One row each for 10.0.0, 11.0.0,
      12.0.0, 13.0.0, 14.0.0, 15.0.0 and 16.0.0, taken from the `BREAKING
      CHANGES` sections of the archived changelogs, each linking its source
      section. A major whose section states nothing a consumer must do says so
      in the Migration cell.
      verify: `./scripts-run src/scripts/lint_major_migration_sections` -> 0
- [ ] **3.2 Make a missing row a failing gate.** Extend
      `lint_major_migration_sections` so a major with a `BREAKING CHANGES`
      section owes a `BREAKING_CHANGES.md` row as well as a `docs/MIGRATION.md`
      heading — the same floor, the same pending-entry path
      (`pendingMajorFinding`) so a cut cannot add a major the index lacks.
      Fixture first: a changelog with a major and an index without it, seen red.
      verify: `npx vitest run tests/scripts/lint_major_migration_sections.test.ts` -> 0

## Phase 4 — The container install test, decided

- [ ] **4.1 Correct the stale scenario label.** `tests/fixtures/installer-e2e/run-scenarios.sh:27`
      echoes `install.py` while line 40 runs `install.ts`; the Python installer
      was removed. Label only, no behaviour change.
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
| D3 | owner | blocker | Post-cut delta review and container test promotion stay with the owner | Both are spend or infra the records name as owner follow-ups (ADR-087, the review ceiling) | — |
| D4 | deterministic | evidence | Closure-scan C1 and C2 (steps 2.2 and 4.2 read as unfalsifiable) are resolved: each step's `verify:` sits on its continuation line and carries an expectation (`-> /post-cut/`, `-> /installer-e2e/`) | `roadmap_verify_share` counts nine of nine clauses in this file as naming an expectation | The scanner is taught to read continuation lines |
| D5 | owner | blocker | Closure-scan C3 (AC-5 offers two outcomes) is the owner choice recorded in `review-ceiling-is-spend`, not an unpicked alternative | The blocker names both options and a recommendation | — |

## Blockers

### blocker: review-ceiling-is-spend
- **Status:** open
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

- [ ] AC-1 — The 16.2.0 ledger carries no row without a terminal status, and
      each status carries a `verified_by` command.
- [ ] AC-2 — A fixture ledger holding a statusless non-blocking row is reported
      by count, and the success line no longer says "all".
- [ ] AC-3 — `fact_claims` written by the self-review gate survives ingest.
- [ ] AC-4 — Every major carrying a `BREAKING CHANGES` section has a
      `BREAKING_CHANGES.md` row, and a fixture missing one fails the lint.
- [~] AC-5 — <!-- blocked-by: review-ceiling-is-spend | asked: no — non-interactive inbox run; the question is carried in the round disposition Owner decisions block --> The post-cut delta is
      either reviewed or named as unreviewed in the workflow output.
