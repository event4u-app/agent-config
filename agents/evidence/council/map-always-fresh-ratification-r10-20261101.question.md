<!-- evidence-type: analysis -->

# Ratification review — a code-graph refresh that turns itself on by use and also runs at turn end — round 10

You are an independent reviewer for a change in the `event4u/agent-config` repository. Three files in it are on the ratification gate's list (hook plumbing): `src/scripts/hook_manifest.yaml`, its compiled projection `src/scripts/hook_manifest.json`, and `src/config/hook-bundle-budget.json`. Under ADR-268 § 4 an agent may change them but may not ratify its own change, so the change needs a two-provider verdict.

subject: 358ad3539cc7b80f29e20c0c45ac04b0dcc9efec3e4f6ec9cf9185c6be53807d

(The digest covers the three gated files at the branch head, computed with `./scripts-run src/scripts/ratification_subject --base-ref origin/main`.)

## Background

The `code-graph-refresh` concern spawns a detached `agent-config code-graph refresh --single-flight --map` so a project's code graph and its `agents/map/` stay current. Before this change it ran on `session_start` only, and only after the developer had run `code-graph auto-refresh on` in that project. A ratification round on 2026-10-23 (two seats) set both conditions: an existing cache is not consent, because a repository can commit one; and no `stop` binding, because a spawn per turn is waste.

On 2026-11-01 the owner reported a project map 20 commits behind: auto-refresh had never been switched on there, so it never refreshed. The owner asked for the map to update itself while work happens.

## What the change does

