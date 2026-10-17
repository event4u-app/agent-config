---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-t verified at 5fa963cec that `_remove_global_content` resolves a host anchor from USER_SCOPE_PATHS and calls `fs.rmSync(target, {recursive: true, force: false})` on it (cmd_uninstall.ts:280-284), so `uninstall --global --purge` deletes everything under `~/.claude/`, `~/.codex/` and the other registered anchors — including files this package never wrote, among them a host's own credentials file. No active, parked or stub roadmap owns it: a grep over agents/roadmaps/{*,later,stubs} for cmd_uninstall, --purge, USER_SCOPE_PATHS and deployed-files returns nothing, and `ls tests/install/` shows 47 test files of which zero are uninstall-shaped. Archiving or parking costs more because the loss is irreversible and lands on data outside this package's ownership; merging into road-to-an-ownership-record-that-belongs-to-the-user would put the only data-loss path in the round behind that file's council round on ADR-020."
relates:
  - slug: road-to-an-ownership-record-that-belongs-to-the-user
    relation: disjoint
    note: "Both read the deployed-files inventory. This file reads it as a deletion allowlist at schema 1; that file bumps the schema additively and declares the edge. Nothing here waits on it — the data-loss fix must not sit behind that file's council round."
  - slug: road-to-gates-that-run-where-the-consumer-stands
    relation: extends
    note: "Phase 0 adds the first uninstall-shaped case to the real-install harness that file generalises. It builds no new harness."
  - slug: road-to-an-installed-layer-that-is-thinned
    relation: disjoint
    note: "Owns what the install projects. This file owns what the uninstall removes and touches no projection logic."
---
# Road to an uninstall that only removes what it brought

> **Source:** `agents/tmp.old/inbox-2026-10-t/topic-2/` — two transcripts and
> ten supplied plans from parallel sessions, pinned at `main@9a43fabe5`,
> `main@9b6ff1a5b` and `main@73eb69439`, all ancestors of HEAD. Re-read at
> `main@5fa963cec` on 2026-10-16.

## Goal

`uninstall --global --purge` removes only the files this package's own
inventory proves it wrote, and never recursively deletes a directory it does
not own. A consumer who uninstalls this package still has the rest of their
host configuration, byte for byte.

## Prerequisites

- `npx vitest` runs locally. Every test below drives the real CLI through
  `spawnSync` with an **explicitly injected** `HOME`.

## Context — read at `main@5fa963cec`

| # | Defect | Evidence |
|---|---|---|
| H1 | **`--purge` recursively deletes a host anchor.** `_remove_global_content` takes `anchor = USER_SCOPE_PATHS[tool]`, resolves `target = expanduser(anchor)` and, under `--purge`, runs `fs.rmSync(target, { recursive: true, force: false })` (`src/scripts/_cli/cmd_uninstall.ts:280-284`). The anchors are whole host configuration roots (`src/install/install.ts:1682`). Everything under them goes, whoever wrote it — a host's own credentials file included. There is no inventory read anywhere in the function. |
| H2 | **Nothing in the test suite covers it.** `tests/install/` holds 47 files, five of them ownership- or preserve-shaped; **zero** are uninstall- or purge-shaped. The behaviour has never been pinned in either direction. |
| H3 | **The non-purge path advertises the purge.** Without `--purge` the function returns `"<anchor> preserved (pass --purge to delete)"` (`:277`) — the message points the user at the destructive path as the way to finish the job. |
| H4 | **The published claim is wider than the evidence.** `README.md:58` advertises a surgical uninstall; `docs/CLAIMS.md` records `surgical-uninstall` as backed, and `docs/proof.md:112-119` records that **18 of 62** backed claims carry `exec:` evidence while the other 44 rest on a pointer. ~~This claim is in the 44.~~ **Wrong, corrected 2026-10-17 at 2.2:** `surgical-uninstall` has carried an `exec:` pointer since 2026-10-01 and was one of the 18 all along. What was actually missing is a claim about the PURGE at all — the README line's scope and the behaviour had no overlap, which is the defect H4 was reaching for. |

