---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-n reproduced at d760ecbde that every installed hook command exits 0 with no output when neither a project-local dispatcher nor an agent-config binary on PATH resolves, so on a machine installed through the README's npx line no hook concern runs, the three fail_closed guards included. No active roadmap owns the hook carrier: the closed carrier roadmap covered rule bodies, not hook dispatch. Archiving, parking or merging into road-to-an-installed-layer-that-is-thinned each costs more, because this fix is right under every decision that file waits on and must not wait with it."
relates:
  - slug: road-to-an-installed-layer-that-is-thinned
    relation: extends
    note: "Active. Its thinned layer is only safe on a carrier that cannot fail silently; Phase 3 here is the fail-safe that file's opt-in already needs and does not have."
  - slug: road-to-a-setup-that-decides-itself
    relation: extends
    note: "Added in the same change. Its decision function reads this file's carrier probe (2.1) and demotion state (3.3); it may not promote any machine before Phase 3 here has merged."
  - slug: road-to-skills-that-arrive-when-called
    relation: extends
    note: "Added in the same change. Its materialiser sources from the staged payload of step 1.1 and never from a package-manager cache."
  - slug: road-to-a-rule-carrier-that-works-outside-the-repo
    relation: extends
    note: "Archived. It made rule bodies resolve outside the repository; the hook command that dispatches concerns was outside its scope and still resolves only through a project-local install or PATH."
---
# Road to a hook carrier that is never silent

> **Source:** `agents/tmp.old/inbox-2026-10-n/` — a round of five supplied plans
> and one transcript on loading skills and rules per need without a setting,
> pinned to `main` @ `63407b635` and `17f028941`. Verified against `main` @
> `d760ecbde` on 2026-10-12; the reproduction below ran at that commit.

## Goal

Every hook command the installer writes either reaches the package's dispatcher
in the host's own launch environment, or — where the layer on disk depends on
it — says so in the session and restores the full layer for the next one.
Done means: a stripped-`PATH` launch in a project with no local install reaches
the dispatcher; deleting a package-manager cache breaks no pointer and no
carrier; a dead carrier on a thinned layer is visible in its own session and
followed by a full layer that stays until a successful re-probe.

This file changes no rule form and removes no setting. It is the precondition
for every file that does.

## Context

Reproduced 2026-10-12 at `d760ecbde`, scratch `HOME` under
`agents/runtime/tmp/`, `--global --ai claude-code` install:

- 106 rule files, 369,415 bytes under `~/.claude/rules`; 10 hook commands in
  `~/.claude/settings.json`.
- The installed `SessionStart` command, run with `PATH=/usr/bin:/bin` from a
  project without a local install, printed **0 bytes and exited 0**. The command
  looks for `node_modules/@event4u/agent-config/dist/hooks/dispatch.js` or a
  package checkout under `$CLAUDE_PROJECT_DIR`, then for `agent-config` on
  `PATH`, and otherwise ends in `command -v "$BIN" … || exit 0`
  (`src/scripts/_lib/claude_settings_hooks.ts:129`, `:150`). When a dispatcher
  is found its exit code propagates; the silence is only the no-binary branch.
- The README's install line is `npx -y @event4u/agent-config init`
  (`README.md:26`), which leaves nothing on `PATH`. No step in
  `src/scripts/install.ts` or `src/install/` handles an `npx` cache root
  (grep for `_npx`, `npx-cache`, `npm_config_cache` → 0).
- On such a machine every hook concern is off, including the three
  `fail_closed` ones — `block-no-verify`, `block-kernel-rule-writes`,
  `block-plumbing-writes` (`src/scripts/hook_manifest.yaml:216`, `:234`, `:256`).
  Today the full rule bodies are what keeps those sessions governed.
- Thinned-stub body pointers are absolute and rooted at the package the install
  ran from (`agents/evidence/analysis/thinned-layer-composition-2026-10.md`),
  which on an `npx` install is a cache the package manager may clear.

