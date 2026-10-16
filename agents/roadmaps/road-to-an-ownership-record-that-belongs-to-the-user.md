---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-t verified at 5fa963cec that the global deploy manifest is written only when the install ran from a directory carrying project settings (install.ts:3531-3537), that an absent record classifies as `unknown` and `decideDeployWrite` returns `write` for it (preserve.ts, recordedOwnership.ts:57-78), so whether a consumer's edit to a globally installed file survives depends on the working directory the install was run from; that the deploy inventory records relative paths and no digest (global_deploy_inventory.ts, 0 hash hits), so the reaper deletes an edited file the package retires; and that `cmd_doctor.ts:597` skips every non-project-scoped tool, so doctor reports green while the installer reports not-current. No active, parked or stub roadmap owns this: the one adjacent stub, road-to-per-repository-install-verification, is itself blocked on ADR-020 and records that no manifest writer was added. Archiving or parking costs more because the loss is a consumer's own edit and is silent; merging into road-to-an-uninstall-that-only-removes-what-it-brought would put that file's data-loss fix behind this file's council round."
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
- [ ] **2.4 `unknown` preserves what the ledger proves we wrote.**
      `decideDeployWrite`'s `unknown` arm becomes `preserve` for a path the
      ledger lists, and stays `write` for a genuinely unrecorded pre-existing
      file — the noise argument in `preserve.ts`'s own comment still holds for
      those, and this change does not touch them.
      verify: tests 1.1–1.3 green; a pre-existing unrecorded file is still
      written, asserted as its own case.
      Open 2026-10-16, deliberately: tests 1.1–1.3 are green and the unrecorded
      file is asserted written (`ownershipLedger.test.ts`, AC-5), but without
      this arm change. The ledger now records a digest for every path it lists,
      so the only ledger-listed path that still reaches `unknown` is a schema-1
      entry from an install that predates the ledger — and preserving those
      would stage a sidecar beside every deployed file on the first upgraded
      install and exit 3, the noise D3 itself argues against. D3 needs
      re-deciding against that case before this arm changes.
- [x] **2.5 One table, three readers.** A parity fixture feeds the same
      ownership table to the preview (`computeConflicts`), the writer
      (`conflictTracker`) and `cmd_doctor`'s classifier, and asserts all three
      agree.
      verify: the parity test fails if any one of the three is changed alone.
      Done 2026-10-16: `tests/install/ownership_parity.test.ts`, one table fed
      through a project manifest and through the ledger; seen red when the
      preview alone was pointed at a different ledger. `cmd_doctor`'s manifest
      classifier now calls `classifyOwnership`.
