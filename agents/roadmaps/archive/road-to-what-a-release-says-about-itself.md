---
complexity: lightweight
status: archived
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-release-finding-ordering
    relation: disjoint
    note: "Parked. Owns when the disposition check reads findings inside the release pull request's workflows. This one owns what the cut accepts once a ledger is there, and touches neither workflow."
  - slug: road-to-a-release-record-that-says-what-it-reviewed-carried
    relation: disjoint
    note: "Parked on blocker review-ceiling-is-spend. Owns the commits after a ledger's recorded head. This one owns a ledger that reviewed nothing at all."
  - slug: road-to-a-release-that-reads-its-settings-delta
    relation: disjoint
    note: "Owns the settings delta at the cut and the owner question what-a-minor-may-remove. Step 2.3 here moves the prose a consumer needs about 16.4.0's removed keys into the migration guide and takes no position on that question."
  - slug: road-to-changelog-unreleased-drain
    relation: extends
    note: "Archived. Drained a 6.0.0 fossil out of [Unreleased] and guarded only the at-a-glance shape; twenty entries from 14.17.0 to 16.4.0 have since accumulated there in a shape that guard does not see."
estate_offset_exempt: "No active roadmap owns what the cut accepts from an empty ledger or what the changelog keeps under [Unreleased]; the two parked release roadmaps own other halves of the same ledger and stay parked on owner blockers, so offsetting against either would trade a reproduced fail-open for a slot."
---
# Road to what a release says about itself

> **Source:** `agents/tmp.old/inbox-2026-10-m/` (topic `s03`) — nineteen
> external reviews of the 16.4.0 release in one transcript, a supplied 49-row
> rescore with its JSON mirror, a comparative locks check and a status note.
> Every figure below was re-derived at `main@17f028941` (16.5.0) on
> 2026-10-12; the reviews were drafted against `d41121927` (16.4.0).

## Goal

A release whose self-review produced nothing cannot be cut on a reason string
alone: it carries a reviewed ledger or a named override, and the message that
stops it says how to get either. The record a release publishes says what it
carried — the commit mix with its largest bucket, a migration note for the
keys it removed, and an `[Unreleased]` section that holds only unreleased
work.

## Context — reproduced at `main@17f028941`

- **An unreviewed ledger passes the cut.**
  `agents/evidence/release-findings/16.4.0.json` carries
  `assurance: unreviewed`, `reviewers: []`, `findings: []` and a
  `no_findings_reason` naming three runs refused with HTTP 400.
  `empty_ledger_problem` (`src/scripts/check_finding_dispositions.ts:466-481`)
  returns null for any non-empty reason; the `assurance` field (`:141`) is read
  and never gated. Step 7 of `release.ts` calls `settleFindingsLedger`
  (`src/scripts/_lib/release_findings_ingest.ts:239`), which runs that check
  and nothing else, and the ingest message at `:137` tells the operator to
  "record a no_findings_reason if none ran". In CI the self-review exits 0 on
  a run that reviewed nothing (`src/scripts/self_review_gate.ts`, the NEUTRAL
  branch near `:1222`).
- **The path that would have reviewed it exists and works.**
  `self_review_gate.ts:1062-1079` resolves the subscription CLI before the
  metered key — "a reviewed release beats a diagnosed one" — and
  `16.5.0.json` carries `assurance: single-pass` with 106 findings from that
  path. The cut does not ask for it.
- **The published mix line drops its largest bucket.**
  `measure_release_mix --from 16.3.0 --to 16.4.0` prints
  `consumer 1 · governance 42 · maintenance 1 · mixed 41`;
  `measure_release_mix.ts:48` says `mixed` "is never collapsed", and
  `release_publication.ts:491-499` writes only `governance_only` and
  `consumer_only` into the `> **Governance mix:**` line.
- **`[Unreleased]` fossilised again.** `CHANGELOG.md:31-889` holds twenty
  bold entries, the oldest about 14.17.0 and 14.19.0, the newest the 46-key
  retirement of `b35d432b1`, which `git merge-base --is-ancestor b35d432b1
  16.4.0` confirms shipped in 16.4.0. The archived drain guarded only a
  `### N.Y.Z at a glance` block (`tests/lib/changelog_eras.test.ts:113-131`).
- **The migration guide is silent and one sentence is stale.**
  `docs/MIGRATION.md` has a 16.4.0 section for the offline doctor (`:69`) and
  none for the 46 retired keys; `:113` still calls the offline default "an
  open owner decision" four sections after it shipped.