Silence on a full layer is correct and stays: it is what keeps an uninstalled
repository from being spammed. Silence on a thinned layer would cost every
routed rule body with nothing in the session saying so.

## Phase 0 — Measure the carrier where it actually runs

- [x] **0.1 One carrier census.** Scratch-`HOME` install per install path
  (checkout, `npm i -g`, `npx`): hook command tails, whether each reaches the
  dispatcher under the launcher's `PATH` and under `PATH=/usr/bin:/bin`, the
  package root the stubs point at, and whether that root sits under a
  package-manager cache. One deterministic report under `agents/evidence/analysis/`.
  verify: two runs at one commit are byte-equal; the `npx` row records the real
  cache path, or records that `npx` did not place the root in a cache.
  Done as `src/scripts/hook_carrier_census.ts` →
  `agents/evidence/analysis/hook-carrier-census-2026-10.md`, pinned byte-equal by
  `tests/scripts/hook_carrier_census.test.ts`. The `npx` root was observed live on
  2026-10-18 (npm 11.19.0) at `<cache>/_npx/4297e1a784ff86d4/node_modules/@event4u/agent-config`;
  with a global install on `PATH` the same command ran the global binary and
  placed nothing in the cache. The cells use a stand-in dispatcher, so they
  measure resolution only; the real bundle was reached separately (see 2.1).
- [x] **0.2 First-host probes**, rows in the shape of
  `src/config/host-injection-effect.json` with host version, transcript pointer
  and expiry, `unobserved` until observed: (a) plain stdout from a shell branch of
  a `SessionStart` command reaches the model, and the documented 10,000-character
  cap holds; (b) the `PATH` a terminal launch and an app launch hand the hook on
  one machine; (c) a rule file replaced on disk mid-session — what other live
  sessions see on their next load.
  verify: one row per item.
  Done as `src/config/hook-carrier-probes.json`, three rows, all `unobserved`:
  no live-host observation was made in this change. Each row carries its own
  expiry (2027-01-18) and is validated by `recordProblems`.

## Phase 1 — A root the package owns

- [x] **1.1 Stage the runtime under the machine root.** Install stages what the
  carrier and the stubs need — the dispatcher bundle and the rule bodies of the
  running version — under `~/.event4u/agent-config/`, which already holds the
  install state, and every absolute pointer and carrier path resolves there.
  verify: an npx-shaped install fixture, then the cache directory deleted —
  pointers and dispatcher still resolve.
  Done in `src/install/stagedRuntime.ts`, called from the claude-code deploy in
  `install.ts` before the thin pass; stub `Body:` pointers are now rooted at
  `runtime/current/` (`bodyLinkRoot`). Staged: `dist/hooks`, `dist/agent-src`,
  `dist/router.json`, the data files of `src/scripts` (not its TypeScript),
  `src/config`, `package.json`, the node path, and `node_modules/yaml` — the
  one package the bundle still resolves at run time (D7). Tests:
  `tests/install/staged_runtime.test.ts`.
- [x] **1.2 One version on disk.** Upgrade replaces the staged runtime
  atomically (stage, then move); a half-written stage is never the one pointers
  resolve to.
  verify: fault-injection fixture interrupting the stage leaves the previous
  version resolvable.
  `current` is a relative symlink swapped by one rename; a later stage sweeps
  stale `.stage-*`, `.current-*` and `v-*` entries, leaving one version.

## Phase 2 — Absolute paths ahead of `PATH`

- [x] **2.1 The staged dispatcher first.** The hook command tries the staged
  dispatcher with the `node` resolved at install, then today's project-local and
  `PATH` fallbacks, in that order.
  verify: the command run from an empty directory with `PATH=/usr/bin:/bin`
  reaches the dispatcher; a project-local install still wins where present.
  *Correction:* the step's order (staged first) and its verify (project-local
  wins) disagree; the verify is what the code follows — project-local, then the
  staged dispatcher, then `PATH` — which still puts every absolute path ahead of
  `PATH`, as the phase title says (D6). The real bundle, staged from this tree,
  was run under `PATH=/usr/bin:/bin` from an empty directory: `--read-exit`
  reached it, a real `SessionStart` emitted its context, and a `PreToolUse` for
  a commit with `--no-verify` was refused by `block-no-verify` with exit 2.