1. **Consent by use.** A local `code-graph build` (into the project's own cache path, not a foreign `--out`) or `code-graph map` (into the project's map dir) writes the auto-refresh marker into the gitignored `agents/map/.build/`, unless an opt-out marker exists, `CI` is set, or the kill switch is on. `auto-refresh off` removes the marker and writes the opt-out marker; `auto-refresh on` removes the opt-out. This includes a build or map an agent runs locally: the owner directive `agents/evidence/owner-directives/2026-11-01-map-auto-refresh.md` (in the diff) records the owner's words and states that reading explicitly, for this ratification to accept or refuse. The concern's existing refusals are unchanged: a marker or cache tracked by git, a CLI that resolves inside the repository or is too old, a held refresh lock, Windows, replay mode, the kill switch. The opt-out wins in the concern even beside an opt-in.
2. **Turn-end binding, admitted by an exclusive claim.** The concern is added to the `stop` slot of the seven platforms that bind it on `session_start`; on claude it sits before `journal-record`, which must end that chain. Per dispatch it reads `git rev-parse HEAD` (or `none` before the first commit) and checks for a claim file `.build/claims/<UTC day of the window>/<head>-<floor(now / THROTTLE_MS)>` (10-minute windows); if it exists → `fresh`, before any further probe. Otherwise, after the tracked-file, cache, refresh-lock and CLI checks, it reads the clock again, refuses (`fresh`) a window two or more windows old, and creates the claim with `O_EXCL` (`flag: 'wx'`) immediately before the spawn: exactly one dispatch wins a pair, every other gets `EEXIST` → `fresh`; any other create error → `record-failed`, no spawn. The winner deletes only whole day folders two or more days older than today. **Containment:** every existing path component from the resolved repository root (`repoRoot` uses `realpathSync`) down to the day folder — `agents/`, `map/`, `.build/`, `claims/`, the day — must be a real directory by `lstat` (never followed), checked before and after the folder is created; a symlink or a planted file at any of them refuses the claim (`record-failed`, no spawn); the sweep skips `claims/` unless it is a real directory and removes only entries that are real directories; and claim storage the repository tracks is refused (`tracked`) like a tracked marker or cache. **The guarantee, stated with its limit:** deletion trails admission by more than a day, so a pair can be won twice only if a dispatch pauses between its admission check and its create, or two processes' clocks disagree, by more than a day; such a duplicate launch is a second `code-graph refresh --single-flight`, which backs off on the refresh lock (the existing, separately ratified single-flight lock) and draws nothing. A launch whose child emits `error` keeps its claim; the pair retries in the next window; no claim is deleted by name. A clock set back lands in an older window, suppressing a refresh for at most that window. The outcome record (`code-graph-refresh.session-start.json`, carrying `slot`) is for `auto-refresh status` only.
3. **Budget.** Bundle ceiling 1,560,400 → 1,562,000 (measured 1,561,506) and the concern's chunk ceiling 15,400 → 20,500 (measured 19,741), each with a `raise_log` entry.
4. **Every write this change adds is contained.** `src/scripts/_lib/contained_write.ts` carries the claim's rule for all of them: every existing component from the repository root down to the target's folder must be a real directory by `lstat` (checked before and after the folder is created), and the file is opened with `O_WRONLY|O_CREAT|O_TRUNC|O_NOFOLLOW`. Used by: the claim (item 2), the concern's outcome record (`recordRefreshIn` with `root`, also from the CLI for a project home), the consent marker (`enableByUse`), and `auto-refresh on` / `off`. **Stated limit:** Node has no `openat`-style descriptor walk, so a concurrent process replacing a checked folder with a symlink between the check and the write is narrowed, not closed. **Pre-existing, out of this change:** the engine's existing writes under `agents/map/` (map generation and swap, graph cache and twin, refresh lock, `auto-refresh off`'s marker removal) are not contained; they are recorded in a parked roadmap in this change, `agents/roadmaps/later/road-to-a-map-engine-that-never-writes-through-a-symlink.md`.
5. Ungated parts of the same branch: the interfaces and data lane readers skip gitignored files; a parked roadmap records an unrelated stale-date gate.

## Rounds 1–9 and what changed

Prompts `…-r1-…` to `…-r9-…` are committed beside this one; all refused 2/2. Each named defect is fixed and tested:

- R1–R5: record-write failure, no-HEAD throttle, future-dated record, opt-out precedence, concurrent dispatch, mislabelled slot, scripted consent (CI exclusion), mutex takeover/release (mutex removed for the `O_EXCL` claim; an 8-process race spawns once), sweep deleting live claims (sweep moved to old windows), paused dispatch re-creating a swept claim (age check by a fresh clock), failed-launch delete by name (removed).
- R6: the age gate and the create were still a check-then-act pair the two-window sweep could fall between, and a clock set back could reuse a swept window. Fixed by moving the sweep a day behind admission (day folders, item 2) and stating the residual limit and what absorbs it. Test: a claim of yesterday survives a win today; fails when the sweep horizon is one day.
- R7: the recursive sweep could follow a repository-provided symlink at `.build/claims` and delete outside the checkout. Fixed by the containment rules in item 2. Tests: a `claims` symlink to an outside folder holding an old day folder → `record-failed`, no spawn, the outside file intact (fails with the guards removed); a symlinked old day folder inside `claims/` is not followed (second layer); tracked claim storage → `tracked`. Turn-end cost stated: a dispatch, `git rev-parse HEAD` and a few `stat` calls per turn; a new HEAD may launch on consecutive turns.
- R8: containment checked only the last three components, so a symlinked `agents/` or `agents/map/` could redirect the write and the sweep outside the checkout. Fixed: the whole path from the repository root is checked (item 2). Test: `agents/map` symlinked to an outside folder holding an old day folder → `record-failed`, no spawn, the outside tree unchanged; fails with the containment check disabled.
- R9: the outcome record and the opt-in and opt-out writes still followed a repository-shipped symlink; the ancestor check could race a concurrent replacement. Fixed: one contained-write helper for all of them (item 4); the race is stated as narrowed, not closed; the engine's pre-existing writers are parked as a roadmap. Tests: the helper refuses a symlinked ancestor and a symlinked target, leaving the outside file intact; the concern writes no outcome record through a symlinked `agents/map`; `build` and `auto-refresh on` write no opt-in through it. Helper and record tests fail without containment.

The owner has since confirmed consent by local use, agents included, in chat; the answer is quoted verbatim in the owner directive (in the diff).

## What to answer

1. Does the diff contain a defect — in the throttle, the consent-by-use path, the opt-out, the manifest bindings or the budget entries? Name file and line for each.
2. Does the change expand any agent's or hook's authority, or weaken an existing gate? In particular: is a local `build`/`map` run an adequate consent signal given the 2026-10-23 concern that a repository can commit a cache, and does the `stop` binding reintroduce the per-turn cost that round refused?
3. Can the turn-end path spawn more than the throttle intends (for example through the legacy layout, a missing build directory, or a record it cannot write)?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The diff (`git diff -U1 origin/main...feat/map-always-fresh`)

One context line (bundle ceiling). Complete for the three gated files, the hook, its record writer, the graph-home resolver, the consent module, the CLI and the owner directive. Left out: compiled `hook_manifest.json`, the lane readers and their test (run in no hook), the two test files (`tests/scripts/hooks/code_graph_refresh_hook.test.ts`, the concern's tests named in the rounds list; `tests/scripts/code_graph_refresh.test.ts`, CLI consent, CI and opt-out), `src/scripts/check_graph_writers.ts`, docs, roadmaps, earlier prompts.

```diff
diff --git a/agents/evidence/owner-directives/2026-11-01-map-auto-refresh.md b/agents/evidence/owner-directives/2026-11-01-map-auto-refresh.md
new file mode 100644
index 0000000000..d6b30076c9
--- /dev/null
+++ b/agents/evidence/owner-directives/2026-11-01-map-auto-refresh.md
@@ -0,0 +1,50 @@
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
+**Confirmed by the owner, 2026-11-01.** Asked in chat whether consent by use —
+including a `build` or `map` an agent runs locally — should turn auto-refresh
+on (option 1) or only an explicit `auto-refresh on` should (option 2), the
+owner answered:
+
+> "1.a und 2.a - also deine vorschläge" <!-- md-language-check: ignore -->
+
+("1.a and 2.a — so your proposals"), choosing consent by local use, agents
+included. (2.a concerns the follow-up map work, not this change.)
+
+What this record does NOT establish: it is written by the agent that
+implements the change, so it is the owner's words as relayed, not a platform
+event. The ratification round that reviews the change decides whether it suffices as
+the policy acknowledgment for consent-by-use; the owner's answer above is the
+owner's own decision on the policy itself.
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 0828ddc3d2..624c6d74f8 100644
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
+            "to": 20500,
+            "by": "agent, feat/map-always-fresh",
+            "what_was_added": "The turn-end binding of the code-graph-refresh concern and the bounds eight ratification rounds required: a `git rev-parse HEAD` probe; a claim file per (HEAD, THROTTLE_MS window) in a per-UTC-day folder, created with O_EXCL right before the spawn after an age check by a fresh clock; a sweep of day folders two or more days old; containment that refuses a claim unless every path component from the repository root down is a real directory (lstat); tracked claim storage refused; the hook slot in the outcome record. Measured 19,741 bytes; ceiling 20,500 leaves about 4 %.",
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
+            "max_bytes": 20500,
             "registered_at": "2026-10-23",
-            "derivation": "Measured 14,284 bytes on 2026-10-24 (the session-start code-graph refresh concern with its opt-in, tracked-file and PATH-trust checks, the CLI capability probe and outcome record of the PR #2604 review follow-up, the refresh-lock staleness check it shares with `code-graph refresh --single-flight`, and the hardened spawn environment). The ceiling is that reading plus about 8 %, rounded, with no growth queued; it was registered at 14,000 against 12,726 B and re-derived in the same PR, before any release carried it. Bound on `session_start` alone; a chunk keeps it off every other dispatch's parse, and the dispatch bundle carries only its `LAZY_CONCERNS` row. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the refresh."
+            "derivation": "Measured 14,284 bytes on 2026-10-24 (the session-start code-graph refresh concern with its opt-in, tracked-file and PATH-trust checks, the CLI capability probe and outcome record of the PR #2604 review follow-up, the refresh-lock staleness check it shares with `code-graph refresh --single-flight`, and the hardened spawn environment). The ceiling is that reading plus about 8 %, rounded, with no growth queued; it was registered at 14,000 against 12,726 B and re-derived in the same PR, before any release carried it. Bound on `session_start` alone; a chunk keeps it off every other dispatch's parse, and the dispatch bundle carries only its `LAZY_CONCERNS` row. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the refresh. RAISED to 20,500 on 2026-11-01: the concern is now also bound on `stop`, admitted by an exclusive claim file in a per-day folder whose whole path from the repository root is lstat-contained, with every write it makes contained (19,741 B measured); the `raise_log` entry whose `to` is 20,500 records it."
         },
diff --git a/src/scripts/_lib/contained_write.ts b/src/scripts/_lib/contained_write.ts
new file mode 100644
index 0000000000..55ed75f70b
--- /dev/null
+++ b/src/scripts/_lib/contained_write.ts
@@ -0,0 +1,69 @@
+/**
+ * Writes that cannot be redirected outside a repository by a symlink it ships.
+ *
+ * A repository can commit `agents/map` (or any folder under it) as a symlink;
+ * a write that follows it lands wherever the link points. Every component from
+ * the repository root down to the target's folder must be a real directory
+ * (lstat, never followed), and the final component is opened with O_NOFOLLOW,
+ * so a symlink there fails the open instead of being followed.
+ *
+ * What this does NOT close: a concurrent process replacing a checked folder
+ * with a symlink between the check and the write. Node has no openat-style
+ * descriptor walk, so the window is narrowed (checked before and after the
+ * folder is created), not removed.
+ */
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
+/** True for a directory that is not a symlink. */
+export function isRealDir(p: string): boolean {
+    try {
+        const st = fs.lstatSync(p);
+        return st.isDirectory() && !st.isSymbolicLink();
+    } catch {
+        return false;
+    }
+}
+
+/**
+ * Whether every component from `root` down to `dir` that exists is a real
+ * directory. Components that do not exist yet pass: the caller creates them.
+ */
+export function containedPath(root: string, dir: string): boolean {
+    const rel = path.relative(root, dir);
+    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return false;
+    let at = root;
+    for (const part of rel.split(path.sep)) {
+        at = path.join(at, part);
+        try {
+            fs.lstatSync(at);
+        } catch {
+            return true;
+        }
+        if (!isRealDir(at)) return false;
+    }
+    return true;
+}
+
+/**
+ * Writes `content` to `file` inside `root`, creating its folder; false when any
+ * component is not a real directory, the target is a symlink, or the write fails.
+ */
+export function writeContained(root: string, file: string, content: string): boolean {
+    const dir = path.dirname(file);
+    if (!containedPath(root, dir)) return false;
+    try {
+        fs.mkdirSync(dir, { recursive: true });
+        if (!containedPath(root, dir)) return false;
+        const { O_WRONLY, O_CREAT, O_TRUNC, O_NOFOLLOW } = fs.constants;
+        const fd = fs.openSync(file, O_WRONLY | O_CREAT | O_TRUNC | (O_NOFOLLOW ?? 0), 0o644);
+        try {
+            fs.writeFileSync(fd, content);
+        } finally {
+            fs.closeSync(fd);
+        }
+        return true;
+    } catch {
+        return false;
+    }
+}
diff --git a/src/scripts/code_graph/auto_refresh.ts b/src/scripts/code_graph/auto_refresh.ts
new file mode 100644
index 0000000000..bcd4513194
--- /dev/null
+++ b/src/scripts/code_graph/auto_refresh.ts
@@ -0,0 +1,31 @@
+/**
+ * The auto-refresh opt-in a local `build` or `map` writes (see `enableByUse`).
+ */
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
+import { writeContained } from '../_lib/contained_write.js';
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
+    // Contained: a symlink the repository ships under agents/map never redirects the opt-in.
+    if (!writeContained(root, path.join(home.buildDir, path.basename(home.autoRefreshPath)), `${JSON.stringify({ enabled_at: new Date().toISOString(), by: 'use' })}\n`)) return '';
+    return '    auto-refresh on — refreshed at session start and at a turn end, at most once per HEAD and 10-minute window; `code-graph auto-refresh off` stops it\n';
+}
diff --git a/src/scripts/code_graph/cli.ts b/src/scripts/code_graph/cli.ts
index c24d6d356c..69e5a9ed1d 100644
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
@@ -161,2 +162,4 @@ import {
 } from './detect.js';
+import { writeContained } from '../_lib/contained_write.js';
+import { enableByUse } from './auto_refresh.js';
 import { graphHome } from './graph_home.js';
@@ -254,3 +257,5 @@ async function cmdBuild(argv: string[]): Promise<number> {
     const { graph, fileCount, reExtracted, reused, lanes } = await buildFromRepo(root, out, { update, lanes: !argv.includes('--no-lanes') });
-    if (out === buildCacheFor(root)) registerUse(root, graph, git(root, 'rev-parse', 'HEAD'));
+    const ownCache = out === buildCacheFor(root);
+    if (ownCache) registerUse(root, graph, git(root, 'rev-parse', 'HEAD'));
+    const consent = ownCache ? enableByUse(root) : '';
     const c = graph.edge_confidence_counts;
@@ -264,2 +269,3 @@ async function cmdBuild(argv: string[]): Promise<number> {
             (out ? `    cache: ${shown(root, out)}\n` : '') +
+            consent +
             legacyCacheNotice(root),
@@ -1147,5 +1153,5 @@ async function cmdRefresh(argv: string[]): Promise<number> {
 /**
- * `auto-refresh on|off|status` — the explicit, local, per-project opt-in the
- * `code-graph-refresh` session concern requires before it starts anything
- * (ratification round of 2026-10-23: an existing cache is not consent).
+ * `auto-refresh on|off|status` — the local, per-project switch the
+ * `code-graph-refresh` concern reads before it starts anything. `on` is also
+ * what a local `build` or `map` does (`enableByUse`); `off` is sticky.
  */
@@ -1167,9 +1173,12 @@ function cmdAutoRefresh(argv: string[]): number {
         const now = path.join(home.buildDir, path.basename(marker));
-        fs.mkdirSync(home.buildDir, { recursive: true });
-        fs.writeFileSync(now, `${JSON.stringify({ enabled_at: new Date().toISOString() })}\n`);
+        if (!writeContained(root, now, `${JSON.stringify({ enabled_at: new Date().toISOString() })}\n`)) {
+            process.stderr.write(`code-graph: refusing to write the opt-in — a path component under ${root} is a symlink or not a directory\n`);
+            return 1;
+        }
         if (now !== marker) fs.rmSync(marker, { force: true });
+        fs.rmSync(home.autoRefreshOffPath, { force: true });
         const cli = usableCli(root);
         process.stdout.write(
-            'auto-refresh on — each agent session start refreshes the graph, and agents/map/ when it exists,\n' +
-                'in the background (POSIX hosts). `code-graph auto-refresh off` stops it.\n' +
+            'auto-refresh on — each agent session start and turn end refreshes the graph, at most once per HEAD and 10-minute window,\n' +
+                'and agents/map/ when it exists, in the background (POSIX hosts). `code-graph auto-refresh off` stops it.\n' +
                 'The opt-in is per working tree: run it again in each new git worktree.\n' +
@@ -1188,3 +1197,6 @@ function cmdAutoRefresh(argv: string[]): number {
         for (const m of new Set([marker, path.join(home.buildDir, path.basename(marker)), path.join(home.legacyDir, path.basename(marker))])) fs.rmSync(m, { force: true });
-        process.stdout.write('auto-refresh off\n');
+        if (home.kind === 'project' && !writeContained(root, home.autoRefreshOffPath, `${JSON.stringify({ disabled_at: new Date().toISOString() })}\n`)) {
+            process.stderr.write(`code-graph: the opt-in is removed, but the opt-out could not be written — a path component under ${root} is a symlink or not a directory\n`);
+        }
+        process.stdout.write('auto-refresh off — a later `build` or `map` keeps it off; `auto-refresh on` reverses this\n');
         return 0;
@@ -1197,3 +1209,3 @@ function cmdAutoRefresh(argv: string[]): number {
     const last = readRefreshRecords(root);
-    const line = (r: (typeof last)['refresh']): string => (r ? `${r.outcome} at ${r.at}${r.detail ? ` (${r.detail})` : ''}` : 'never');
+    const line = (r: (typeof last)['refresh']): string => (r ? `${r.outcome}${r.slot ? ` on ${r.slot}` : ''} at ${r.at}${r.detail ? ` (${r.detail})` : ''}` : 'never');
     const mapDir = home.mapDir;
@@ -1203,5 +1215,5 @@ function cmdAutoRefresh(argv: string[]): number {
     process.stdout.write(
-        `auto-refresh: ${fs.existsSync(marker) ? 'on' : 'off'}\n` +
+        `auto-refresh: ${fs.existsSync(home.autoRefreshOffPath) ? 'off (opted out)' : fs.existsSync(marker) ? 'on' : 'off — the next local build or map turns it on'}\n` +
             `cli: ${'reason' in cli ? (cli.reason === 'no-cli' ? 'none usable — nothing will run' : `${cli.cli} ${cliPackage(cli.cli)?.version ?? '?'} — too old, nothing will run`) : `${cli.cli} ${cliPackage(cli.cli)?.version ?? '?'}`}\n` +
-            `last session start: ${line(last['session-start'])}\n` +
+            `last concern run (session start or turn end): ${line(last['session-start'])}\n` +
             `last refresh: ${line(last.refresh)}\n` +
@@ -1339,5 +1351,3 @@ async function drawMap(argv: string[]): Promise<number> {
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
index aa29103183..39d20468cb 100644
--- a/src/scripts/code_graph/refresh_lock.ts
+++ b/src/scripts/code_graph/refresh_lock.ts
@@ -22,2 +22,3 @@ import * as path from 'node:path';
 
+import { writeContained } from '../_lib/contained_write.js';
 import { graphHome } from './graph_home.js';
@@ -51,2 +52,6 @@ export interface RefreshRecord {
     detail?: string | undefined;
+    /** HEAD when the concern spawned a refresh, so a later turn end with the same HEAD can skip. */
+    head?: string | undefined;
+    /** The hook slot that ran the concern (`session_start`, `stop`); the file name predates the second slot. */
+    slot?: string | undefined;
 }
@@ -59,11 +64,22 @@ export const refreshRecordPath = (root: string, by: RefreshRecord['by']): string
 export function recordRefresh(root: string, rec: Omit<RefreshRecord, 'at'>): void {
-    recordRefreshIn(path.dirname(graphHome(root).lockPath), rec);
+    const home = graphHome(root);
+    recordRefreshIn(path.dirname(home.lockPath), rec, Date.now(), home.kind === 'project' ? root : undefined);
 }
 
-/** For the session concern: its chunk must not carry the user-global resolver. */
-export function recordRefreshIn(stateDir: string, rec: Omit<RefreshRecord, 'at'>): void {
+/**
+ * For the session concern: its chunk must not carry the user-global resolver.
+ * Creates the build directory when missing. Returns whether the record landed.
+ * With `root` (a project home), the write is contained: no component from the
+ * root down may be a symlink, and the record itself is opened with O_NOFOLLOW.
+ */
+export function recordRefreshIn(stateDir: string, rec: Omit<RefreshRecord, 'at'>, now: number = Date.now(), root?: string): boolean {
+    const file = path.join(stateDir, `code-graph-refresh.${rec.by}.json`);
+    const body = JSON.stringify({ at: new Date(now).toISOString(), ...rec });
+    if (root !== undefined) return writeContained(root, file, body);
     try {
-        fs.writeFileSync(path.join(stateDir, `code-graph-refresh.${rec.by}.json`), JSON.stringify({ at: new Date().toISOString(), ...rec }));
+        fs.mkdirSync(stateDir, { recursive: true });
+        fs.writeFileSync(file, body);
+        return true;
     } catch {
-        /* never fails a refresh */
+        return false;
     }
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 38771b2153..2a9e3254ae 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1446,10 +1446,15 @@ concerns:
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
+  # `git rev-parse HEAD` and an exclusive claim file per HEAD and fixed
+  # THROTTLE_MS window (day folders swept two days on), so normally one launch
+  # per HEAD and window; a rarer duplicate backs off on the refresh lock.
+  # `session_end` stays unbound — it would refresh for a session that is gone. Silent, exit 0, POSIX only, no hook-token-budget
+  # row — it emits nothing. Loaded from its own chunk.
   # Kill switch: `AGENT_CONFIG_CODE_GRAPH_REFRESH=off`.
@@ -1713,3 +1718,3 @@ platforms:
     session_end:      [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush]
-    stop:             [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop]
+    stop:             [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop, code-graph-refresh]
     pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, block-credential-reads, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, memory-recall]
@@ -1731,3 +1736,3 @@ platforms:
     session_end:      [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush, journal-record]
-    stop:             [chat-history, verify-before-complete, team-review-gate, end-review-nudge, obligation-settle, turn-end-gate, self-repair, session-register, session-eol, interruption-ledger, roadmap-progress, design-pass-stop, suggestion-capture, journal-record]
+    stop:             [chat-history, verify-before-complete, team-review-gate, end-review-nudge, obligation-settle, turn-end-gate, self-repair, session-register, session-eol, interruption-ledger, roadmap-progress, design-pass-stop, suggestion-capture, code-graph-refresh, journal-record]
     user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, delegation-nudge, skill-route, git-authorization, session-canary, self-repair, session-register, rule-inject, suggestion-capture, journal-record, quota-notice, intake-pass]
@@ -1806,3 +1811,3 @@ platforms:
     # still costs the dispatch, and its entire output is thrown away.
-    stop:             [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop]
+    stop:             [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop, code-graph-refresh]
     user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass]
@@ -1832,3 +1837,3 @@ platforms:
     session_end:        [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush]
-    stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop]
+    stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop, code-graph-refresh]
     user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass]
@@ -1848,3 +1853,3 @@ platforms:
     session_end:        [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush]
-    stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop]
+    stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop, code-graph-refresh]
     user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass]
@@ -1867,3 +1872,3 @@ platforms:
     session_start:      [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, profile-staleness, wrapper-freshness, surface-probe, session-register, code-graph-refresh]
-    stop:               [chat-history, verify-before-complete, self-repair, session-register, design-pass-stop]
+    stop:               [chat-history, verify-before-complete, self-repair, session-register, design-pass-stop, code-graph-refresh]
     # language-mirror IS bound here: unlike minimal-safe-diff it needs only the
@@ -1886,3 +1891,3 @@ platforms:
     session_end:        [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush]
-    stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop]
+    stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop, code-graph-refresh]
     user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass]
diff --git a/src/scripts/hooks/code_graph_refresh_hook.ts b/src/scripts/hooks/code_graph_refresh_hook.ts
index 5fe10f82bd..9e88292d0c 100644
--- a/src/scripts/hooks/code_graph_refresh_hook.ts
+++ b/src/scripts/hooks/code_graph_refresh_hook.ts
@@ -2,3 +2,3 @@
 /**
- * Session-start code-graph refresh — the consumer-side freshness carrier.
+ * Session-start and turn-end code-graph refresh — the consumer-side freshness carrier.
  *
@@ -20,6 +20,24 @@
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
+ * 1-6, 2026-11-01). Claims live in one folder per UTC day; only day folders
+ * two or more days old are swept, while admission refuses windows older than two
+ * (a clock read at claim time), so deletion trails admission by more than a day.
+ * The exactly-once property holds unless a dispatch pauses, or clocks disagree,
+ * by more than a day; then a duplicate launch is absorbed by the single-flight
+ * refresh lock. A failed launch keeps its claim and the pair retries in the next
+ * window.
+ *
  * WHEN IT DOES NOTHING — the conditions a ratification round of 2026-10-23
  * (two of two seats, refused the first cut) made load-bearing:
- *   · the project never ran `code-graph auto-refresh on`. An existing cache is
- *     not consent: a repository can commit one.
+ *   · no opt-in marker. `code-graph auto-refresh on` writes one, and so does a
+ *     local `code-graph build` or `map` unless `auto-refresh off` left an
+ *     opt-out. An existing cache alone is not consent: a repository can commit one.
  *   · the opt-in marker or the cache is TRACKED by git. Both live under the
@@ -42,2 +60,3 @@ import { fileURLToPath, pathToFileURL } from 'node:url';
 
+import { containedPath, isRealDir } from '../_lib/contained_write.js';
 import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
@@ -62,4 +81,83 @@ export type RefreshOutcome =
     | 'cli-too-old'
+    | 'fresh'
+    | 'record-failed'
     | 'spawned';
 
+/** How long a spawn for one HEAD covers later turn ends; a session start after it re-checks. */
+export const THROTTLE_MS = 10 * 60 * 1000;
+const DAY_MS = 24 * 60 * 60 * 1000;
+/** Day folders this many days older than today are swept; admission refuses windows older than two. */
+export const SWEEP_AFTER_DAYS = 2;
+
+/**
+ * The claim for one (HEAD, window) pair, inside the folder of the UTC day its
+ * window starts on; its path is the whole protocol.
+ */
+export function claimPath(buildDir: string, head: string | null, now: number): string {
+    const w = Math.floor(now / THROTTLE_MS);
+    return path.join(buildDir, 'claims', String(Math.floor((w * THROTTLE_MS) / DAY_MS)), `${head ?? 'none'}-${w}`);
+}
+
+/** The window a claim path names, or null for a path that is not a claim. */
+function windowOf(file: string): number | null {
+    const m = /-(\d+)$/.exec(path.basename(file));
+    return m ? Number(m[1]) : null;
+}
+
+/**
+ * Deletes whole day folders at least SWEEP_AFTER_DAYS older than `today`. The
+ * deletion horizon sits a day behind the admission horizon (two windows), so a
+ * claim can only be deleted after no dispatch can claim its window any more —
+ * unless a dispatch pauses, or clocks disagree, by more than a day. In that case
+ * a second launch for the pair is possible and the single-flight refresh lock
+ * absorbs it: the second refresh backs off.
+ */
+function sweepSpent(claimsDir: string, today: number): void {
+    try {
+        if (!isRealDir(claimsDir)) return;
+        for (const d of fs.readdirSync(claimsDir)) {
+            const full = path.join(claimsDir, d);
+            // Only a real directory is removed recursively: a symlink here could point anywhere.
+            if (/^\d+$/.test(d) && Number(d) <= today - SWEEP_AFTER_DAYS && isRealDir(full)) fs.rmSync(full, { recursive: true, force: true });
+        }
+    } catch {
+        /* a spent day folder only costs disk entries */
+    }
+}
+
+/**
+ * Creates the claim exclusively: `won`, `taken` (another dispatch holds this
+ * pair, or its window is past admission by a clock read at claim time) or
+ * `failed`.
+ */
+function claim(root: string, file: string, clock: () => number): 'won' | 'taken' | 'failed' {
+    const at = clock();
+    const w = windowOf(file);
+    if (w !== null && w <= Math.floor(at / THROTTLE_MS) - 2) return 'taken';
+    const day = path.dirname(file);
+    const claims = path.dirname(day);
+    // Claims are created and swept only inside real directories from the root down, never through a symlink.
+    if (!containedPath(root, day)) return 'failed';
+    try {
+        fs.mkdirSync(day, { recursive: true });
+        if (!containedPath(root, day) || !isRealDir(day)) return 'failed';
+        fs.writeFileSync(file, '', { flag: 'wx' });
+    } catch (e) {
+        return (e as NodeJS.ErrnoException).code === 'EEXIST' ? 'taken' : 'failed';
+    }
+    sweepSpent(claims, Math.floor(at / DAY_MS));
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
@@ -92,2 +190,11 @@ export function repoRoot(start: string): string | null {
 
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
@@ -106,3 +213,4 @@ function anyTracked(root: string, rels: readonly string[]): boolean {
 
-export function refreshFor(cwd: string, spawnFn: typeof spawn = spawn): RefreshOutcome {
+/** `beforeClaim` runs right before the claim is created and `clock` is read there; tests use both to interleave and pause a dispatch. */
+export function refreshFor(cwd: string, spawnFn: typeof spawn = spawn, now: number = Date.now(), slot?: string, beforeClaim?: () => void, clock: () => number = Date.now): RefreshOutcome {
     if (process.env['AGENT_CONFIG_CODE_GRAPH_REFRESH'] === 'off') return 'disabled';
@@ -114,7 +222,12 @@ export function refreshFor(cwd: string, spawnFn: typeof spawn = spawn): RefreshO
     const home = projectBuildPaths(root);
-    if (!fs.existsSync(home.autoRefreshPath)) return 'not-opted-in';
+    // The opt-out wins over a marker a concurrent `build` may have written beside it.
+    if (!fs.existsSync(home.autoRefreshPath) || fs.existsSync(home.autoRefreshOffPath)) return 'not-opted-in';
+    // A claimed pair returns before the tracked-file probe: the common turn end costs one git call.
+    const head = headOf(root);
+    const file = claimPath(home.buildDir, head, now);
+    if (fs.existsSync(file)) return 'fresh';
     // A repository-committed opt-in is refused before anything is written into the tree.
-    if (anyTracked(root, [home.autoRefreshPath, home.cachePath].map((p) => path.relative(root, p)))) return 'tracked';
+    if (anyTracked(root, [home.autoRefreshPath, home.cachePath, path.join(home.buildDir, 'claims')].map((p) => path.relative(root, p)))) return 'tracked';
     const done = (outcome: RefreshOutcome, detail?: string): RefreshOutcome => {
-        recordRefreshIn(home.buildDir, { by: 'session-start', outcome, detail });
+        recordRefreshIn(home.buildDir, { by: 'session-start', outcome, detail, slot, ...(head !== null ? { head } : {}) }, now, root);
         return outcome;
@@ -126,2 +239,6 @@ export function refreshFor(cwd: string, spawnFn: typeof spawn = spawn): RefreshO
     if ('reason' in verdict) return done(verdict.reason, (verdict as { cli?: string }).cli);
+    beforeClaim?.();
+    const won = claim(root, file, clock);
+    if (won === 'taken') return 'fresh';
+    if (won === 'failed') return 'record-failed';
     const child = spawnFn(verdict.cli, [...REFRESH_ARGS, '--root', root], {
@@ -132,2 +249,3 @@ export function refreshFor(cwd: string, spawnFn: typeof spawn = spawn): RefreshO
     });
+    // A failed launch keeps its claim: the pair retries in the next window, and no path is ever deleted by its name.
     child.on('error', () => {});
@@ -142,3 +260,3 @@ export function main(): number {
         const cwd = typeof envelope['cwd'] === 'string' && envelope['cwd'] ? envelope['cwd'] : process.cwd();
-        refreshFor(cwd);
+        refreshFor(cwd, spawn, Date.now(), slotOf(envelope));
     } catch {
```
