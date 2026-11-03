<!-- evidence-type: analysis -->

# Ratification review — a code-graph refresh that turns itself on by use and also runs at turn end — round 1

You are an independent reviewer for a change in the `event4u/agent-config` repository. Three files in it are on the ratification gate's list (hook plumbing): `src/scripts/hook_manifest.yaml`, its compiled projection `src/scripts/hook_manifest.json`, and `src/config/hook-bundle-budget.json`. Under ADR-268 § 4 an agent may change them but may not ratify its own change, so the change needs a two-provider verdict.

subject: 2d5b5d2e1bea9329ece6f83c4f7250d18ad0ae3572bf5870be8e49b83cb0afdf

(The digest covers the three gated files at the branch head, computed with `./scripts-run src/scripts/ratification_subject --base-ref origin/main`.)

## Background

The `code-graph-refresh` concern spawns a detached `agent-config code-graph refresh --single-flight --map` so a project's code graph and its `agents/map/` stay current. Before this change it ran on `session_start` only, and only after the developer had run `code-graph auto-refresh on` in that project. A ratification round on 2026-10-23 (two seats) set both conditions: an existing cache is not consent, because a repository can commit one; and no `stop` binding, because a spawn per turn is waste.

On 2026-11-01 the owner reported a project map 20 commits behind: auto-refresh had never been switched on there, so it never refreshed. The owner asked for the map to update itself while work happens.

## What the change does

1. **Consent by use.** A local `code-graph build` (into the project's own cache path, not a foreign `--out`) or `code-graph map` (into the project's map dir) writes the auto-refresh marker into the gitignored `agents/map/.build/`, unless an opt-out marker exists. `auto-refresh off` removes the marker and writes the opt-out marker `code-graph-auto-refresh.off.json`; `auto-refresh on` removes the opt-out. The concern's existing refusals are unchanged: a marker or cache tracked by git, a CLI that resolves inside the repository or is too old, a held lock, Windows, replay mode, and the kill switch `AGENT_CONFIG_CODE_GRAPH_REFRESH=off`.
2. **Turn-end binding.** The concern is added to the `stop` slot of the seven platforms that bind it on `session_start` (augment, claude, cowork, cursor, cline, windsurf, gemini). On claude it is placed before `journal-record`, which must end that chain. A throttle runs before the cache check: the concern reads `git rev-parse HEAD`; if the last recorded outcome is `spawned`, its recorded HEAD equals the current one, and it is under 10 minutes old, it returns `fresh` without spawning and without overwriting that record. A spawn now records the HEAD it was started for. With no readable HEAD (no commit yet) it never throttles.
3. **Budget.** Bundle ceiling 1,560,400 → 1,562,000 (measured 1,561,506) and the concern's chunk ceiling 15,400 → 17,600 (measured 16,335), each with a `raise_log` entry.
4. Ungated parts of the same branch: the interfaces and data lane readers now skip gitignored files (`gitVisibleFiles`), and a parked roadmap records an unrelated stale-date gate.

Verified locally: unit tests for the throttle (same HEAD skips and keeps the record; moved HEAD, expired window and no-commit spawn), consent by use, sticky opt-out, foreign `--out` not consenting, the lane filter (seen red with the filter neutralised), and `journal-record` still last on claude `stop`; bundle composition, generator sync and the graph-writers gate pass.

## What to answer

1. Does the diff contain a defect — in the throttle, the consent-by-use path, the opt-out, the manifest bindings or the budget entries? Name file and line for each.
2. Does the change expand any agent's or hook's authority, or weaken an existing gate? In particular: is a local `build`/`map` run an adequate consent signal given the 2026-10-23 concern that a repository can commit a cache, and does the `stop` binding reintroduce the per-turn cost that round refused?
3. Can the turn-end path spawn more than the throttle intends (for example through the legacy layout, a missing build directory, or a record it cannot write)?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The diff (`git diff origin/main...feat/map-always-fresh`)

Complete for the three gated files and every file the hook or the consent path runs. Left out to fit the council bundle ceiling, and named here so the omission is visible: the compiled `src/scripts/hook_manifest.json` (a single-line projection of the YAML that `check_generator_sync` verifies byte-for-byte), the two lane readers and their test (`src/scripts/code_graph/lanes/{interfaces/index.ts,data/read_data.ts}`, `tests/scripts/code_graph_reader_precision.test.ts` — item 4, which narrows what a lane reads and runs in no hook), and the roadmap files.

