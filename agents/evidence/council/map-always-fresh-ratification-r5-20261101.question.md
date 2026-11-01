<!-- evidence-type: analysis -->

# Ratification review — a code-graph refresh that turns itself on by use and also runs at turn end — round 5

You are an independent reviewer for a change in the `event4u/agent-config` repository. Three files in it are on the ratification gate's list (hook plumbing): `src/scripts/hook_manifest.yaml`, its compiled projection `src/scripts/hook_manifest.json`, and `src/config/hook-bundle-budget.json`. Under ADR-268 § 4 an agent may change them but may not ratify its own change, so the change needs a two-provider verdict.

subject: 9f5e74b0ea33ed61f1ffcfd252367acde2f5842884e672f2ea270074f609e7bc

(The digest covers the three gated files at the branch head, computed with `./scripts-run src/scripts/ratification_subject --base-ref origin/main`.)

## Background

The `code-graph-refresh` concern spawns a detached `agent-config code-graph refresh --single-flight --map` so a project's code graph and its `agents/map/` stay current. Before this change it ran on `session_start` only, and only after the developer had run `code-graph auto-refresh on` in that project. A ratification round on 2026-10-23 (two seats) set both conditions: an existing cache is not consent, because a repository can commit one; and no `stop` binding, because a spawn per turn is waste.

On 2026-11-01 the owner reported a project map 20 commits behind: auto-refresh had never been switched on there, so it never refreshed. The owner asked for the map to update itself while work happens.

## What the change does

1. **Consent by use.** A local `code-graph build` (into the project's own cache path, not a foreign `--out`) or `code-graph map` (into the project's map dir) writes the auto-refresh marker into the gitignored `agents/map/.build/`, unless an opt-out marker exists, `CI` is set, or the kill switch is on. `auto-refresh off` removes the marker and writes the opt-out marker; `auto-refresh on` removes the opt-out. This includes a build or map an agent runs locally: the owner directive `agents/evidence/owner-directives/2026-11-01-map-auto-refresh.md` (in the diff) records the owner's words and states that reading explicitly, for this ratification to accept or refuse. The concern's existing refusals are unchanged: a marker or cache tracked by git, a CLI that resolves inside the repository or is too old, a held refresh lock, Windows, replay mode, the kill switch. The opt-out wins in the concern even beside an opt-in.
2. **Turn-end binding, admitted by an exclusive claim.** The concern is added to the `stop` slot of the seven platforms that bind it on `session_start`; on claude it sits before `journal-record`, which must end that chain. Per dispatch it reads `git rev-parse HEAD` (or `none` before the first commit) and checks for a claim file named `code-graph-refresh.claim-<head>-<floor(now / THROTTLE_MS)>` (10-minute windows). If the file exists it returns `fresh`. Otherwise, after the cache, refresh-lock and CLI checks, it creates that file with `O_EXCL` (`flag: 'wx'`) immediately before the spawn: exactly one dispatch wins a (HEAD, window) pair, every other gets `EEXIST` → `fresh`; any other create error → `record-failed`, no spawn. The winner deletes only claim files whose window is at least two windows older than its own: no dispatch can name those again, since windows only move forward. Claims of the current and the previous window, for any HEAD, and of any later window are never deleted, so a claim still winnable keeps its owner. Consequence, stated: at most one launch per HEAD and fixed window — two can fall either side of a window boundary, and a new HEAD may launch at once. There is no lock to take over, no release and no shared record used for admission. A launch whose child emits `error` deletes its own claim file — created exclusively by it, in the current window, which no sweep touches — so the next dispatch may retry that pair. A clock set back lands in an older window name, which suppresses a refresh for at most one window. The outcome record (`code-graph-refresh.session-start.json`, now carrying `slot`) is for `auto-refresh status` only and plays no part in admission.
3. **Budget.** Bundle ceiling 1,560,400 → 1,562,000 (measured 1,561,506) and the concern's chunk ceiling 15,400 → 19,000 (measured 17,863), each with a `raise_log` entry.
4. Ungated parts of the same branch: the interfaces and data lane readers skip gitignored files; a parked roadmap records an unrelated stale-date gate.

## Rounds 1–4 and what changed

Round prompts are committed beside this one (`…-r1-…` to `…-r4-…`). All four were refused 2/2.

- **Round 1** found: a failed record write let every turn spawn, no throttle without HEAD, a future-dated record suppressed refresh, the opt-out was not authoritative in the hook. Fixed; the last two remain fixed.
- **Round 2** found: concurrent dispatches could both pass the throttle, a failed launch kept covering, the record mislabelled stop runs, consent by use from scripts. Fixed by an admission mutex, a nonce withdrawal, a `slot` field and the CI exclusion.
- **Round 3** found the mutex's stale takeover and release not ownership-safe, and the withdrawal racing a newer claim. Not patched: the mutex, the withdrawal and the record-based throttle are **removed** and replaced by the exclusive claim in item 2. Tests: (a) eight real processes released at one instant spawn exactly once; (b) a dispatch interleaved between another one's checks and its claim yields one `spawned` and one `fresh`; both fail when `wx` is replaced by `w`. Also: a claim in another window neither blocks nor survives the next win; an erroring launch frees its pair; an uncreatable claim spawns nothing.