**Not reproduced, deliberately.** The supplied source carries a shell script
whose uninstall half runs this path against `$HOME`. It was read and **not
run**: a single imperfect `HOME` override destroys the operator's real host
configuration, which is exactly the failure under test. The static reading
above is sufficient to act on, and Phase 0 is how the behaviour gets exercised
safely.

> **Phases 0 and 1 shipped out of band on 2026-10-16**, on the owner's
> direction: the data-loss path was taken out of the roadmap queue and fixed
> as its own change rather than waiting for a slot.
> `tests/install/uninstall_purge_containment.test.ts` was observed **red**
> against `26c06aef7` — `.credentials.json was deleted`, plus the refusal arm
> — and green after the fix. An end-to-end run of the owner's own reproduction
> script against the fixed tree confirms it where it counts:
> `U2 rc=0 own_rule=kept credentials=kept`, against an expectation line that
> predicted `DELETED`.
>
> **That run also found what this file had wrong.** Step 0.2 recorded the
> two-step case as answered "still possible"; that is true of the deletion
> FUNCTION and false of the CLI, because `uninstall --global` deletes the
> lockfile and a second invocation then exits before reaching the purge at
> all. Pre-existing, not caused by the fix — the script's own expectation line
> predicted `purge_after_rc=1` before it.
>
> **The step that finding produced is now **1.5** below.** It could not be a
> checkbox on 2026-10-16 and that was a gate limitation rather than a
> judgement: `lint_plan_risk_register` compares a plan against the blob at
> the commit that introduced its current `reviewed:` date, and its marker
> grammar accepts only a bare date, so a plan created and stamped the same
> day cannot record a same-day re-review. The next touch of this file is
> 2026-10-17, the marker carries that date honestly, and the step is in its
> proper place.

## Phase 0 — Freeze the loss before changing it

- [x] **0.1 Write the containment test, red first.** New
      `tests/install/uninstall_purge_containment.test.ts`, beside
      `tests/install/installed_layer_ownership_real_install.test.ts`, driving
      `cmd_uninstall` through `spawnSync` with `env: { HOME: mkdtempSync(…) }`
      — injected explicitly, **never** inherited and never set by a shell
      assignment. Seed the fixture HOME with a file this package never wrote,
      a credentials-shaped file, a foreign plugin directory and a symlink
      pointing out of the anchor.
      verify: the test is **red** and its failure names
      `cmd_uninstall.ts:283`. A test that passes here has not reproduced the
      defect and is not evidence.
- [x] **0.2 Pin the two-step case, at the level the test reaches.** `uninstall --global` followed by
      `uninstall --global --purge`: assert the second invocation is still
      possible, i.e. the first does not remove the record the second needs.
      verify: red or green, recorded either way — this one is a genuine
      unknown and the test is how it stops being one.
- [x] **0.3 Assert bytes, not existence.** Every foreign-file assertion
      compares a digest taken before the run, so a file that is deleted and
      recreated empty fails.
      verify: a deliberately mutated fixture file fails the assertion.

## Phase 1 — Purge from the inventory, never from the anchor

- [x] **1.1 Read the inventory.** `_remove_global_content` loads
      `~/.event4u/agent-config/deployed-files.json` through
      `src/scripts/_lib/global_deploy_inventory.ts` and deletes only the
      relative paths it lists, resolved under the anchor.
      verify: Phase 0.1 green; the seeded foreign files are byte-identical
      after the run.
- [x] **1.2 Prune only directories this package created, and only when
      empty.** No recursive directory removal survives in the file.
      verify: `grep -c 'rmSync(target, { recursive' src/scripts/_cli/cmd_uninstall.ts` -> /^0$/
      returns 0.
