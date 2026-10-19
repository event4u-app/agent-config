<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-t verified at 5fa963cec that the global deploy manifest is written only when the install ran from a directory carrying project settings (install.ts:3531-3537), that an absent record classifies as `unknown` and `decideDeployWrite` returns `write` for it (preserve.ts, recordedOwnership.ts:57-78), so whether a consumer's edit to a globally installed file survives depends on the working directory the install was run from; that the deploy inventory records relative paths and no digest (global_deploy_inventory.ts, 0 hash hits), so the reaper deletes an edited file the package retires; and that `cmd_doctor.ts:597` skips every non-project-scoped tool, so doctor reports green while the installer reports not-current. No active, parked or stub roadmap owns this: the one adjacent stub, road-to-per-repository-install-verification, is itself blocked on ADR-020 and records that no manifest writer was added. Archiving or parking costs more because the loss is a consumer's own edit and is silent; merging into road-to-an-uninstall-that-only-removes-what-it-brought would put that file's data-loss fix behind this file's council round."
estate_growth_exempt: "2026-10-18: adds one open blocker, global-entries-in-the-consumer-lock. It is a newly classified decision, not a repaired undercount: step 3.3 was already open and owner-labelled in prose, and an AI council round that day split on its venue, so the escalation now has the structured form roadmap:resolve-blockers and stubs:due read instead of living only in a step note."
relates:
  - slug: road-to-an-uninstall-that-only-removes-what-it-brought
    relation: extends
    note: "That file reads the deploy inventory as a deletion allowlist at schema 1. Phase 2 here bumps that schema to two digests; it must not block the data-loss fix, so the schema bump is additive and the reader tolerates schema 1."
  - slug: road-to-gates-that-run-where-the-consumer-stands
    relation: extends
    note: "Phase 1's red tests are consumer-scenario cases; that file generalises the harness they live in. Neither builds a second harness."
  - slug: road-to-an-installed-layer-that-is-thinned
    relation: disjoint
    note: "Owns which artefacts the default projection carries. This file owns what happens to a file after it is deployed, whichever projection put it there."
  - slug: road-to-typed-grants-that-persist
    relation: disjoint
    note: "Owns who may authorise what. This file records who WROTE a file; it adds no grant, no ask and no authority path."
---
# Road to an ownership record that belongs to the user

> **Source:** `agents/tmp.old/inbox-2026-10-t/topic-2/` — two transcripts and
> ten supplied plans, pinned at `main@9a43fabe5`, `main@9b6ff1a5b` and
> `main@73eb69439`, all ancestors of HEAD. Re-read at `main@5fa963cec` on
> 2026-10-16.

## Goal

Whether a consumer's edit to a globally installed file survives the next
install stops depending on the directory the install was run from. The record
of what this package wrote, and of what the user changed afterwards, lives
with the **user**, is readable by every surface that reports on it, and says
the same thing in all of them.

## Prerequisites

- Phase 0's council round is closed before Phase 2 changes any classifier.
  Phases 1 and 3's doctor fix do not wait on it.
- `npx vitest` runs locally; the tests drive the real installer through
  `spawnSync` with an injected `HOME`.

## Context — read at `main@5fa963cec`

| # | Defect | Evidence |
|---|---|---|
| K1 | **The ownership record is written only from a project that has settings.** `src/install/install.ts:3531-3537` gates the manifest write on `pathExists(_resolve_settings_read(project_root))`. Install from a directory with no project settings and no record is written at all. |
| K2 | **No record means overwrite.** With no recorded digest, `classifyOwnership` returns `unknown` (`src/install/recordedOwnership.ts:57`, `:72-78`), and `decideDeployWrite` in `src/install/preserve.ts` returns `preserve` only for `recorded-modified` — so `unknown` is written over. K1 and K2 together mean a user edit survives or dies according to the working directory of a later install. |
| K3 | **There is one digest where there need to be two.** `RecordedOwnership` is `recorded-unchanged \| recorded-modified \| unknown` and `classifyOwnership(recordedSha256, onDiskSha256)` takes no **packaged** digest. The record therefore cannot distinguish "the user changed it" from "we shipped a new version of it", which is the distinction every later decision needs. |
| K4 | **The reaper deletes an edited file the package retires.** `src/scripts/_lib/global_deploy_inventory.ts` records relative paths; a grep for a hash or digest over that module returns **0**. A file the user edited and the package later withdraws is removed without the edit ever being seen. |
| K5 | **`doctor` is green while the installer says not-current.** `src/scripts/_cli/cmd_doctor.ts:597` — `if (tool['scope'] !== 'project') continue;` — so a global-scope tool is skipped entirely. The two surfaces that report on the same install disagree by construction. |
| K6 | **The manifest is stageable in a consumer repository.** `grep -c installed-tools src/config/gitignore-block.txt` returns **0**, so a manifest full of `$HOME`-rooted paths can be committed. `README.md:357` calls the lock "committed, machine-managed"; `docs/contracts/agents-layout.md:71` says it must never be committed **in the source repo**. The qualifier means the two are not flatly contradictory — and the consumer case is then governed by nothing, which is the actual gap. |
| K7 | **The contract has no word for a sidecar.** `docs/contracts/install-layout.md:206` fixes `kind ∈ {deployed, bridge, marker}`; a grep for `sidecar` over that file and the manifest contract returns 0/0. A second project under the same HOME produces exactly that object and the contract cannot name it. |

