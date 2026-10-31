<!-- evidence-type: analysis -->

# Ratification review — hook-bundle ceiling raise (branch analysis/inbox-2026-10-bm)

subject: b5e34aa337c4657a1010115cbe69ee54c0eed2c9b2f3e6ad0a0243ebdf3b9ae9

The line above is the `ratification_subject` digest of the gated content at
revision `8c94451479` — `src/config/hook-bundle-budget.json`, the only gated
file in the branch.

The change raises the dispatch-bundle ceiling 1,557,900 -> 1,560,400 B. The
gate's own build measures 1,560,338 B on the branch merged with origin/main
14012757d and 1,557,828 B on origin/main, so +2,510 B. The first build was
+5,050 B; the park marker's reset-time lookup moved out of the hook into
run_supervise (a CLI), the marker field was removed as dead code, and the
failure-class table became a one-entry set. What remains is new behaviour on
the dispatch path: a per-dispatch shared git snapshot for the two Stop
concerns, a fail-open node compile cache, a resource sample in the opt-in
timings sink, the reset-sentence exception in git-authorization, and the
one-entry parking set.

Questions: (1) does the change expand any authority, permission or
safety-floor reach? (2) is the raise_log entry accurate against the diff
below? Answer with findings, then end your reply with exactly one line in
this form:

`STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`

## Diff of the gated file and the growth sources against origin/main

~~~diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 9fa01fce24..28ffeea65a 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1557900,
+    "max_bytes": 1560400,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -117,6 +117,15 @@
             "by": "agent, worktree-inbox-2026-10-bi (road-to-a-correction-that-is-heard 1.1, 1.3)",
             "what_was_added": "The self-repair user-report detector on the dispatch path: one combined recurrence pattern (ordinal + punctuation, `wie oft noch ich`, `how many times do I`, `as I mentioned before`, `told you this`, `immer noch nicht`, an addressed `schon wieder`) under which 6 of the 10 trigger phrases `recurring-criticism` names fire and the other 4 are allowlisted with a reason (each needs a contextual constraint), plus a `subject` capture kept out of the tested outgoing paths (`tabs`) that makes counting repeats by subject possible; the counter itself is not built here (later/road-to-a-noted-that-is-a-write 1.2). Measured 1,557,828 B on a base of 1,556,650 B (origin/main 965c4db02 with its own self_repair.ts, same gate run): +1,178 B; the ceiling leaves 72 B. Where the subject goes was probed, not asserted: rendering it into the upstream body turned both `payload-has-only-closed-fields` tests (tests/scripts/self_repair_release.test.ts, which check the whole outgoing release payload and the fallback issue body) red, and feeding it into `fingerprint()` turned `is not part of the fingerprint` (tests/scripts/self_repair.test.ts) red; both passed once restored.",
             "why_it_could_not_be_avoided": "Room was made first and measured: the new patterns were merged into one alternation and the narrower `how many times (do|must|should) i` pattern, now subsumed, was removed (growth 1,274 B -> 1,128 B); the first-person precision fix the council asked for then added 50 B, for 1,178 B final. The detector runs in the `self-repair` concern on `user_prompt_submit`, which is inlined, not a lazy chunk; moving it into a chunk is a dispatcher change larger than this raise. The subject ships now because road-to-a-correction-that-is-heard AC-2 requires the record to name what a repeated correction was about. Re-based onto the 2026-10-28 intake-pass raise; ratified by AI council 2026-10-29 (agents/evidence/ratifications/hook-bundle-raise-20261029.md)."