## Phase 0 — The control

- [x] **0.1 The 16.4.0 ledger passes the cut today, recorded red-first.** A
      fixture copies `16.4.0.json` verbatim under a test version that is not
      released; a case named `unreviewed-ledger-at-the-cut` asserts the
      `--release` check exits 1 on it. Run it against the current gate and
      record that it fails (the gate exits 0) before Phase 1 changes anything.
      verify: `npx vitest run tests/scripts/check_finding_dispositions.test.ts -t unreviewed-ledger-at-the-cut --reporter=verbose` -> /✓.*unreviewed-ledger-at-the-cut/

## Phase 1 — An empty review stops the cut, and says how to proceed

- [x] **1.1 `assurance: unreviewed` refuses at the cut.** In `--release` mode
      for a version the release-status discriminator reads as unreleased, an
      empty ledger whose `assurance` is `unreviewed` exits 1 unless it carries
      `assurance_override` naming a committed file under
      `agents/evidence/owner-directives/` whose text contains the version. A
      released version's backfilled ledger keeps passing (decision D2).
      verify: `npx vitest run tests/scripts/check_finding_dispositions.test.ts -t unreviewed --reporter=verbose` -> /✓.*unreviewed-ledger-at-the-cut/
- [x] **1.2 The stop names the review first and the override second.** The
      message at `release_findings_ingest.ts:137` and the refusal of 1.1 name
      the local CLI review the self-review gate resolves first, then the
      ingest command, then the override; no message tells the operator to
      write a reason for a review that did not run.
      verify: `grep -c 'record a no_findings_reason if none ran' src/scripts/_lib/release_findings_ingest.ts` -> /^0$/
- [x] **1.3 The field has a schema and a reader.** `assurance_override` is
      added to the ledger schema `check_review_schema` reads, with the
      directive path as its only value, and the override is printed in the
      release's known limitations so a reader of the published notes sees it.
      verify: `npx vitest run tests/scripts/review_findings_schema.test.ts -t assurance_override --reporter=verbose` -> /✓.*assurance_override/
- [x] **1.4 Four fixtures, one per outcome.** The 16.4.0 ledger at the cut
      exits 1; `16.5.0.json` exits 0; the 16.4.0 ledger with an override
      naming an existing directive exits 0; the 16.4.0 ledger for a released
      version exits 0.
      verify: `npx vitest run tests/scripts/check_finding_dispositions.test.ts tests/scripts/release_findings_ingest.test.ts` -> 0

*Exit: 0.1 was seen red and 1.1 to 1.4 are green. Rollback: revert; the cut
returns to accepting a reason string.*

## Phase 2 — The published record says what it carried

- [x] **2.1 The mix line prints every bucket.** `release_publication.ts`
      renders `governance-only N vs consumer-only M (mixed K, maintenance L;
      taxonomy …; range …)`. Every reader of the line is found with
      `grep -rn 'Governance mix' src tests` and updated in the same change.
      verify: `npx vitest run tests/scripts/release_mix_line_reproduces.test.ts -t mix-line-carries-mixed --reporter=verbose` -> /✓.*mix-line-carries-mixed/
- [x] **2.2 `[Unreleased]` is drained, preserved verbatim.** The twenty
      entries at `CHANGELOG.md:31-889` move into
      `docs/archive/CHANGELOG-unreleased-drain-2026-10.md` with the archive
      header the 6.0.0 drain used, each entry tagged with the first release
      tag that contains the commit that added it; `[Unreleased]` keeps its
      placeholder.
      verify: `grep -c '46 settings keys are retired' docs/archive/CHANGELOG-unreleased-drain-2026-10.md` -> /^1$/
- [x] **2.3 The migration guide carries the removed keys.** `docs/MIGRATION.md`
      § 16.4.0 gains the retired-keys note — a set value is ignored, one
      deprecation line per key and process, where the list lives
      (`src/scripts/_lib/settings_removed_keys.ts`) — and `:113` points at the
      16.4.0 section instead of calling the default open.
      verify: `grep -c 'open owner decision' docs/MIGRATION.md` -> /^0$/
- [x] **2.4 The drain guard sees the new shape.** A case in
      `tests/lib/changelog_eras.test.ts` fails when a `- **` entry under
      `[Unreleased]` was added by a commit the newest release tag already
      contains; the 2.2 state is green and a fixture with one shipped entry is
      red.
      verify: `npx vitest run tests/lib/changelog_eras.test.ts -t unreleased-holds-only-unreleased --reporter=verbose` -> /✓.*unreleased-holds-only-unreleased/