- [x] **1.3 A missing or unparseable inventory refuses.** Exit 1 with a
      one-line reason naming the file. There is no fallback that deletes the
      anchor — a fallback is how this defect would come back.
      verify: a fixture with the inventory removed exits 1 and deletes
      nothing.
- [x] **1.4 Reword the preserved-path message.** `:277` names the inventory
      scope rather than offering a recursive delete.
      verify: the string no longer reads as an instruction to delete the
      anchor.
- [x] **1.5 Stop the plain uninstall consuming the record the purge needs.**
      `uninstall --global` then `uninstall --global --purge` yielded
      `plain_rc=0 purge_after_rc=1 files_left=892`: the first call deleted the
      lockfile, the second found no tools and exited before the purge ran, and
      892 deployed files stayed on disk with no command left that would remove
      them. Either the plain uninstall keeps the lockfile while recorded
      content is still on disk, or it says in one line that `--purge` must come
      first. Verify at **CLI level**, not function level — that distinction is
      what 0.2 got wrong.
      verify: `npx vitest run tests/install/uninstall_lockfile_retention.test.ts` -> 0
      > **Landed 2026-10-17, both allowed outcomes taken.** The lockfile is
      > kept whenever a tool's anchor still holds a file the inventory records
      > — `_tools_with_recorded_content_left` in `cmd_uninstall.ts` — and the
      > kept-lockfile line names `--purge` as what removes the rest. Nothing
      > widened what may be deleted: a purge without a record still refuses,
      > which is risk 5's condition.
      >
      > The same block held a second instance of the identical defect, found
      > while fixing this one and fixed with it: a purge that REFUSED still
      > reached the lockfile delete, so the one state in which the record
      > matters most destroyed it. A refusal now keeps the lockfile too.
      >
      > Four CLI-level cases in
      > `tests/install/uninstall_lockfile_retention.test.ts`, three of them
      > seen red first; the fourth is the polarity case — the lockfile IS
      > deleted once nothing recorded is left on disk — which passed before
      > and after, so the fix cannot be "never delete it".

## Phase 2 — Make the published promise match the behaviour

- [x] **2.1 Scope the README claim.** `README.md:58` states what the uninstall
      covers and what it leaves, in the terms Phase 1 actually implements.
      `docs/CLAIMS.md` stays consistent in the same change.
      verify: `./scripts-run src/scripts/build_proof` -> 0
      > **Landed 2026-10-17.** The bullet gains a second sentence: under
      > `--purge` only the files the deploy inventory recorded are deleted,
      > never the anchor, and a purge with no inventory refuses.
- [x] **2.2 Give `surgical-uninstall` an `exec:` pointer.** The claim gains
      evidence pointing at the Phase 0 tests, moving it out of the 44
      pointer-only claims.
      verify: `docs/proof.md`'s exec share rises from 18/62 and the new
      figure is the one written, not a predicted one.
      > **Landed 2026-10-17, with H4's premise corrected.** H4 recorded
      > `surgical-uninstall` as one of the 44 pointer-only claims. It is not
      > and was not: its evidence has read
      > `exec:vitest run tests/lib/json_pointers.test.ts
      > tests/lib/host_hook_merge.test.ts -> 0` since 2026-10-01, so it was
      > already one of the 18. Appending the uninstall suites to that command
      > would therefore have moved no share at all, and would also have
      > widened one claim across two mechanisms that fail independently —
      > JSON-pointer ownership of KEYS in a shared file, and inventory-bounded
      > deletion of FILES under a shared directory.
      >
      > The purge property is its own ledger entry instead,
      > `uninstall-purge-inventory-bounded`, markered in the same README
      > bullet and carrying
      > `exec:vitest run tests/install/uninstall_purge_containment.test.ts
      > tests/install/uninstall_lockfile_retention.test.ts -> 0`. `build_proof`
      > then WROTE **19 of 63** — the measured figure, not a predicted one —
      > and `check_claims` passes with 11 markers bound. The derived
      > denominator in `internal/reports/exec-evidence-feasibility.json` is
      > bumped 62 → 63 in the same change, because `check_claims` gates it
      > against the live ledger; `exec_feasible` and `delta_pp` stay frozen,
      > which that file's own convention requires.
