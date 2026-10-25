---
complexity: lightweight
status: ready
estate_offset_exempt: "Owner search before writing: grep -rlF for pendingBreakingLine, doctorShell, _NULL_FORMS, recorded_rel_files and ADR-284 across agents/roadmaps/*.md, later/ and stubs/ returned one file (later/road-to-an-installed-layer-that-is-thinned), which mentions ADR-284 in passing and owns none of these defects. Count half: this file is written, executed and archived in the same change, so active_roadmaps returns to five when the change lands; the owner WIP limit of five (2026-10-24) is held at the end of the change, not only at its start."
execution:
  mode: phase-checkpoints
---
# Road to release notes that say what shipped

> **Source:** `agents/tmp.old/inbox-2026-10-ai/` and `agents/tmp.old/inbox-2026-10-aj/`
> — two external review rounds over releases 17.0.0 and 17.2.0, read in two
> lanes and verified against `d2ec783d95`. Every step below is a claim from those
> rounds that was still true at that SHA, has no owning roadmap, and needs no
> owner decision. Claims that were overtaken, owner-reserved or owned elsewhere
> are dispositioned in § Not in this roadmap.

## Goal

A release's notes name only what that release carries, and the shipped surfaces
that state a requirement agree with the package. Concretely: no `Breaking …
shipped by this release` line names a change an earlier tag already contains;
`doctor` and the install docs ask for the Node floor `engines.node` declares; a
recorded null of the kinds the benches actually emit (`underpowered`, `TIE`)
reaches the `Honest nulls` head field; and `uninstall --global --purge` never
deletes a recorded file whose bytes the user changed.

## Phase 1 — The Pending table stops re-announcing shipped breaks

The two rows that shipped in 17.0.0 (hook carrier `3f8c98e74`, purge scope) were
announced again by 17.1.0, 17.2.0, 17.2.1, 17.3.0 and 17.4.0 (`CHANGELOG.md:420`):
`pendingBreakingLine` copies every `## Pending` row, deleting a row is a hand
step, and the release-PR shape check bars `BREAKING_CHANGES.md` from the cut.

- [x] **1.1 `pendingBreakingLine` drops a row whose cited commit an earlier tag
      already contains.** It takes an `isShipped(sha)` predicate; the release
      caller passes a git ancestry check of the commit against the previous release tag. A row
      citing no commit is kept, so the lint in 1.2 is what makes the filter total.
      verify: `npx vitest run tests/scripts/release_head_prefill.test.ts` -> 0
- [x] **1.2 `lint_breaking_changes_index` refuses a Pending row that cites no
      commit.** The commit is the row's identity for 1.1; a row without one is
      the shape that let the purge row slip past any ancestry check.
      verify: `./scripts-run src/scripts/lint_breaking_changes_index --selftest` -> 0
- [x] **1.3 Delete the two shipped rows; give the two remaining rows their
      commits.** `3f8c98e74` and the purge row are named by the 17.0.0 by-major
      row; `79cb86c0dd` and `a3d4596078` are in no tag.
      verify: `./scripts-run src/scripts/lint_breaking_changes_index` -> 0
- [x] **1.4 Replace the test that pinned the defect.** The real-index test skips
      once the row leaves Pending and so could never go red on a re-announcement;
      it is rewritten to assert that no row the real index keeps under Pending
      cites a commit contained in the newest release tag.
      verify: the rewritten test fails against the index as it stood at
      `d2ec783d95` and passes after 1.3.
- [x] **1.5 Correct the record.** The index prose states that the 17.1.0–17.4.0
      heads re-announced two 17.0.0 breaks they do not carry. It lives in
      `BREAKING_CHANGES.md`, not under `## [Unreleased]`: the changelog
      conventions keep that section empty and released sections fixed.
      verify: `grep -c 're-announced two 17.0.0 breaks' BREAKING_CHANGES.md` -> /^1$/

## Phase 2 — Shipped surfaces state the Node floor the package declares

`engines.node` is `>=22.6.0` (ADR-290). `doctorShell` still passes Node 20
(`src/cli/commands/doctorShell.ts:22`), `docs/installation.md:180,217` say ≥ 18
and ≥ 20, and the npm tarball ships a root `MIGRATION.md` about 9.8.

- [x] **2.1 `doctorShell` reads its floor from `engines.node`.** A hard-coded
      major drifts on every floor change; the check compares full versions, so
      Node 22.5 fails a 22.6 floor.
      verify: `npx vitest run tests/cli/doctorShell.test.ts` -> 0
- [x] **2.2 `docs/installation.md` names Node 22.6 at both doors.**
      verify: `grep -nE 'Node ≥ ?(18|20)' docs/installation.md` -> 1
- [x] **2.3 The shipped root `MIGRATION.md` points at the current migration
      record.** It is in `package.json` `files[]` and opens on 9.8; its 6.0–9.8
      guides are still linked, so it gains a header naming `docs/MIGRATION.md`
      and `BREAKING_CHANGES.md` instead of losing them. `docs/releases.md` linked
      breaking-release notes to the root file and now links `docs/MIGRATION.md`.
      verify: `head -3 MIGRATION.md | grep -c 'docs/MIGRATION.md'` -> /^1$/

## Phase 3 — Recorded nulls the benches emit reach the head

`_NULL_FORMS` (`src/scripts/_lib/release_highlights.ts:185`) misses the two
verdicts the 17.x benches published — the tier-downshift `underpowered` and the
orientation-map `TIE` — so the 17.1.0 and 17.2.0 heads read `Honest nulls: none`.

