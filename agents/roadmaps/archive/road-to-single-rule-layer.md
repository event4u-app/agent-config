---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
---
# Road to a single rule layer

> **Source:** session measurement 2026-08-22, prompted by the operator asking why
> rules are still linked into `.cursor` and the other agent directories after
> ADR-236. Every figure below was measured that day — the project-layer counts in a
> **freshly generated** worktree (`git worktree add` off `origin/main`, then
> `task sync && task generate-tools`), the global-layer counts against the live
> home directory, and the context cost against the main checkout as it stood.

## Goal

Every rule is delivered from exactly one layer, in **all five** host directories
this package projects into — not only `.claude/`. After this roadmap a freshly
generated project layer contains only the package-only rules, each of the five
global layers is verified to carry what was withheld before it is withheld, and a
gate catches a global-only rule reappearing in a project directory. ADR-236
decided this; the measurement below shows it holds for one host out of five.

## What is true today

**The installer side is completely correct, for every host.** All five global
layers carry exactly the 103 global-scope rules and none of the 16 package-only
ones — verified by name, not by count:

| Host | global rules directory | rules | of the 103 missing | package-only leaked |
|---|---|---:|---:|---:|
| claude | `~/.claude/rules` | 103 | 0 | 0 |
| cursor | `~/.cursor/rules` | 103 | 0 | 0 |
| augment | `~/.augment/rules` | 103 | 0 | 0 |
| windsurf | `~/.codeium/windsurf/rules` | 103 | 0 | 0 |
| cline | `~/Documents/Cline/Rules` | 103 | 0 | 0 |

**The generator side is correct for one host in five.** Measured in the fresh
worktree with `partitionActive: true` (`dual-layer/partitioned — host layer
verified at 14.7.0`), after one `task generate-tools`:

| Project directory | files | package-only | **global-only (the duplication)** |
|---|---:|---:|---:|
| `.claude/rules` | 13 | 13 | **0** |
| `.clinerules` | 14 | 13 | **0** (plus 1 non-rule file) |
| `.cursor/rules` | 126 | 26 | **100** |
| `.windsurf/rules` | 113 | 13 | **100** |
| `.augment/rules` | 118 | 15 | **103** |

`generate_rule_symlinks` filters on `isExclusivelyPackageOnly` at
`condense.ts:1136` and sweeps stale entries, so the two symlink trees are right.
The cursor-`.mdc`, windsurf and augment emitters never ask, so they write the full
113 regardless of the partition.

**The main checkout is separately rotten.** Its `.claude/rules` holds 92 entries —
15 package-only plus **77 global-only symlinks** dating from 2026-07-30, i.e. from
before the partition shipped. Those 77 are loaded on top of the identical global
copies in every Claude Code session in this repository: **286,147 bytes,
≈ 71,500 tokens, duplicated per session.** The generator would sweep them; it has
not run here since the partition landed.

**Nothing guards any of it.** `check_single_delivery` hardcodes
`globalRoot = ~/.claude` and `projectRoot = <repo>/.claude` (`:446-447`), so the
four other host directories are outside its scope entirely; and its own docstring
records that in CI it compares nothing, because `.claude/` is gitignored and no CI
leg installs at user scope. `check_rule_projection_integrity` runs in
`consistency.yml` but asserts projection completeness, not layer exclusivity.

**One design note that is now falsified.** `partitionEligibility.ts:365-369` says
the partition is scoped to `.claude/` because `partitionActive` verifies the claude
host layer against `installed.lock` and "says nothing about `~/.cursor`", so
"every other tool directory keeps the full projection". That reasoning is sound and
its conclusion is wrong for rules: the rule filter sits in
`_scoped_rule_basenames()`, which is per-run and not per-directory, so it already
withholds from `.clinerules` on the strength of a claude fingerprint. The fix is
not to narrow the filter but to earn the fact per host — the presence check in
Phase 2 is exactly the evidence the docstring says is missing.

## Phase 1 — Make the layer split measurable

- [x] **1.1 Add a host→global-rules-path registry.** Five entries, two of which
      are not derivable from the tool id: windsurf resolves to
      `~/.codeium/windsurf/rules` and cline to `~/Documents/Cline/Rules`. Put it
      beside the existing tool detection so a sixth host is one row.
      verify: a unit test asserts all five paths and that each is absent-tolerant
      (a missing directory returns null, never throws).
- [x] **1.2 Add `check_rule_layer_partition` in report mode.** For each of the
      five host directories print project total / package-only / global-only, and
      for each global layer print how many of the expected global-scope rules it
      carries. Read-only, exit 0 in this phase.
      verify: run it on this worktree and on the main checkout; it reproduces the
      two tables in § What is true today, including the 77.

## Phase 2 — Earn the withhold per host, never by extrapolation