- [x] **2.3 Name the behaviour change for machines that already purged.** A
      `BREAKING_CHANGES.md` row, because a user relying on the recursive
      delete gets less after this change.
      verify: the row exists and names the old and new scope.
      > **Landed 2026-10-17 as a pending row, which is a shape the file did
      > not have.** Its table is one row per released major and the break has
      > shipped in no release; inventing `17.0.0` would pin a release target.
      > A `## Pending` section above the table carries the row with its
      > landing dates instead, names old scope and new scope, and says the
      > release that carries it moves the row down. `CHANGELOG.md` was not
      > the alternative: its `## [Unreleased]` section states in the file
      > that an entry belongs under a dated release section, not there.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | critical-technical | evidence | The inventory is a deletion **allowlist**; an absent inventory refuses rather than falling back | the fallback is the defect: any path that deletes the anchor when the record is missing reproduces H1 on the first corrupt file | the inventory becomes reconstructible from a source the uninstall can trust |
| D2 | critical-technical | agent | The historical reproduction is **not** re-run; the static reading is the evidence | running it risks the operator's real host configuration, which `non-destructive-by-default` makes a Hard-Floor action | it is run inside a container with no host mount |
| D3 | deterministic | evidence | Phase 0 writes against inventory schema 1, not the two-digest schema its sibling introduces | the containment property does not need the packaged digest, and waiting would hold a data-loss fix behind a council round | schema 1 stops recording the relative paths |
| D4 | reversible-technical | agent | The fix ships before the claim correction, not after | a correct claim over broken behaviour is still broken behaviour | — |

## What this roadmap deliberately does not do

- It does not change what the install writes, only what the uninstall removes.
- It does not add the packaged digest or the ownership states — that is its
  sibling, and this file must not wait for it.
- It does not run the supplied reproduction script.
- It does not add a CLI verb or a flag beyond the existing `--purge`.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-17 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The containment test's `HOME` override leaks and the suite deletes a real host configuration | implementation | The test exercises a recursive delete; an inherited `HOME` turns the test run into the incident. | `env:` is passed explicitly to `spawnSync`, never a shell assignment; the fixture root is asserted to be under the temp dir before the CLI is invoked, and the test fails closed if it is not. | Phase 0 — Freeze the loss before changing it |
| 2 | The inventory is incomplete, so purge leaves this package's own files behind | implementation | A file written outside the inventory survives an uninstall and looks like the package did not uninstall. | 1.3 refuses on a missing inventory rather than guessing; leftovers are a visible, recoverable failure while the current behaviour is an invisible, irreversible one. | Phase 1 — Purge from the inventory, never from the anchor |
| 3 | A user relying on the recursive delete reports a regression | product | Someone used `--purge` as a host-config reset. | 2.3 names it in `BREAKING_CHANGES.md` — landed 2026-10-17 as a pending row naming old and new scope; the host's own tooling owns that reset, not this package. | Phase 2 — Make the published promise match the behaviour |
| 4 | A level-confusion makes a green case read as a working flow | implementation | 0.2's unit case passes while the CLI flow it appears to cover does not — measured, `purge_after_rc=1` with 892 files left. A reader takes the green as coverage of the flow. | The case's own comment states the level it reaches and now points at the CLI suite beside it. **Discharged 2026-10-17:** `uninstall_lockfile_retention.test.ts` drives `main()` with real argv, so the flow has a case of its own and a regression of it reds there rather than hiding behind a unit green. | Phase 0 — Freeze the loss before changing it |
| 5 | Fixing 1.5 reintroduces an over-broad delete | implementation | The obvious repair — let the purge run without a lockfile — is the "delete when the record is missing" shape Phase 1 exists to remove. | 1.5's two allowed outcomes are *keep the lockfile* or *say `--purge` must come first*; neither widens what may be deleted. **Discharged 2026-10-17:** both were taken, the refusal path is untouched, and the CLI suite asserts a purge with no record still exits 1 having deleted nothing — including the lockfile. | Phase 1 — Purge from the inventory, never from the anchor |

