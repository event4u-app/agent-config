---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "lane of road-to-leading-every-row; the set's growth is declared there. The defects are install-time data loss on a neighbour's files and a backed public claim that says the opposite; no active roadmap plans them, and the archived multi-package-coexistence roadmap that claimed array coexistence is closed."
relates:
  - slug: road-to-leading-every-row
    relation: depends
    note: "the programme; blocker b7 there amends the ADR premise this lane's mechanism replaces"
  - slug: road-to-neighbours-that-pull-their-weight
    relation: disjoint
    note: "sibling lane; this one keeps neighbours intact and counts them, that one routes through them"
  - slug: road-to-skill-ecosystem-security-and-conformance
    relation: disjoint
    note: "parked; its install ledger and ledger-first uninstall overlap 1.2 and 1.5 and wake on their own condition — this lane uses the lockfile that exists today"
  - slug: road-to-a-graph-that-wins
    relation: disjoint
    note: "parked; its foreign graph.json reader lives in internal/bench, Phase 3 here is the runtime load path"
depends: [road-to-leading-every-row]
---
# Road to a tree that keeps its neighbours

> **Source:** `agents/tmp.old/inbox-2026-10-b/` — the owner's directive in the round's
> chat (consumers install other agent packages beside this one, and this suite
> orchestrates them rather than displacing them), backed by a code-level read of four
> such packages' installers. Every anchor re-read at `9bc8cd4`. Class: owner directive +
> external comparison corpus.

## Goal

Installing, upgrading or uninstalling this package never deletes, replaces or hides a
neighbour's artefact, and `doctor` can say which neighbours are present, what effect each
of their hooks has, and whether this suite's own hooks are still bound — by **shape**,
never by name (ADR-088 § 2). At `9bc8cd4`: `deep_merge` replaces every array wholesale
(`src/scripts/install.ts:499-520`, branch `:515-516`), and seven `merge_json_file` call
sites write hook arrays (augment-user `:969`, cursor `:1035,1071`, windsurf `:1198,1237`,
gemini `:1272,1305`), so a foreign hook group on those hosts is lost at install;
`_cleanDir` deletes every rule file and directory under `.cursor/rules` and `.windsurf/rules`
that is not ours by name (`src/install/emit_host_rules_cli.ts:63-85,87-110`) and
`.windsurfrules` is overwritten (`:117`); the reserved-name sweep removes any builtin-named
command (`install.ts:2973-2978`); and `docs/CLAIMS.md:287-292` (`surgical-uninstall`,
status backed) claims a neighbour's entries are never touched. Only the Claude path is
neighbour-safe, and its signature is Claude-specific
(`src/scripts/_lib/claude_settings_hooks.ts:50,154,214-238`). A foreign `links`-shaped graph
passes detection (`code_graph/detect.ts:34,79-95`) and throws at load (`code_graph/query.ts:127,147-149`).

The honest limit: the host owns load order and context order, so this lane makes a
neighbour's effect visible; it cannot make it run after ours.

## Phase 1 — Stop destroying what a neighbour wrote

- [x] **1.1 Per-event append with a per-platform signature on the seven hook writers.**
      One helper replacing the array branch for `hooks.<event>` at the seven sites only:
      keep every entry without this suite's signature, replace ours, append if absent.
      The signature is per platform (`dispatch:hook --platform <host>`), and the helper is
      shape-aware — cursor and windsurf entries are `{command}` objects, augment and gemini
      are `{hooks:[…]}` groups. `deep_merge` stays for non-hook keys.
      `corrected-from-reproduction` — the supplied draft named thirteen sites and the
      Claude-only signature.
      verify: fixture — a `.cursor/hooks.json` with one foreign entry gains ours and keeps the foreign one byte-identical across install → upgrade → uninstall
- [x] **1.2 Ownership pointers stop owning the parent array.** `json_pointers.ts:202-203`
      records array values wholesale; record the managed entry's signature instead, so
      uninstall removes only it.
      verify: `npx vitest run tests/lib/json_pointers.test.ts -t 'foreign array entry survives'` -> 0