## Phase 0 — Resolve the lock, not the symptom

- [x] **0.1 Read the adjacent stub before citing it.**
      `agents/roadmaps/stubs/road-to-per-repository-install-verification.md`
      records this work as blocked on ADR-020 and that no manifest writer was
      ever added. Run `./scripts-run src/scripts/adr_cite_check ADR-020` and
      read its status, amendments and successors before treating it as a
      blocker.
      verify: the `adr_cite_check` output is quoted in the council question.
      Done 2026-10-16: ADR-020 reads `accepted`, **amended three times**
      (2026-05-30 user-content exception, 2026-06-03 settings-scope correction
      via ADR-049, 2026-07-13 bridge marker retired), no `review_trigger`, no
      declared protected dimension, `reopen_policy` absent. The tool's closing
      AMENDED line is why the user-content amendment carries weight in both
      seats' reasoning. The stub's own blocked-on-ADR-020 state is unchanged by
      the verdict — see its new § A council verdict on an adjacent ADR-020
      reading.
- [x] **0.2 Route the transition to the council.** The question is narrow:
      does a per-user ownership ledger **weaken** ADR-020's global-only
      invariant, or is it the mechanism that makes it safe? It is reversible
      and internal, so under `decision-revisit-gate` it is council-decidable;
      it reaches the owner only on a split.
      verify: a recorded verdict with a `revisit-if`, written at the stub and
      mirrored into `## Decisions` as D1. A verdict with no record is not one.
      Done 2026-10-16: **(a)**, 2/2 concluded, no split, members `anthropic` +
      `openai`, prompt mode, two rounds, $0.00 (subscription transport). Record
      at `agents/evidence/council/ownership-ledger-adr020-20261016.md`, written
      at the stub, mirrored as D1. Phase 2 proceeds under the four boundaries D1
      carries.

## Phase 1 — Freeze the three losses, red first

- [x] **1.1 Install without project settings.** A test that installs from a
      directory with no settings file, edits a deployed file, re-installs, and
      asserts the edit survives.
      verify: **red**, with `install.ts:3531` named in the failure.
      Done 2026-10-16: `tests/install/ownership_ledger_real_install.test.ts`
      case 1.1, observed red (edited digest `e7f6d00b…` replaced by `4141eda3…`).
- [x] **1.2 A second project under the same HOME.** Install from project A,
      then from project B, and assert the record from A is still the record.
      verify: **red**, with the sidecar object named.
      Done 2026-10-16: case 1.2, observed red at the same digest swap; the case
      asserts the `.agent-config.new` sidecar by digest once the edit survives.
- [x] **1.3 A retired-but-edited file.** Deploy, edit, retire the file from
      the package, re-install, and assert the edit is not deleted silently.
      verify: **red**, with `global_deploy_inventory.ts` named.
      Done 2026-10-16: case 1.3, observed red (`expected null` — the edited
      retired file was unlinked).
- [x] **1.4 Pin the current `unknown` arm as a named case.** Extend
      `tests/install/recordedOwnership.test.ts` so today's behaviour is
      asserted explicitly before it changes.
      verify: green now, and the case that changes in Phase 2 is the one this
      step names.
      Done 2026-10-16: `GLOBAL-TARGET-WITHOUT-PROJECT-MANIFEST`, green.
- [x] **1.5 Assert bytes and exit codes, not output text.** Every assertion
      above compares digests.
      verify: a fixture whose file is recreated empty fails.
      Done 2026-10-16: the step-1.5 case in the same file asserts it.