- [x] **2.2 A probe the other files can read.** `doctor` and the install receipt
  record, per host, whether 2.1's command reached the dispatcher from a stripped
  environment, with the date and package version.
  verify: snapshot per outcome (reached, not reached, not probed).
  The install probes the `SessionStart` command it is about to write (with
  `--read-exit`, so no concern runs) and records `runtime/carrier.json`; doctor
  has a `hook-carrier` check that re-probes. Windows has no `/bin/sh` to probe
  with and records nothing ("not probed") (D9).

## Phase 3 — Silence only where it is free

- [x] **3.1 A visible line on a thinned layer.** When the layer on disk is thinned
  and no dispatcher resolves, the shell branch prints one line — within the cap,
  without `node` — saying routed rule bodies will not arrive and to open them from
  the absolute paths in the stubs. It exits 0; a session is never blocked by it.
  On a full layer the branch stays silent.
  verify: dispatcher removed — thinned layer prints the line, full layer prints
  nothing.
  The branch is in the `SessionStart` command only, so a tool call never prints
  it, and the `runtime/thinned` marker the install writes is what says the layer
  is thinned.
- [x] **3.2 Fail full, in shell.** In the same branch the command restores the
  full layer from the staged copy of 1.1 — only files carrying the package's
  ownership stamp, never removing a file — and marks the machine `demoted`. The
  running session keeps 3.1's line; the next starts full.
  verify: after a dead-carrier session the layer is byte-equal to the full
  fixture of 0.1; a foreign rule file is untouched.
  The staged copy is the installed layer snapshotted after the rewrite and
  before the thin pass, so it is the full layer byte for byte. Each file is
  replaced by an atomic rename; a failed copy keeps the marker, so the line keeps
  printing rather than going quiet on a layer that is still thin.
- [x] **3.3 Demotion is sticky.** A demoted machine is promoted again only after
  an install, upgrade or `doctor` run passes 2.2's probe. No flapping between a
  terminal launch and an app launch.
  verify: state-machine test over alternating alive and dead sessions.
  The install also thins only on a carrier the probe reached (D8), so a machine
  is never thinned onto a dead carrier in the first place; doctor clears a
  demotion on a passing probe and the next install re-thins.

## Phase 4 — Say what changes for machines that were silent