+        },
+        {
+            "date": "2026-10-31",
+            "from": 1557900,
+            "to": 1560400,
+            "by": "agent, analysis/inbox-2026-10-bm (road-to-a-fleet-that-pays-less-per-event 1.1, 1.2, 2.1; road-to-a-quota-signal-that-tells-the-truth 1.4, 3.1)",
+            "what_was_added": "Measured with this gate's own build (APFS-cloned node_modules) on the branch merged with origin/main 14012757d: 1,560,338 B against 1,557,828 B for origin/main itself, so +2,510 B; the ceiling is that reading plus 62 B. Per module (metafile bytesInOutput, branch minus base): concern_timings.ts +593 (per-dispatch max RSS and CPU microseconds, read only when the timings sink is armed), stop_snapshot.ts +563 and end_review_nudge_hook.ts +282 (one git numstat / untracked read per Stop dispatch shared by end-review-nudge and obligation-settle, which removes a second `git diff` and `git ls-files` spawn from every Stop), compile_cache.ts +500 and dispatch_entry.ts +114 (node compile cache for the lazy concern chunks, fail-open), machine_wake.ts +179 and git_authorization_hook.ts +40 (the host usage-reset sentence no longer consumes a pending refusal), host_rate_marker_hook.ts +100 (one set naming which host failure classes park a run).",
+            "why_it_could_not_be_avoided": "Room was made first and measured: the first build was +5,050 B, because the park marker's reset time was looked up inside the hook and pulled the quota ledger and pressure model into the bundle; that lookup moved to run_supervise (a CLI, outside the bundle) and the marker field became dead code and was removed, and the failure-class table became a one-entry set (+5,050 -> +2,510 B). What remains is new behaviour on the dispatch path itself: the Stop memo has to live where both Stop concerns run, the compile cache has to be enabled by the entry that loads the lazy chunks, and the resource sample has to be taken by the process whose usage it reports. The base had 72 B of headroom, so none of it fits without a raise.",
+            "what_would_have_caught_it": "This gate, on the first push; it did, and the reduction above is the response."
         }
     ],
     "chunks": [
diff --git a/src/scripts/_lib/compile_cache.ts b/src/scripts/_lib/compile_cache.ts
new file mode 100644
index 0000000000..0204138f90
--- /dev/null
+++ b/src/scripts/_lib/compile_cache.ts
@@ -0,0 +1,42 @@
+/**
+ * compile_cache — node's on-disk compile cache for the per-event entries.
+ *
+ * Every hook event and every MCP start is a fresh node process that compiles
+ * the same JavaScript again. `module.enableCompileCache` (node ≥ 22.1, the
+ * package floor is 22.6) keeps the compiled code on disk between those
+ * processes. It covers modules loaded AFTER the call — the lazy concern chunks
+ * and dynamic imports — not the entry file that makes it.
+ *
+ * Fail-open by construction: a node without the API, an unwritable directory
+ * or a throwing call all leave the process exactly as it was without the cache.
+ * `NODE_DISABLE_COMPILE_CACHE` is honoured by node itself.
+ */
+import * as nodeModule from 'node:module';
+import * as path from 'node:path';
+
+import { event4u_root } from './user_global_paths.js';
+
+export const COMPILE_CACHE_DIRNAME = 'compile-cache';
+
+/** The cache directory, beside the staged runtime under the user-global root. */
+export function compileCacheDir(env: NodeJS.ProcessEnv = process.env): string {
+    return path.join(event4u_root(env), 'runtime', COMPILE_CACHE_DIRNAME);
+}
+
+export interface CompileCacheApi {
+    enableCompileCache?: (dir?: string) => unknown;
+}
+
+/** True when the cache was requested; false when the API is absent or failed. */
+export function enableCompileCacheFailOpen(
+    env: NodeJS.ProcessEnv = process.env,
+    api: CompileCacheApi = nodeModule as unknown as CompileCacheApi,
+): boolean {
+    try {
+        if (typeof api.enableCompileCache !== 'function') return false;
+        api.enableCompileCache(compileCacheDir(env));
+        return true;
+    } catch {
+        return false;
+    }
+}
diff --git a/src/scripts/_lib/machine_wake.ts b/src/scripts/_lib/machine_wake.ts
index 61af8ba53a..41dec156a5 100644
--- a/src/scripts/_lib/machine_wake.ts
+++ b/src/scripts/_lib/machine_wake.ts
@@ -62,3 +62,23 @@ export function humanTypedThisTurn(prompt: string): boolean {
     }
     return true;
 }