- **Round 4** found the sweep deleting every other pair's claim, so a still-winnable claim (another HEAD in this window, or the previous window) could be freed and won twice, and a failed launch's delete could hit a re-created path; also that "once HEAD moved or 10 minutes passed" misdescribed fixed windows. Fixed: the sweep deletes only claims two or more windows old (item 2); the CLI, consent message and doc now say "at most once per HEAD and 10-minute window". Tests: a win leaves the other HEAD's current- and previous-window claims and a later window's claim standing and sweeps the spent one; a claim for another HEAD created between this dispatch's checks and its claim survives, and this pair stays `fresh` afterwards. All three fail with the old delete-every-other-pair sweep restored.

## What to answer

1. Does the diff contain a defect — in the throttle, the consent-by-use path, the opt-out, the manifest bindings or the budget entries? Name file and line for each.
2. Does the change expand any agent's or hook's authority, or weaken an existing gate? In particular: is a local `build`/`map` run an adequate consent signal given the 2026-10-23 concern that a repository can commit a cache, and does the `stop` binding reintroduce the per-turn cost that round refused?
3. Can the turn-end path spawn more than the throttle intends (for example through the legacy layout, a missing build directory, or a record it cannot write)?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The diff (`git diff -U1 origin/main...feat/map-always-fresh`)

One line of context, to fit the council bundle ceiling. Complete for the three gated files, the hook, its record writer, the graph-home resolver, the consent module, the CLI and the owner directive. Left out, named so the omission is visible: the compiled `hook_manifest.json` (byte-checked YAML projection), the lane readers and their test (run in no hook), `tests/scripts/code_graph_refresh.test.ts` (CLI consent, CI and opt-out tests), `src/scripts/check_graph_writers.ts`, the docs, the roadmap files and the earlier round prompts.

