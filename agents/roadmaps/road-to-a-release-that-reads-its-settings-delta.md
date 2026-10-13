---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "No active or parked roadmap reads the settings surface at the cut: later/road-to-contract-integrity shipped its release-discipline phase for artefact files only and is parked, and later/road-to-release-holds-that-refuse owns publish holds, not deltas. 16.4.0 removed 46 settings keys in a minor while docs/releases.md still promises breaking-only; offsetting against an unrelated roadmap would trade that contradiction for a slot."
estate_growth_exempt: "Grows open_blockers by one: what-a-minor-may-remove is an owner-reserved release-contract question (a public commitment) that this run may pose but not answer."
relates:
  - slug: road-to-contract-integrity
    relation: extends
    note: "Parked with its release-discipline phase shipped. That phase added a structural detector for deleted and renamed artefact files, read against the trunk. This adds the reading that phase never had: settings keys, read against the last release, at the moment a version is cut."
  - slug: road-to-release-holds-that-refuse
    relation: disjoint
    note: "Owns holds that stop a publish while a roadmap's intermediate state is broken. Nothing here opens, reads or clears a hold."
---
# Road to a release that reads its settings delta

> **Source:** `agents/tmp.old/inbox-2026-10-k/` — an external harvest round
> that walked consecutive release tags at `f76e83e47` and supplied the walk as
> a prototype. Re-run on `main` @ `d41121927` on 2026-10-11 against local tags:
> the figures below are this tree's, and they moved since the round (16.4.0
> landed in between). Class: external harvest proposal, verified and
> reproduced against this tree.