+
+/**
+ * The host's own resume sentence after a plan-quota reset, anchored at
+ * character zero exactly as in `prompt_shape.isSyntheticPrompt`.
+ *
+ * Deliberately NOT a wake prefix: answering "machine" would leave the ledger
+ * standing, so an authorization from before the limit would ride through the
+ * reset on the strength of a prose match. The turn stays "human" for the
+ * ledger, which is replaced as on any turn. The one thing it must not do is
+ * SPEND the pending refusal: that record exists so the user's answer to the
+ * guard's question confirms it, and a sentence nobody typed is not that answer.
+ * Leaving the record costs nothing it could grant — only an affirmative inside
+ * `PENDING_MAX_AGE_MS` of the original refusal confirms it, and the record still
+ * expires by age.
+ */
+export const HOST_LIMIT_RESET_PREFIX = 'Your claude.ai usage limit has reset';
+
+export function isHostLimitResetResume(prompt: string): boolean {
+    return prompt.trimStart().startsWith(HOST_LIMIT_RESET_PREFIX);
+}
diff --git a/src/scripts/_lib/stop_snapshot.ts b/src/scripts/_lib/stop_snapshot.ts
new file mode 100644
index 0000000000..3bc4ff6828
--- /dev/null
+++ b/src/scripts/_lib/stop_snapshot.ts
@@ -0,0 +1,49 @@
+/**
+ * stop_snapshot — one working-tree read per dispatch, shared across concerns.
+ *
+ * `end_review_nudge_hook` and `obligation_settle_hook` both run on Stop and
+ * both read `git diff --numstat HEAD` plus `git ls-files --others` at the same
+ * root, so a Stop used to pay four `git` starts for two answers.
+ *
+ * The memo exists only while a dispatch scope is open
+ * (`withDispatchSnapshotScope`, opened by `dispatch_entry`). Outside one every
+ * read is fresh, and each scope starts empty and is discarded on exit — so a
+ * standalone concern run, or a later event in a long-lived process, can never
+ * be answered from an earlier event's tree.
+ *
+ * The scope lives on `globalThis` under a registered symbol for the same reason
+ * `hook_stdin`'s override does: a concern loaded from a lazy chunk is a second
+ * module graph with its own copy of this file.
+ */
+
+const SCOPE_KEY = Symbol.for('agent-config.dispatchSnapshotScope');
+
+interface ScopeHost {
+    [SCOPE_KEY]?: Map<string, unknown> | null;
+}
+
+function host(): ScopeHost {
+    return globalThis as unknown as ScopeHost;
+}
+
+/** Run `fn` with a fresh, empty snapshot scope; the scope is dropped afterwards. */
+export function withDispatchSnapshotScope<T>(fn: () => T): T {
+    const h = host();
+    const outer = h[SCOPE_KEY] ?? null;
+    h[SCOPE_KEY] = new Map();
+    try {
+        return fn();
+    } finally {
+        h[SCOPE_KEY] = outer;
+    }
+}
+
+/** `compute()` once per key inside an open scope; uncached outside one. */
+export function memoInDispatch<T>(key: string, compute: () => T): T {
+    const scope = host()[SCOPE_KEY];
+    if (!scope) return compute();
+    if (scope.has(key)) return scope.get(key) as T;
+    const value = compute();
+    scope.set(key, value);
+    return value;
+}
diff --git a/src/scripts/git_authorization_hook.ts b/src/scripts/git_authorization_hook.ts
index 978b1f6d7b..2b2eead8e3 100644
--- a/src/scripts/git_authorization_hook.ts
+++ b/src/scripts/git_authorization_hook.ts
@@ -59,7 +59,7 @@ import fs from "node:fs";
 import path from "node:path";
 import { fileURLToPath, pathToFileURL } from "node:url";
 