- [ ] **4.1 Declare the behaviour change.** On machines where the carrier was
  absent, Phases 1–2 make every hook concern — the `fail_closed` guards included —
  run for the first time. The release that ships 2.1 names those concerns in its
  changelog as a fix that changes behaviour, and `doctor` prints the carrier
  state and when it last changed.
  verify: the changelog entry names the three `fail_closed` concerns; doctor
  snapshot shows the carrier state.
  *Partial (2026-10-18):* the doctor half is done (`hook-carrier` check,
  `describeCarrierState`, tested). The changelog half is open: release notes are
  generated by `task release` from the commits of the span, and `## [Unreleased]`
  takes no hand entries, so it is verifiable only at the release that ships 2.1.
  The PR that ships 2.1 carries `Consumer-Impact: notice` and names the three
  concerns for that release head.
  *Corrected 2026-10-18:* the release will **not** see that trailer. #2455 was
  squash-merged (`3f8c98e74`), its `Consumer-Impact: notice` sits in an inner
  paragraph, and `parse_impact_trailers` reads only the body's final paragraph,
  which GitHub's squash body makes a `Co-authored-by:` line — measured over
  `16.5.0..origin/main`, 5 squash commits lose their trailer this way, 2 of them
  `notice`. So the changelog half needs the three concerns named in the release
  head by hand, whatever the class. An AI council round the same day split on
  that class (`anthropic`: a `notice` in the curated head; `openai`: a
  `BREAKING_CHANGES.md` Pending row), so no note is placed yet; both seats agree
  a note is owed and the trailer loss is a release-tooling defect. Record:
  `agents/evidence/council/setup-key-removal-release-class-20261018.md`.
  *Re-measured 2026-10-19.* The squash-trailer defect the correction above rests
  on is **fixed** — two parallel runs found this independently, #2479 on one side
  and a re-measurement on the other. `trailer_blocks` in
  `src/scripts/_lib/consumer_impact.ts` now returns every trailer-only paragraph
  of a body rather than the final one, so `parse_impact_trailers` over
  `3f8c98e74` and `3245c7e7c` returns `notice` with `recorded: true` for both —
  the two commits the 2026-10-18 measurement recorded as lost. The next release
  does record #2455 as a `notice`, so the half of the correction that rested on
  the trailer being lost no longer holds.

  **The step does not move, and its reason is now structural rather than a
  tooling defect** — which is the stronger statement, because a fixed tool does
  not unblock it. Released notes render commit **subjects**, and the subject
  naming the three guards is an inner bullet of a squash **body** (`* fix(hooks):
  reach a staged dispatcher ahead of PATH, so block-no-verify,
  block-kernel-rule-writes and block-plumbing-writes run where they were
  silent`), which no generator reads. Naming them therefore needs a curated-head
  line, and `render_release_head` (`src/scripts/release.ts:332`) takes its
  content only from `_derive_head_prefill`, which derives from the git span at
  release time. A grep for a staged or pending surface an earlier change could
  write into returns nothing. So this half is reachable only from a release run,
  a Hard-Floor action no drain lane holds.

  **The class is settled as breaking by D10, and the row exists** — #2491
  (`e8b36d7ce`) placed it. `grep -c 'block-no-verify' BREAKING_CHANGES.md`
  returns 1 on `main`, and the record is
  `agents/evidence/council/hook-carrier-release-note-class-20261019.md`. An
  earlier version of this note claimed otherwise; that grep had run against a
  checkout taken before #2491 merged and the claim was wrong. It is corrected
  here rather than quietly dropped, because the retraction is the useful part:
  a measurement against a tree that moved under the measurer reads exactly like
  a measurement against the tree.

  **One thing about D10 is worth contesting, and it is not its existence.** Its
  own `Resolved when` column records the round as **degraded 1/2**: `openai`
  chose B1 in round one and could not answer round two (codex exit 1);
  `anthropic` moved B2 → B1 in round two. Both seats' *latest* answers are B1,
  which is how the disposition was read. But this package's own doctrine is that
  a degraded council routes a decision to the owner rather than deciding it —
  the same rule that kept three merge-gate PRs from clearing on 2026-10-17 — and
  one seat's round-one answer plus another seat's round-two answer is not a round
  that converged. **This is recorded as a contest of D10's standing, not of its
  content**: B1 may well be right, and the row is in the file either way. What is
  claimed here is only that a 1/2 round is weaker evidence than the decision row
  reads, and that the revisit condition D10 already carries — a full 2/2 round
  returning anything other than B1 — is the thing that settles it.

## Phase 5 — The plugin channel says what it carries

Arrived from round `inbox-2026-10-q` (handoff H1 of
`road-to-an-intake-the-queue-can-carry`). The plugin channel's `hooks/hooks.json`,
generated by `src/scripts/condense.ts`, resolves a dispatcher only through a
project-local npm install or an `agent-config` binary on `PATH`; on a plugin-only
install every one of its ten commands ends in `|| exit 0` and no concern runs, the
`fail_closed` guards included. `.claude-plugin/marketplace.json:8` meanwhile says
existing installs "keep working hooks". The owner chose on 2026-10-14 that the
plugin ships no dispatcher of its own (D4).