```diff
diff --git a/docs/contracts/agents-layout.md b/docs/contracts/agents-layout.md
index 7d414f5e0f..c6a7a0cc89 100644
--- a/docs/contracts/agents-layout.md
+++ b/docs/contracts/agents-layout.md
@@ -87,7 +87,7 @@ Scope column: `pkg` = source repo only · `consumer` = consumer projects only ·
 | `evidence/` | pkg | tracked-durable (see notes) | permanent, **no cold location** (see Evidence temperature below) | tooling + humans | Research, analysis, audits, eval findings, metrics — everything evidential. Sub-dirs: `analysis/`, `audits/`, `architectural-drift/`, `archived-skills/`, `council/`, `eval-findings/`, `eval-corpora/`, `investigations/`, `mcp-sessions/`, `metrics/`, `notes/`, `reports/` |
 | `features/` | pkg | tracked-durable | permanent | maintainer | Feature-flag status docs (long-form complement to `.agent-tools.yml`) |
 | `knowledge/` | both | tracked-durable | permanent | human-gated (`/team-knowledge` skills) | Curated committed knowledge pages (sessions/, concepts/, procedures/, decisions/). Committed only after human review; never auto-written |
-| `map/` | both | **local-only** (gitignored) | rebuildable | `agent-config code-graph map` | The project map the code-graph engine draws: `index.html` (offline viewer), `MAP.md`, `areas/<area>.md`, `map.json`; plus `lineage.md`, mechanisms by verdict from `provenance/mechanisms.jsonl`, written by `agent-config code-graph map --lineage` and carried over by every redraw. Derived from the index under `runtime/state/`; deleting it loses nothing a rebuild does not restore (ADR-297). Kept current after `agent-config code-graph auto-refresh on` (redrawn in the background at every agent session start) |
+| `map/` | both | **local-only** (gitignored) | rebuildable | `agent-config code-graph map` | The project map the code-graph engine draws: `index.html` (offline viewer), `MAP.md`, `areas/<area>.md`, `map.json`; plus `lineage.md`, mechanisms by verdict from `provenance/mechanisms.jsonl`, written by `agent-config code-graph map --lineage` and carried over by every redraw. Derived from the index under `runtime/state/`; deleting it loses nothing a rebuild does not restore (ADR-297). Kept current once auto-refresh is on — a local `code-graph build` or `map` turns it on, `code-graph auto-refresh off` turns it off for good — redrawn in the background at every agent session start and at every turn end after HEAD moved |
 | `memory/` | both | mixed (see notes) | permanent (durable) / TTL (intake) | `/memory:*` skills | Layer 1 memory pipeline: `intake/` (gitignored JSONL), `knowledge/` subdir (mirrors top-level knowledge/). Intake is local-only; curated YAML in subdirs is committed |
 | `memory-quarantine/` | pkg | tracked-durable | permanent | `memory_eviction` | Curated memory entries demoted on a recorded stale verdict (ADR-234). Outside the memory root so `check_memory` does not read them as a memory type; an entry stops being injected, stays readable, and returns when someone re-verifies it |
 | `notes/` | pkg | tracked-durable | permanent | maintainer | Ad-hoc analyst notes that are not evidence/reports (e.g. `visibility-sync-audit.md`). **Merge candidate** — new notes land in `evidence/notes/` going forward; existing file stays for now |
diff --git a/docs/contracts/hook-architecture-v1.md b/docs/contracts/hook-architecture-v1.md
index 78fd7314b2..403e43aa14 100644
--- a/docs/contracts/hook-architecture-v1.md
+++ b/docs/contracts/hook-architecture-v1.md
@@ -1308,7 +1308,7 @@ configuration. `orphan` — the name survives only in prose; nothing reads it.
 |---|---|---|---|
 | `AGENT_CONFIG_ALLOW_SPEAKING_INBOX` | maintainer | Lets a write into the speaking-inbox directory through the PreToolUse block | `hooks/block_speaking_inbox_dir.ts:79` |
 | `AGENT_CONFIG_ALLOW_CREDENTIAL_READS` | maintainer | Lets a read of a credential-class file, or a command that prints the environment, through the PreToolUse block | `hooks/block_credential_reads.ts:52` |
-| `AGENT_CONFIG_CODE_GRAPH_REFRESH` | maintainer | `=off` stops the `code-graph-refresh` session concern spawning its background `code-graph refresh --single-flight --map`, even in a project that ran `code-graph auto-refresh on`; the git-hook refresh in this package's own checkout is unaffected | `hooks/code_graph_refresh_hook.ts:108` |
+| `AGENT_CONFIG_CODE_GRAPH_REFRESH` | maintainer | `=off` stops the `code-graph-refresh` concern (session start and turn end) spawning its background `code-graph refresh --single-flight --map`, even in a project whose auto-refresh is on; the git-hook refresh in this package's own checkout is unaffected | `hooks/code_graph_refresh_hook.ts:140` |
 | `AGENT_CONFIG_SHOWCASE_MAX_USD` | maintainer | USD ceiling that lets an interactive `task release` offer the paid `bench:showcase:quick` run; unset → never offered | `_lib/release_showcase.ts:30` |
 | `AGENT_CONFIG_DEPLOY_INVENTORY` | harness | Path override for the global deploy inventory | `_lib/global_deploy_inventory.ts:61` |
 | `AGENT_CONFIG_DEV_MODE` | maintainer | Maintainer dev mode; forces `--scope=project` and is captured into the corpus manifest | `_lib/corpus_manifest.ts:89` |
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 0828ddc3d2..f0fc22fb6c 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1560400,
+    "max_bytes": 1562000,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -126,6 +126,25 @@
             "what_was_added": "Measured with this gate's own build (APFS-cloned node_modules) on the branch merged with origin/main 14012757d: 1,560,119 B against 1,557,828 B for origin/main itself, so +2,291 B; the ceiling leaves 281 B of headroom, the jitter margin this file's own doctrine names. Per module (metafile bytesInOutput, branch minus base): concern_timings.ts +593 (per-dispatch max RSS and CPU microseconds, read only when the timings sink is armed), stop_snapshot.ts +563 and end_review_nudge_hook.ts +282 (one git numstat / untracked read per Stop dispatch shared by end-review-nudge and obligation-settle, which removes a second `git diff` and `git ls-files` spawn from every Stop), compile_cache.ts +500 and dispatch_entry.ts +114 (node compile cache for the lazy concern chunks, fail-open), host_rate_marker_hook.ts +100 (one set naming which host failure classes park a run). No git-authorization or other guard code changes: an earlier revision of this raise carried a pending-refusal exception there, which the 2026-10-31 council round refused and which was withdrawn.",
             "why_it_could_not_be_avoided": "Room was made first and measured: the first build was +5,050 B, because the park marker's reset time was looked up inside the hook and pulled the quota ledger and pressure model into the bundle; that lookup moved to run_supervise (a CLI, outside the bundle), the marker field became dead code and was removed, the failure-class table became a one-entry set, and the withdrawn git-authorization exception went with its bytes (+5,050 -> +2,291 B). What remains is new behaviour on the dispatch path itself: the Stop memo has to live where both Stop concerns run, the compile cache has to be enabled by the entry that loads the lazy chunks, and the resource sample has to be taken by the process whose usage it reports. The base had 72 B of headroom, so none of it fits without a raise.",
             "what_would_have_caught_it": "This gate, on the first push; it did, and the reduction above is the response."
+        },
+        {
+            "date": "2026-11-01",
+            "chunk": "src/scripts/hooks/code_graph_refresh_hook.ts",
+            "from": 15400,
+            "to": 17600,
+            "by": "agent, feat/map-always-fresh",
+            "what_was_added": "The turn-end binding of the code-graph-refresh concern: a `git rev-parse HEAD` probe, a read of the last spawn record, and the HEAD stamped into that record, so a `stop` dispatch spawns a refresh only after HEAD moved or THROTTLE_MS passed. Measured 16,335 bytes; ceiling is that plus about 8 %.",
+            "why_it_could_not_be_avoided": "The owner reported on 2026-11-01 a project map 20 commits behind; bound on session_start alone, a long session never refreshes. Without the throttle a turn-end binding would spawn a node process per turn, which is the waste the 2026-10-23 council kept it off `stop` for. The chunk loads only for this concern, so no other dispatch pays the bytes.",
+            "what_would_have_caught_it": "Nothing earlier: the growth is the feature."
+        },
+        {
+            "date": "2026-11-01",
+            "from": 1560400,
+            "to": 1562000,
+            "by": "agent, feat/map-always-fresh",
+            "what_was_added": "The `code-graph-refresh` row on the `stop` slot of seven platforms in the compiled manifest, and the opt-out marker path in the shared graph-home resolver. Measured 1,561,506 bytes, 1,106 over the 1,560,400 ceiling.",
+            "why_it_could_not_be_avoided": "A binding is a manifest row the dispatch bundle carries; the concern body itself stays in its own chunk. The resolver field is the single place a layout path is chosen (check_graph_writers), so the opt-out cannot live elsewhere.",
+            "what_would_have_caught_it": "Nothing earlier: the growth is the feature."
         }
     ],
     "chunks": [
@@ -155,9 +174,9 @@
         },
         {
             "entry": "src/scripts/hooks/code_graph_refresh_hook.ts",
-            "max_bytes": 15400,
+            "max_bytes": 17600,
             "registered_at": "2026-10-23",
-            "derivation": "Measured 14,284 bytes on 2026-10-24 (the session-start code-graph refresh concern with its opt-in, tracked-file and PATH-trust checks, the CLI capability probe and outcome record of the PR #2604 review follow-up, the refresh-lock staleness check it shares with `code-graph refresh --single-flight`, and the hardened spawn environment). The ceiling is that reading plus about 8 %, rounded, with no growth queued; it was registered at 14,000 against 12,726 B and re-derived in the same PR, before any release carried it. Bound on `session_start` alone; a chunk keeps it off every other dispatch's parse, and the dispatch bundle carries only its `LAZY_CONCERNS` row. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the refresh."
+            "derivation": "Measured 14,284 bytes on 2026-10-24 (the session-start code-graph refresh concern with its opt-in, tracked-file and PATH-trust checks, the CLI capability probe and outcome record of the PR #2604 review follow-up, the refresh-lock staleness check it shares with `code-graph refresh --single-flight`, and the hardened spawn environment). The ceiling is that reading plus about 8 %, rounded, with no growth queued; it was registered at 14,000 against 12,726 B and re-derived in the same PR, before any release carried it. Bound on `session_start` alone; a chunk keeps it off every other dispatch's parse, and the dispatch bundle carries only its `LAZY_CONCERNS` row. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the refresh. RAISED to 17,600 on 2026-11-01: the concern is now also bound on `stop` and throttled by HEAD (16,335 B measured); the `raise_log` entry whose `to` is 17,600 records it."
         },
         {
             "entry": "src/scripts/update_notice_hook.ts",
diff --git a/src/scripts/check_graph_writers.ts b/src/scripts/check_graph_writers.ts
index c247bfa956..cec76bb524 100644
--- a/src/scripts/check_graph_writers.ts
+++ b/src/scripts/check_graph_writers.ts
@@ -61,8 +61,8 @@ const ARTEFACT = [
     /index-v1\.sqlite3/,
     /estate-index/,
     /hub\.json/,
-    /NATIVE_CACHE_REL|LOCK_REL|AUTO_REFRESH_REL/,
-    /\.(?:cachePath|buildCachePath|lockPath|autoRefreshPath|mapDir|buildDir)\b|\b(?:sqliteTwinPath|sidecarPath|outcomesPath|graphGeneration)\s*\(/,
+    /NATIVE_CACHE_REL|LOCK_REL|AUTO_REFRESH_(?:OFF_)?REL/,
+    /\.(?:cachePath|buildCachePath|lockPath|autoRefreshPath|autoRefreshOffPath|mapDir|buildDir)\b|\b(?:sqliteTwinPath|sidecarPath|outcomesPath|graphGeneration)\s*\(/,
 ];
 
 /** Locations outside both layouts that a graph artefact was, or could plausibly be, written to. */
@@ -81,7 +81,7 @@ const OUTSIDE = [
  * only inside a layout while these resolve into one. Pre-ADR-303 fallbacks are
  * named `legacy…` and are read, never written, so they are not in these sets.
  */
-const LAYOUT_CONSTANTS = new Set(['MAP_DIR_REL', 'BUILD_DIR_REL', 'NATIVE_CACHE_REL', 'LOCK_REL', 'AUTO_REFRESH_REL']);
+const LAYOUT_CONSTANTS = new Set(['MAP_DIR_REL', 'BUILD_DIR_REL', 'NATIVE_CACHE_REL', 'LOCK_REL', 'AUTO_REFRESH_REL', 'AUTO_REFRESH_OFF_REL']);
 const LAYOUT_RESOLVERS = new Set(['hubDir', 'graphsRoot', 'indexPath', 'estateMapDir', 'outcomesPath']);
 
 export interface WriterFinding {
diff --git a/src/scripts/code_graph/auto_refresh.ts b/src/scripts/code_graph/auto_refresh.ts
new file mode 100644
index 0000000000..1df70b8ff4
--- /dev/null
+++ b/src/scripts/code_graph/auto_refresh.ts
@@ -0,0 +1,30 @@
+/**
+ * The auto-refresh opt-in a local `build` or `map` writes (see `enableByUse`).
+ */
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
+import { graphHome } from './graph_home.js';
+
+/**
+ * Turn auto-refresh on because this developer just built or drew the graph here.
+ *
+ * The ratification round of 2026-10-23 refused an EXISTING cache as consent,
+ * since a repository can commit one. A `build` or `map` run on this machine is a
+ * different fact: it is the developer asking for the map, and a map nobody keeps
+ * current is the failure the owner reported on 2026-11-01 (a map 20 commits
+ * behind because nobody ever typed `auto-refresh on`). The marker still lands in
+ * the gitignored `.build/`, the concern still refuses a tracked one, and
+ * `auto-refresh off` leaves an opt-out this never overrides.
+ */
+export function enableByUse(root: string): string {
+    const home = graphHome(root);
+    if (home.kind !== 'project' || fs.existsSync(home.autoRefreshPath) || fs.existsSync(home.autoRefreshOffPath)) return '';
+    try {
+        fs.mkdirSync(home.buildDir, { recursive: true });
+        fs.writeFileSync(path.join(home.buildDir, path.basename(home.autoRefreshPath)), `${JSON.stringify({ enabled_at: new Date().toISOString(), by: 'use' })}\n`);
+    } catch {
+        return '';
+    }
+    return '    auto-refresh on — kept current at every session start and after each commit; `code-graph auto-refresh off` stops it\n';
+}
diff --git a/src/scripts/code_graph/cli.ts b/src/scripts/code_graph/cli.ts
index c24d6d356c..b6b0a2ae6c 100644
--- a/src/scripts/code_graph/cli.ts
+++ b/src/scripts/code_graph/cli.ts
@@ -21,8 +21,9 @@
  *   confirm <id…> | --from-query <symbol>       re-read the witnesses of facts
  *   pack "<task>" [--diff] [--since <rev>]      a verified context pack
  *   rebuild-diff                                incremental vs cold build
- *   auto-refresh on|off|status [--root P]      opt this project in to the
- *                                               session-start background refresh
+ *   auto-refresh on|off|status [--root P]      turn the background refresh
+ *                                               on or off; a local `build` or
+ *                                               `map` turns it on unless `off`
  *   projects list|add|remove|prune             the user-global registry of
  *                                               projects this machine works in
  *                                               (ADR-299, `projects_cli.ts`)
@@ -159,6 +160,7 @@ import {
     graphState,
     pickSource,
 } from './detect.js';
+import { enableByUse } from './auto_refresh.js';
 import { graphHome } from './graph_home.js';
 import { estateMain } from './estate_cli.js';
 import { estateMapMain } from './estate_map.js';
@@ -252,7 +254,9 @@ async function cmdBuild(argv: string[]): Promise<number> {
     }
     const update = argv.includes('--update');
     const { graph, fileCount, reExtracted, reused, lanes } = await buildFromRepo(root, out, { update, lanes: !argv.includes('--no-lanes') });
-    if (out === buildCacheFor(root)) registerUse(root, graph, git(root, 'rev-parse', 'HEAD'));
+    const ownCache = out === buildCacheFor(root);
+    if (ownCache) registerUse(root, graph, git(root, 'rev-parse', 'HEAD'));
+    const consent = ownCache ? enableByUse(root) : '';
     const c = graph.edge_confidence_counts;
     process.stdout.write(
         `✅  code-graph ${update ? 'updated' : 'built'} — ${fileCount} files · ${graph.nodes.length} nodes · ${graph.edges.length} edges\n` +
@@ -262,6 +266,7 @@ async function cmdBuild(argv: string[]): Promise<number> {
             (update ? `    incremental: ${reExtracted} re-extracted · ${reused} reused\n` : '') +
             (lanes ? laneSummaryLines(lanes) : '') +
             (out ? `    cache: ${shown(root, out)}\n` : '') +
+            consent +
             legacyCacheNotice(root),
     );
     if (argv.includes('--check-fixture-findings')) {
@@ -1145,9 +1150,9 @@ async function cmdRefresh(argv: string[]): Promise<number> {
 }
 
 /**
- * `auto-refresh on|off|status` — the explicit, local, per-project opt-in the
- * `code-graph-refresh` session concern requires before it starts anything
- * (ratification round of 2026-10-23: an existing cache is not consent).
+ * `auto-refresh on|off|status` — the local, per-project switch the
+ * `code-graph-refresh` concern reads before it starts anything. `on` is also
+ * what a local `build` or `map` does (`enableByUse`); `off` is sticky.
  */
 function cmdAutoRefresh(argv: string[]): number {
     const root = resolveRoot(argv);
@@ -1168,10 +1173,11 @@ function cmdAutoRefresh(argv: string[]): number {
         fs.mkdirSync(home.buildDir, { recursive: true });
         fs.writeFileSync(now, `${JSON.stringify({ enabled_at: new Date().toISOString() })}\n`);
         if (now !== marker) fs.rmSync(marker, { force: true });
+        fs.rmSync(home.autoRefreshOffPath, { force: true });
         const cli = usableCli(root);
         process.stdout.write(
-            'auto-refresh on — each agent session start refreshes the graph, and agents/map/ when it exists,\n' +
-                'in the background (POSIX hosts). `code-graph auto-refresh off` stops it.\n' +
+            'auto-refresh on — each agent session start, and each turn end after HEAD moved, refreshes the graph\n' +
+                'and agents/map/ when it exists, in the background (POSIX hosts). `code-graph auto-refresh off` stops it.\n' +
                 'The opt-in is per working tree: run it again in each new git worktree.\n' +
                 (fs.existsSync(cacheFor(root)) ? '' : 'No graph yet: `code-graph build` or `code-graph map` creates one.\n'),
         );
@@ -1186,7 +1192,11 @@ function cmdAutoRefresh(argv: string[]): number {
     }
     if (action === 'off') {
         for (const m of new Set([marker, path.join(home.buildDir, path.basename(marker)), path.join(home.legacyDir, path.basename(marker))])) fs.rmSync(m, { force: true });
-        process.stdout.write('auto-refresh off\n');
+        if (home.kind === 'project') {
+            fs.mkdirSync(home.buildDir, { recursive: true });
+            fs.writeFileSync(home.autoRefreshOffPath, `${JSON.stringify({ disabled_at: new Date().toISOString() })}\n`);
+        }
+        process.stdout.write('auto-refresh off — a later `build` or `map` keeps it off; `auto-refresh on` reverses this\n');
         return 0;
     }
     if (action !== 'status') {
@@ -1201,7 +1211,7 @@ function cmdAutoRefresh(argv: string[]): number {
     const drawnFrom = mapGeneration(mapDir);
     const mutex = reclaimMutexPath(home.lockPath);
     process.stdout.write(
-        `auto-refresh: ${fs.existsSync(marker) ? 'on' : 'off'}\n` +
+        `auto-refresh: ${fs.existsSync(marker) ? 'on' : fs.existsSync(home.autoRefreshOffPath) ? 'off (opted out)' : 'off — the next local build or map turns it on'}\n` +
             `cli: ${'reason' in cli ? (cli.reason === 'no-cli' ? 'none usable — nothing will run' : `${cli.cli} ${cliPackage(cli.cli)?.version ?? '?'} — too old, nothing will run`) : `${cli.cli} ${cliPackage(cli.cli)?.version ?? '?'}`}\n` +
             `last session start: ${line(last['session-start'])}\n` +
             `last refresh: ${line(last.refresh)}\n` +
@@ -1337,9 +1347,7 @@ async function drawMap(argv: string[]): Promise<number> {
                 ? `    diff ${r.model.diff.rev}: ${r.model.diff.changed.length} changed · ${r.model.diff.impacted.length} linked into them · ${r.model.diff.areas.length} area(s) touched\n`
                 : '') +
             `    wrote: ${r.written.length} files under ${rel}/ — open ${path.join(rel, 'index.html')}\n` +
-            (fs.existsSync(graphHome(root).autoRefreshPath)
-                ? ''
-                : '    keep it current at every agent session start: agent-config code-graph auto-refresh on\n'),
+            (out ? '' : enableByUse(root)),
     );
     let rc = 0;
     const renderFile = path.join(r.outDir, '.build', 'map-render.json');
diff --git a/src/scripts/code_graph/graph_home.ts b/src/scripts/code_graph/graph_home.ts
index 4721d924aa..699ab0315d 100644
--- a/src/scripts/code_graph/graph_home.ts
+++ b/src/scripts/code_graph/graph_home.ts
@@ -26,6 +26,8 @@ export const NATIVE_CACHE_REL = path.join(BUILD_DIR_REL, 'code-graph-v1.json');
 export const LOCK_REL = path.join(BUILD_DIR_REL, 'code-graph-refresh.lock');
 /** Written by `code-graph auto-refresh on`; the session concern acts only while it exists. */
 export const AUTO_REFRESH_REL = path.join(BUILD_DIR_REL, 'code-graph-auto-refresh.json');
+/** Written by `code-graph auto-refresh off`; a local `build` or `map` then no longer turns auto-refresh on. */
+export const AUTO_REFRESH_OFF_REL = path.join(BUILD_DIR_REL, 'code-graph-auto-refresh.off.json');
 /** The layout before ADR-303, read as a fallback for one release. */
 export const LEGACY_STATE_DIR_REL = path.join('agents', 'runtime', 'state');
 
@@ -43,6 +45,8 @@ export interface GraphHome {
     mapDir: string;
     lockPath: string;
     autoRefreshPath: string;
+    /** The opt-out marker; current layout only, since no older release wrote one. */
+    autoRefreshOffPath: string;
     /** The directory an older release kept these files in. */
     legacyDir: string;
     repoId: string | null;
@@ -65,6 +69,7 @@ function home(kind: GraphHome['kind'], root: string, dir: string, mapDir: string
         mapDir,
         lockPath: path.join(buildDir, path.basename(LOCK_REL)),
         autoRefreshPath: at(AUTO_REFRESH_REL),
+        autoRefreshOffPath: path.join(buildDir, path.basename(AUTO_REFRESH_OFF_REL)),
         legacyDir,
         repoId: id,
         instance: inst,
diff --git a/src/scripts/code_graph/refresh_lock.ts b/src/scripts/code_graph/refresh_lock.ts
index aa29103183..2059e142ea 100644
--- a/src/scripts/code_graph/refresh_lock.ts
+++ b/src/scripts/code_graph/refresh_lock.ts
@@ -49,6 +49,8 @@ export interface RefreshRecord {
     by: 'session-start' | 'refresh';
     outcome: string;
     detail?: string | undefined;
+    /** HEAD when the concern spawned a refresh, so a later turn end with the same HEAD can skip. */
+    head?: string | undefined;
 }
 
 /** One file per side, so the session concern writes without reading or merging anything. */
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 38771b2153..22a9678b76 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1444,14 +1444,18 @@ concerns:
     effect: telemetry
   # Consumer-side code-graph freshness. The git-hook refresh in install-hooks.sh
   # reaches this package's own checkout only; a consumer project's graph and
-  # agents/map/ never refreshed. On session_start this spawns a detached
+  # agents/map/ never refreshed. It spawns a detached
   # `agent-config code-graph refresh --single-flight --map` and returns — only
-  # for a project that ran `code-graph auto-refresh on`, whose opt-in marker
-  # and cache git does not track, with an `agent-config` on PATH that resolves
-  # outside the repository. session_start alone: `stop` is per turn and
-  # `session_end` refreshes for a session that is gone (council, 2026-10-23,
-  # two of two seats). Silent, exit 0, POSIX only, no hook-token-budget row —
-  # it emits nothing. Loaded from its own chunk.
+  # for a project with an opt-in marker (`code-graph auto-refresh on`, or a
+  # local `build`/`map` without a prior `off`), whose marker and cache git does
+  # not track, with an `agent-config` on PATH that resolves outside the
+  # repository. The council of 2026-10-23 (two of two seats) kept it off `stop`
+  # because a spawn per turn is waste; on 2026-11-01 the owner reported a map 20
+  # commits behind, so `stop` is bound with a different mechanism: one
+  # `git rev-parse HEAD`, and a spawn only when HEAD moved past the last spawn
+  # or THROTTLE_MS passed. `session_end` stays unbound — it would refresh for a
+  # session that is gone. Silent, exit 0, POSIX only, no hook-token-budget
+  # row — it emits nothing. Loaded from its own chunk.
   # Kill switch: `AGENT_CONFIG_CODE_GRAPH_REFRESH=off`.
   code-graph-refresh:
     script: src/scripts/hooks/code_graph_refresh_hook.ts
@@ -1711,7 +1715,7 @@ platforms:
     ask:              text
     session_start:    [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, surface-probe, session-register, code-graph-refresh]
     session_end:      [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush]
-    stop:             [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop]
+    stop:             [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop, code-graph-refresh]
     pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, block-credential-reads, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, memory-recall]
     post_tool_use:    [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, design-pass]
 
@@ -1729,7 +1733,7 @@ platforms:
     # concern's own header used to end at: a rule whose trigger does not recur
     # was not restored at all.
     session_end:      [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush, journal-record]
-    stop:             [chat-history, verify-before-complete, team-review-gate, end-review-nudge, obligation-settle, turn-end-gate, self-repair, session-register, session-eol, interruption-ledger, roadmap-progress, design-pass-stop, suggestion-capture, journal-record]
+    stop:             [chat-history, verify-before-complete, team-review-gate, end-review-nudge, obligation-settle, turn-end-gate, self-repair, session-register, session-eol, interruption-ledger, roadmap-progress, design-pass-stop, suggestion-capture, code-graph-refresh, journal-record]
     user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, delegation-nudge, skill-route, git-authorization, session-canary, self-repair, session-register, rule-inject, suggestion-capture, journal-record, quota-notice, intake-pass]
     # `rule-inject` was bound here and is not any more
     # (road-to-delivery-for-every-host 3.2, owner ruling E2). E2's strategy is
@@ -1804,7 +1808,7 @@ platforms:
     # is later verified to forward it. Binding them here would be dead
     # weight: the concern still runs (git diff, transcript scan, classifier),
     # still costs the dispatch, and its entire output is thrown away.
-    stop:             [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop]
+    stop:             [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop, code-graph-refresh]
     user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass]
     pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, block-credential-reads, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, spawn-guard-shadow, source-first-gate, memory-recall]
     post_tool_use:    [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, design-pass, spawn-guard-shadow]
@@ -1830,7 +1834,7 @@ platforms:
     ask:              text
     session_start:      [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, surface-probe, session-register, code-graph-refresh]
     session_end:        [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush]
-    stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop]
+    stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop, code-graph-refresh]
     user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass]
     post_tool_use:      [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, design-pass]
 
@@ -1846,7 +1850,7 @@ platforms:
     ask:              text
     session_start:      [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, surface-probe, session-register, code-graph-refresh]
     session_end:        [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush]
-    stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop]
+    stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop, code-graph-refresh]
     user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass]
     post_tool_use:      [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, design-pass]
 
@@ -1865,7 +1869,7 @@ platforms:
   windsurf:
     ask:              text
     session_start:      [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, profile-staleness, wrapper-freshness, surface-probe, session-register, code-graph-refresh]
-    stop:               [chat-history, verify-before-complete, self-repair, session-register, design-pass-stop]
+    stop:               [chat-history, verify-before-complete, self-repair, session-register, design-pass-stop, code-graph-refresh]
     # language-mirror IS bound here: unlike minimal-safe-diff it needs only the
     # user_prompt_submit slot, which Windsurf has.
     user_prompt_submit: [chat-history, verify-before-complete, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass]
@@ -1884,7 +1888,7 @@ platforms:
     ask:              text
     session_start:      [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, surface-probe, session-register, code-graph-refresh]
     session_end:        [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush]
-    stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop]
+    stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop, code-graph-refresh]
     user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass]
     post_tool_use:      [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, design-pass]
 
diff --git a/src/scripts/hooks/code_graph_refresh_hook.ts b/src/scripts/hooks/code_graph_refresh_hook.ts
index 5fe10f82bd..0f3a224a12 100644
--- a/src/scripts/hooks/code_graph_refresh_hook.ts
+++ b/src/scripts/hooks/code_graph_refresh_hook.ts
@@ -1,6 +1,6 @@
 #!/usr/bin/env tsx
 /**
- * Session-start code-graph refresh — the consumer-side freshness carrier.
+ * Session-start and turn-end code-graph refresh — the consumer-side freshness carrier.
  *
  * WHY THIS EXISTS. The git-hook refresh block lives in `install-hooks.sh`,
  * which only this package's own `prepare` script runs. A consumer project gets
@@ -18,10 +18,18 @@
  * Freshness is eventual: the session's first graph read may still see the old
  * cache, and `code-graph-context` keeps saying so.
  *
+ * WHY IT ALSO RUNS AT TURN END. Bound on `session_start` alone, a long session
+ * that commits twenty times keeps the map it started with (measured 2026-11-01:
+ * a map 20 commits behind). On `stop` it costs one `git rev-parse HEAD`: while
+ * HEAD equals the one the last spawn recorded and that spawn is under
+ * `THROTTLE_MS` old, it returns `fresh` without spawning or recording — the
+ * record it compared against is the one it must keep.
+ *
  * WHEN IT DOES NOTHING — the conditions a ratification round of 2026-10-23
  * (two of two seats, refused the first cut) made load-bearing:
- *   · the project never ran `code-graph auto-refresh on`. An existing cache is
- *     not consent: a repository can commit one.
+ *   · no opt-in marker. `code-graph auto-refresh on` writes one, and so does a
+ *     local `code-graph build` or `map` unless `auto-refresh off` left an
+ *     opt-out. An existing cache alone is not consent: a repository can commit one.
  *   · the opt-in marker or the cache is TRACKED by git. Both live under the
  *     gitignored runtime dir; a tracked copy came from the repository, not
  *     from this developer.
@@ -60,8 +68,12 @@ export type RefreshOutcome =
     | 'locked'
     | 'no-cli'
     | 'cli-too-old'
+    | 'fresh'
     | 'spawned';
 
+/** How long a spawn for one HEAD covers later turn ends; a session start after it re-checks. */
+export const THROTTLE_MS = 10 * 60 * 1000;
+
 export { resolveCli } from '../code_graph/refresh_cli.js';
 
 /**
@@ -90,6 +102,26 @@ export function repoRoot(start: string): string | null {
     }
 }
 
+/** HEAD of `root`, or null when git cannot say (no commit yet, not a work tree). */
+function headOf(root: string): string | null {
+    try {
+        return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], env: hardenedSpawnEnv() }).trim() || null;
+    } catch {
+        return null;
+    }
+}
+
+/** Whether the last spawn already covers `head`. Unknown head or unreadable record → no. */
+function coveredBy(buildDir: string, head: string | null, now: number): boolean {
+    if (head === null) return false;
+    try {
+        const rec = JSON.parse(fs.readFileSync(path.join(buildDir, 'code-graph-refresh.session-start.json'), 'utf-8')) as { outcome?: string; head?: string; at?: string };
+        return rec.outcome === 'spawned' && rec.head === head && now - Date.parse(rec.at ?? '') < THROTTLE_MS;
+    } catch {
+        return false;
+    }
+}
+
 /** True when git tracks any of `rels` under `root` (or git cannot answer). */
 function anyTracked(root: string, rels: readonly string[]): boolean {
     try {
@@ -104,7 +136,7 @@ function anyTracked(root: string, rels: readonly string[]): boolean {
     }
 }
 
-export function refreshFor(cwd: string, spawnFn: typeof spawn = spawn): RefreshOutcome {
+export function refreshFor(cwd: string, spawnFn: typeof spawn = spawn, now: number = Date.now()): RefreshOutcome {
     if (process.env['AGENT_CONFIG_CODE_GRAPH_REFRESH'] === 'off') return 'disabled';
     if (process.platform === 'win32') return 'unsupported';
     if (is_replay_mode()) return 'replay';
@@ -115,8 +147,10 @@ export function refreshFor(cwd: string, spawnFn: typeof spawn = spawn): RefreshO
     if (!fs.existsSync(home.autoRefreshPath)) return 'not-opted-in';
     // A repository-committed opt-in is refused before anything is written into the tree.
     if (anyTracked(root, [home.autoRefreshPath, home.cachePath].map((p) => path.relative(root, p)))) return 'tracked';
+    const head = headOf(root);
+    if (coveredBy(home.buildDir, head, now)) return 'fresh';
     const done = (outcome: RefreshOutcome, detail?: string): RefreshOutcome => {
-        recordRefreshIn(home.buildDir, { by: 'session-start', outcome, detail });
+        recordRefreshIn(home.buildDir, { by: 'session-start', outcome, detail, ...(outcome === 'spawned' && head !== null ? { head } : {}) });
         return outcome;
     };
     if (!fs.existsSync(home.cachePath)) return done('no-cache');
diff --git a/tests/scripts/code_graph_refresh.test.ts b/tests/scripts/code_graph_refresh.test.ts
index 9ffb379888..4bd29ff7eb 100644
--- a/tests/scripts/code_graph_refresh.test.ts
+++ b/tests/scripts/code_graph_refresh.test.ts
@@ -300,6 +300,32 @@ describe('refresh — build/update/no-op with a hard wall-clock budget', () => {
         expect(runCli(['auto-refresh', 'sideways', '--root', tmp]).status).toBe(2);
     });
 
+    it('a local build turns auto-refresh on, and `off` stays off across later builds', () => {
+        const marker = path.join(tmp, 'agents', 'map', '.build', 'code-graph-auto-refresh.json');
+        const optOut = path.join(tmp, 'agents', 'map', '.build', 'code-graph-auto-refresh.off.json');
+        expect(runCli(['auto-refresh', 'status', '--root', tmp]).stdout).toMatch(/auto-refresh: off — the next local build or map turns it on/);
+        const built = runCli(['build', '--root', tmp]);
+        expect(built.status).toBe(0);
+        expect(built.stdout).toMatch(/auto-refresh on — kept current/);
+        expect(fs.existsSync(marker)).toBe(true);
+        expect(runCli(['auto-refresh', 'off', '--root', tmp]).status).toBe(0);
+        expect(fs.existsSync(marker)).toBe(false);
+        expect(fs.existsSync(optOut)).toBe(true);
+        const again = runCli(['build', '--root', tmp]);
+        expect(again.stdout).not.toMatch(/auto-refresh on/);
+        expect(fs.existsSync(marker)).toBe(false);
+        expect(runCli(['auto-refresh', 'status', '--root', tmp]).stdout).toMatch(/auto-refresh: off \(opted out\)/);
+        expect(runCli(['auto-refresh', 'on', '--root', tmp]).status).toBe(0);
+        expect(fs.existsSync(optOut)).toBe(false);
+        expect(fs.existsSync(marker)).toBe(true);
+    });
+
+    it('a build into a foreign --out path is not consent', () => {
+        const marker = path.join(tmp, 'agents', 'map', '.build', 'code-graph-auto-refresh.json');
+        expect(runCli(['build', '--root', tmp, '--out', path.join(tmp, 'elsewhere.json')]).status).toBe(0);
+        expect(fs.existsSync(marker)).toBe(false);
+    });
+
     it('auto-refresh reads an opt-in an older release wrote, moves it on `on` and removes it on `off`', () => {
         const legacy = path.join(tmp, 'agents', 'runtime', 'state', 'code-graph-auto-refresh.json');
         const marker = path.join(tmp, 'agents', 'map', '.build', 'code-graph-auto-refresh.json');
diff --git a/tests/scripts/hooks/code_graph_refresh_hook.test.ts b/tests/scripts/hooks/code_graph_refresh_hook.test.ts
index c4bfe611fa..340828714e 100644
--- a/tests/scripts/hooks/code_graph_refresh_hook.test.ts
+++ b/tests/scripts/hooks/code_graph_refresh_hook.test.ts
@@ -12,6 +12,7 @@ import {
     refreshFor,
     repoRoot,
     resolveCli,
+    THROTTLE_MS,
 } from '../../../src/scripts/hooks/code_graph_refresh_hook.js';
 
 /**
@@ -213,3 +214,46 @@ describe('code-graph-refresh session concern', () => {
         expect(calls).toHaveLength(0);
     });
 });
+
+describe('turn-end binding — spawn only after HEAD moved (2026-11-01)', () => {
+    const commit = (msg: string): void => {
+        fs.writeFileSync(path.join(root, `${msg}.txt`), msg);
+        git('add', `${msg}.txt`);
+        execFileSync('git', ['-C', root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', msg], { stdio: 'ignore' });
+    };
+
+    it('skips a second call for the same HEAD, and keeps the spawn record it compared against', () => {
+        optedIn();
+        commit('one');
+        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
+        const first = readRefreshRecords(root)['session-start'];
+        expect(first?.head).toMatch(/^[0-9a-f]{40}$/);
+        expect(refreshFor(root, fakeSpawn)).toBe('fresh');
+        expect(calls).toHaveLength(1);
+        expect(readRefreshRecords(root)['session-start']).toEqual(first);
+    });
+
+    it('spawns again once HEAD moved', () => {
+        optedIn();
+        commit('one');
+        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
+        commit('two');
+        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
+        expect(calls).toHaveLength(2);
+    });
+
+    it('spawns again for the same HEAD once the throttle window passed', () => {
+        optedIn();
+        commit('one');
+        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
+        expect(refreshFor(root, fakeSpawn, Date.now() + THROTTLE_MS + 1000)).toBe('spawned');
+        expect(calls).toHaveLength(2);
+    });
+
+    it('never throttles without a HEAD to compare (no commit yet)', () => {
+        optedIn();
+        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
+        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
+        expect(calls).toHaveLength(2);
+    });
+});
```
