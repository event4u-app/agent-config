---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
---
# Road to a cut the upgrader can take

> **Source:** `agents/tmp.old/inbox-2026-10-al/` — a review of `16.5.0` against
> `main@6194e2769` (2026-10-18) and the proposal roadmap it produced, re-verified
> at `384e9e85c9` (17.4.0) on 2026-10-25. Seventeen majors and minors landed in
> between, so most of the proposal had been overtaken; this file carries only
> what was still true, and says below where the rest went.

## Goal

A consumer who upgrades is told what happened: an upgrade that kept the user's
own edits reports a completed upgrade, not a failed step; a default-off feature
costs no settings parse on the hot path; a release that ships a row the
breaking-changes index files as pending is numbered major; and no comment says
`uninstall` removes something it keeps.

## Disposition of the source's defects at `384e9e85c9`

| Source | Verdict | Where it went |
|---|---|---|
| D1 upgrade reports exit 3 as a failed step | still true (cause narrowed by #2590) | step 2.1 |
| D2 default-off egress stage pays the full cascade | still true | step 3.1 |
| D3 settings fixture claims an unreleased key | overtaken by the 17.0.0 cut; delta test green | — |
| D4 bump ignores the Pending table | instance overtaken (17.0.0 was major), mechanism still true | step 1.1 |
| D5 project purge without containment | still true, but unreachable today | step 4.2; the unreachability is `later/road-to-17-0-follow-ups` 3.15 |
| D6 two comments disagree on the staged runtime | still true | step 4.1 |
| D7 `/design-system:sync` links broken; no command link lint | still true, and systemic | `later/road-to-17-0-follow-ups` 6.6 |
| D8 subjects not Conventional Commits | overtaken in practice (599 of 600 since 17.0.0 conform) | declined, see below |
| Phase 2.3 recognise an untouched older version | overtaken by #2590 (the transaction log is the proof) | — |
| Phase 4.2 `doctor` names a stale staged runtime | partly overtaken (`version_skew` in `claude_hook_scope.ts`) | declined, see below |

## Phase 1 — The cut says what it carries

- [x] **1.1 A span that ships a Pending row is a major.** `span_surfaces`
      reads `BREAKING_CHANGES.md` § Pending and reports `pending-breaking` when
      the span carries a row's `Landed` commit (or a row cites none);
      `span_bump` already numbers any major surface major. Lives in
      `_lib/major_surface.ts`, so `release.ts` — above its size ceiling — gains
      no line. `CONTRIBUTING.md` § Versioning policy and the Pending preamble
      name the new trigger.
      verify: the three cases in `tests/lib/major_surface.test.ts` under "a
      Pending row in BREAKING_CHANGES.md is a major surface" pass, and the bump
      suites (`impact_bump`, `release*`) stay green — 421 tests.

## Phase 2 — An upgrade that kept files is not an upgrade that failed

- [x] **2.1 `upgrade` and `update` know exit 3.** The global step's exit 3
      (`EXIT_COMPLETED_WITH_CONFLICTS`) is reported as completed with kept
      files, names the `*.agent-config.new` sidecars and
      `agent-config global --force`, never advises re-running, and passes 3
      through (E2 of the source). `cmd_update` reads it with
      `installCompleted`, so the pin follows the installed version. A genuine
      non-zero still fails the upgrade.
      verify: the two tests under "a global step that kept edited files" in
      `tests/scripts/_cli/cmd_upgrade.test.ts` were seen red without the fix
      (exit 1 where 3 was expected) and pass with it; the decoupling fixture
      that used 3 as an arbitrary failure now uses 4.

## Phase 3 — Off means off on the hot path

- [x] **3.1 One read decides the egress mode.** The fast path skipped the
      settings cascade only when no layer contained the word `egress`; the
      template every project receives opens the key with mode `off`, so each
      hook event parsed every layer and then ran the full cascade, which read
      them again. The mode is now resolved from that single read: each layer
      the cascade would read is parsed once and its `egress` subtree merged in
      the cascade's order with its rule (no layer naming the word stays `off`
      unparsed; a broken layer naming it stays `protect`). A path the cascade
      lists twice is read once, at its last position — under last-writer-wins
      merging `A·D·A` equals `D·A`. Measured on the shipped template: 26.0 ms
      cold / 9.9 ms warm before, 10.6 / 3.2 ms after. The bundle stays under its
      ceiling (1,554,785 B). The latency budget row
      that described a key match the code never made is corrected. Five
      ratification rounds refused earlier designs — a block-only reader
      (indentless sequence, BOM, bare CR, a layer broken outside the block), a
      per-layer skip that judged on one read and resolved on another, and a
      single read that still read the doubly listed canonical layer twice.
      verify: the cases "detects and resolves from one read", "reads every
      layer at most once" and "merges every layer the way the settings cascade
      does" (64 two-layer combinations at two working directories, with a
      user-global `egress` the cascade filters, against `load_agent_settings`)
      in `tests/scripts/hooks/egress_stage.test.ts` were seen red against the
      base, a reversed merge order and an undeduplicated path list, and pass
      with the change; the ratification gate accepts the record
      (`agents/evidence/ratifications/inbox-2026-10-al-am-egress.md`, 2/2).