- [x] **2.1 Add `hostLayerCarries(hostId, ruleNames)`.** True only when that
      host's global directory exists and contains every name that would be
      withheld. This is the property `personaPartition`'s docstring demands
      ("withholding is only safe once the surviving layer is known to carry what
      is withheld") and the one `partitionActive` cannot supply for a non-claude
      host.
      verify: sabotage in both directions — temporarily rename one global layer,
      assert the predicate flips to false and the projection goes back to full;
      restore, assert it flips back. A predicate never seen false proves nothing.
- [x] **2.2 Route the rule filter through it.** `_scoped_rule_basenames()` stops
      being per-run: the emit plan already exists per tool directory
      (`projected_rule_trees`), so the package-only narrowing moves there and is
      applied per host, gated on 2.1.
      verify: with all five global layers present, the plan narrows for all five;
      with one renamed, that one host alone stays full.

## Phase 3 — Connect the three emitters that never asked

- [x] **3.1 Cursor `.mdc` emitter.** Consume the per-host plan from 2.2 and add
      the stale sweep — a filter that only declines to write leaves the existing
      100 standing, which is the failure `personaPartition` names as "not a
      partition".
      verify: fresh generate in a clean worktree → `.cursor/rules` global-only = 0;
      then re-run over a directory pre-populated with all 113 → also 0.
- [x] **3.2 Windsurf emitter.** Same, against `~/.codeium/windsurf/rules`.
      verify: as 3.1, `.windsurf/rules` global-only = 0 from both starting states.
- [x] **3.3 Augment emitter.** Same, on both its branches — `rules_use_symlinks`
      true and false — since the flag selects a different writer.
      verify: as 3.1 for each branch; `.augment/rules` global-only = 0.

## Phase 4 — A gate that can fail

- [x] **4.1 Make `check_rule_layer_partition` blocking, with an honest skip.**
      Non-zero when a project host directory carries a global-only rule while that
      host's global layer is verified to carry it. When a global layer is absent —
      CI, a fresh clone, a machine with no install — it must say
      `skipped: no global layer for <host>` and exit 0, because a gate that scans
      nothing and exits green is indistinguishable from a gate that passed.
      verify: sabotage — copy one global-only rule into `.cursor/rules`, assert
      non-zero and that the message names the file; remove it, assert zero. Then
      run with `HOME` pointed at an empty directory and assert the skip line
      appears for all five.
- [x] **4.2 Register it under CI-identical argv and record the coverage row.**
      Same invocation locally and in `consistency.yml`, beside
      `check_rule_projection_integrity`.
      verify: `gate-coverage.yml` carries the row and the workflow step runs it.

## Phase 5 — Clean up what the measurement turned up

- [x] **5.1 Sweep the main checkout's 77 stale symlinks.** One generator run in
      the main checkout after Phase 3, then re-measure.
      verify: `.claude/rules` goes 92 → 13, and the byte count of duplicated rule
      prose goes 286,147 → 0.
      **Done, by a different mechanism, because the one this step named does not
      work here.** `task generate-tools` in the main checkout emits `rules=0` and
      sweeps nothing: `agents/.agent-tools.yml` is `skip-worktree`-masked to
      `tools: []` there, so `_filter_tool_dirs` resolves to zero directories. That
      is why the 77 symlinks dated 2026-07-30 survived every regeneration for three
      weeks — the generator ran and was structurally inert. A `--prune` mode was
      added to `check_rule_layer_partition` instead, keyed on the gate's own finding
      rather than on a generator run, so it works regardless of tool selection and
      touches only files verified present in that host's global layer. Measured:
      488 files removed across all five directories, 411 → 0 duplicated, 286,147 →
      0 bytes, nothing tracked modified. `.claude/rules` ends at 15 rather than 13:
      the two extra are package-only rules carrying `type: manual`, which the
      generator would not symlink (ADR-004) but which are not duplicates and are not
      the prune's business.
- [x] **5.2 Remove `production-validator.subagent.md` from `.clinerules`.**
      **The premise was wrong and the file stays.** It is written by
      `generate_subagent_host_contexts`, and its placement is documented at that
      function as reaper-safe by construction: "Cline → a flat real
      `<name>.subagent.md` in `.clinerules/` (whose reaper only unlinks *symlinks*,
      so a real file survives)". `.clinerules` is Cline's single flat context
      surface, so a subagent context belongs there — the second half of this step's
      verify ("holds only rule files") was the incorrect expectation, not a finding.
      No change made. `check_rule_layer_partition` already handles it correctly for
      the right reason: it classifies against `src/rules` and ignores a basename
      with no rule source, so the file is neither counted nor reported.
- [x] **5.3 Decide the cursor legacy `.md` symlinks.** Resolved on the second
      branch of the verify: the contract now states what is established and what is
      not, because the honest answer is that nobody measured this.
      The label "legacy" was unsourced. What the tree DOES show is one-sided:
      `check_host_loadability::check_cursor_rules` reads `.mdc` only
      (`if (!name.endsWith('.mdc')) continue;`) and is written around Cursor
      rejecting an unparseable file, and the `.mdc` emitter rewrites frontmatter into
      a dialect the `.md` symlinks do not carry. What is missing is any observation
      of whether a current Cursor build reads `.md` at all.
      So the symlinks stay and `docs/contracts/multi-tool-projection-fidelity.md`
      gains § Cursor's two formats, which records both halves and names the
      five-minute test that would settle it. Removing a delivery surface on the
      strength of a label is the same error class as withholding a rule on another
      host's fingerprint — the thing this roadmap exists to stop.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A host silently loses its rules | implementation | Withholding from a project directory whose global layer does not actually carry the rules delivers them nowhere — the one failure the fail-safe design exists to prevent, and the reason the current code refuses to extrapolate from claude's fingerprint | `hostLayerCarries` checks presence per host before any withhold, sabotage-verified in both directions (2.1); a false predicate returns the full projection | Phase 2 — Earn the withhold per host, never by extrapolation |
| 2 | The gate is green because it measured nothing | implementation | `check_single_delivery` already documents this exact shape: `.claude/` is gitignored and no CI leg installs at user scope, so in CI it compares zero pairs and exits 0. A new gate inherits that unless it is explicit | 4.1 requires a named skip reason per host and forbids silent green; the sabotage test runs locally where a layer exists | Phase 4 — A gate that can fail |
| 3 | A filter without a sweep leaves the duplication standing | implementation | Three emitters currently write 313 global-only files between them. Declining to write new ones does not remove them, and every one of these directories is gitignored, so nothing else ever cleans them | Each of 3.1–3.3 verifies from a pre-populated directory, not only from empty | Phase 3 — Connect the three emitters that never asked |
| 4 | Cursor's `.mdc` frontmatter diverges under the filter | implementation | The `.mdc` writer emits a different frontmatter dialect (`description`, `globs`, `alwaysApply` only). Narrowing the input set must not change what it writes for the rules that survive | 3.1 diffs the surviving 13 `.mdc` bodies and frontmatter before and after the change | Phase 3 — Connect the three emitters that never asked |
| 5 | The withheld set is right but the wrong 16 | product | The partition key is `workspaces: [agent-config-maintainer]` alone. A rule that is genuinely maintainer-only but forgot the field is shipped globally to every consumer, and the inverse hides a useful rule | 1.2 prints the 16 by name so the list is reviewable rather than implied; a change to the set is a visible diff | Phase 1 — Make the layer split measurable |

## Acceptance Criteria

- [x] AC-1 — After one fresh generate, every one of the five project host
      directories reports **zero** global-only rules, measured by name against
      `isExclusivelyPackageOnly` and not by total count.
      **Met.** `.claude/rules` 13 · `.cursor/rules` 13 · `.clinerules` 13 ·
      `.windsurf/rules` 13 · `.augment/rules` 15 — all `DUPLICATED 0`, all
      `sole-carrier 0`. The augment 15 is that emitter's pre-existing lack of the
      scope and ADR-004 manual filters, recorded in step 3.3 and out of scope.
- [x] AC-2 — No rule is withheld from a host whose global layer was not first
      verified to carry it, and renaming any one global layer restores that host's
      full projection — both directions demonstrated, not argued.
      **Met.** 22 tests across `host_layer_carries_sabotage` and
      `rule_partition_per_host`: per host, carries → renamed away → refuses with
      reason `layer-absent` → restored → carries; and renaming one layer leaves the
      other four narrowed, which is the isolation the change was for. A layer
      missing one single name keeps the whole projection. Each predicate was also
      sabotaged at the source and seen RED before being restored.
- [x] AC-3 — A global-only rule placed back into any project host directory makes
      a registered gate exit non-zero and name the file; the same gate, run where
      no global layer exists, prints a per-host skip reason and exits zero.
      **Met on both halves.** Planted `direct-answers.mdc` in `.cursor/rules` →
      exit 1 naming the file; removed → exit 0. With `HOME` pointed at an empty
      directory: five `precondition_unmet` skips naming each unreadable path, exit
      0, and the summary line reads "nothing compared … This is not a pass" rather
      than a success. Six-case `--self-test` (3 rejecting) plus 6 unit tests over a
      synthetic root; two source-level sabotages seen RED.
- [x] AC-4 — The duplicated rule prose loaded per session in this repository is
      stated as a before-and-after number: 286,147 bytes / ≈ 71,500 tokens before,
      and whatever it measures after.
      **Met: 286,147 → 0 bytes.** 77 rules in `.claude/rules` were being loaded on
      top of byte-identical global copies in every Claude Code session here; that is
      now zero. What remains in the project layer is 47,638 bytes (≈ 11,900 tokens)
      of package-only rules, which is the layer working as designed rather than a
      residue. Across all five directories the prune removed 488 files and took the
      duplicate count 411 → 0.