- [x] **5.1 Visible no-dispatcher branch.** The generated plugin commands print one
  stderr line naming the missing dispatcher and the `npx` install line, exit
  non-blocking, and emit one session-start context line; blocking stays opt-in.
  The generator in `src/scripts/condense.ts` changes, never the generated file.
  verify: with no project-local install and `PATH=/usr/bin:/bin`, the generated
  `SessionStart` command prints the line to stderr and exits 0.
  *Correction (2026-10-14, at `5a5a71f30`):* `condense.ts` does not build the
  command — it takes it from `build_claude_hook_matrix`
  (`src/scripts/_lib/claude_settings_hooks.ts`), the same string the installer
  writes into `~/.claude/settings.json`, and the host dedupes the two only while
  they are byte-identical (`tests/install/claude_hook_matrix_parity.test.ts`). A
  plugin-only string would double-dispatch every event on a machine carrying
  both. The branch is therefore in the shared command and keyed on
  `CLAUDE_PLUGIN_ROOT`, which the host sets for a plugin's hooks only (D5): the
  settings carrier stays silent, as Phase 3 decides. The line names
  `npm i -g @event4u/agent-config` ahead of the `npx` line, because the `npx`
  line alone leaves nothing on `PATH` until Phases 1–2 land (Context). That the
  host exports `CLAUDE_PLUGIN_ROOT` to the hook process is unobserved here and
  belongs with the 0.2 probes; if it does not, the branch stays silent, which is
  today's behaviour.
- [x] **5.2 A plugin-only test.** One test runs a generated plugin command in a
  temporary directory with no dispatcher and asserts the stderr line; it is seen
  red against today's `|| exit 0` before 5.1 lands.
  verify: the test fails on the pre-5.1 generator and passes after it.
  Done as `tests/install/plugin_hook_no_dispatcher.test.ts`, run against the
  shipped `hooks/hooks.json`; red on the old generator (two of three cases,
  empty stderr), green after it.
- [x] **5.3 The marketplace sentence states the dependency.** The description in
  `.claude-plugin/marketplace.json` and the pointer skill
  `.claude-plugin/skills/install-agent-config/SKILL.md` say hooks run only
  alongside an npm install, and no longer claim that existing installs keep
  working hooks; both are edited at their generator source in `condense.ts`.
  verify: `cat .claude-plugin/marketplace.json .claude-plugin/skills/install-agent-config/SKILL.md | grep -c 'keep working hooks'` -> /^0$/
  *Correction:* only the pointer skill is generated by `condense.ts`
  (`PLUGIN_POINTER_SKILL_BODY`); `marketplace.json` has no generator — the
  release flow bumps its versions in place — so its description was edited
  directly.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | Repairing the carrier ships as a declared fix, not behind an owner decision | The silent branch exists to spare uninstalled repositories; a governed install whose guards never run is the defect, and restoring them changes no rule form | a consumer reports a `fail_closed` refusal that was correct to suppress |