## Phase 4 — Say the same thing about what lands on the machine

- [x] **4.1 One uninstall contract for the staged runtime.** The code and
      `docs/installation.md` agree that a plain uninstall keeps the runtime
      (the preserved stubs point into it) and `uninstall --global --purge`
      removes it; `src/install/userPin.ts` and step 3.5 of the active
      `road-to-a-setup-that-decides-itself` said otherwise and now say the same.
      verify: no file under `src/` or `agents/roadmaps/` says a plain
      `uninstall` removes the runtime directory.
- [x] **4.2 Project-scope purge holds recorded paths to the project root.**
      `_delete_tool_files` refuses a recorded path that is not strictly below
      the project root, lexically or through a resolved parent, and removes a
      recorded symlink as a link. The manifest reader drops `files[]` today, so
      the CLI does not reach this path; the guard is what holds when 3.15 of
      the follow-ups makes it reachable.
      verify: the test under "project scope --purge holds recorded paths" in
      `tests/scripts/_cli/cmd_uninstall.test.ts` was seen red without the guard
      and passes with it: an outside directory, a path through a symlinked
      parent and the root itself are refused, the inside directory is purged.

## Declined, with the reason

- **A Conventional-Commit check on PR titles (source 1.3, E5).** Every
  non-merge subject from 17.0.0 to 17.4.0 parses (396 of 396), and 203 of 204
  since; the generated notes the check would protect are already grouped.
- **`doctor` names a stale staged runtime against the PATH binary (source 4.2).**
  `claude_hook_scope.ts` reports `version_skew` against the source checkout;
  the PATH-binary half has no observed failure behind it in this round.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The single read resolves a mode the cascade would not | implementation | The egress merge drifts from `load_agent_settings` — a new layer kind, a rename onto the key, a changed merge rule. | A parity test runs 64 two-layer combinations against the real cascade; a rename or a mergeable user-global `egress` would change the cascade and red it. | Phase 3 — Off means off on the hot path |
| 2 | Automation reads exit 3 as a failure | product | A script that treated any non-zero `upgrade` as failed still does, now with an honest message. | 3 is the installer's existing completed-with-conflicts code and `installCompleted` already names it; `cmd_update` reads it the same way. | Phase 2 — An upgrade that kept files is not an upgrade that failed |
| 3 | A Pending row the index forgot to delete forces a major | product | A row whose commit lands in the span reads as shipping. | The cut already skips rows an earlier tag carries; a row left after its major is a fresh-span commit only if re-landed. | Phase 1 — The cut says what it carries |

## Acceptance Criteria

- [x] AC-1 — `agent-config upgrade` whose global step keeps edited files exits 3
      and prints no `step failed`.
- [x] AC-2 — `readEgressMode` reads each settings layer once and never runs
      the cascade, with the change ratified.
- [x] AC-3 — a dry-run bump over a span that carries a Pending row is `major`.
- [x] AC-4 — a project-scope purge never deletes a recorded path outside the
      project root.
