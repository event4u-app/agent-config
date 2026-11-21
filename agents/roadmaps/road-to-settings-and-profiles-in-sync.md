---
complexity: lightweight
status: ready
tree_pin: 811cea61d6
execution:
  mode: autonomous
estate_growth_exempt: "Owner asked on 2026-11-21 to plan and work off every learning of the session retro; this file adds one active roadmap for measure 22 (P2). No active, later or stub roadmap owns a stray-settings report, an unattributed graph-cache sweep or a cross-profile drift report (content grep over agents/roadmaps at 811cea61d6 for '17.3', 'prune-removed', 'code-graph-v1', 'orphan', 'profile drift', 'settings.json copies' found only unrelated mentions)."
estate_offset_exempt: "Same owner request of 2026-11-21; nothing parked or active covers this, so nothing is archived to offset it. The agent-switch-side half (its installer registering hooks twice) belongs to the agent-switch repository and is recorded as an external blocker, not as work here. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
relates:
  - slug: road-to-additive-settings-sync
    relation: extends
    note: "archived, fully done; its user-line-preserving YAML edit is what step 2.3's fold reuses — this file adds a stray-file source and renames, not a new merge engine"
  - slug: road-to-a-link-with-agent-switch
    relation: disjoint
    note: "owns the limits/switch-request link over MCP; this file reads agent-switch's profile directories only to report drift and never calls the link, writes .mcp.json or touches its D1-D5"
  - slug: road-to-gates-that-do-not-trap-the-agent
    relation: disjoint
    note: "owns a sanctioned route to permissions.allow (its E5); this file only counts allow-list differences across profiles and never writes permissions"
  - slug: road-to-an-episode-ledger-with-cost-per-control
    relation: disjoint
    note: "reads each profile's settings.json as-of-analysis to attribute episodes; this file reports drift between those files and shares no output"
# relates: probe — `agent-config roadmap:context --roadmap road-to-settings-and-profiles-in-sync
# --relates` (2026-11-21): 1 hit (archive/road-to-additive-settings-sync, body read).
# The other three rows come from the semantic half: grep -rl over agents/roadmaps for
# the retro's measure-22 terms, bodies of every active hit read.
---
# Road to settings and profiles in sync

> **Source:** owner's session retrospective of 2026-11-21 (about 380 Claude
> Code sessions across six profiles, 643 incidents, three read-only audits),
> measure 22 (P2, "shaky foundation"), and the AI council round of the same
> day (members: anthropic, openai). Council convergence, inlined: anthropic
> ranked the settings/cache drift as a foundation problem to clear before
> layering more controls on it; openai asked that every claim about a blocked
> or drifted state be traced to the concrete file or hook that decided it —
> which is why every command below reports *which file* it read.

## Goal

One agent-runnable command each answers, from the machine's real state,
three questions the retro could only answer by hand: which settings files
are live and how far behind they are (`settings:status`), how much graph
cache on disk belongs to no project (`code-graph cache:prune --dry-run`),
and where the Claude profiles under agent-switch differ in what
agent-config cares about (`profiles:drift`). The settings fix and the cache
sweep apply with one flag after a dry run; the profile report is read-only.
`agent-config doctor` surfaces all three as rows. Nothing here is a
hand-written context file: every report is generated from the disk on each
run.

## Context — verified against the tree at `811cea61d6`

Observed on the owner's machine on 2026-11-21 (live reads, not tree facts):

- Two user-global settings files exist. `~/.agent-settings.yml` (87,836 B,
  first line `agent_config_version: "17.3.0"`) and
  `~/.event4u/agent-config/settings/.agent-settings.yml` (91,609 B,
  `agent_config_version: ''` at line 18). Both last changed 2026-11-10.
- `~/.event4u/agent-config/map` holds 166 MB; the retro audit counts five
  homes there attributed to no project, plus ~285 MB of
  `agents/runtime/state/code-graph-v1.*` in the agent-config checkout, both
  from 2026-10-26 (≈450 MB together).