- [ ] **2.6 `doctor` reads the project manifest's files at all.** Found by
      2.5: `cmd_doctor` reads the manifest through
      `installed_tools.read_manifest`, whose hand-rolled parser drops every
      nested `files[]` entry, so `_collect_manifest_entries` receives no files
      and project-scope `missing` / `modified` / `tag_drift` are never reported
      on a real tree. The parity test pins today's empty read.
      verify: the pinned `read_manifest` assertion in
      `ownership_parity.test.ts` flips, and `doctor --ci` names a project-scope
      edit.
      Open: fixing it turns a consumer's `doctor --ci` red on drift it has
      silently passed until now — a consumer-visible exit-code change, so it
      ships on its own with that stated, not inside this change.

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
- [ ] **3.3 Close the `$HOME`-leak gap.** Add the manifest to
      `src/config/gitignore-block.txt`, and reconcile `README.md:357` with
      `docs/contracts/agents-layout.md:71` so the consumer case is governed by
      one sentence rather than by neither.
      The two documents state the same rule for the consumer tree.
      verify: `grep -c installed-tools src/config/gitignore-block.txt` -> /^[1-9][0-9]*$/
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
- [ ] **3.4 `adopt` and `reset` are flags, not verbs.** ADR-041 is accepted;
      they attach to an existing command.
      verify: the output of `agent-config --help` lists no new top-level verb.
      Open 2026-10-16: no flag implemented. What `adopt` (record an edit as
      ours?) and `reset` (restore one file, a scoped `--force`?) do is not
      specified anywhere in the tree, and inventing the semantics of a
      consumer-facing flag is not this drain's call.

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

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | contested-technical | council:agents/evidence/council/ownership-ledger-adr020-20261016.md | **(a) — a per-user ownership ledger makes ADR-020's global-only invariant coherent; it does not weaken it.** Phase 2 proceeds, bounded: the ledger is user-global ownership metadata and not a scope, its treatment is independent of the invoking project and working directory, it carries no project key and drives no project-dependent artefact selection, and the two-digest requirement is core preservation logic rather than an implementation detail | AI council, 2026-10-16, members `anthropic` + `openai`, prompt mode, 2 rounds, 2/2 concluded, no split, $0.00 (subscription transport). Both seats read the project-conditioned write at `install.ts:3531-3537` as the actual scope violation: a global artefact's fate decided by a project-shaped condition | the ledger becomes project-keyed or encodes project preferences · it drives artefact **selection** rather than preservation · two projects demonstrably need different versions of one global artefact at once · the two-digest distinction proves insufficient · ADR-020 or an amendment is shown to require package-controlled content uniformity |
| D2 | deterministic | evidence | The schema bump is additive and schema 1 keeps loading | the sibling roadmap's deletion allowlist reads the same file and must not wait on this one | the sibling lands schema 2 first |
| D3 | critical-technical | evidence | `unknown` preserves only paths the ledger lists | a blanket preserve would keep every unrecorded pre-existing file forever, which is the noise `preserve.ts` already argues against | the ledger becomes complete enough that unrecorded means foreign |
| D4 | deterministic | agent | `adopt` / `reset` ship as flags | ADR-041 accepted | ADR-041 is superseded |
| D5 | reversible-technical | agent | The doctor fix (3.1) is sequenced before Phase 2 lands | it makes the disagreement visible, and a visible disagreement is what makes Phase 2's parity test meaningful | 3.1 turns out to depend on the widened classifier |

## What this roadmap deliberately does not do

- It does not change which artefacts the install projects.
- It does not add a CLI verb, a grant, an ask or an authority path.
- It does not touch the uninstall path; its sibling owns that and must not be
  held behind this file's council round.
- It does not reopen ADR-020. Phase 0 asks whether this mechanism sits inside
  that record, which is a different question.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-16 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Preserving `unknown` keeps a stale file forever | implementation | A file the user never touched stops being updated because the ledger lost its record. | 2.1's two digests make "we shipped a new one" expressible, so `outdated` is a state rather than a guess; 2.4 preserves only ledger-listed paths. | Phase 2 — Two digests, one classifier |
| 2 | The council round stalls and Phase 2 never starts | product | A blocked phase in a ready roadmap decays into a parked one. | Phases 0, 1 and 3.1 deliver value without it, and the blocker's "if you do nothing" names the resulting state plainly rather than implying the file is stuck. | Phase 0 — Resolve the lock, not the symptom |
| 3 | The schema bump breaks the sibling's deletion allowlist | implementation | Two roadmaps read one file and one of them is a data-loss fix. | D2 makes the bump additive and 2.1 asserts a schema-1 fixture still loads; the sibling's containment test runs in the same suite. | Phase 2 — Two digests, one classifier |
| 4 | The parity fixture is satisfied by three readers sharing one bug | implementation | Agreement is not correctness. | The parity test is a cross-check on top of 2.2's table-driven test, not instead of it; the table enumerates all seven states independently. | Phase 2 — Two digests, one classifier |
| 5 | Gitignoring the manifest breaks a team that committed it deliberately | product | Someone relies on the committed lock for reproducibility. | 3.3 reconciles the two documents rather than picking a side silently; `installed-tools.lock` and the ownership manifest are different files and the change names which is which. | Phase 3 — Say the same thing on every surface |

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
- [ ] **AC-8** `grep -c installed-tools src/config/gitignore-block.txt` ≥ 1,
      and `grep -c sidecar docs/contracts/install-layout.md` ≥ 1.
- [ ] **AC-9** `task ci` green.

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