-import { humanTypedThisTurn as _humanTypedThisTurn } from "./_lib/machine_wake.js";
+import { humanTypedThisTurn as _humanTypedThisTurn, isHostLimitResetResume } from "./_lib/machine_wake.js";
 
 import {
   CONSEQUENCE_PHRASES,
@@ -1385,8 +1385,9 @@ export function run(stdin_text: string, options: { consumer_root: string }): num
   const { authorized, evidence } = classifyAuthorization(prompt);
 
   // The answer to the guard's own question. Read (and consume) on EVERY prompt,
-  // so the record cannot outlive the turn it was raised in.
-  const pending = takePending(options.consumer_root, session, Date.now());
+  // so the record cannot outlive the turn it was raised in — except the host's
+  // quota-reset resume, which no human typed and so cannot be that answer.
+  const pending = isHostLimitResetResume(prompt) ? null : takePending(options.consumer_root, session, Date.now());
   if (pending && !authorized.includes(pending.op) && isAffirmative(prompt)) {
     authorized.push(pending.op);
     evidence[pending.op] =
diff --git a/src/scripts/hooks/concern_timings.ts b/src/scripts/hooks/concern_timings.ts
index b5b3848db6..9ae27478d4 100644
--- a/src/scripts/hooks/concern_timings.ts
+++ b/src/scripts/hooks/concern_timings.ts
@@ -20,7 +20,7 @@ import fs from "node:fs";
  * - it is off unless the variable is set, so the cost on a real dispatch is
  *   one `process.env` lookup.
  *
- * It carries a concern name, an integer, an event and a platform. There is no
+ * It carries a concern name, integers, an event and a platform. There is no
  * field that can hold a payload, a path or a prompt — the same shape-level
  * privacy floor `payload_stubs` keeps one row up.
  *
@@ -46,6 +46,44 @@ export interface ConcernTimingSample {
   duration_us: number;
 }
 
+/**
+ * What one dispatch cost the process, beside the wall-clock samples.
+ *
+ * Wall time alone cannot say whether five sessions with four subagents each
+ * leave the machine usable: a fast event that holds 200 MB, or burns CPU while
+ * another session waits, is invisible to it. Both numbers are cumulative for
+ * the process, which for a directly invoked dispatcher IS the dispatch. Taken
+ * once per dispatch and stamped on each of its rows, so a reader keyed on
+ * `concern` still sees one row per concern.
+ */
+export interface ResourceSample {
+  /** Peak resident set size, kilobytes (`process.resourceUsage().maxRSS`). */
+  max_rss_kb: number;
+  /** User + system CPU time, microseconds. */
+  cpu_us: number;
+}
+
+export function readResourceSample(): ResourceSample {
+  const u = process.resourceUsage();
+  return { max_rss_kb: u.maxRSS, cpu_us: u.userCPUTime + u.systemCPUTime };
+}
+
+function resourceColumns(read: () => ResourceSample): Record<string, number> {
+  try {
+    const sample = read();
+    const out: Record<string, number> = {};
+    for (const key of ["max_rss_kb", "cpu_us"] as const) {
+      const value = sample[key];
+      if (typeof value === "number" && Number.isFinite(value)) {
+        out[key] = Math.round(value);
+      }
+    }
+    return out;
+  } catch {
+    return {};
+  }
+}
+
 /**
  * Append one JSONL row per concern, when the sink is armed.
  *
@@ -58,11 +96,13 @@ export function writeConcernTimings(
   platform: string,
   samples: readonly ConcernTimingSample[],
   sinkPath: string | undefined = process.env[TIMINGS_SINK_ENV],
+  readUsage: () => ResourceSample = readResourceSample,
 ): void {
   if (!sinkPath) {
     return;
   }
   try {
+    const resources = resourceColumns(readUsage);
     const lines: string[] = [];
     for (const sample of samples) {
       // A concern the dispatcher never timed is OMITTED rather than recorded
@@ -82,6 +122,7 @@ export function writeConcernTimings(
           duration_us: Math.round(sample.duration_us),
           event,
           platform,
+          ...resources,
         }),
       );
     }
diff --git a/src/scripts/hooks/dispatch_entry.ts b/src/scripts/hooks/dispatch_entry.ts
index 2260594f49..53b706678a 100644
--- a/src/scripts/hooks/dispatch_entry.ts
+++ b/src/scripts/hooks/dispatch_entry.ts
@@ -12,7 +12,20 @@
 import * as path from 'node:path';
 import { fileURLToPath } from 'node:url';
 
-import { main } from './dispatch_hook.js';
+import { enableCompileCacheFailOpen } from '../_lib/compile_cache.js';
+import { withDispatchSnapshotScope } from '../_lib/stop_snapshot.js';
+import { main as dispatchMain } from './dispatch_hook.js';
+
+/**
+ * Both invocation paths (direct and the CLI's in-process route) call this
+ * `main`, so it is where one dispatch begins and ends: the compile cache is
+ * requested here and the shared working-tree snapshot lives exactly as long
+ * as this call.
+ */
+export function main(argv?: string[]): number {
+    enableCompileCacheFailOpen();
+    return withDispatchSnapshotScope(() => dispatchMain(argv));
+}
 
 /**
  * Direct-invocation detection. Under the esbuild bundle, EVERY inlined
@@ -33,5 +46,3 @@ const _invokedDirectly =
 if (_invokedDirectly) {
     process.exitCode = main(process.argv.slice(2));
 }
-
-export { main };
diff --git a/src/scripts/hooks/end_review_nudge_hook.ts b/src/scripts/hooks/end_review_nudge_hook.ts
index 099ac094a8..53da16ebb5 100644
--- a/src/scripts/hooks/end_review_nudge_hook.ts
+++ b/src/scripts/hooks/end_review_nudge_hook.ts
@@ -250,6 +250,7 @@ import {
     type BaselineApplication,
     type MutationMeasure,
 } from '../_lib/review_skipped_record.js';
+import { memoInDispatch } from '../_lib/stop_snapshot.js';
 import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
 import { readHookStdin } from './hook_stdin.js';
 import { atomic_write_json, is_replay_mode } from './state_io.js';
@@ -365,8 +366,14 @@ export function nonDocMutatedLines(rows: readonly NumstatRow[]): number {
 /**
  * `git diff --numstat HEAD` at `cwd`. Fails closed to `[]` (never throws) —
  * no repo, no HEAD, or `git` missing all read as "nothing to measure".
+ * Inside a dispatch scope the read is shared with `untrackedNonDocFiles`'s
+ * sibling caller in `obligation_settle_hook` (see `_lib/stop_snapshot`).
  */
 export function gitNumstatRows(cwd: string): NumstatRow[] {
+    return [...memoInDispatch(`numstat\0${path.resolve(cwd)}`, () => readGitNumstatRows(cwd))];
+}
+
+function readGitNumstatRows(cwd: string): NumstatRow[] {
     try {
         const r = spawnSync('git', ['diff', '--numstat', 'HEAD'], {
             cwd,
@@ -387,6 +394,10 @@ export function gitNumstatRows(cwd: string): NumstatRow[] {
  * throws), matching `gitNumstatRows`'s own contract.
  */
 export function untrackedNonDocFiles(cwd: string): string[] {
+    return [...memoInDispatch(`untracked\0${path.resolve(cwd)}`, () => readUntrackedNonDocFiles(cwd))];
+}
+
+function readUntrackedNonDocFiles(cwd: string): string[] {
     try {
         const r = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], {
             cwd,
diff --git a/src/scripts/hooks/host_rate_marker_hook.ts b/src/scripts/hooks/host_rate_marker_hook.ts
index d1cbeee2bf..7153a03d83 100644
--- a/src/scripts/hooks/host_rate_marker_hook.ts
+++ b/src/scripts/hooks/host_rate_marker_hook.ts
@@ -3,10 +3,14 @@
  * host-rate-marker — the host's own `StopFailure` with error class
  * `rate_limit` writes the `quota_parked` marker, tagged host-sourced.
  *
- * Bound on `agent_error`, onto which Claude's `StopFailure` is lowered. Any
- * other failure class is not a rate signal and writes nothing. It records and
- * never acts: nothing here sleeps, retries or relaunches, and the exit is 0 on
- * every path.
+ * Bound on `agent_error`, onto which Claude's `StopFailure` is lowered. Which
+ * failure classes park is one set, {@link HOST_FAILURE_PARKS}: an auth,
+ * account or org failure is not a quota wall, and reading it as one would tell
+ * an operator to wait for a reset that will fix nothing. The reset time is not
+ * looked up here: `run_supervise` reads it from the quota ledger when it reports
+ * the marker, which keeps the ledger and pressure model out of the dispatch
+ * bundle. It records and never acts: nothing here sleeps, retries or relaunches,
+ * and the exit is 0 on every path.
  */
 import * as fs from 'node:fs';
 import * as path from 'node:path';
@@ -23,11 +27,17 @@ const isObject = (v: unknown): v is JsonObject => typeof v === 'object' && v !==
 /** The host vendor whose plan window a host-sourced marker describes. */
 const HOST_PROVIDER = 'anthropic';
 
+/**
+ * The host failure classes that park a run. Auth, account, org and every other
+ * class are not a quota wall; a class this set does not name writes nothing.
+ */
+export const HOST_FAILURE_PARKS: ReadonlySet<string> = new Set(['rate_limit']);
+
 function processEnvelope(envelope: unknown, root: string): number {
     try {
         if (!isObject(envelope)) return EXIT_ALLOW;
         const payload = isObject(envelope['payload']) ? envelope['payload'] : envelope;
-        if (payload['hook_event_name'] !== 'StopFailure' || payload['error'] !== 'rate_limit') return EXIT_ALLOW;
+        if (payload['hook_event_name'] !== 'StopFailure' || !HOST_FAILURE_PARKS.has(String(payload['error']))) return EXIT_ALLOW;
         const session = payload['session_id'];
         if (typeof session !== 'string' || session === '') return EXIT_ALLOW;
         writeQuotaParked(root, session, [HOST_PROVIDER], () => new Date(), 'host');
~~~