## Acceptance Criteria

- [x] **AC-1** After `uninstall --global --purge` in a fixture HOME, every
      seeded file this package did not write is byte-identical to its
      pre-run digest. Asserted by digest, not by existence, in
      `uninstall_purge_containment.test.ts`.
- [x] **AC-2** `grep -c 'rmSync(target, { recursive' src/scripts/_cli/cmd_uninstall.ts`
      returns 0, and no other recursive anchor delete exists in that file.
      It returned **1** until 2026-10-17, and the hit was the docstring
      quoting the construct it had removed. The comment now spells the old
      call out in prose and says why, so the grep measures survivors rather
      than mentions. The one remaining `rmSync(…, { recursive: true })` in the
      file deletes a path listed in the PROJECT manifest's `files[]`, which is
      a recorded artefact and not an anchor.
- [x] **AC-3** With the inventory absent, the command exits 1 and the fixture
      tree is unchanged. Asserted in both suites — the deletion function's
      refusal arm, and the CLI-level case that also pins the lockfile
      surviving a refusal.
- [x] **AC-4** The containment test was observed **red** against the
      pre-change code, and the observation is recorded in the PR.
      `uninstall_purge_containment` was red at `26c06aef7`
      (`.credentials.json was deleted`); `uninstall_lockfile_retention` was
      red on three of its four cases before 1.5.
- [x] **AC-5** `surgical-uninstall` in `docs/CLAIMS.md` carries an `exec:`
      pointer, and `docs/proof.md` reports a measured exec share above 18/62.
      It already carried one, which 2.2 records as a correction to H4; the
      purge property is the new exec-backed entry, and `build_proof` wrote
      **19 of 63**.
- [x] **AC-6** `task ci` green. Discharged by the remote run, which is the
      authoritative gate: PR #2450 settled **GREEN on 50 of 50 checks at
      `2fea377b7`** on 2026-10-17. Three checks were red on the first push and
      all three were this plan's own README sentence — the frozen word budget,
      the serial-comma rule, and a `\bexpect` match on the word "expectation"
      in a reworded comment; each is recorded at the commit that fixed it.

## Provenance

Source-derived under template rule 19. The source set compares this package
against several external references; none is named here per
`source-confidentiality`, and the retained links are `ENC1`-encrypted in the
round's intake note. No code, prompt or text from any of them is adopted —
every item below is a defect in this tree.

| Proposed | Verdict | Why |
|---|---|---|
| Inventory-driven purge | KEEP | H1 verified at `cmd_uninstall.ts:280-284`. |
| Red test before the fix | KEEP | H2: zero of 47 install tests touch this surface. |
| Two-step uninstall case | KEEP | The source marked it unverifiable; 0.2 is how it is answered. |
| Run the supplied reproduction script | CUT | Its uninstall half deletes `$HOME` content; D2 records the refusal. |
| Build a new consumer-scenario harness | FOLD | `tests/install/` already runs real installs in a throwaway HOME; the sibling roadmap generalises it. |
| Numeric maturity grades for the package | CUT | No measurement basis; the source withdraws them itself. |

## Notes — how this file was derived

Three extraction passes over a twelve-file source set, converging at pass 3
with one re-grade and no new rows. H1 was re-verified line by line at HEAD by
this file's author, not inherited from the source. H2's count comes from
`ls tests/install/`. The supplied plans proposed running their own
reproduction script; that was refused, and the refusal is D2 rather than a
silent omission.