- [x] **1.3 `_cleanDir` deletes only files this package wrote.** Ownership comes from the
      installed-tools lockfile's written paths, not from a frontmatter tag — the `.mdc`
      emitter (`src/scripts/condense.ts:1286-1304`) writes no package tag, so gating on one
      would never remove our own stale files. Foreign files are kept and listed once as
      `kept: <n> neighbour file(s)`; `.windsurfrules` is written only when absent or ours.
      `corrected-from-reproduction`.
      verify: fixture — a foreign `.cursor/rules/other.mdc` survives `emitCursor`; a stale file of ours is still removed
- [x] **1.4 The reserved-name sweep skips files it does not own.** `install.ts:2973-2978`
      removes a builtin-named command only when the lockfile claims it; a foreign one is
      reported, not deleted.
      verify: fixture — a foreign `~/.claude/commands/review.md` survives install and appears in the doctor line
- [x] **1.5 The public claim matches the tree.** `docs/CLAIMS.md` `surgical-uninstall` gains
      an evidence line pointing at 1.1's array fixture; until 1.1 lands its status reads
      `partial` with the install-side gap named.
      verify: `grep -A4 'claim: surgical-uninstall' docs/CLAIMS.md | grep -c 'hooks'` -> /[1-9]/

## Phase 2 — Count the neighbours and their effects