- Six profiles under `~/.agent-switch/claude/` (ArturB, MBerg, MathiasB,
  MatneX, Matze, MatzeB). The audit found agent-config's managed hooks
  byte-identical in all six, but `agent-switch __hook-event` registered twice
  per event in three profiles, five `settings.json` copies versus one
  symlink, and allow-lists of 56 versus 73 entries.

Tree facts:

- The loader reads user-global settings from `event4u_root()` only —
  `agent-settings.yml` and `settings/.agent-settings.yml`
  (`src/scripts/_lib/agent_settings.ts:189`, `:218`, `:237-251`), with a
  legacy-XDG fallback (`src/scripts/_lib/user_global_paths.ts:130-148`). A
  file named `~/.agent-settings.yml` is a **project-layer** file: it is read
  only when the cwd has no boundary anchor (`agents/` marker or `.git`) in any
  ancestor (`agent_settings.ts:515-535`, cascade `:799-837`). So the 17.3.0
  file is a stray, not the global the retro assumed — UNVERIFIED which
  process emitted the "66 removed keys" warning; step 1.1 measures it.
- `agent_config_version` is a project **pin**, not a stamp
  (`src/config/agent-settings.template.yml:10-18`); the dispatcher re-execs
  via `npx …@<pin>` when it is set and differs
  (`src/scripts/_lib/pin_resolver.ts:1-22`). A pin of `17.3.0` in a file the
  cascade can reach is a downgrade waiting for a cwd without `.git`.
- `upgrade` syncs only `~/.event4u/agent-config/settings/.agent-settings.yml`
  and the project file (`src/scripts/_cli/cmd_upgrade.ts:37-43`, `:446`), so
  a stray file is never synced and never reported.
- `settings:sync --prune-removed` already deletes removed keys line by line
  (`src/scripts/_lib/settings_prune_removed.ts:1-10`,
  `src/scripts/sync_agent_settings.ts:937`); `REMOVED_KEYS` and
  `RENAMED_KEYS` live in `settings_removed_keys.ts:89` and
  `settings_renamed_keys.ts:38`. **Delta:** nothing points the user at the
  stray file, and nothing applies renames.
- `settings:migrate` already exists with a different meaning: it lifts a
  project-local file into the global store, read-only on the source,
  `--dry-run` supported (`src/scripts/_cli/cmd_settings_migrate.ts:1-22`).
- Graph homes: hub `graphsRoot()` plus `legacyGraphsRoot()`
  (`src/scripts/code_graph/graph_home.ts:85-126`); legacy in-repo cache dir
  `LEGACY_STATE_DIR_REL = agents/runtime/state` (`graph_home.ts:32`).
  `code-graph projects prune` drops only **registered** entries whose root is
  stale (`src/scripts/code_graph/projects_cli.ts:145-162`). **Delta:** a home
  no registry entry owns, and a legacy in-repo copy shadowed by a `.build`
  copy, are never swept.
- Profiles: `discover_sources()` already enumerates agent-switch profile
  config dirs (`src/scripts/_lib/session_catalog.ts:429-450`, root
  `AGENT_SWITCH_HOME` or `~/.agent-switch`). Managed hook entries carry
  `MANAGED_SIGNATURE = 'dispatch:hook --platform claude'`
  (`src/scripts/_lib/claude_settings_hooks.ts:53`). `upgrade` hands profile
  distribution to `agent-switch sync --quiet` (`cmd_upgrade.ts:44-46`), and
  `block-config-weakening` refuses agent edits to Class-C keys in
  `.claude/settings(.local).json`, so agent-config **reports** profile drift
  and never rewrites a profile's `settings.json`.
- Consumers without a project `.agent-settings.yml` are the designed state
  under ADR-020 (`docs/decisions/ADR-020-global-only-consumer-scope.md`), not
  drift. No step creates project settings (D3).

## Phase 1 — `settings:status`: which files are live, and how stale