*Exit: 2.1 to 2.4 are green. Rollback: revert; the archive file and the guard
leave together.*

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | critical-technical | evidence | An unreviewed ledger stops the cut unless a reviewed ledger replaces it or an owner directive names the version | it tightens a floor and reopens no lock: the archived ledger roadmap accepted an unreviewed reason only to backfill releases already shipped; `16.5.0.json` shows the CLI path produces a reviewed ledger, so an ordinary cut is unaffected | a cut is stopped with no reviewer reachable and no owner reachable for a week |
| D2 | deterministic | evidence | The refusal applies only to a version the release-status discriminator reads as unreleased | backfilled ledgers for shipped versions carry `assurance: unreviewed` by design (archived `road-to-the-ledger-two-releases-skipped`); refusing them would red history no one can re-review | a shipped version's ledger is rewritten after the fact |
| D3 | reversible-technical | evidence | The override is a path to a committed owner directive, not a free-text field | a free-text field is the reason string this roadmap replaces; `agents/evidence/owner-directives/` already carries owner rulings by path (ADR-282's provenance) | an authenticated owner channel lands (ADR-281 § Amendment) — the override then binds to it |
| D4 | reversible-technical | evidence | The `[Unreleased]` guard is a test over git history, not a release-tool change that moves entries at the cut | the archived drain chose a guard over a tool change; a test is decidable and reversible, while moving hand prose into generated sections changes what the release writer owns | the guard fires on more than one cut in a row |
| D5 | reversible-technical | evidence | The mix line adds buckets; it does not change which comparison is printed first | the measurer already computes all four (`measure_release_mix.ts:48`); D-B of the comparative series asks what the mix is for, which this line does not answer | ADR-260 § 1 receives the record that question asks for |
| D6 | deterministic | evidence | Closure scan at authoring: 8 hits, none open. Five name-filter hits are the test titles these steps create, and each expectation is a `✓` line for that title, which a run that skips every test cannot print. Three typed-op hits are the words "merge" and "retirement" in context and non-goals; no step merges, deploys or publishes | `./scripts-run src/scripts/closure_scan` on this file, 2026-10-12 | a step is added that performs a typed operation |

## What this roadmap deliberately does not do

- It adds no second provider, no self-hosted runner and no second review
  framework; the CI self-review stays as it is, including its neutral exit.
- It adds no council for release assurance and no new evidence type.
- It does not change the merge gate's `classifyBlocking` — the release gate
  and the merge gate differ by exactly the cell they differ by today.
- It does not rewrite `16.4.0.json` or any shipped ledger.
- It does not decide whether removing a settings key belongs in a minor;
  that is blocker `what-a-minor-may-remove` of the settings-delta roadmap.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-12 | reviewer: claude-opus -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A provider outage blocks a cut | product | With no CLI on the operator's machine and no metered credit, the cut stops where it shipped before | 1.2 names the local CLI review first and 1.1 keeps the override; D1 names when to revisit | Phase 1 — An empty review stops the cut, and says how to proceed |
| 2 | History turns red | implementation | Backfilled ledgers for shipped versions carry `unreviewed` by design and would fail a version-blind refusal | D2 scopes the refusal to unreleased versions; 1.4 pins a released-version fixture green | Phase 1 — An empty review stops the cut, and says how to proceed |
| 3 | A mix-line reader breaks | implementation | A test or script parses the published line by position | 2.1 greps every reader and updates it in the same change | Phase 2 — The published record says what it carried |
| 4 | Drained entries lose their history | implementation | Moving twenty entries out of `CHANGELOG.md` hides what shipped where | 2.2 moves them verbatim and tags each with its first containing release | Phase 2 — The published record says what it carried |

## Acceptance Criteria

- [x] AC-1 — The 16.4.0 ledger, placed at an unreleased cut, exits 1 with a
      message that names the local CLI review before the override, and the
      case was seen red before the gate changed.
- [x] AC-2 — A reviewed ledger, an overridden ledger and a shipped version's
      backfilled ledger each exit 0.
- [x] AC-3 — The published mix line carries `mixed` and `maintenance`, and
      every reader of the line passes.
- [x] AC-4 — `[Unreleased]` holds no entry a release tag already contains, the
      drained entries exist verbatim in one archive file, and a fixture with a
      shipped entry fails the guard.
- [x] AC-5 — The migration guide names the retired keys' behaviour in its
      16.4.0 section and no longer calls the offline default open.