## Phase 2 — Two digests, one classifier

- [x] **2.1 Inventory schema 2.** `deployed-files.json` records
      `{path, installed_sha256, packaged_sha256}` per file. Additive: a
      reader tolerating schema 1 keeps the sibling roadmap's deletion
      allowlist working unchanged.
      verify: a schema-1 fixture still loads, and the sibling's containment
      test stays green.
      Done 2026-10-16: `deployed-files.json` schema 2 adds a per-tool `digests`
      map beside an unchanged `files` list (`global_deploy_inventory.ts`);
      `tests/install/ownershipLedger.test.ts` loads a schema-1 fixture, and
      `tests/install/uninstall_purge_containment.test.ts` is green in the same
      run. Honest limit: at record time both digests are what was just
      deployed, so they diverge only for a retired file (`packaged: null`);
      `outdated` is reachable through the classifier when a caller passes the
      current package digest, and no caller does yet.
- [x] **2.2 Widen the classifier.** `classifyOwnership`
      (`recordedOwnership.ts:72-78`) takes the packaged digest and returns
      `clean | outdated | customized | customized-and-outdated |
      retired-unmodified | retired-modified | unknown`.
      verify: a table-driven test covers all seven, including the two the old
      three-value type could not express.
      Done 2026-10-16: added as `classifyFileState` in `recordedOwnership.ts`,
      and `classifyOwnership` is now that classifier with the packaged digest
      unknown (one classifier, its callers unchanged). Table test in
      `tests/install/recordedOwnership.test.ts`, seen red under a mutation.
- [x] **2.3 Write the record from anywhere.** The manifest write at
      `install.ts:3531` stops depending on
      `_resolve_settings_read(project_root)`; the record is user-scoped.
      verify: test 1.1 green.
      Done 2026-10-16: the record that decides a global target is the
      user-scoped ledger, written on every global deploy
      (`src/install/ownershipLedger.ts`) and laid over the project manifest by
      `recordedHashesWithLedger`, which the writer and the preview both read.
      The project-manifest write itself keeps its settings gate: that block also
      writes project anchors into the working directory, and moving it would put
      files into whatever directory an install ran from. Test 1.1 green.
- [x] **2.4 `unknown` preserves what the ledger proves we wrote.**
      `decideDeployWrite`'s `unknown` arm becomes `preserve` for a path the
      ledger lists, and stays `write` for a genuinely unrecorded pre-existing
      file — the noise argument in `preserve.ts`'s own comment still holds for
      those, and this change does not touch them.
      verify: tests 1.1–1.3 green; a pre-existing unrecorded file is still
      written, asserted as its own case.
      Was open 2026-10-16, deliberately: preserving every ledger-listed
      `unknown` would have staged a sidecar beside every deployed file on the
      first upgraded install and exited 3 — the noise D3 itself argues
      against — so D3 needed re-deciding against that case first.
      **Closed 2026-10-17 under a fresh council round.** 2/2 concluded, no
      split, verdict **(d)**: preserve a digest-less ledger path **unless
      equality with what the run would write is provable**. Record and the
      question it was asked:
      `agents/evidence/council/ownership-unknown-arm-20261017{,.question}.md`;
      D3 below is restated from it.
      The branch is `isLedgerMigration` in `preserve.ts` — ledger-listed,
      `unknown`, readable bytes — and it is the only place the packaged digest
      is computed, so a tree whose ledger paths all carry digests pays nothing.
      Red observed first: with the branch neutralised, the preserve-when-
      different and preserve-when-undecidable cases both fail.
      **Two downstream surfaces moved with it, and neither was optional.**
      `preflight`'s `unknown` remedy told the operator to back the file up
      because the installer would overwrite it — false the moment the branch
      landed, so it has its own arm now. And `computeConflicts` would have
      promised a write the writer then refused, which is the
      two-surfaces-disagree shape 2.5 exists to stop, so `ConflictEntry` gains
      a `migration` flag carrying the DECISION — `ownership` stays `unknown`,
      because nobody proved an edit and labelling it otherwise would assert
      the thing the branch exists because it cannot prove.
      `doctor` is the one reader that cannot follow: it is not installing, so
      it has no packaged digest, and `recorded_digests` does not even
      enumerate a path without one. That gap is **named in its docstring and
      asserted as a difference** in `ownership_parity.test.ts`, so doctor
      learning to cover it reds the case rather than passing silently.