- [ ] **1.1 Failing test first.** Add
      `tests/scripts/_cli/cmd_settings_status.test.ts` with a fixture `HOME`
      holding a canonical global file, a flat global file, a stray
      `$HOME/.agent-settings.yml` pinned to `17.3.0` with two `REMOVED_KEYS`
      entries and one `RENAMED_KEYS` entry, and a git-rooted project dir. It
      asserts the JSON report lists each file with `role`
      (`global-canonical | global-flat | legacy-xdg | stray-home | project`),
      `reached_from_git_root` (true/false), `pin`, `removed_keys`,
      `renamed_keys`. verify: `npx vitest run tests/scripts/_cli/cmd_settings_status.test.ts` -> 1
      failing because the verb does not exist.
- [ ] **1.2 Implement `agent-config settings:status [--json]`.** New
      `src/scripts/_cli/cmd_settings_status.ts`, read-only, built on
      `user_global_settings_paths()`, `_resolve_cascade_paths()`,
      `REMOVED_KEYS`, `RENAMED_KEYS` and `read_pin`. Register it in
      `src/scripts/_dispatch.bash` next to `settings:check`; regenerate the
      help snapshot. verify: 1.1's test green; `npx vitest run
      tests/cli/help.test.ts` green.
- [ ] **1.3 Pin reach test.** Add a case to
      `tests/scripts/_cli/cmd_settings_status.test.ts` proving that a pin in
      the stray-home file is reported `pin_reachable: true` only for a cwd
      without a boundary anchor, and that `pin_resolver` ignores it from a
      git-rooted cwd. verify: the case passes against `read_pin` unchanged; if
      it fails, the finding goes to 2.1's council question as evidence.
- [ ] **1.4 Doctor row.** `agent-config doctor` prints one `settings` row
      from 1.2's report: `ok` when every live file has 0 removed and 0
      renamed keys and no stray-home file exists, else `drift` with the
      file and the fixing command. verify: a doctor test over the 1.1
      fixture shows `drift` naming `~/.agent-settings.yml`.

## Phase 2 — Settings fix, dry-run first

- [ ] **2.1 Council on the verb shape.** Run `agent-config council:status`;
      when configured, ask the council whether the fix lands as
      `settings:migrate --stray` (existing verb, new source) or as
      `settings:sync --renames` plus `settings:status --fold-stray` — the
      existing `settings:migrate` meaning (project → global) must not change.
      Record the answer as D1. verify: D1 row present with a
      `council:<date>` resolver; without a council, `agent` resolves it by
      keeping `settings:migrate`'s meaning and adding `--stray`.
- [ ] **2.2 Failing tests for the fold.** In the test file D1 names, cover:
      the stray file's non-default, non-removed values are folded into the
      canonical global file only where the canonical file has no value;
      `agent_config_version` is never copied into a global file; renamed keys
      are rewritten to their new name; `--dry-run` writes nothing and prints
      each planned change; the stray file is renamed to
      `.agent-settings.yml.migrated-<date>`, never deleted. verify: the new
      cases fail.
- [ ] **2.3 Implement the fold** per D1, reusing the line-by-line YAML editing
      of `settings_prune_removed.ts` so comments survive, then run the
      existing `--prune-removed` path on the canonical file. verify: 2.2 green;
      `npx vitest run tests/lib/agent_settings.test.ts
      tests/scripts/_cli/cmd_settings_migrate.test.ts` green.
- [ ] **2.4 `upgrade` names a stray file.** After step 3 of `upgrade`
      (`cmd_upgrade.ts:37-43`), print one line when `settings:status` reports
      a stray-home or legacy file, naming the D1 command with `--dry-run`.
      Never applies it. verify: an upgrade test with the stray fixture shows
      the line; without it, no line.

## Phase 3 — Graph cache sweep

- [ ] **3.1 Failing test first.** Add
      `tests/scripts/code_graph/cache_prune.test.ts` with a fixture hub
      holding one registered home, one home no registry entry names (older
      than the threshold), one younger unattributed home, and a repo with
      both `agents/map/.build/code-graph-v1.json` and a legacy
      `agents/runtime/state/code-graph-v1.json`. Assert `--dry-run` lists the
      old unattributed home and the shadowed legacy copy with sizes, and
      deletes nothing. verify: the test fails, the verb is missing.
- [ ] **3.2 Implement `agent-config code-graph cache:prune [--dry-run|--apply]
      [--older-than <days>]`** in `src/scripts/code_graph/` next to
      `projects_cli.ts`, using `homeDirs()` and `isHomeDir()`
      (`graph_home.ts:93-121`) and the registry; default is dry-run, default
      age 14 days (D2). Never touches `HUB_OWN_ENTRIES`, a registered home, or
      a legacy copy without a newer `.build` copy beside it. verify: 3.1 green
      plus an `--apply` case removing exactly the listed paths.
- [ ] **3.3 Doctor row.** `doctor` prints a `graph-cache` row with the
      reclaimable size from 3.2's dry run when it exceeds 50 MB. verify: a
      doctor test over the 3.1 fixture.

## Phase 4 — Profile drift report

- [ ] **4.1 Failing test first.** Add
      `tests/scripts/_cli/cmd_profiles_drift.test.ts` with an
      `AGENT_SWITCH_HOME` fixture of three Claude profiles: one symlinked
      `settings.json`, one copy whose hooks repeat an identical command twice
      on one event, one copy with a different `permissions.allow` count and an
      extra enabled plugin. Assert the JSON names per profile:
      `settings_link` (symlink/copy), `managed_hooks_identical`,
      `duplicate_hook_commands` (by event, by command), `allow_count`,
      `plugins_diff`. verify: test fails, verb missing.
- [ ] **4.2 Implement `agent-config profiles:drift [--json]`**, read-only,
      enumerating profiles through `discover_sources()`
      (`session_catalog.ts:429`) and identifying managed entries by
      `MANAGED_SIGNATURE`. It prints which tool owns each finding:
      agent-config for managed hooks, agent-switch for its own hook entries
      and for distribution (`agent-switch sync`). It writes nothing under any
      profile. verify: 4.1 green; a test asserts every fixture file's bytes
      and mtime are unchanged after a run.
- [ ] **4.3 Doctor row.** `doctor` prints `profiles` as `ok` or `drift` with
      the count of findings per owner. verify: doctor test over 4.1's fixture.

## Phase 5 — Documentation generated from the verbs

- [ ] **5.1 Help and docs.** Add the three verbs to the CLI help text and to
      `docs/customization.md` § settings, describing behaviour only — no
      machine-specific numbers. verify: `./scripts-run
      src/scripts/check_references` exits 0; `npx vitest run
      tests/cli/help.test.ts` green.
- [ ] **5.2 Targeted gate over every touched surface.** verify: `npx vitest run tests/cli/help.test.ts tests/lib/agent_settings.test.ts tests/scripts/_cli/cmd_settings_status.test.ts tests/scripts/_cli/cmd_settings_migrate.test.ts tests/scripts/_cli/cmd_profiles_drift.test.ts tests/scripts/code_graph/cache_prune.test.ts` -> 0

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D2 | reversible-technical | agent | Unattributed graph homes are swept after 14 days, dry-run by default | the orphans found were 26 days old; `projects prune` already uses a staleness window (`projects_cli.ts:25`) | a live home is reported as unattributed in any test or doctor run |
| D3 | deterministic | evidence | No step creates per-project `.agent-settings.yml` in consumers | ADR-020 global-only consumer scope | ADR-020 is superseded |
| D4 | deterministic | evidence | agent-config reports profile drift and never edits a profile's `settings.json` | `block-config-weakening`; `upgrade` delegates distribution to `agent-switch sync` (`cmd_upgrade.ts:44-46`) | agent-switch hands profile writes back to agent-config |

<!-- Release holds — none. Considered: the fold (Phase 2) could ship half-built.
     guarded: every write path is behind an explicit flag (`--apply` / D1's verb
     without `--dry-run`) and Phases 1, 3 and 4 are read-only by default, so each
     intermediate tree state is publishable. -->

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Fold loses a live user value | implementation | Folding the stray file overwrites a value the canonical global already holds, or drops comments the user wrote | Canonical value always wins; line-by-line editing as in `settings_prune_removed.ts`; stray file renamed, never deleted; dry-run default | Phase 2 — Settings fix, dry-run first |
| 2 | Sweep deletes a live graph | implementation | A home whose project is simply unregistered (registry nearly empty per the audit) is classed as orphaned and deleted | 14-day age floor, dry-run default, registered and younger homes never touched, `--apply` removes only the listed paths | Phase 3 — Graph cache sweep |
| 3 | Drift report edits a profile | product | A "fix" option creeps in and rewrites `settings.json`, colliding with agent-switch distribution and `block-config-weakening` | D4; 4.2's test asserts bytes and mtime unchanged | Phase 4 — Profile drift report |
| 4 | Stray pin downgrades a run | implementation | `agent_config_version: "17.3.0"` in a file reachable from a cwd without `.git` re-execs an old release | 1.3 measures reach; 2.2 never copies the pin into a global file | Phase 1 — `settings:status`: which files are live, and how stale |

## Blockers

### blocker: apply-on-owner-machine
- **Status:** open
- **Owner:** owner
- **Routed:** pending — deleting ~450 MB and renaming a settings file under the owner's home directory is a destructive action outside the repository (Hard Floor), not a council decision
- **Blocks:** Acceptance Criteria — AC-4
- **Question:** Run the built fixes against this machine's real files?
- **Recommendation:** Run both dry runs first, then apply; each change is reversible except the cache deletion, which only removes rebuildable caches.
- **If you do nothing:** the commands ship and doctor shows `drift`, but the stray 17.3.0 file and the ~450 MB stay on this machine.
- **What to do:**
  1. `agent-config settings:status` and the D1 command with `--dry-run`; read the planned changes; rerun without `--dry-run`.
  2. `agent-config code-graph cache:prune --dry-run`, then `--apply`.
  3. `agent-config doctor` — expected: `settings ok`, `graph-cache ok`.
- **Resolved when:** `agent-config settings:status --json` lists no `stray-home` file and `agent-config code-graph cache:prune --dry-run` reports 0 reclaimable bytes on the owner's machine.

### blocker: agent-switch-duplicate-hooks
- **Status:** open
- **Owner:** external
- **Blocks:** Acceptance Criteria — AC-5
- **Recommendation:** File the duplicate registration against agent-switch's installer (event4u-app/agent-switch); its hook writer must be idempotent per event.
- **If you do nothing:** three profiles keep `agent-switch __hook-event` registered twice per event; `profiles:drift` keeps reporting it under owner `agent-switch`.
- **What to do:**
  1. Run `agent-config profiles:drift --json` and attach the `duplicate_hook_commands` findings to an agent-switch issue.
  2. After an agent-switch release with the fix, run `agent-switch sync` and rerun the report.
- **Resolved when:** `agent-config profiles:drift --json` reports 0 `duplicate_hook_commands` across all profiles.

## Acceptance Criteria

- [ ] AC-1 — `agent-config settings:status --json` names every settings file
      the loader can reach, its role, pin, removed and renamed key counts;
      covered by `tests/scripts/_cli/cmd_settings_status.test.ts`.
- [ ] AC-2 — The D1 fold command migrates a stray file without losing a
      canonical value, never copies a pin into a global file, and writes
      nothing under `--dry-run`; covered by 2.2's tests.
- [ ] AC-3 — `agent-config code-graph cache:prune --dry-run` lists only
      unattributed homes past the age floor and shadowed legacy copies;
      `--apply` removes exactly those; `profiles:drift` writes nothing.
- [ ] AC-4 — On the owner's machine, doctor shows `settings ok` and
      `graph-cache ok` (blocker `apply-on-owner-machine`).
- [ ] AC-5 — `profiles:drift` reports 0 duplicate hook commands (blocker
      `agent-switch-duplicate-hooks`).
- [ ] All quality gates pass: `task ci` exits 0.