- [x] **2.1 `doctor neighbours`: one census, seven shape classes.** Read-only: (a) hook
      entries per event in every host hook file without our signature — event, matcher,
      command head only, timeout; (b) skills under `.claude/skills` and `~/.claude/skills`
      the lockfile does not claim — ours live in `~/.claude/skills` on a consumer, so root
      is never origin; (c) commands and (d) agents under `.claude/`; (e) `.mcp.json` servers
      other than ours; (f) rule files under `.cursor/rules`, `.windsurf/rules`, `.claude/rules`
      not claimed; (g) H1/H2 sections in the instruction files whose heading is not ours.
      Each entry carries a qualified id `<origin>:<name>`, a sha256 digest and a shape class.
      No name is a constant in `src/`.
      verify: `agent-config doctor neighbours --json` on the fixture consumer -> /"hook_groups":\s*\[\{/ and /"instruction_sections"/
- [x] **2.2 Our concerns declare their effect; foreign effects read `unknown`.**
      `hook_manifest.yaml` has no `effect:` field (grep count 0); add one to each of the 62
      concerns from `permission | context | verification | telemetry | memory |
      notification | formatting`, generated into `hooks/hooks.json` unchanged, and give
      `lint_hook_manifest` an enum check (it has no unknown-key guard today). A foreign
      entry's effect is `unknown` unless its output shape is observed.
      verify: `grep -c '^\s*effect:' src/scripts/hook_manifest.yaml` -> /62/
- [x] **2.3 Two deny-shaped warnings, worded as the host behaves.** `double-gate` fires
      only when two entries on one event with overlapping matchers both carry `permission`
      (ours by field, the neighbour's by observation or `unknown`), and says "the host runs
      both; either deny applies" — never an order the host does not have. `shadowed` fires
      for a foreign skill whose name equals one of ours.
      verify: fixture — a foreign PreToolUse `Edit|Write` entry beside `block-no-verify` prints `double-gate`; beside a `context` concern prints nothing
- [x] **2.4 Liveness, not trust.** The census adds two lines: our hook group is bound
      **and** fired in the last session (read from `src/scripts/_lib/hook_effect_probe.ts`,
      the probe `hook_effect_doctor` already runs), and settings
      takeover — a foreign `model` or `env.CLAUDE_CODE_*` key, or our `hooks` key missing
      after our own install. A neighbour that removed this suite is then visible.
      verify: fixture — deleting our hook group from `settings.json` yields a `removed-after-install` line
- [x] **2.5 One environment label per host.** The census prints `controlled` (no foreign
      effectful entry), `coordinated` (foreign effectful entries, all observed),
      `degraded` (a foreign `permission` or `unknown` effect on a slot we gate, or a foreign
      Stop entry), or `uncontrolled` (2.4 reports our group removed or unfired). The label
      is a report, never a refusal.
      verify: fixture — each of the four states is produced by one planted consumer
- [x] **2.6 The census links the existing `foreign` file listing.** `cmd_doctor.ts:624-657`
      links to the census line rather than repeating paths; nothing is removed.
      verify: `agent-config doctor` output carries one `neighbours:` line with counts

## Phase 3 — A foreign graph that detects also loads, and never gates

- [x] **3.1 A load adapter for the `links` shape in `query.ts` `loadGraph`.** Map
      `links[]`/`edges[]` with `source`/`target`/`relation` to edges with
      `resolved_via: 'foreign'`; add `'foreign'` to `ResolvedVia` and to `GUESS_RESOLVED_VIA`
      (`code_graph/types.ts:61,99-102`) so the accepted-edge filter treats it as a guess; an
      unmapped relation is counted, never guessed; `schema_version` and `source_checksum`
      are synthesised. `corrected-from-reproduction` — the filter is a denylist, so a new
      value would otherwise be accepted.
      verify: fixture — a 20-node `links` graph loads and `query` answers with a `resolved_via` histogram
- [x] **3.2 Consumer-declared index paths, no vendor constants.** A Class A project setting
      `code_graph.consumer_index_paths: []` extends `CONSUMER_CANDIDATES` (`detect.ts:34`);
      the default list stays generic.
      verify: `./scripts-run src/scripts/check_no_external_sources` -> 0 with no finding under `src/scripts/code_graph/`
- [x] **3.3 Gate verbs refuse an all-foreign graph and say so.** `dead` already has a
      refusal shape (`verbs.ts:405,456`); `impact --diff` and `untested` gain the same shape
      with `reason: foreign-edges-not-accepted`.
      verify: fixture — `untested --diff` on the foreign graph -> /foreign-edges-not-accepted/

## Acceptance criteria

- On a fixture consumer with one foreign hook entry per host file, one foreign rule file, one foreign builtin-named command and one foreign skill, install, upgrade and uninstall leave all of them byte-identical.
- `docs/CLAIMS.md` `surgical-uninstall` cites an array fixture that passes, or reads `partial` with the gap named.
- `doctor neighbours --json` lists seven shape classes with qualified id, digest and class per entry, prints one environment label per host, and reports a removed or unfired hook group of ours.
- All 62 concerns carry an `effect:` from the closed set; `hooks/hooks.json` is byte-identical.
- A foreign graph loads, answers `query`, and is refused by the three gate verbs with a named reason.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | content-derived per-platform signature, not an id field | `claude_settings_hooks.ts:15-21` keeps the host's dedup guarantee | a host dedups by id |
| D2 | contested-technical | evidence | census by shape, never a vendor table | ADR-088 § 2; `check_no_external_sources.ts:381-385` scans paths | ADR-088 is superseded |
| D3 | reversible-technical | agent | ownership from the lockfile, not a frontmatter tag | the emitter writes no tag (`condense.ts:1286-1304`) | the emitter starts tagging |
| D4 | reversible-technical | agent | foreign edges join the guess set | `types.ts:99-107` filters by denylist | the accepted-edge filter becomes an allowlist |
| D6 | deterministic | agent | closure pass C1–C2 (1.5 and 3.1 verifies listed unfalsifiable): accepted — 1.5's grep fails until the claim cites the hook fixture, 3.1's fixture asserts the histogram | `closure_scan` 2026-10-01; listing family, never a gate | a flip lands without the fixture |
| D5 | reversible-technical | agent | no separate effect-ledger lane; our effects declared, foreign effects `unknown` | no host exposes foreign hook execution to another hook | a host exposes a hook trace |

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A call site relied on array replacement | implementation | A migration of our own entry now leaves a stale duplicate. | 1.1 replaces ours by signature; its fixture asserts one managed entry per event after each lifecycle step. | Phase 1 — Stop destroying what a neighbour wrote |
| 2 | The census prints a neighbour's secrets into a committed report | product | A hook command line can carry a token. | 2.1 prints the command head and matcher only; the fixture asserts no argument text. | Phase 2 — Count the neighbours and their effects |
| 3 | `effect:` is wrong on a concern and the warning misfires | implementation | A single-valued field on a concern that both injects and refuses. | `lint_hook_manifest` enum check; 2.3's fixture pins the blocking concerns. | Phase 2 — Count the neighbours and their effects |
| 4 | `degraded` becomes the common label and is ignored | product | Most neighbours mutate permission on PreToolUse. | The label names the entries responsible so the consumer can choose; it never refuses. | Phase 2 — Count the neighbours and their effects |
| 5 | A foreign relation is mapped wrong and `explain` sounds confident | product | The relation table guesses another tool's vocabulary. | Foreign edges are guesses, gates refuse them, and unmapped relations are counted. | Phase 3 — A foreign graph that detects also loads, and never gates |