```diff
diff --git a/agents/evidence/owner-directives/2026-11-01-map-auto-refresh.md b/agents/evidence/owner-directives/2026-11-01-map-auto-refresh.md
new file mode 100644
index 0000000000..f3f10567b0
--- /dev/null
+++ b/agents/evidence/owner-directives/2026-11-01-map-auto-refresh.md
@@ -0,0 +1,39 @@
+<!-- evidence-type: analysis -->
+
+# Owner directive — the project map keeps itself current without an explicit opt-in
+
+| Field | Value |
+|---|---|
+| Ordered by | the repository owner, in chat |
+| Date | 2026-11-01 |
+| Scope | the `code-graph-refresh` concern and the auto-refresh opt-in (`feat/map-always-fresh`) |
+| Grants by itself | that a local `code-graph build` or `map` outside CI may turn auto-refresh on for that working tree, and that the concern may also run on `stop`, throttled; nothing else — no push, no commit on the developer's behalf |
+
+The owner's words, verbatim, after seeing a project map 20 commits behind:
+
+> "warum ist die map so veraltet? Ich will, dass alles was wir wissen sich immer wieder automatisch aktualisiert, wenn wir an einem projekt arbeiten. AC soll permanent lernen udn sich und die arbeit an projekten verbessern." <!-- md-language-check: ignore -->
+
+("Why is the map so out of date? I want everything we know to update itself
+automatically, again and again, while we work on a project. AC should learn
+permanently and improve itself and the work on projects.")
+
+And, on the follow-up design:
+
+> "ich nicht will, dass die map immer komplett gebaut werden muss. incrementelle updates gehen schneller als komplette." <!-- md-language-check: ignore -->
+
+("I don't want the map to have to be rebuilt completely every time;
+incremental updates are faster than complete ones.")
+
+**Automated local use is in scope, stated rather than implied.** The owner
+asked for the map to update itself while "we" work on a project — the owner
+and the agents working with them. A `build` or `map` an agent runs locally is
+therefore meant to turn auto-refresh on just as one the owner types; the
+exclusions are CI (`CI` set) and the kill switch. Ratification round 3 asked
+for this to be explicit rather than read into the quote; it is recorded here
+as the implementing agent's reading of the owner's request, for the
+ratification to accept or refuse.
+
+What this record does NOT establish: it is written by the agent that
+implements the change, so it is the owner's words as relayed, not a platform
+event. The ratification round that reviews the change decides whether it
+suffices as the policy acknowledgment for consent-by-use.
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 0828ddc3d2..1695598c4e 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -6,3 +6,3 @@
     "review_by": "2027-10-01",
-    "max_bytes": 1560400,
+    "max_bytes": 1562000,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
@@ -128,2 +128,21 @@
             "what_would_have_caught_it": "This gate, on the first push; it did, and the reduction above is the response."
+        },
+        {
+            "date": "2026-11-01",
+            "chunk": "src/scripts/hooks/code_graph_refresh_hook.ts",
+            "from": 15400,
+            "to": 19000,
+            "by": "agent, feat/map-always-fresh",
+            "what_was_added": "The turn-end binding of the code-graph-refresh concern and the bound three ratification rounds required: a `git rev-parse HEAD` probe and a claim file named for the (HEAD, THROTTLE_MS window) pair, created with O_EXCL right before the spawn so exactly one dispatch wins each pair, deleted by its own launch on failure; plus the hook slot in the outcome record. Measured 17,863 bytes; ceiling is that plus about 6 %.",
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
@@ -157,5 +176,5 @@
             "entry": "src/scripts/hooks/code_graph_refresh_hook.ts",
-            "max_bytes": 15400,
+            "max_bytes": 19000,
             "registered_at": "2026-10-23",
-            "derivation": "Measured 14,284 bytes on 2026-10-24 (the session-start code-graph refresh concern with its opt-in, tracked-file and PATH-trust checks, the CLI capability probe and outcome record of the PR #2604 review follow-up, the refresh-lock staleness check it shares with `code-graph refresh --single-flight`, and the hardened spawn environment). The ceiling is that reading plus about 8 %, rounded, with no growth queued; it was registered at 14,000 against 12,726 B and re-derived in the same PR, before any release carried it. Bound on `session_start` alone; a chunk keeps it off every other dispatch's parse, and the dispatch bundle carries only its `LAZY_CONCERNS` row. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the refresh."
+            "derivation": "Measured 14,284 bytes on 2026-10-24 (the session-start code-graph refresh concern with its opt-in, tracked-file and PATH-trust checks, the CLI capability probe and outcome record of the PR #2604 review follow-up, the refresh-lock staleness check it shares with `code-graph refresh --single-flight`, and the hardened spawn environment). The ceiling is that reading plus about 8 %, rounded, with no growth queued; it was registered at 14,000 against 12,726 B and re-derived in the same PR, before any release carried it. Bound on `session_start` alone; a chunk keeps it off every other dispatch's parse, and the dispatch bundle carries only its `LAZY_CONCERNS` row. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the refresh. RAISED to 19,000 on 2026-11-01: the concern is now also bound on `stop`, admitted by an exclusive per-(HEAD, window) claim file (17,863 B measured); the `raise_log` entry whose `to` is 19,000 records it."
         },
diff --git a/src/scripts/code_graph/auto_refresh.ts b/src/scripts/code_graph/auto_refresh.ts
new file mode 100644
index 0000000000..a35f4ef9a3
--- /dev/null
+++ b/src/scripts/code_graph/auto_refresh.ts
@@ -0,0 +1,34 @@
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
+ * `auto-refresh off` leaves an opt-out this never overrides. The owner's
+ * directive is recorded in agents/evidence/owner-directives/2026-11-01-map-auto-refresh.md;
+ * under `CI` nothing is written.
+ */
+export function enableByUse(root: string): string {
+    // A CI run is a script, not a developer asking for a map; the kill switch also covers the opt-in.
+    if (process.env['CI'] || process.env['AGENT_CONFIG_CODE_GRAPH_REFRESH'] === 'off') return '';
+    const home = graphHome(root);
+    if (home.kind !== 'project' || fs.existsSync(home.autoRefreshPath) || fs.existsSync(home.autoRefreshOffPath)) return '';
+    try {
+        fs.mkdirSync(home.buildDir, { recursive: true });
+        fs.writeFileSync(path.join(home.buildDir, path.basename(home.autoRefreshPath)), `${JSON.stringify({ enabled_at: new Date().toISOString(), by: 'use' })}\n`);
+    } catch {
+        return '';
+    }
+    return '    auto-refresh on — refreshed at session start and at a turn end, at most once per HEAD and 10-minute window; `code-graph auto-refresh off` stops it\n';
+}
diff --git a/src/scripts/code_graph/cli.ts b/src/scripts/code_graph/cli.ts
index c24d6d356c..30f679ecb1 100644
--- a/src/scripts/code_graph/cli.ts
+++ b/src/scripts/code_graph/cli.ts
@@ -23,4 +23,5 @@
  *   rebuild-diff                                incremental vs cold build
- *   auto-refresh on|off|status [--root P]      opt this project in to the
- *                                               session-start background refresh
+ *   auto-refresh on|off|status [--root P]      turn the background refresh
+ *                                               on or off; a local `build` or
+ *                                               `map` turns it on unless `off`
  *   projects list|add|remove|prune             the user-global registry of
@@ -161,2 +162,3 @@ import {
 } from './detect.js';
+import { enableByUse } from './auto_refresh.js';
 import { graphHome } from './graph_home.js';
@@ -254,3 +256,5 @@ async function cmdBuild(argv: string[]): Promise<number> {
     const { graph, fileCount, reExtracted, reused, lanes } = await buildFromRepo(root, out, { update, lanes: !argv.includes('--no-lanes') });
-    if (out === buildCacheFor(root)) registerUse(root, graph, git(root, 'rev-parse', 'HEAD'));
+    const ownCache = out === buildCacheFor(root);
+    if (ownCache) registerUse(root, graph, git(root, 'rev-parse', 'HEAD'));
+    const consent = ownCache ? enableByUse(root) : '';
     const c = graph.edge_confidence_counts;
@@ -264,2 +268,3 @@ async function cmdBuild(argv: string[]): Promise<number> {
             (out ? `    cache: ${shown(root, out)}\n` : '') +
+            consent +
             legacyCacheNotice(root),
@@ -1147,5 +1152,5 @@ async function cmdRefresh(argv: string[]): Promise<number> {
 /**
- * `auto-refresh on|off|status` — the explicit, local, per-project opt-in the
- * `code-graph-refresh` session concern requires before it starts anything
- * (ratification round of 2026-10-23: an existing cache is not consent).
+ * `auto-refresh on|off|status` — the local, per-project switch the
+ * `code-graph-refresh` concern reads before it starts anything. `on` is also
+ * what a local `build` or `map` does (`enableByUse`); `off` is sticky.
  */
@@ -1170,6 +1175,7 @@ function cmdAutoRefresh(argv: string[]): number {
         if (now !== marker) fs.rmSync(marker, { force: true });
+        fs.rmSync(home.autoRefreshOffPath, { force: true });
         const cli = usableCli(root);
         process.stdout.write(
-            'auto-refresh on — each agent session start refreshes the graph, and agents/map/ when it exists,\n' +
-                'in the background (POSIX hosts). `code-graph auto-refresh off` stops it.\n' +
+            'auto-refresh on — each agent session start and turn end refreshes the graph, at most once per HEAD and 10-minute window,\n' +
+                'and agents/map/ when it exists, in the background (POSIX hosts). `code-graph auto-refresh off` stops it.\n' +
                 'The opt-in is per working tree: run it again in each new git worktree.\n' +
@@ -1188,3 +1194,7 @@ function cmdAutoRefresh(argv: string[]): number {
         for (const m of new Set([marker, path.join(home.buildDir, path.basename(marker)), path.join(home.legacyDir, path.basename(marker))])) fs.rmSync(m, { force: true });
-        process.stdout.write('auto-refresh off\n');
+        if (home.kind === 'project') {
+            fs.mkdirSync(home.buildDir, { recursive: true });
+            fs.writeFileSync(home.autoRefreshOffPath, `${JSON.stringify({ disabled_at: new Date().toISOString() })}\n`);
+        }
+        process.stdout.write('auto-refresh off — a later `build` or `map` keeps it off; `auto-refresh on` reverses this\n');
         return 0;
@@ -1197,3 +1207,3 @@ function cmdAutoRefresh(argv: string[]): number {
     const last = readRefreshRecords(root);
-    const line = (r: (typeof last)['refresh']): string => (r ? `${r.outcome} at ${r.at}${r.detail ? ` (${r.detail})` : ''}` : 'never');
+    const line = (r: (typeof last)['refresh']): string => (r ? `${r.outcome}${r.slot ? ` on ${r.slot}` : ''} at ${r.at}${r.detail ? ` (${r.detail})` : ''}` : 'never');
     const mapDir = home.mapDir;
@@ -1203,5 +1213,5 @@ function cmdAutoRefresh(argv: string[]): number {
     process.stdout.write(
-        `auto-refresh: ${fs.existsSync(marker) ? 'on' : 'off'}\n` +
+        `auto-refresh: ${fs.existsSync(home.autoRefreshOffPath) ? 'off (opted out)' : fs.existsSync(marker) ? 'on' : 'off — the next local build or map turns it on'}\n` +
             `cli: ${'reason' in cli ? (cli.reason === 'no-cli' ? 'none usable — nothing will run' : `${cli.cli} ${cliPackage(cli.cli)?.version ?? '?'} — too old, nothing will run`) : `${cli.cli} ${cliPackage(cli.cli)?.version ?? '?'}`}\n` +
-            `last session start: ${line(last['session-start'])}\n` +
+            `last concern run (session start or turn end): ${line(last['session-start'])}\n` +
             `last refresh: ${line(last.refresh)}\n` +
@@ -1339,5 +1349,3 @@ async function drawMap(argv: string[]): Promise<number> {
             `    wrote: ${r.written.length} files under ${rel}/ — open ${path.join(rel, 'index.html')}\n` +
-            (fs.existsSync(graphHome(root).autoRefreshPath)
-                ? ''
-                : '    keep it current at every agent session start: agent-config code-graph auto-refresh on\n'),
+            (out ? '' : enableByUse(root)),
     );
diff --git a/src/scripts/code_graph/graph_home.ts b/src/scripts/code_graph/graph_home.ts
index 4721d924aa..661ec5bf1e 100644
--- a/src/scripts/code_graph/graph_home.ts
+++ b/src/scripts/code_graph/graph_home.ts
@@ -28,2 +28,4 @@ export const LOCK_REL = path.join(BUILD_DIR_REL, 'code-graph-refresh.lock');
 export const AUTO_REFRESH_REL = path.join(BUILD_DIR_REL, 'code-graph-auto-refresh.json');
+/** Written by `code-graph auto-refresh off`; a local `build` or `map` then no longer turns auto-refresh on. */
+export const AUTO_REFRESH_OFF_REL = path.join(BUILD_DIR_REL, 'code-graph-auto-refresh.off.json');
 /** The layout before ADR-303, read as a fallback for one release. */
@@ -45,2 +47,4 @@ export interface GraphHome {
     autoRefreshPath: string;
+    /** The opt-out marker; current layout only, since no older release wrote one. */
+    autoRefreshOffPath: string;
     /** The directory an older release kept these files in. */
@@ -67,2 +71,3 @@ function home(kind: GraphHome['kind'], root: string, dir: string, mapDir: string
         autoRefreshPath: at(AUTO_REFRESH_REL),
+        autoRefreshOffPath: path.join(buildDir, path.basename(AUTO_REFRESH_OFF_REL)),
         legacyDir,
@@ -133,6 +138,12 @@ export function projectCachePath(root: string): string {
 /** What the session refresh concern reads of a project home, without the rest — its chunk has a byte ceiling. */
-export function projectBuildPaths(root: string): Pick<GraphHome, 'buildDir' | 'cachePath' | 'lockPath' | 'autoRefreshPath'> {
+export function projectBuildPaths(root: string): Pick<GraphHome, 'buildDir' | 'cachePath' | 'lockPath' | 'autoRefreshPath' | 'autoRefreshOffPath'> {
     const b = path.join(root, BUILD_DIR_REL);
     const f = (n: string): string => pick(path.join(b, n), path.join(root, LEGACY_STATE_DIR_REL, n));
-    return { buildDir: b, cachePath: f('code-graph-v1.json'), lockPath: path.join(b, 'code-graph-refresh.lock'), autoRefreshPath: f('code-graph-auto-refresh.json') };
+    return {
+        buildDir: b,
+        cachePath: f('code-graph-v1.json'),
+        lockPath: path.join(b, 'code-graph-refresh.lock'),
+        autoRefreshPath: f('code-graph-auto-refresh.json'),
+        autoRefreshOffPath: path.join(b, path.basename(AUTO_REFRESH_OFF_REL)),
+    };
 }
diff --git a/src/scripts/code_graph/refresh_lock.ts b/src/scripts/code_graph/refresh_lock.ts
index aa29103183..d2c0daf779 100644
--- a/src/scripts/code_graph/refresh_lock.ts
+++ b/src/scripts/code_graph/refresh_lock.ts
@@ -51,2 +51,6 @@ export interface RefreshRecord {
     detail?: string | undefined;
+    /** HEAD when the concern spawned a refresh, so a later turn end with the same HEAD can skip. */
+    head?: string | undefined;
+    /** The hook slot that ran the concern (`session_start`, `stop`); the file name predates the second slot. */
+    slot?: string | undefined;
 }
@@ -62,8 +66,13 @@ export function recordRefresh(root: string, rec: Omit<RefreshRecord, 'at'>): voi
 
-/** For the session concern: its chunk must not carry the user-global resolver. */
-export function recordRefreshIn(stateDir: string, rec: Omit<RefreshRecord, 'at'>): void {
+/**
+ * For the session concern: its chunk must not carry the user-global resolver.
+ * Creates the build directory when missing. Returns whether the record landed.
+ */
+export function recordRefreshIn(stateDir: string, rec: Omit<RefreshRecord, 'at'>, now: number = Date.now()): boolean {
     try {
-        fs.writeFileSync(path.join(stateDir, `code-graph-refresh.${rec.by}.json`), JSON.stringify({ at: new Date().toISOString(), ...rec }));
+        fs.mkdirSync(stateDir, { recursive: true });
+        fs.writeFileSync(path.join(stateDir, `code-graph-refresh.${rec.by}.json`), JSON.stringify({ at: new Date(now).toISOString(), ...rec }));
+        return true;
     } catch {
-        /* never fails a refresh */
+        return false;
     }
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 38771b2153..22a9678b76 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1446,10 +1446,14 @@ concerns:
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
@@ -1713,3 +1717,3 @@ platforms:
     session_end:      [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush]
-    stop:             [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop]
+    stop:             [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop, code-graph-refresh]
     pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, block-credential-reads, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, memory-recall]
@@ -1731,3 +1735,3 @@ platforms:
     session_end:      [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush, journal-record]
-    stop:             [chat-history, verify-before-complete, team-review-gate, end-review-nudge, obligation-settle, turn-end-gate, self-repair, session-register, session-eol, interruption-ledger, roadmap-progress, design-pass-stop, suggestion-capture, journal-record]
+    stop:             [chat-history, verify-before-complete, team-review-gate, end-review-nudge, obligation-settle, turn-end-gate, self-repair, session-register, session-eol, interruption-ledger, roadmap-progress, design-pass-stop, suggestion-capture, code-graph-refresh, journal-record]
     user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, delegation-nudge, skill-route, git-authorization, session-canary, self-repair, session-register, rule-inject, suggestion-capture, journal-record, quota-notice, intake-pass]
@@ -1806,3 +1810,3 @@ platforms:
     # still costs the dispatch, and its entire output is thrown away.
-    stop:             [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop]
+    stop:             [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop, code-graph-refresh]
     user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass]
@@ -1832,3 +1836,3 @@ platforms:
     session_end:        [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush]
-    stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop]
+    stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop, code-graph-refresh]
     user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass]
@@ -1848,3 +1852,3 @@ platforms:
     session_end:        [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush]
-    stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop]
+    stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop, code-graph-refresh]
     user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass]
@@ -1867,3 +1871,3 @@ platforms:
     session_start:      [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, profile-staleness, wrapper-freshness, surface-probe, session-register, code-graph-refresh]
-    stop:               [chat-history, verify-before-complete, self-repair, session-register, design-pass-stop]
+    stop:               [chat-history, verify-before-complete, self-repair, session-register, design-pass-stop, code-graph-refresh]
     # language-mirror IS bound here: unlike minimal-safe-diff it needs only the
@@ -1886,3 +1890,3 @@ platforms:
     session_end:        [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush]
-    stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop]
+    stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop, code-graph-refresh]
     user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass]
diff --git a/src/scripts/hooks/code_graph_refresh_hook.ts b/src/scripts/hooks/code_graph_refresh_hook.ts
index 5fe10f82bd..dc42f23e90 100644
--- a/src/scripts/hooks/code_graph_refresh_hook.ts
+++ b/src/scripts/hooks/code_graph_refresh_hook.ts
@@ -2,3 +2,3 @@
 /**
- * Session-start code-graph refresh — the consumer-side freshness carrier.
+ * Session-start and turn-end code-graph refresh — the consumer-side freshness carrier.
  *
@@ -20,6 +20,21 @@
  *
+ * WHY IT ALSO RUNS AT TURN END. Bound on `session_start` alone, a long session
+ * that commits twenty times keeps the map it started with (measured 2026-11-01:
+ * a map 20 commits behind). On `stop` it costs one `git rev-parse HEAD` and one
+ * exclusive file create: a claim named for the HEAD (or `none` before the first
+ * commit) and the current `THROTTLE_MS` window is created with `O_EXCL` right
+ * before the spawn. Exactly one dispatch wins a (HEAD, window) pair; every other
+ * gets `fresh` — so at most one launch per HEAD and fixed window, and two may
+ * fall either side of a window boundary. There is no lock to take over, nothing
+ * to release and no record another process could overwrite (ratification rounds
+ * 1-4, 2026-11-01). Only claims two or more windows old are swept, so a claim is
+ * never deleted while its pair can still be won; a launch that fails deletes only
+ * its own, current-window claim. A clock set back lands in an older window,
+ * which suppresses a refresh for at most one window.
+ *
  * WHEN IT DOES NOTHING — the conditions a ratification round of 2026-10-23
  * (two of two seats, refused the first cut) made load-bearing:
- *   · the project never ran `code-graph auto-refresh on`. An existing cache is
- *     not consent: a repository can commit one.
+ *   · no opt-in marker. `code-graph auto-refresh on` writes one, and so does a
+ *     local `code-graph build` or `map` unless `auto-refresh off` left an
+ *     opt-out. An existing cache alone is not consent: a repository can commit one.
  *   · the opt-in marker or the cache is TRACKED by git. Both live under the
@@ -62,4 +77,62 @@ export type RefreshOutcome =
     | 'cli-too-old'
+    | 'fresh'
+    | 'record-failed'
     | 'spawned';
 
+/** How long a spawn for one HEAD covers later turn ends; a session start after it re-checks. */
+export const THROTTLE_MS = 10 * 60 * 1000;
+/** The claim for one (HEAD, window) pair; its name is the whole protocol. */
+export function claimPath(buildDir: string, head: string | null, now: number): string {
+    return path.join(buildDir, `code-graph-refresh.claim-${head ?? 'none'}-${Math.floor(now / THROTTLE_MS)}`);
+}
+
+const CLAIM_RE = /^code-graph-refresh\.claim-.+-(\d+)$/;
+
+/** The window a claim file names, or null for a name that is not a claim. */
+function windowOf(file: string): number | null {
+    const m = CLAIM_RE.exec(path.basename(file));
+    return m ? Number(m[1]) : null;
+}
+
+/**
+ * Deletes claims at least two windows older than `current`: no dispatch can
+ * name them again (windows only move forward), so deleting one never frees a
+ * pair someone could still win. Claims of the current and the previous window —
+ * any HEAD — are never touched, so an active claim keeps its owner.
+ */
+function sweepSpent(dir: string, current: number | null): void {
+    if (current === null) return;
+    try {
+        for (const f of fs.readdirSync(dir)) {
+            const w = windowOf(f);
+            if (w !== null && w <= current - 2) fs.rmSync(path.join(dir, f), { force: true });
+        }
+    } catch {
+        /* a spent claim only costs a directory entry */
+    }
+}
+
+/** Creates the claim exclusively: `won`, `taken` (another dispatch holds this pair) or `failed`. */
+function claim(file: string): 'won' | 'taken' | 'failed' {
+    try {
+        fs.mkdirSync(path.dirname(file), { recursive: true });
+        fs.writeFileSync(file, '', { flag: 'wx' });
+    } catch (e) {
+        return (e as NodeJS.ErrnoException).code === 'EEXIST' ? 'taken' : 'failed';
+    }
+    sweepSpent(path.dirname(file), windowOf(file));
+    return 'won';
+}
+
+/** `session_start` / `stop` from either invocation shape, or undefined. */
+export function slotOf(envelope: Record<string, unknown>): string | undefined {
+    const payload = (typeof envelope['payload'] === 'object' && envelope['payload'] !== null ? envelope['payload'] : {}) as Record<string, unknown>;
+    for (const v of [envelope['event'], envelope['native_event'], envelope['hook_event_name'], payload['hook_event_name']]) {
+        if (typeof v !== 'string' || v === '') continue;
+        const raw = v.toLowerCase();
+        return raw === 'sessionstart' ? 'session_start' : raw;
+    }
+    return undefined;
+}
+
 export { resolveCli } from '../code_graph/refresh_cli.js';
@@ -92,2 +165,11 @@ export function repoRoot(start: string): string | null {
 
+/** HEAD of `root`, or null when git cannot say (no commit yet, not a work tree). */
+function headOf(root: string): string | null {
+    try {
+        return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], env: hardenedSpawnEnv() }).trim() || null;
+    } catch {
+        return null;
+    }
+}
+
 /** True when git tracks any of `rels` under `root` (or git cannot answer). */
@@ -106,3 +188,4 @@ function anyTracked(root: string, rels: readonly string[]): boolean {
 
-export function refreshFor(cwd: string, spawnFn: typeof spawn = spawn): RefreshOutcome {
+/** `beforeClaim` runs right before the claim is created; tests use it to interleave a second dispatch. */
+export function refreshFor(cwd: string, spawnFn: typeof spawn = spawn, now: number = Date.now(), slot?: string, beforeClaim?: () => void): RefreshOutcome {
     if (process.env['AGENT_CONFIG_CODE_GRAPH_REFRESH'] === 'off') return 'disabled';
@@ -114,7 +197,11 @@ export function refreshFor(cwd: string, spawnFn: typeof spawn = spawn): RefreshO
     const home = projectBuildPaths(root);
-    if (!fs.existsSync(home.autoRefreshPath)) return 'not-opted-in';
+    // The opt-out wins over a marker a concurrent `build` may have written beside it.
+    if (!fs.existsSync(home.autoRefreshPath) || fs.existsSync(home.autoRefreshOffPath)) return 'not-opted-in';
     // A repository-committed opt-in is refused before anything is written into the tree.
     if (anyTracked(root, [home.autoRefreshPath, home.cachePath].map((p) => path.relative(root, p)))) return 'tracked';
+    const head = headOf(root);
+    const file = claimPath(home.buildDir, head, now);
+    if (fs.existsSync(file)) return 'fresh';
     const done = (outcome: RefreshOutcome, detail?: string): RefreshOutcome => {
-        recordRefreshIn(home.buildDir, { by: 'session-start', outcome, detail });
+        recordRefreshIn(home.buildDir, { by: 'session-start', outcome, detail, slot, ...(head !== null ? { head } : {}) }, now);
         return outcome;
@@ -126,2 +213,6 @@ export function refreshFor(cwd: string, spawnFn: typeof spawn = spawn): RefreshO
     if ('reason' in verdict) return done(verdict.reason, (verdict as { cli?: string }).cli);
+    beforeClaim?.();
+    const won = claim(file);
+    if (won === 'taken') return 'fresh';
+    if (won === 'failed') return 'record-failed';
     const child = spawnFn(verdict.cli, [...REFRESH_ARGS, '--root', root], {
@@ -132,3 +223,4 @@ export function refreshFor(cwd: string, spawnFn: typeof spawn = spawn): RefreshO
     });
-    child.on('error', () => {});
+    // The claim is this dispatch's alone (created exclusively, never taken over), so deleting it on a failed launch frees exactly this pair.
+    child.on('error', () => fs.rmSync(file, { force: true }));
     child.unref();
@@ -142,3 +234,3 @@ export function main(): number {
         const cwd = typeof envelope['cwd'] === 'string' && envelope['cwd'] ? envelope['cwd'] : process.cwd();
-        refreshFor(cwd);
+        refreshFor(cwd, spawn, Date.now(), slotOf(envelope));
     } catch {
diff --git a/tests/scripts/hooks/code_graph_refresh_hook.test.ts b/tests/scripts/hooks/code_graph_refresh_hook.test.ts
index c4bfe611fa..be54519b05 100644
--- a/tests/scripts/hooks/code_graph_refresh_hook.test.ts
+++ b/tests/scripts/hooks/code_graph_refresh_hook.test.ts
@@ -13,3 +13,6 @@ import {
     repoRoot,
+    claimPath,
     resolveCli,
+    slotOf,
+    THROTTLE_MS,
 } from '../../../src/scripts/hooks/code_graph_refresh_hook.js';
@@ -215 +218,189 @@ describe('code-graph-refresh session concern', () => {
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
+    it('without a HEAD (no commit yet) the window alone throttles', () => {
+        optedIn();
+        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
+        expect(refreshFor(root, fakeSpawn)).toBe('fresh');
+        expect(refreshFor(root, fakeSpawn, Date.now() + THROTTLE_MS + 1000)).toBe('spawned');
+        expect(calls).toHaveLength(2);
+    });
+
+
+
+    it('the opt-out wins over a marker written beside it', () => {
+        optedIn();
+        fs.writeFileSync(path.join(root, 'agents', 'map', '.build', 'code-graph-auto-refresh.off.json'), '{}');
+        expect(refreshFor(root, fakeSpawn)).toBe('not-opted-in');
+        expect(calls).toHaveLength(0);
+    });
+
+    it('a legacy-only layout with no build directory still records and throttles', () => {
+        fs.rmSync(path.join(root, 'agents', 'map'), { recursive: true, force: true });
+        const legacy = path.join(root, 'agents', 'runtime', 'state');
+        fs.mkdirSync(legacy, { recursive: true });
+        fs.writeFileSync(path.join(legacy, path.basename(CACHE_REL)), '{}');
+        fs.writeFileSync(path.join(legacy, path.basename(AUTO_REFRESH_REL)), '{}');
+        writeCli(path.join(outside, 'bin'));
+        process.env['PATH'] = [path.join(outside, 'bin'), GIT_DIR].join(path.delimiter);
+        commit('one');
+        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
+        expect(refreshFor(root, fakeSpawn)).toBe('fresh');
+        expect(calls).toHaveLength(1);
+    });
+
+
+
+
+
+    it('records which slot ran it', () => {
+        optedIn();
+        commit('one');
+        expect(refreshFor(root, fakeSpawn, Date.now(), 'stop')).toBe('spawned');
+        expect(readRefreshRecords(root)['session-start']?.slot).toBe('stop');
+        expect(slotOf({ event: 'stop' })).toBe('stop');
+        expect(slotOf({ hook_event_name: 'SessionStart' })).toBe('session_start');
+        expect(slotOf({ payload: { hook_event_name: 'Stop' } })).toBe('stop');
+        expect(slotOf({})).toBeUndefined();
+    });
+
+    it('does not spawn when the claim cannot be created', () => {
+        optedIn();
+        commit('one');
+        const build = path.join(root, 'agents', 'map', '.build');
+        fs.chmodSync(build, 0o500);
+        try {
+            expect(refreshFor(root, fakeSpawn)).toBe('record-failed');
+            expect(calls).toHaveLength(0);
+        } finally {
+            fs.chmodSync(build, 0o700);
+        }
+    });
+
+    it('a win never deletes a claim another pair could still hold, and sweeps only spent windows', () => {
+        optedIn();
+        commit('one');
+        const build = path.join(root, 'agents', 'map', '.build');
+        const now = Date.now();
+        const otherHeadNow = claimPath(build, 'b'.repeat(40), now);
+        const otherHeadPrev = claimPath(build, 'b'.repeat(40), now - THROTTLE_MS);
+        const spent = claimPath(build, 'b'.repeat(40), now - 2 * THROTTLE_MS);
+        for (const f of [otherHeadNow, otherHeadPrev, spent]) fs.writeFileSync(f, '');
+        expect(refreshFor(root, fakeSpawn, now)).toBe('spawned');
+        expect(fs.existsSync(otherHeadNow)).toBe(true);
+        expect(fs.existsSync(otherHeadPrev)).toBe(true);
+        expect(fs.existsSync(spent)).toBe(false);
+    });
+
+    it('a dispatch for another HEAD interleaved before a claim leaves both claims standing', () => {
+        optedIn();
+        commit('one');
+        const build = path.join(root, 'agents', 'map', '.build');
+        const now = Date.now();
+        const elsewhere = claimPath(build, 'c'.repeat(40), now);
+        // Another pair is won between this dispatch's checks and its claim.
+        expect(refreshFor(root, fakeSpawn, now, 'stop', () => fs.writeFileSync(elsewhere, '', { flag: 'wx' }))).toBe('spawned');
+        expect(fs.existsSync(elsewhere)).toBe(true);
+        // And this pair stays claimed against a later dispatch.
+        expect(refreshFor(root, fakeSpawn, now)).toBe('fresh');
+        expect(calls).toHaveLength(1);
+    });
+
+    it('a later window\'s claim is not swept by an earlier-window win (clock set back)', () => {
+        optedIn();
+        commit('one');
+        const build = path.join(root, 'agents', 'map', '.build');
+        const now = Date.now();
+        const future = claimPath(build, 'd'.repeat(40), now + 3 * THROTTLE_MS);
+        fs.writeFileSync(future, '');
+        expect(refreshFor(root, fakeSpawn, now)).toBe('spawned');
+        expect(fs.existsSync(future)).toBe(true);
+    });
+
+    it('a dispatch that runs between another one\'s checks and its claim wins once, the other gets fresh', () => {
+        optedIn();
+        commit('one');
+        let inner: string | null = null;
+        const outer = refreshFor(root, fakeSpawn, Date.now(), 'stop', () => {
+            inner = refreshFor(root, fakeSpawn, Date.now(), 'stop');
+        });
+        expect([outer, inner].sort()).toEqual(['fresh', 'spawned']);
+        expect(calls).toHaveLength(1);
+    });
+
+    it('a launch that errors deletes its own claim, so the next dispatch spawns', async () => {
+        optedIn();
+        commit('one');
+        const errSpawn = ((cmd: string, args: readonly string[], opts: Record<string, unknown>) => {
+            calls.push({ cmd, args, opts });
+            const child = new EventEmitter() as EventEmitter & { unref: () => void };
+            child.unref = () => {};
+            queueMicrotask(() => child.emit('error', new Error('ENOENT')));
+            return child;
+        }) as unknown as typeof spawn;
+        expect(refreshFor(root, errSpawn)).toBe('spawned');
+        await new Promise((r) => setTimeout(r, 10));
+        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
+        expect(calls).toHaveLength(2);
+    });
+
+    it('eight concurrent processes released at one instant spawn exactly once', async () => {
+        optedIn();
+        commit('one');
+        const marker = path.join(outside, 'spawned');
+        const at = Date.now() + 3000;
+        const file = path.join(outside, 'race.mts');
+        fs.writeFileSync(
+            file,
+            [
+                `import fs from 'node:fs';`,
+                `import { refreshFor } from ${JSON.stringify(path.resolve('src/scripts/hooks/code_graph_refresh_hook.ts'))};`,
+                `const fake = () => { fs.appendFileSync(${JSON.stringify(marker)}, 'x'); return { on() {}, unref() {} }; };`,
+                `while (Date.now() < ${at}) { /* barrier */ }`,
+                `refreshFor(${JSON.stringify(root)}, fake as never);`,
+            ].join('\n'),
+        );
+        const tsx = path.resolve('node_modules', '.bin', 'tsx');
+        const env = { ...process.env, PATH: [process.env['PATH'], path.dirname(process.execPath)].join(path.delimiter) };
+        const { spawn: realSpawn } = await import('node:child_process');
+        const codes = await Promise.all(
+            Array.from({ length: 8 }, () => new Promise<number | null>((resolve) => realSpawn(tsx, [file], { stdio: 'ignore', env }).on('exit', resolve))),
+        );
+        expect(codes.every((c) => c === 0)).toBe(true);
+        expect(fs.readFileSync(marker, 'utf-8')).toBe('x');
+    }, 60_000);
+});
```