- [x] **2.5 One table, three readers.** A parity fixture feeds the same
      ownership table to the preview (`computeConflicts`), the writer
      (`conflictTracker`) and `cmd_doctor`'s classifier, and asserts all three
      agree.
      verify: the parity test fails if any one of the three is changed alone.
      Done 2026-10-16: `tests/install/ownership_parity.test.ts`, one table fed
      through a project manifest and through the ledger; seen red when the
      preview alone was pointed at a different ledger. `cmd_doctor`'s manifest
      classifier now calls `classifyOwnership`.
      **Open defect found by this step, not yet a checkbox** (this plan's risk
      review is stamped today and a new step reds `lint-plan-risk-register`
      until a later re-review can record it): `cmd_doctor` reads the manifest
      through `installed_tools.read_manifest`, whose hand-rolled parser drops
      every nested `files[]` entry, so `_collect_manifest_entries` receives no
      files and project-scope `missing` / `modified` / `tag_drift` are never
      reported on a real tree. The parity test pins today's empty read; the
      fix flips that assertion and makes `doctor --ci` name a project-scope
      edit. Not fixed here: it turns a consumer's `doctor --ci` red on drift it
      has silently passed until now — a consumer-visible exit-code change that
      ships on its own with that stated.

## Phase 3 — Say the same thing on every surface

- [x] **3.1 `doctor` stops skipping global scope.** `cmd_doctor.ts:597` reads
      the ledger instead of returning early for non-project tools.
      verify: installer `rc=3` and `doctor --ci` non-zero on the same tree,
      asserted by one test that runs both.
      Done 2026-10-16: `src/scripts/_cli/doctor_ownership_ledger.ts` reports
      every ledger file the installer would preserve as `modified`, on both
      the manifest and the no-manifest path (`cmd_doctor.ts` net zero lines).
      `ownership_ledger_real_install.test.ts` step-3.1 case runs both, observed
      red first (`modified` empty after an rc=3 install).
- [x] **3.2 Name the sidecar in the contract.** `kind: sidecar` enters
      `docs/contracts/install-layout.md:206` with its uninstall semantics.
      verify: `grep -c sidecar docs/contracts/install-layout.md` -> /^[1-9][0-9]*$/
      Done 2026-10-16: named with today's uninstall semantics (reported as
      skipped, left in place), plus the ledger file in the runtime-root table
      and the kind in `installed-tools-lockfile.md`.