| D2 | reversible-technical | agent | No daemon watches carrier health | The hook command runs in shell on every event, which already is the check; supervision would add a process for nothing | a host stops invoking hook commands in a way the shell branch cannot see |
| D3 | reversible-technical | agent | Restore adds files and never removes one | Removal under a live session is the one write that can hurt another session on the machine | probe 0.2 (c) shows replaced files are not picked up at all, making restore moot |
| D4 | product-owned | owner | The plugin channel ships no dispatcher of its own: its no-dispatcher branch becomes visible and the marketplace text stops claiming working hooks (Phase 5); no release-asset archive, no resolution from the npm package at hook time | Owner answer 2026-10-14, option (c), after the AI council (anthropic + openai, 2/2, both (c), both owner-reserved because it withdraws a public statement); the channel is DEPRECATED as a content channel, and a dispatcher fetched at hook time would put network and latency where enforcement must be deterministic | material plugin-only usage is measured, or a self-contained integrity-verified carrier needs no network at hook time |
| D5 | reversible-technical | agent | The plugin's no-dispatcher notice lives in the command shared with the settings carrier and is keyed on `CLAUDE_PLUGIN_ROOT` | The host dedupes plugin and settings hooks only on byte-identical command strings (`claude_hook_matrix_parity.test.ts`); a plugin-only string would run every concern twice where both are installed, and the env key keeps the settings carrier silent as Phase 3 requires | probe 0.2 shows the host does not export `CLAUDE_PLUGIN_ROOT` to plugin hook processes, or dedupe stops being string-based |
| D6 | reversible-technical | agent | The hook command tries project-local, then the staged dispatcher, then `PATH` | Step 2.1's own verify requires a project-local install to win; the phase's point — absolute paths ahead of `PATH` — holds either way, and a project pinning a version must keep it | a project-local install is found to shadow a newer staged guard in a way that matters |
| D7 | reversible-technical | agent | The staged runtime carries the bundle, `dist/agent-src`, the data files of `src/scripts`, `src/config`, `package.json`, and `node_modules/yaml` | Measured by running the real bundle from a stage: it reads `src/scripts/hooks/host_lowering.yaml` and resolves `yaml` through a `createRequire` the bundler did not inline; the rest of `src/scripts` is 27 MB of TypeScript the bundle already contains | a concern reads a package file outside the staged set, or the bundle stops resolving `yaml` at run time |
| D8 | reversible-technical | agent | The install thins only on a carrier the stripped-environment probe reached | A layer thinned onto a dead carrier would print 3.1's line and restore at the next session — a thin that is undone before it is used; refusing it up front is the same outcome without the round trip | the probe reports not-reached on a machine whose real launcher does reach the dispatcher |
| D9 | reversible-technical | agent | On Windows the install and doctor do not probe, and thinning keeps its earlier behaviour | There is no `/bin/sh` to run the probe with; recording "not reached" would be a measurement that was never taken | a Windows host is found to run the hook commands through a shell the probe can use |
| D10 | contested-technical | council:hook-carrier-release-note-class-20261019 | The #2455 behaviour change is released as breaking: a `BREAKING_CHANGES.md` Pending row naming the three `fail_closed` guards, moved into the per-major table and a `### Breaking` entry by the release that carries it | Second round 2026-10-19: `anthropic` moved B2 → B1 on the new input (#2479 fixed the trailer loss; ADR-290 makes the next release a major anyway); `openai` chose B1 in round one and could not answer round two (codex exit 1). Both seats' latest answers are B1; the round itself was degraded 1/2 | a full 2/2 round returns anything other than B1, or the release carrying the row is cut as a minor |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-14 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Guards start refusing on machines that never saw them | product | A consumer whose carrier was silent meets a `fail_closed` refusal for the first time after upgrade. | 4.1 names the concerns in the changelog; doctor prints the carrier state. | Phase 4 — Say what changes for machines that were silent |
| 2 | Launch environments differ on one machine | implementation | A session launched where the carrier is dead meets a layer another session left thinned. | 2.1 removes the `PATH` dependency; 3.1 covers the remainder; 3.3 keeps demotion sticky. | Phase 2 — Absolute paths ahead of `PATH` |
| 3 | Restore writes into a directory other sessions read | implementation | A full-layer restore lands while a second session is live. | 3.2 only adds owned files; probe 0.2 (c) measures pickup first. | Phase 3 — Silence only where it is free |
| 4 | Plugin-only sessions start printing a line on every event | product | 5.1 makes a previously silent branch talk; a line per hook event would be noise on every tool call. | 5.1 prints on stderr only, and the context line fires once at session start; the test in 5.2 pins the shape. | Phase 5 — The plugin channel says what it carries |

## Acceptance Criteria

- [x] AC-1 — With `PATH=/usr/bin:/bin` and no project-local install, every
  installed hook command reaches the dispatcher.
- [x] AC-2 — With the package-manager cache of an `npx` install deleted, every
  stub pointer and carrier path still resolves.
- [x] AC-3 — On a thinned layer a dead carrier prints 3.1's line; on a full layer
  nothing prints.
- [x] AC-4 — A dead-carrier session is followed by a full layer that stays until
  2.2's probe passes again.