- [x] **3.1 Add a verdict-bound `underpowered` and a verdict-shaped `tie` to
      `_NULL_FORMS`.** Both are tied to a verdict noun, because the same spans
      carry rule prose ("underpowered data is not ready", "a refused leg leaves
      the cost verdict underpowered"). `inconclusive` was dropped: its one 17.x
      specimen describes a rule. Over 16.5.0..17.4.0 the new forms derive
      `479bcf0`, `d5f7f45` and `84c2421`, all three recorded nulls.
      verify: `npx vitest run tests/scripts/check_release_highlights.test.ts` -> 0

## Phase 4 — The 17.0.0 migration record and its neighbours are true

- [x] **4.1 Say what an existing install must do to get the three guards.** The
      carrier migration cell reads "Nothing to do for the install to keep
      working". Establish from the installer whether an existing global install
      receives the staged-dispatcher hook command on `update` or only on a fresh
      `init`, and write that into `docs/MIGRATION.md` § 17.0.0.
      Done: the hook command is rewritten only by the global deploy
      (`ensure_managed_hooks`, `src/scripts/install.ts:3061`), which
      `agent-config upgrade` (its `install --global` step) and
      `agent-config refresh --global` run; no `postinstall` exists. The two rows
      deleted in 1.3 took their migration text with them, so it moved here too.
      verify: `grep -c 'agent-config refresh --global' docs/MIGRATION.md` -> /^[1-9]/
- [x] **4.2 Stop the credential-read guard's header from promising a backstop
      that ships off.** `block_credential_reads.ts` says the forms it misses
      reach the egress stage; that stage ships `mode: off`.
      verify: the header names the egress default and says the residue is
      uncaught while it stays off.
- [x] **4.3 Hand ADR-284's status to the roadmap that owns ADR-293.** ADR-284
      reads `accepted` with `superseded_by: —` although both keys it acts on
      (`lean_projection.hosts`, `mode: delivery`) were removed by ADR-293, whose
      `supersedes` names only ADR-267 and ADR-278. Marking it superseded here
      would rewrite an owner-and-council record from an inbox claim, so the
      finding is carried as step 4.10 of `road-to-a-setup-that-decides-itself`.
      verify: `grep -c '4.10 Record what ADR-293 did to ADR-284' agents/roadmaps/road-to-a-setup-that-decides-itself.md` -> /^1$/

## Phase 5 — Purge keeps what the user changed

`purge_anchor` (`src/scripts/_cli/cmd_uninstall.ts:359-376`) unlinks every
recorded path without consulting the recorded digests and swallows every per-file
error. `reap_stale` already preserves a file `edited_since_install`.

- [x] **5.1 Purge preserves a recorded file whose bytes differ from the digest
      the ledger recorded, and counts preserved and failed files.** A file with
      no recorded digest keeps today's behaviour.
      verify: `npx vitest run tests/install/uninstall_purge_containment.test.ts` -> 0

## Not in this roadmap

Dispositions for every still-true finding of the two rounds that is not a step
above:

| Finding | Disposition |
|---|---|
| 17.0.0 impact map `notice` vs index `action` | declined — `classifyUpdate` checks `engines.node` locally and returns `action` for the Node floor (`src/scripts/_lib/classify_update.ts:98-105`); the published map is history |
| trailerless breaking commit recorded `none` | owner-reserved — owner ruling on #2567 stands |
| `claude_settings_hooks.ts` / `hooks.json` outside the kernel-edit gate | owned — later/road-to-a-hard-floor-the-shell-cannot-talk-past (Arrivals) |
| `block-no-verify` bypasses (`sh -c`, `eval`, `GIT_CONFIG_*`) | owned — later/road-to-a-hard-floor-the-shell-cannot-talk-past |
| no 17.x release-findings ledger; 16.5.0 HIGH undisposed | declined — owner decision 2026-10-22: a release waits for no review |
| graph-wins reactivation, map usefulness | owned — later/road-to-a-graph-that-wins (Arrivals) |
| skill-trigger coverage toward 80 % (57.5 % now) | owned — later/road-to-a-menu-whose-precision-is-measured (Arrivals) |
| benchmarks steer subagent / council use | owned — later/road-to-evidence-calibrated-model-orchestration (Arrivals) |
| Windows runtime swap not atomic, 22.6.0 CI leg, consumer-matrix `paths`, `RELEASE_PR_TOKEN` environment, removed keys still read, temperature-report claim, home path in `command-surface.json` | owned — later/road-to-17-0-follow-ups (Arrivals + steps) |
| tick-the-shipped-path, free-hands shadow | overtaken — both archived complete |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Filter hides a genuinely pending row | implementation | An ancestry check against the wrong tag drops a row a release does carry | 1.1 tests both a shipped and an unshipped commit; 1.2 forces every row to cite its commit | Phase 1 — The Pending table stops re-announcing shipped breaks |
| 2 | Purge keeps too much | product | Preserving edited files leaves residue after an uninstall | Preserved files are counted and named in the output, so the user sees what stayed | Phase 5 — Purge keeps what the user changed |

## Acceptance Criteria

- [x] AC-1 — No `## Pending` row in `BREAKING_CHANGES.md` cites a commit that a
      release tag contains, and a release head built today names none of them.
- [x] AC-2 — `doctor`, `docs/installation.md` and the shipped `MIGRATION.md`
      state no Node floor other than the one in `engines.node`.
- [x] AC-3 — `uninstall --global --purge` leaves a user-edited recorded file in
      place and says so.