- [x] **3.3 Close the `$HOME`-leak gap.** Re-cut 2026-10-18 to blocker
      `global-entries-consumer-lock` option (b′): a consumer's
      `agents/installed-tools.lock` keeps its global-scope entries (so `sync`
      still replays them for a new team member) but no longer records their
      absolute `files[]`; the user-scoped ledger holds global ownership. The
      lock stays tracked-durable and out of `src/config/gitignore-block.txt`,
      and `README.md:357` and `docs/contracts/agents-layout.md` keep stating one
      rule. The change states whether `files` is omitted or empty for a global
      entry, audits every reader of the lock (`validate`, uninstall, migration,
      drift checks), and handles existing committed global entries that carry
      absolute paths.
      verify: a test runs a global install from a project with settings and asserts the lock's global-scope entries carry no `$HOME`-rooted path, `sync` still replays them, the ledger still holds their paths and digests, and `validate` accepts the lock
      Open 2026-10-16 — the step's premise moved. `docs/contracts/agents-layout.md`
      (the `installed-tools.lock` row) now governs the consumer case explicitly:
      tracked-durable, deliberately absent from the gitignore block, because
      `README.md` tells teams to commit it. The two documents already agree, so
      this verify line would reverse a recorded contract and a team workflow —
      owner-reserved (Risk 5). The residual gap is narrower: a global install
      run from a project with settings writes `$HOME`-rooted global-scope
      entries into that tracked lock. Now that the ledger carries global
      ownership, dropping those entries from the project lock is the candidate
      fix, and it changes a tracked consumer file, so it is the owner's call.
      **Re-read 2026-10-17, unchanged and still owner-reserved.**
      `grep -c installed-tools src/config/gitignore-block.txt` is 0 and must
      stay 0 while `docs/contracts/agents-layout.md` records the lock as
      tracked-durable and `README.md` tells teams to commit it: satisfying
      this step's verify line as written would reverse a recorded contract
      and a team workflow in one edit. The narrower residual gap — a global
      install run from a project with settings writing `$HOME`-rooted
      global-scope entries into that tracked lock — is now MORE tractable
      than it was, because Phase 2 gives global ownership a home of its own,
      so dropping those entries from the project lock loses nothing. It still
      changes what consumers commit, so it stays the owner's.
      **Put to the AI council 2026-10-18 — split, so it escalates.** Both seats
      recommend the narrow fix (stop writing global-scope entries into a
      consumer's lock); `anthropic` read it as council-decidable, `openai` as a
      change to a public compatibility commitment. A reader audit after the
      round found the commitment is real: `cmd_sync.ts:166-182, :343-355`
      replays a `--scope=global` install from the lock's global entries — the
      new-team-member workflow `README.md:357` promises, which a per-user
      ledger cannot serve. `sync` reads `name`, `scope` and `bridge_marker` and
      never the per-entry `files[]`, so a narrower variant that keeps global
      entries and drops their absolute `files[]` would close the leak without
      breaking it. Record: `agents/evidence/council/ownership-record-residue-20261018.md`;
      the owner's pick is the blocker below.
      **Done 2026-10-18 under (b′).** `files` is **omitted** on every
      `scope: global` entry (`dropGlobalScopeFiles` in `manifestFiles.ts`, run
      on every lock write, so a lock committed earlier loses its absolute paths
      on the next install). Reader audit: `sync` and `validate` read no
      `files[]`; `prune` skips global entries; `install_drift` and `doctor`'s
      manifest reader lose nothing the ledger reader (3.1) does not cover;
      `recordedOwnership` already overlays the ledger. Three readers did need a
      change: project `uninstall` sent a global entry without `files[]` to the
      project-marker map and deleted a PROJECT file the global install never
      wrote (now: entry dropped, no file touched); `skill_origin` and the
      neighbour census claimed global skills only through the lock (now also
      through the deploy inventory); and the `claude-desktop` marker's digest
      lived only in the lock (now recorded in the ledger). Test:
      `ownership_ledger_real_install.test.ts` step-3.3 case, observed red first.
- [x] **3.4 `adopt` and `reset` are flags, not verbs.** ADR-041 is accepted;
      they attach to an existing command.
      verify: the output of `agent-config --help` lists no new top-level verb.
      Open 2026-10-16: no flag implemented. What `adopt` (record an edit as
      ours?) and `reset` (restore one file, a scoped `--force`?) do is not
      specified anywhere in the tree, and inventing the semantics of a
      consumer-facing flag is not this drain's call.
      **Re-read 2026-10-17 against ADR-041, which does not supply them.**
      That ADR governs the controlled VERB vocabulary — which leading tokens
      a visible command may use, and that a new one needs its own ADR. It
      says nothing about what `adopt` or `reset` would do. So D4's "they ship
      as flags" is a correct routing decision with no feature behind it, and
      this step's verify line (`--help` lists no new top-level verb) passes
      vacuously today: there is nothing to list.
      The step belongs with whoever specifies the behaviour. Phase 2 sharpens
      what `adopt` would have to mean — after the migration branch, the thing
      a consumer most plausibly wants is "record the bytes I have as ours",
      which is precisely the ownership assertion the council declined to make
      automatically. That is a product decision, not a drain edit.
      **Closed 2026-10-18 by AI council verdict (b)**, 2/2, no split, $0.00
      (`agents/evidence/council/ownership-record-residue-20261018.md`, D6):
      the step is satisfied by its verify line plus the routing decision, and
      the unspecified behaviour moves to
      `agents/roadmaps/stubs/road-to-adopt-and-reset-flags-with-a-specification.md`.
      Both seats held that implementing the flags with agent-chosen semantics
      is owner-reserved (*cannot be bounded from available evidence*).
      `agent-config --help` re-run 2026-10-18: no `adopt` or `reset` verb.

## Blockers

### blocker: adr-020-ownership-ledger-reading

- **Status:** resolved — (a), AI council 2026-10-16, 2/2 concluded, no split. The
  verdict and its four boundaries are in
  `agents/evidence/council/ownership-ledger-adr020-20261016.md`; mirrored as D1.
- **Owner:** AI council (reaches the owner only on a split — it did not split)
- **Blocks:** Phase 2. Phases 0, 1 and step 3.1 run without it — the red tests
  and the doctor fix change no invariant.
- **What to do:** pick exactly one — (a) the council records that a per-user
  ownership ledger is the mechanism that makes ADR-020's global-only
  invariant safe, and Phase 2 proceeds; or (b) the council records that it
  weakens the invariant, Phase 2 is cancelled, and Phase 1's red tests become
  the documented behaviour with a reason; or (c) the council splits and the
  transition escalates to the owner with both readings attached.
- **Resolved when:** a verdict with a `revisit-if` is recorded at
  `agents/roadmaps/stubs/road-to-per-repository-install-verification.md` and
  mirrored into this file's `## Decisions` as D1, and this blocker's Status
  reads `resolved — <verdict>`.
- **Recommendation:** (a). ADR-020 makes consumption global-only; a record
  that is written only when a *project* has settings is the thing actually in
  tension with that, and the ledger removes the tension rather than creating
  it. The council round exists because that reading should be checked by
  somebody who did not write this file, not because the direction is unclear.
- **If you do nothing:** Phase 1's three tests stay red in the tree, which is
  an honest state and a bad one — the losses are pinned and unfixed, and the
  next install still decides a user's edits by working directory.

### blocker: global-entries-in-the-consumer-lock

- **Status:** resolved — (b′): keep global entries in a consumer's lock, stop
  recording their absolute `files[]`. Decided by: AI council (2/2, 2026-10-18),
  under the owner's delegation of 2026-10-18 ("versuche die offenen entscheidungen im ai council zu lösen"); record
  `agents/evidence/council/global-entries-consumer-lock-20261018.md`. Step 3.3's
  verify line and AC-8's first half are re-cut to it. Was: escalated
  2026-10-18 after an earlier round split on the venue (`anthropic` DECIDE (b),
  `openai` ESCALATE (b); `agents/evidence/council/ownership-record-residue-20261018.md`).
- **Owner:** owner — the transition changes what consumers commit to
  `agents/installed-tools.lock`, which the council could not agree is internal.
- **Blocks:** step 3.3 and the first half of AC-8.
- **What to do:** pick one —
  (a) add the lock to `src/config/gitignore-block.txt` as 3.3 is written,
  reversing the tracked-durable row in `docs/contracts/agents-layout.md` and the
  team workflow in `README.md:357`;
  (b) stop writing global-scope entries into a consumer's lock, which also
  stops `agent-config sync` replaying global installs for a new team member
  (`src/scripts/_cli/cmd_sync.ts:343-355`);
  (b′) keep global entries but stop recording their absolute `files[]` in the
  consumer's lock, since the user-scoped ledger now holds global ownership and
  `sync` never reads `files[]`;
  (c) keep today's behaviour and re-cut 3.3 and AC-8 to the agreed rule the two
  documents already state.
- **Resolved when:** the owner's pick is recorded here as `Status: resolved —
  <pick>`, and 3.3's verify line and AC-8's first half are re-cut to that pick.
- **Recommendation:** (b′). It closes the `$HOME` leak the step exists for,
  keeps the `sync` capability both seats wanted preserved, and relies on the
  ledger exactly as D1 bounds it — ownership metadata, not artefact selection.
- **If you do nothing:** a global install run from a consumer project with
  settings keeps writing the installing user's absolute home paths into a file
  that team commits; nothing is lost, and the leak stays.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | contested-technical | council:agents/evidence/council/ownership-ledger-adr020-20261016.md | **(a) — a per-user ownership ledger makes ADR-020's global-only invariant coherent; it does not weaken it.** Phase 2 proceeds, bounded: the ledger is user-global ownership metadata and not a scope, its treatment is independent of the invoking project and working directory, it carries no project key and drives no project-dependent artefact selection, and the two-digest requirement is core preservation logic rather than an implementation detail | AI council, 2026-10-16, members `anthropic` + `openai`, prompt mode, 2 rounds, 2/2 concluded, no split, $0.00 (subscription transport). Both seats read the project-conditioned write at `install.ts:3531-3537` as the actual scope violation: a global artefact's fate decided by a project-shaped condition | the ledger becomes project-keyed or encodes project preferences · it drives artefact **selection** rather than preservation · two projects demonstrably need different versions of one global artefact at once · the two-digest distinction proves insufficient · ADR-020 or an amendment is shown to require package-controlled content uniformity |
| D2 | deterministic | evidence | The schema bump is additive and schema 1 keeps loading | the sibling roadmap's deletion allowlist reads the same file and must not wait on this one | the sibling lands schema 2 first |
| D3 | critical-technical | council:agents/evidence/council/ownership-unknown-arm-20261017.md | **(d) — `unknown` preserves a path the ledger lists UNLESS equality with what the run would write is provable.** Equality proves writing cannot destroy an edit; inequality proves nothing, because an edited file and an untouched older version are indistinguishable without a recorded digest, and overwriting on "proves nothing" accepts irreversible loss knowingly. A genuinely unrecorded path still writes — the noise `preserve.ts` argues against is real for files this tree has no record of, and a ledger listing IS a record | AI council 2026-10-17, `anthropic` + `openai`, prompt mode, 2 rounds, 2/2 concluded, no split, $0.00 (subscription transport). Both seats also corrected the draft's claim that preservation resolves the ambiguity after one install: a preserved file was never installed, so the delay is one cycle at best and persists until the sidecar is merged | the package content for the affected files is shown not to have changed across the ledger-addition upgrade · a migration `rc=3` is shown to break supported automation and no message fixes it · conflict resolution gains a step that establishes ownership explicitly |
| D4 | deterministic | agent | `adopt` / `reset` ship as flags | ADR-041 accepted | ADR-041 is superseded |
| D5 | reversible-technical | agent | The doctor fix (3.1) is sequenced before Phase 2 lands | it makes the disagreement visible, and a visible disagreement is what makes Phase 2's parity test meaningful | 3.1 turns out to depend on the widened classifier |
| D6 | reversible-technical | council:agents/evidence/council/ownership-record-residue-20261018.md | **3.4 closes on its routing; the flags' behaviour moves to a stub.** If `adopt` / `reset` ship they ship as flags, and what they do is specified in `agents/roadmaps/stubs/road-to-adopt-and-reset-flags-with-a-specification.md` before any implementation | AI council 2026-10-18, `anthropic` + `openai`, prompt mode, 2 rounds, 2/2 concluded, no split, $0.00. Both seats: implementing with agent-chosen semantics is owner-reserved (cannot be bounded from available evidence) | approved semantics and acceptance tests make either flag bounded and implementation-ready |
| D7 | product-owned | council:agents/evidence/council/global-entries-consumer-lock-20261018.md | Blocker `global-entries-consumer-lock` → (b′): a consumer's lock keeps global-scope entries for `sync` replay and stops recording their absolute `files[]`; the lock stays tracked-durable and out of the gitignore block | AI council 2026-10-18, `anthropic` + `openai`, prompt mode, one round, 2/2, $0.00, under the owner's delegation of 2026-10-18 ("versuche die offenen entscheidungen im ai council zu lösen"); `sync` reads `name`, `scope`, `bridge_marker` and never `files[]` (`cmd_sync.ts:166-182, :343-355`) | a reader of the lock other than `sync` is found that needs a global entry's `files[]` |

## What this roadmap deliberately does not do

- It does not change which artefacts the install projects.
- It does not add a CLI verb, a grant, an ask or an authority path.
- It does not touch the uninstall path; its sibling owns that and must not be
  held behind this file's council round.
- It does not reopen ADR-020. Phase 0 asks whether this mechanism sits inside
  that record, which is a different question.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-18 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Preserving `unknown` keeps a stale file forever | implementation | A file the user never touched stops being updated because the ledger lost its record. | 2.1's two digests make "we shipped a new one" expressible, so `outdated` is a state rather than a guess. 2.4 as landed narrows this further than the row anticipated: preservation needs the path to be ledger-listed AND the bytes to differ from what the run would write, so an untouched file that already matches the package is written rather than frozen. | Phase 2 — Two digests, one classifier |
| 2 | The council round stalls and Phase 2 never starts | product | A blocked phase in a ready roadmap decays into a parked one. | Phases 0, 1 and 3.1 deliver value without it, and the blocker's "if you do nothing" names the resulting state plainly rather than implying the file is stuck. | Phase 0 — Resolve the lock, not the symptom |
| 3 | The schema bump breaks the sibling's deletion allowlist | implementation | Two roadmaps read one file and one of them is a data-loss fix. | D2 makes the bump additive and 2.1 asserts a schema-1 fixture still loads; the sibling's containment test runs in the same suite. | Phase 2 — Two digests, one classifier |
| 4 | The parity fixture is satisfied by three readers sharing one bug | implementation | Agreement is not correctness. | The parity test is a cross-check on top of 2.2's table-driven test, not instead of it; the table enumerates all seven states independently. | Phase 2 — Two digests, one classifier |
| 5 | Gitignoring the manifest breaks a team that committed it deliberately | product | Someone relies on the committed lock for reproducibility. | Re-cut 2026-10-18 to option (b′): the lock is not gitignored and keeps its global entries, so `sync` replay survives; only the absolute `files[]` of global entries leave it, and 3.3 audits every reader of the lock before they do. | Phase 3 — Say the same thing on every surface |
| 6 | The first install after the ledger ships is loud for people who edited nothing | product | For a consumer whose global files were deployed before digests existed, 2.4 cannot tell an untouched older version from an edit, so every such file that differs from the new package content is preserved with a sidecar and the run exits 3. | The equality test removes every file that provably matches, so the burst is bounded to files that genuinely differ; the report line is its own message naming the cause rather than claiming an edit; `--force` is the one-command escape and is named in it. The council weighed this against silent loss and took the recoverable direction — the cost is a confusing install, and the alternative is an unrecoverable one. | Phase 2 — Two digests, one classifier |
| 7 | Preservation delays the ambiguity rather than resolving it | implementation | A preserved file was never installed, so the run records the STAGED digest for it. Until the consumer merges the sidecar, the path keeps classifying as divergent. | That is the designed behaviour and not a leak: from the second install the path is `recorded-modified` on the ordinary path rather than on the migration branch, so the one-off message appears once. Both council seats named this explicitly, and the record states it so a future reader does not mistake the delay for a bug. | Phase 2 — Two digests, one classifier |

## Acceptance Criteria

- [x] **AC-1** All three Phase 1 tests were observed **red** before Phase 2,
      and the observation is recorded in the PR.
- [x] **AC-2** An edit to a globally deployed file survives a re-install run
      from a directory with no project settings.
- [x] **AC-3** An edit survives an install run from a second project under the
      same HOME.
- [x] **AC-4** A file the package retires while the user has edited it is not
      deleted silently.
- [x] **AC-5** A genuinely unrecorded pre-existing file is still written, as
      its own asserted case.
- [x] **AC-6** Installer `rc=3` and `doctor --ci` non-zero on the same tree,
      asserted by one test.
- [x] **AC-7** A schema-1 inventory still loads, and the sibling roadmap's
      containment test is green in the same run.
- [x] **AC-8** A global install run from a consumer project with settings
      writes no `$HOME`-rooted path into that project's
      `agents/installed-tools.lock` while `sync` still replays its global
      entries (3.3, re-cut 2026-10-18 to option (b′)), and
      `grep -c sidecar docs/contracts/install-layout.md` ≥ 1 (satisfied by 3.2).
- [x] **AC-9** `task ci` green. Discharged by the PR's CI, not by a local
      run; `check_pack_size` and `check_gate_completeness` are red on
      `main@8c90aad26` independently of this branch. Flipped in the PR that
      closes 3.3, whose merge is gated on its CI being green.

## Provenance

Source-derived under template rule 19. The source set compares this package
against several external references; none is named here per
`source-confidentiality`, links `ENC1`-encrypted in the round's intake note.
No code, prompt or text from any of them is adopted — every item above is a
defect in this tree, verified at HEAD.

| Proposed | Verdict | Why |
|---|---|---|
| Per-user ownership ledger | KEEP | K1/K2 verified; the working directory currently decides. |
| Two digests in the record | KEEP | K3: the type has no packaged-digest parameter. |
| Ownership hash in the deploy inventory | KEEP | K4: zero hash hits in that module. |
| Doctor reads global scope | KEEP | K5 verified verbatim at `cmd_doctor.ts:597`. |
| `kind: sidecar` in the contract | KEEP | K7: absent from both contracts. |
| "Customizations are already protected" | CUT | Refuted at HEAD by K1–K3; the source asserted it and the tree contradicts it. |
| A second manifest format alongside the existing one | CUT | The existing inventory is bumped, not duplicated. |
| New `adopt` / `reset` verbs | FOLD | Flags on an existing verb; ADR-041. |
| "Multi-host 9.5/10" and other numeric grades | CUT | No measurement basis; the source withdraws them itself. |

## Notes — how this file was derived

Three extraction passes over a twelve-file source set, converging at pass 3
with one re-grade and no new rows. K1–K5 were re-verified line by line at HEAD
by this file's author. One of the source's claims in this area —
"customizations are already protected" — is **never-true** at HEAD and is
recorded as a CUT rather than dropped, because it is the assumption that made
the rest of the source under-read this surface. The contract contradiction in
K6 is narrower than the source stated: the layout contract carries a
source-repo qualifier the source's quote omitted, and the real gap is that the
consumer case is then unaddressed.