> **Arrivals (blocker `what-a-minor-may-remove`):** 2 — latest `inbox-2026-10-m`
> (2026-10-12): a 16.4.0 release review reads the 46-key retirement in a minor
> as a breach of `BREAKING_CHANGES.md:13` ("settings keys are part of its public
> contract") and cites `:52`, where 11.0.0 was a major for removing one key,
> `worktrees.mode`. New evidence for the blocker, cutting toward option (a); it
> does not change the question. It does widen step 5.1: `BREAKING_CHANGES.md:13`
> is a fourth sentence stating the rule, and 5.1 names three.
> Earlier: `inbox-2026-10-k` (2026-10-11).

## Goal

When a version is cut, the release knows which settings keys the last release
had and this one does not, which changed type, which lost a vocabulary value,
and which arrived without a default. A removed key with no tombstone and no
rename entry stops the cut. Whether a tombstoned removal may ship below a
major is one owner answer, and the release contract, the rename map and the
cut all follow it. The upgrade leg asserts the delta it was written to assert.

## Context

- The contract: "These surfaces only change in a **breaking release** … Config
  formats — `.agent-settings.yml` keys and semantics" (`docs/releases.md:29-34`).
- The practice. Re-reproduced 2026-10-13 over this tree's local tags, reading
  the template out of each tag over its four historical paths: **197**
  consecutive tag pairs carry a settings template; **11** lost leaf keys;
  **9 of the 11 were minors (75 keys)**, 2 were majors (5 keys). The 196/74
  first written here is superseded by this reading, which the fixture carries.
  Of the 80 lost keys, 61 are tombstoned, 1 renamed and 18 are in neither map;
  classified against the maps as they stood AT each tag the answer is the same,
  key for key, and at every tag carrying an unannotated removal no tombstone map
  existed at all. The 19 pairs the walk cannot read are a contiguous prefix
  (1.0.0 → 1.8.0) from before the template existed, and none of them is a
  major.
  `corrected-from-reproduction` — the round read 8 minors / 29 keys at
  `f76e83e47`; 16.3.0 → 16.4.0 (`b35d432b1`, "retire 46 default-neutral
  derivable settings keys") is the ninth, the largest by far. All 46 of that
  minor's removals carry an entry in `REMOVED_KEYS`
  (`src/scripts/_lib/settings_removed_keys.ts:71`) or `RENAMED_KEYS`
  (`src/scripts/_lib/settings_renamed_keys.ts:21-23`) — checked key by key.
  The practice is disciplined; the contract describes a rule the last nine
  minors did not follow.
- A third sentence disagrees with both: a renamed-key entry "is dropped one
  minor after it lands" (`settings_renamed_keys.ts:10`).
- The bump cannot see any of this. It reads commit subjects
  (`src/scripts/release.ts:446` reads `%H%x1f%s`; `:461` sets `breaking` from a
  `!` or the words `BREAKING CHANGE`).
- Nothing checks that a removed key has a tombstone. `lint_settings_classes`
  validates the entries that exist (`src/scripts/lint_settings_classes.ts:19`),
  and the loader's removal warning walks `REMOVED_KEYS` only
  (`settings_removed_keys.ts:158-163`). A key deleted from the template with no
  entry in either map gets no warning; the installed value simply stops
  applying. That 46 of 46 were tombstoned is discipline, not a guard.
- The comparison exists on the consumer's machine and is not read here. Every
  global install computes the flattened surface from the live schema
  (`src/scripts/install.ts:3714-3715`) and, on upgrade, a delta of
  `added / removed / default_changed / enum_added / enum_removed /
  type_changed` (`src/shared/settingsSurface.ts:126`, called at
  `install.ts:3734`).
- The assertion was promised and closed without being written. The archived
  step for the upgrade leg reads "settings-sync produces the expected
  upgrade-delta"
  (`agents/roadmaps/archive/road-to-proof-under-real-conditions.md:134-137`)
  and its closing note names `conformance` as the probe;
  `src/scripts/consumer_matrix.ts:636-660` upgrades the last published version
  to the tarball and runs `conformance`; it reads no delta.
- The planner already has the shape this needs: two `assert_*` calls take a
  target and `previewOnly`, refuse a real cut and only report in dry-run
  (`release.ts:1565`, `:1589`). A release pull request may only touch
  allowlisted files (`src/scripts/check_release_pr_shape.ts:27`).
- CLI verbs and hook events were walked the same way by the round and are
  clean: one verb removal in 129 pairs, in a major; no event removal in 98.

## Phase 1 — The control reading

- [x] **1.1 A planted removal passes today.** A test deletes one key from the
      settings schema in a temporary copy, adds no tombstone, commits with a
      `feat:` subject and runs the planner in dry-run. The output proposes a
      minor and names no settings change.
      verify: `npx vitest run tests/scripts/release_settings_delta.test.ts -t control --reporter=verbose` -> /✓.*control/
- [x] **1.2 The history is a fixture.** The eleven tag pairs with their
      removed keys are frozen as a test fixture, each key marked tombstoned,
      renamed or neither, so Phase 3 has known inputs of every class.
      verify: `npx vitest run tests/scripts/release_settings_delta.test.ts -t history-fixture --reporter=verbose` -> /✓.*history-fixture/

## Phase 2 — The last release's surface, written by the release

- [x] **2.1 The surface is derived.** A small module emits the flattened
      settings surface from the live schema, sorted, without descriptions and
      without timestamps, plus the keys of both tombstone maps.
      verify: `npx vitest run tests/scripts/release_settings_delta.test.ts -t emit --reporter=verbose` -> /✓.*emit/
- [x] **2.2 One committed file, one writer.**
      `tests/fixtures/settings_surface_released.json` is rewritten by the
      release script when it cuts a version and is added to the release pull
      request's allowlist. A test fails when the file changes in a commit that
      does not also change the package version.
      verify: `npx vitest run tests/scripts/release_settings_delta.test.ts -t single-writer --reporter=verbose` -> /✓.*single-writer/

## Phase 3 — The cut answers the delta

- [x] **3.1 A third assertion beside the two.** A module under `_lib/`
      computes the delta between the committed file and the live surface with
      `computeSurfaceDelta`, and the planner calls it where it calls the other
      two. On a real cut it refuses; in dry-run it reports. It refuses on: a
      removed key in neither map; a type change; a removed vocabulary value; a
      key added without a default. Each refusal names the keys.
      verify: `npx vitest run tests/scripts/release_settings_delta.test.ts -t refuses --reporter=verbose` -> /✓.*refuses/
- [x] **3.2 The 1.1 control flips.** The planted removal is reported in dry-run
      and refused on a real cut; the same removal with a tombstone is not
      refused by 3.1.
      verify: `npx vitest run tests/scripts/release_settings_delta.test.ts -t control-flipped --reporter=verbose` -> /✓.*control-flipped/
- [ ] <!-- blocked-by: what-a-minor-may-remove | asked: no — authored from inbox round inbox-2026-10-k, which had no owner turn on this question; it is carried by the blocker below for /roadmap:resolve-blockers --> **3.3 A tombstoned removal follows the owner's answer.** Under (a) the
      assertion also refuses a tombstoned or renamed removal when the target is
      not a major; under (b) it lists it and lets the cut proceed.
      verify: `npx vitest run tests/scripts/release_settings_delta.test.ts -t tombstoned-removal --reporter=verbose` -> /✓.*tombstoned-removal/

## Phase 4 — The leg asserts what it was written to assert

- [x] **4.1 The upgrade leg reads the delta.** After upgrading from the last
      published version to the tarball, the leg reads the delta the installer
      writes and asserts that its `removed`, `type_changed` and `enum_removed`
      entries equal the ones 3.1 computes for the same pair.
      verify: `npx vitest run tests/scripts/consumer_matrix_settings_delta.test.ts` -> 0

## Phase 5 — Three sentences that say one thing

- [ ] <!-- blocked-by: what-a-minor-may-remove | asked: no — authored from inbox round inbox-2026-10-k, which had no owner turn on this question; it is carried by the blocker below for /roadmap:resolve-blockers --> **5.1 The contract, the rename map and the tombstone map agree.**
      `docs/releases.md` § The stability surface, the retention sentence at
      `settings_renamed_keys.ts:10` and the comment above `REMOVED_KEYS` state
      the rule the owner chose, in the same words.
      verify: `npx vitest run tests/scripts/release_settings_delta.test.ts -t three-sentences-agree --reporter=verbose` -> /✓.*three-sentences-agree/

## What this roadmap deliberately does not do

- No surface file for CLI verbs or hook events; their histories show no
  removal below a major (D1 names what reopens it).
- No pull-request check against the last release. A removal that merged with
  its annotation would keep every later pull request red until the next cut;
  the cut is where the question is decidable.
- No post-publish execution of the published version, no private-twin push,
  no fuzzing, no scheduled registry canary — no failed publish is on record and
  the weekly matrix leg already installs the published version.
- No change to how commit subjects are parsed, and no new override flag.
- No edit to the structural detector or to where it runs.

## Acceptance Criteria

- [ ] AC-1 — A key removed with no tombstone and no rename entry is reported in
      dry-run and refuses a real cut, and a test shows both.
- [ ] AC-2 — The last release's settings surface is one committed file that
      only the release script writes.
- [ ] AC-3 — The frozen history is classified by the assertion exactly as the
      fixture marks it.
- [ ] AC-4 — The upgrade leg fails when the installer's delta and the release's
      delta disagree.
- [ ] AC-5 — The release contract, the rename map and the tombstone map state
      one rule.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Settings only | Nine minors removed 74 keys; verbs show one removal in a major across 129 pairs, events none across 98 | A verb or event is removed below a major |
| D2 | reversible-technical | agent | Decide at the cut, not on each pull request | A last-release base would hold every later pull request red after one annotated break; dry-run already reports without failing | Removals start reaching the cut unnoticed often enough to cost a re-plan |
| D3 | reversible-technical | agent | Reuse the consumer-side delta and its six kinds | A second vocabulary for the same change would be two clocks | The review form needs a kind the release must not read |
| D4 | reversible-technical | agent | An untombstoned removal refuses under either owner answer | With no entry in either map the installed value stops applying with no warning; no reading of the contract permits that | A removal is ever meant to be silent |
| D5 | reversible-technical | agent | The committed file has one writer and is cross-checked by the upgrade leg | The install-layout golden is the precedent; 4.1 ties the file to shipped bytes | The file and the published surface are found to differ |
| D7 | contested-technical | council:settings-minor-removal-2026-10-13 | The owner, not the council and not the agent, picks (a) or (b). The council may advise and did; the blocker stays open and steps 3.3 and 5.1 stay open with it | Both seats, 2 of 2 present, quorum concluded, no billable spend (`anthropic` and `openai`, both subscription-authed). Independently reached owner-reserved: amending a published versioning promise is governance, not implementation. One seat: "A council can analyze and recommend. An agent can implement an owner decision. But amending the contract is governance." The other: "a council may recommend; an agent may implement only an explicit owner decision" | The owner delegates this class of contract amendment in writing |
| D8 | reversible-technical | council:settings-minor-removal-2026-10-13 | The recommendation carried to the owner changes from (b) to (a); both readings are kept on the blocker so the owner sees the disagreement rather than only its outcome | Both seats chose (a) against this file's own (b). Their argument is one the file did not have: a tombstone reports breakage and does not prevent it, so membership in a runtime diagnostic map is not evidence of behavioural compatibility; and a contract amended to match its own violations is weaker than no published promise. `BREAKING_CHANGES.md:52` records 11.0.0 as a major for removing one key, which is the contract being honoured deliberately once | The owner picks (b), or behavioural-compatibility evidence for the 75 keys is produced |
| D6 | deterministic | agent | Closure pass 2026-10-11: the four `typed-op` hits are the words "publish" and "push" in the frontmatter, a `relates` note and the non-goals — operations this roadmap explicitly does not perform; the one real owner question is the blocker below | `closure_scan` on this file: 4 typed-op listings, all in negated or descriptive prose | A step is added that publishes or pushes |

## Blockers

### blocker: what-a-minor-may-remove
- **Status:** open — raised 2026-10-11 from inbox round `inbox-2026-10-k`, which carried no owner turn on this question. Put to the council 2026-10-13 (`council:settings-minor-removal-2026-10-13`, both seats, 2 of 2, concluded, no billable spend): **owner-reserved**, unanimously and independently. The council advised; it did not and may not settle it.
- **Owner:** owner — the release contract is a public commitment; the council may advise.
- **Blocks:** steps 3.3 and 5.1, AC-5.
- **What to do:** pick exactly one — (a) keep `docs/releases.md:29-34` as written: any removal or rename of a settings key ships only in a major, and `src/scripts/_lib/settings_renamed_keys.ts:10` is changed to say an alias is dropped only in a major; or (b) amend `docs/releases.md` to say a key may be removed or renamed in a minor when it leaves an entry in `REMOVED_KEYS` or `RENAMED_KEYS`, and that an alias is dropped only in a major.
- **Resolved when:** `docs/releases.md` states (a) or (b) and `npx vitest run tests/scripts/release_settings_delta.test.ts -t three-sentences-agree` exits 0.
- **Recommendation:** the two readings disagree, and both are carried here so the owner decides on the
  disagreement rather than on one side of it.
  - **This file's original reading — (b).** Nine minors removed 75 keys (reproduced: 75, not the 74
    first written here), each since 9.29.0 carrying a tombstone or alias, including 16.4.0's 46; the
    page describes a rule the releases have not followed, and (a) would have made 16.4.0 a major.
    Keeping aliases until the next major means a rename never becomes a silent removal.
  - **The council's reading 2026-10-13 — (a), both seats, independently.** A tombstone reports
    breakage; it does not prevent it, so membership in a mutable runtime diagnostic map is evidence of
    detectability and not of behavioural compatibility. The nine minors establish that enforcement was
    absent, not that consumers consented to a weaker contract — `BREAKING_CHANGES.md:52` records 11.0.0
    as a major taken deliberately for one key, `worktrees.mode`. And a contract amended to match its own
    violations sets the precedent for the next ones. One seat added the sharpest form: under (b) the
    tombstone map would both authorise a removal and decide whether it is detected, which is circular.
  - **Both readings agree on one thing:** the alias-retention sentence at
    `settings_renamed_keys.ts:10` changes under EITHER option, because dropping an alias IS the removal.
    It cannot be deferred past whichever answer the owner picks.
  - **What the council's circularity objection does NOT reach:** step 3.1, as built, grants nothing. It
    refuses a removal carrying no entry in either map and reports a carried removal without refusing it;
    no tombstone authorises anything today. The circularity would arrive with 3.3, which is exactly the
    step this blocker holds.
- **If you do nothing:** 3.1 still stops an untombstoned removal; the contract page keeps promising a rule the last nine minors broke, and the rename map keeps a retention rule that contradicts both.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-11 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The release pull request fails its own shape gate | implementation | A new file rewritten at the cut is outside the allowlist. | 2.2 adds it to the allowlist in the same change and tests a cut in a temporary copy. | Phase 2 — The last release's surface, written by the release |
| 2 | A rename reads as a removal plus an addition | implementation | The surface drops the old leaf and gains the new one. | 2.1 emits both tombstone maps; 3.1 treats a removed key present in either as carried; the 1.2 fixture includes the one rename in the history. | Phase 3 — The cut answers the delta |
| 3 | Type and vocabulary history cannot be replayed | implementation | Old tags carry a template, not a schema, so the fixture pins key presence only. | 3.1's type and vocabulary branches are tested with planted changes, not history. | Phase 1 — The control reading |
| 4 | The owner answer arrives late | product | 3.3 and 5.1 wait. | Phases 1, 2, 4 and steps 3.1–3.2 do not depend on it and close the silent case under either answer. | Phase 3 — The cut answers the delta |

## Provenance

- The round's lesson: a vendor's release procedure compares a candidate's
  input schema with the live version before publishing, with compatibility
  rules (removed input, changed type, narrowed choices, new input without a
  default; defaults may change) — the same six kinds this tree already
  computes on the consumer side.
- No council was consulted.

| Item from the round | Verdict | Where it lands |
|---|---|---|
| Compare the candidate's schema with the live version before publishing | KEEP | Phases 2 and 3 |
| The compatibility rule set | FOLD | 3.1 — the tree's own delta kinds already say this |
| A narrowing change named on the pull request that makes it (loop 2) | CUT | D2 — the cut is where it is decidable |
| The structural detector reads paths that exist (loop 2) | MOVED | `road-to-sentences-the-tree-can-back` |
| A hook-protocol stability class (loop 2 blocker) | CUT | D1 — event history is clean |
| Push to a private twin; fuzz the candidate; registry canary | CUT | No defect any of them would have caught |
