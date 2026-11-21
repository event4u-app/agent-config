<!-- evidence-type: analysis -->

# Ratification review — the hook-bundle budget becomes an allowlist and a backstop, and three per-dispatch fixed costs leave the dispatcher — round 2

You are an independent reviewer for a change in the `event4u/agent-config` repository. Gated files: the ratification gate itself, the dispatcher `hooks/dispatch_hook.ts`, two new dispatcher modules (`hooks/concern_env.ts`, `hooks/feedback_policy.ts`) and `src/config/hook-bundle-budget.json`. Under ADR-268 § 4 the change needs a two-provider verdict.

subject: f6c2def194a4745c4e61f109177def0855cf65a685398b38dec2f265c7ebcc5f

(Base-revision gate digest — CI runs the base copy — over `.github/workflows/consistency.yml`, `src/config/hook-bundle-budget.json`, `src/scripts/check_kernel_edit_ratified.ts`, `src/scripts/hooks/concern_env.ts`, `src/scripts/hooks/dispatch_hook.ts`, `src/scripts/hooks/feedback_policy.ts` at commit `7b9f836abb`. The head's own gate no longer lists the budget file and computes `2186fa9a929f55cc6aac0ae0bf3de117a42b7efb170c71d0da2c98c67fb426af` over the other five; same content.)

The full change description and round-1 material are in `agents/evidence/council/hook-system-pays-ratification-r1-20261120.question.md` (committed). In one paragraph: the budget file becomes a package allowlist (`["yaml"]`) plus a backstop at the reading plus about 20 %, with `shrink_only`, `raise_log` and per-chunk ceilings removed and the file taken off the ratification watched set (owner directive `agents/evidence/owner-directives/2026-11-20-hook-bundle-budget-and-hook-economy.md`); the dispatcher hardens the concern environment once per dispatch and resets it on drift between concerns; a per-concern feedback file is written only for a non-quiet outcome, with `summary.json` carrying every entry; chunks get the bundle's `yaml` copy instead of loading a second one; the CLI launcher enables the compile cache before importing the bundle.

## Round 1 and what changed

Refused 2/2. Every named defect, and what was done (commit `7b9f836abb`):

- **Exception safety (both seats).** The concern loop now runs inside `try { … } finally { closeConcernEnv(); }` (`dispatch_hook.ts`, around the loop; the body is re-indented, nothing else in it changed). Test: a dispatch that throws inside the scope restores the environment, and the next dispatch opens a real scope (`tests/scripts/hooks/concern_env.test.ts`).
- **Inherited names (both seats).** `replaceEnv` and `drifted` use `Object.hasOwn`. Test: a concern that sets `toString` on `process.env` no longer keeps it alive.
- **Reentry (one seat).** Defined in `openConcernEnvScope`'s header: a nested open returns a no-op closer and runs under the outer hardened copy; the outer close restores; each concern still gets a drift reset. The spawn fallback is a child process, not a re-entry.
- **Stale doctor feedback (one seat).** `hooks_doctor` ranks candidates by the run's RECORDED `completed_at` — the per-concern file's own field (its mtime only for older files that record none) and, in `summary.json`, the latest invocation that ran the concern — never by the summary's mtime. Test: a newer quiet run in a summary beats an older warn file even when the summary's mtime is older.
- **Metafile defaults (one seat).** `analyzeMetafile` measures the output whose entry is `src/scripts/hooks/dispatch_entry.ts` (a single entry output is still accepted, for fixtures), and refuses an output with no `bytes` or no `inputs` instead of reading it as empty. Tests for both.
- **Duplicate copies of one package (both seats).** The gate also fails a package bundled from more than one directory on disk (`node_modules/yaml` and `node_modules/x/node_modules/yaml`). Test.
- **YAML handoff and `require` compatibility (both seats).** New `tests/scripts/hooks/bundled_yaml.test.ts`: the published value exposes the same `parse`/`stringify`/`parseDocument`/`Document`/`YAMLMap` as a plain `require('yaml')` and parses; the banner, run the way node runs a CJS chunk, returns the bundle copy for `yaml` without calling the underlying `require`, keeps `require.resolve`, delegates every other id, and falls back to a real require when the global is absent. The runtime load-set test still shows no `node_modules` load on any hot event.
- **`raw_exit_code` in the summary (one seat).** Stated: the summary now carries `raw_exit_code` for every entry, so the quiet-allow decision is reconstructible from the summary alone.

Not changed, and why: the global name `__acBundledYaml` stays (a chunk is a separate CJS file built by esbuild; it has no module-level import of the bundle to read instead). The allowlist change review threshold drops to ordinary review by owner decision D2; adding a package is a visible one-line edit to a committed file.

Suites green after the fixes: 135 test files, 2,358 tests across the hook, dispatcher, composition and ratification-gate suites; the gate's self-test 4/4.

## What to answer

1. Is each round-1 defect closed by what is described and shown below? Name any that is not, with file and line.
2. Does the fix itself introduce a defect, or weaken a fail-closed guard, an exit-code contract, the hardening of a concern's child processes, or isolation between concerns?
3. Does anything here expand authority?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The diff since round 1 (`git diff 21ee5a25c8..7b9f836abb`, whitespace-only re-indent of the loop body ignored)

````diff
diff --git a/src/scripts/check_hook_bundle_composition.ts b/src/scripts/check_hook_bundle_composition.ts
index c2dbb738de..f04c38fe18 100644
--- a/src/scripts/check_hook_bundle_composition.ts
+++ b/src/scripts/check_hook_bundle_composition.ts
@@ -78,6 +78,8 @@ export interface Analysis {
     readonly modules: number;
     /** Bytes in the output, summed per owning npm package (zero-byte packages omitted). */
     readonly packageBytes: ReadonlyMap<string, number>;
+    /** Packages whose bytes come from more than one copy on disk (a nested duplicate), sorted. */
+    readonly duplicated: readonly string[];
 }
 
 /**
@@ -98,27 +100,56 @@ export function owningPackage(modulePath: string): string | null {
     return head.startsWith('@') ? `${head}/${parts[1] ?? ''}` : head;
 }
 
-/** Parse an esbuild metafile and attribute its one entry-point output. */
+/** The entry the bundle is built from; the metafile output carrying it is the one measured. */
+export const ENTRY_REL = 'src/scripts/hooks/dispatch_entry.ts';
+
+/**
+ * The directory a package's bytes come from (`…/node_modules/<pkg>`), so two
+ * copies of one package name — a nested duplicate — count as two roots.
+ */
+export function packageRoot(modulePath: string): string | null {
+    const pkg = owningPackage(modulePath);
+    if (pkg === null) return null;
+    const at = modulePath.lastIndexOf('node_modules/');
+    return modulePath.slice(0, at + 'node_modules/'.length + pkg.length);
+}
+
+/**
+ * Parse an esbuild metafile and attribute the output built from {@link ENTRY_REL}.
+ *
+ * Refuses rather than defaulting: an output with no `bytes` or no `inputs`
+ * would otherwise read as a clean zero-byte bundle, which is the silent green
+ * this gate exists to replace. A metafile carrying exactly one entry output is
+ * accepted whatever its entry is named (the self-test fixtures).
+ */
 export function analyzeMetafile(json: string): Analysis {
     const meta = JSON.parse(json) as {
         outputs?: Record<string, { entryPoint?: string; bytes?: number; inputs?: Record<string, { bytesInOutput?: number }> }>;
     };
-    const outputs = Object.values(meta.outputs ?? {});
-    const out = outputs.find((o) => typeof o.entryPoint === 'string');
+    const entries = Object.values(meta.outputs ?? {}).filter((o) => typeof o.entryPoint === 'string');
+    const out = entries.find((o) => o.entryPoint === ENTRY_REL) ?? (entries.length === 1 ? entries[0] : undefined);
     if (out === undefined) {
         throw new Error(
-            'metafile carries no entry-point output — refusing to report a composition for a build that produced nothing',
+            entries.length === 0
+                ? 'metafile carries no entry-point output — refusing to report a composition for a build that produced nothing'
+                : `metafile carries ${String(entries.length)} entry outputs and none is ${ENTRY_REL}`,
         );
     }
+    if (typeof out.bytes !== 'number' || out.inputs === undefined || Object.keys(out.inputs).length === 0) {
+        throw new Error('the entry output carries no byte count or no inputs — refusing to read it as an empty bundle');
+    }
     const packageBytes = new Map<string, number>();
-    const inputs = out.inputs ?? {};
-    for (const [p, v] of Object.entries(inputs)) {
+    const roots = new Map<string, Set<string>>();
+    for (const [p, v] of Object.entries(out.inputs)) {
         const pkg = owningPackage(p);
         const bytes = v.bytesInOutput ?? 0;
         if (pkg === null || bytes <= 0) continue;
         packageBytes.set(pkg, (packageBytes.get(pkg) ?? 0) + bytes);
+        const root = packageRoot(p);
+        if (root !== null) roots.set(pkg, (roots.get(pkg) ?? new Set<string>()).add(root));
     }
-    return { bytes: out.bytes ?? 0, modules: Object.keys(inputs).length, packageBytes };
+    const duplicated = [...roots].filter(([, r]) => r.size > 1).map(([pkg]) => pkg).sort();
+    return { bytes: out.bytes, modules: Object.keys(out.inputs).length, packageBytes, duplicated };
 }
 
 /** Packages contributing bytes that the budget does not list, sorted. */
@@ -172,6 +203,12 @@ export function verdict(a: Analysis, budget: Budget): string[] {
                 '`allowed_packages` as a reviewed dependency decision.',
         );
     }
+    if (a.duplicated.length > 0) {
+        findings.push(
+            `package(s) bundled from more than one copy on disk: ${a.duplicated.join(', ')}. Every dispatch parses ` +
+                'both. Dedupe the dependency so one copy is bundled.',
+        );
+    }
     if (a.bytes > budget.maxBytes) {
         findings.push(
             `bundle is ${String(a.bytes)} bytes, backstop is ${String(budget.maxBytes)} ` +
diff --git a/src/scripts/hooks/concern_env.ts b/src/scripts/hooks/concern_env.ts
index 8201ce6e2e..b0a15f9d9c 100644
--- a/src/scripts/hooks/concern_env.ts
+++ b/src/scripts/hooks/concern_env.ts
@@ -33,7 +33,7 @@ let active: Scope | null = null;
 /** Make `process.env` equal `target`: drop keys it lacks, set the ones that differ. */
 function replaceEnv(target: NodeJS.ProcessEnv): void {
     for (const k of Object.keys(process.env)) {
-        if (!(k in target)) delete process.env[k];
+        if (!Object.hasOwn(target, k)) delete process.env[k];
     }
     for (const [k, v] of Object.entries(target)) {
         if (v !== undefined && process.env[k] !== v) process.env[k] = v;
@@ -44,14 +44,20 @@ function drifted(target: NodeJS.ProcessEnv): boolean {
     const keys = Object.keys(process.env);
     if (keys.length !== Object.keys(target).length) return true;
     for (const k of keys) {
-        if (process.env[k] !== target[k]) return true;
+        if (!Object.hasOwn(target, k) || process.env[k] !== target[k]) return true;
     }
     return false;
 }
 
 /**
  * Open the dispatch-wide scope. Returns the close function, which restores the
- * environment the dispatch started with. A nested open is a no-op.
+ * environment the dispatch started with. The caller closes it in a `finally`,
+ * so a dispatch that throws still restores the environment and leaves no scope
+ * open for the next dispatch in the same process.
+ *
+ * A nested open (a synchronous re-entry into dispatch from inside a concern)
+ * returns a no-op closer and runs under the outer scope's hardened copy; the
+ * outer close restores. Each concern still gets a drift reset on leaving.
  */
 export function openConcernEnvScope(packageRoot: string): () => void {
     if (active !== null) return () => undefined;
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index ec91c09d56..b5c9981754 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -1293,6 +1293,7 @@ export function main(argv?: string[]): number {
     egress.placeholder,
   );
   const closeConcernEnv = openConcernEnvScope(REPO_ROOT);
+  try {
     for (const [concern, keep_classes] of keep_by_concern) {
       if (!_concern_matches_tool(concern, tool_name)) {
         continue;
@@ -1397,7 +1398,9 @@ export function main(argv?: string[]): number {
         payload_stubs: stubs_served,
       });
     }
+  } finally {
     closeConcernEnv();
+  }
   const final_rc = _reduce(rcs);
   writeConcernTimings(String(envelope["event"] ?? ""), String(envelope["platform"] ?? ""), timing_samples);
   _write_feedback(envelope, session_id, feedback_entries, final_rc, started_at);
diff --git a/src/scripts/hooks_doctor.ts b/src/scripts/hooks_doctor.ts
index e84fb93aa5..7cec5d81b8 100644
--- a/src/scripts/hooks_doctor.ts
+++ b/src/scripts/hooks_doctor.ts
@@ -123,58 +123,74 @@ function _concern_state_file(state_dir: string, concern: string): string | null
 }
 
 /**
- * Return the most-recent dispatcher feedback file for the concern,
- * walking `agents/runtime/state/.dispatcher/<session>/<concern>.json`.
- * Since 2026-11-20 a concern that only ever allowed quietly has no file of its
- * own (`hooks/feedback_policy.ts`); its last run is then the newest session
- * `summary.json` that lists it.
+ * Return the dispatcher feedback file that holds the concern's most recent run,
+ * walking `agents/runtime/state/.dispatcher/<session>/`.
+ *
+ * Since 2026-11-20 a quiet allow has no `<concern>.json` of its own
+ * (`hooks/feedback_policy.ts`); `summary.json` carries every run. So both are
+ * candidates, ranked by the run's RECORDED `completed_at` — never by file mtime,
+ * which a summary advances whenever any other concern runs. The per-concern file
+ * wins a tie, because it holds the detail.
  */
 function _latest_feedback(state_dir: string, concern: string): string | null {
   const dispatcher_dir = path.join(state_dir, ".dispatcher");
   if (!_isDir(dispatcher_dir)) {
     return null;
   }
-  const candidates: Array<{ p: string; mtime: number }> = [];
   let sessions: string[];
   try {
     sessions = fs.readdirSync(dispatcher_dir);
   } catch {
     return null;
   }
+  let best: { p: string; at: string; detail: boolean } | null = null;
+  const consider = (p: string, at: string | null, detail: boolean): void => {
+    if (at === null) return;
+    if (best === null || at > best.at || (at === best.at && detail && !best.detail)) best = { p, at, detail };
+  };
   for (const sess of sessions) {
-    const candidate = path.join(dispatcher_dir, sess, `${concern}.json`);
-    try {
-      const st = fs.statSync(candidate);
-      if (st.isFile()) {
-        candidates.push({ p: candidate, mtime: st.mtimeMs });
-        continue;
+    const own = path.join(dispatcher_dir, sess, `${concern}.json`);
+    consider(own, _recorded_at(own), true);
+    const summary = path.join(dispatcher_dir, sess, "summary.json");
+    consider(summary, _summary_last_run(summary, concern), false);
   }
-    } catch {
-      /* not a file */
+  return best === null ? null : (best as { p: string }).p;
 }
-    const summary = path.join(dispatcher_dir, sess, "summary.json");
+
+/**
+ * `completed_at` of a per-concern feedback file; its mtime when the file records
+ * none (older writers); null when the file is absent.
+ */
+function _recorded_at(file: string): string | null {
+  let mtime: string;
   try {
-      const st = fs.statSync(summary);
-      if (st.isFile() && _summary_lists(summary, concern)) {
-        candidates.push({ p: summary, mtime: st.mtimeMs });
-      }
+    mtime = fs.statSync(file).mtime.toISOString();
   } catch {
-      /* no summary */
-    }
-  }
-  if (candidates.length === 0) {
     return null;
   }
-  candidates.sort((a, b) => b.mtime - a.mtime);
-  return candidates[0]!.p;
+  try {
+    const doc = JSON.parse(fs.readFileSync(file, "utf-8")) as { completed_at?: unknown };
+    return typeof doc.completed_at === "string" ? doc.completed_at : mtime;
+  } catch {
+    return mtime;
+  }
 }
 
-function _summary_lists(summary: string, concern: string): boolean {
+/** Latest `completed_at` among the summary's invocations that ran `concern`. */
+function _summary_last_run(summary: string, concern: string): string | null {
   try {
-    const doc = JSON.parse(fs.readFileSync(summary, "utf-8")) as { invocations?: Array<{ concerns?: Array<{ concern?: unknown }> }> };
-    return (doc.invocations ?? []).some((inv) => (inv.concerns ?? []).some((c) => c.concern === concern));
+    const doc = JSON.parse(fs.readFileSync(summary, "utf-8")) as {
+      invocations?: Array<{ completed_at?: unknown; concerns?: Array<{ concern?: unknown }> }>;
+    };
+    let last: string | null = null;
+    for (const inv of doc.invocations ?? []) {
+      if (typeof inv.completed_at !== "string") continue;
+      if (!(inv.concerns ?? []).some((c) => c.concern === concern)) continue;
+      if (last === null || inv.completed_at > last) last = inv.completed_at;
+    }
+    return last;
   } catch {
-    return false;
+    return null;
   }
 }
 
diff --git a/tests/scripts/hook_bundle_composition.test.ts b/tests/scripts/hook_bundle_composition.test.ts
index 8ee571aa21..9aeb270659 100644
--- a/tests/scripts/hook_bundle_composition.test.ts
+++ b/tests/scripts/hook_bundle_composition.test.ts
@@ -92,6 +92,38 @@ describe('check_hook_bundle_composition — analyzeMetafile', () => {
         expect(unlistedPackages(a, BUDGET)).toEqual([]);
     });
 
+    it('fails a package bundled from two copies on disk, a nested duplicate under the same name', () => {
+        const a = analyzeMetafile(
+            metafile(1000, { 'node_modules/yaml/dist/index.js': 600, 'node_modules/x/node_modules/yaml/dist/index.js': 400 }),
+        );
+        expect(a.duplicated).toEqual(['yaml']);
+        expect(verdict(a, BUDGET).some((f) => f.includes('more than one copy'))).toBe(true);
+    });
+
+    it('refuses an entry output with no byte count or no inputs instead of reading it as empty', () => {
+        const noBytes = JSON.stringify({ outputs: { o: { entryPoint: 'src/scripts/hooks/dispatch_entry.ts', inputs: { 'src/x.ts': { bytesInOutput: 1 } } } } });
+        const noInputs = JSON.stringify({ outputs: { o: { entryPoint: 'src/scripts/hooks/dispatch_entry.ts', bytes: 10, inputs: {} } } });
+        expect(() => analyzeMetafile(noBytes)).toThrow(/byte count or no inputs/u);
+        expect(() => analyzeMetafile(noInputs)).toThrow(/byte count or no inputs/u);
+    });
+
+    it('measures the dispatch entry when the metafile carries several entry outputs', () => {
+        const json = JSON.stringify({
+            outputs: {
+                other: { entryPoint: 'src/other.ts', bytes: 5, inputs: { 'src/other.ts': { bytesInOutput: 5 } } },
+                main: { entryPoint: 'src/scripts/hooks/dispatch_entry.ts', bytes: 7, inputs: { 'src/a.ts': { bytesInOutput: 7 } } },
+            },
+        });
+        expect(analyzeMetafile(json).bytes).toBe(7);
+        const ambiguous = JSON.stringify({
+            outputs: {
+                a: { entryPoint: 'src/a.ts', bytes: 5, inputs: { 'src/a.ts': { bytesInOutput: 5 } } },
+                b: { entryPoint: 'src/b.ts', bytes: 7, inputs: { 'src/b.ts': { bytesInOutput: 7 } } },
+            },
+        });
+        expect(() => analyzeMetafile(ambiguous)).toThrow(/none is/u);
+    });
+
     it('throws on a metafile with no entry-point output rather than reporting zero', () => {
         expect(() => analyzeMetafile(JSON.stringify({ inputs: {}, outputs: {} }))).toThrow(/entry/u);
     });
diff --git a/tests/scripts/hooks/bundled_yaml.test.ts b/tests/scripts/hooks/bundled_yaml.test.ts
new file mode 100644
index 0000000000..2c55411ecf
--- /dev/null
+++ b/tests/scripts/hooks/bundled_yaml.test.ts
@@ -0,0 +1,61 @@
+// The bundle hands its `yaml` copy to the chunks (hooks/bundled_yaml.ts + the
+// chunk banner in hook_chunks.mjs), so a chunk never loads a second copy from
+// node_modules (road-to-a-hook-system-that-pays-for-what-it-does 2.1).
+import { createRequire } from 'node:module';
+
+import { afterEach, describe, expect, it } from 'vitest';
+
+import { BUNDLED_YAML_GLOBAL } from '../../../src/scripts/hooks/bundled_yaml.js';
+import { CHUNK_OPTIONS } from '../../../src/scripts/hook_chunks.mjs';
+
+const realRequire = createRequire(import.meta.url);
+const g = globalThis as Record<string, unknown>;
+const saved = g[BUNDLED_YAML_GLOBAL];
+
+afterEach(() => {
+    g[BUNDLED_YAML_GLOBAL] = saved;
+});
+
+/** Run the chunk banner the way node runs a CJS chunk: `require` is a wrapper parameter. */
+function bannerRequire(base: NodeJS.Require): NodeJS.Require {
+    const run = new Function('require', '__filename', '__dirname', `${CHUNK_OPTIONS.banner.js}; return require;`) as (
+        r: NodeJS.Require,
+        f: string,
+        d: string,
+    ) => NodeJS.Require;
+    return run(base, '/x/dist/hooks/c.chunk.cjs', '/x/dist/hooks');
+}
+
+describe('bundled yaml handoff', () => {
+    it('the published value is the package exports object a plain require returns', () => {
+        const published = g[BUNDLED_YAML_GLOBAL] as Record<string, unknown>;
+        const plain = realRequire('yaml') as Record<string, unknown>;
+        for (const k of ['parse', 'stringify', 'parseDocument', 'Document', 'YAMLMap']) {
+            expect(typeof published[k], k).toBe(typeof plain[k]);
+        }
+        expect((published['parse'] as (s: string) => unknown)('a: 1')).toEqual({ a: 1 });
+    });
+
+    it('inside a chunk, require("yaml") returns the bundle copy and loads nothing', () => {
+        const marker = { parse: () => 'bundled' };
+        g[BUNDLED_YAML_GLOBAL] = marker;
+        let loaded = 0;
+        const base = Object.assign((id: string) => {
+            loaded += 1;
+            return realRequire(id);
+        }, { resolve: realRequire.resolve, cache: realRequire.cache }) as unknown as NodeJS.Require;
+        const r = bannerRequire(base);
+        loaded = 0; // the banner itself requires node:url before it swaps `require`
+        expect(r('yaml')).toBe(marker);
+        expect(loaded).toBe(0);
+        expect(typeof r.resolve).toBe('function');
+        expect(r('node:path')).toBe(realRequire('node:path'));
+        expect(loaded).toBe(1);
+    });
+
+    it('without the global, a chunk falls back to a real require', () => {
+        g[BUNDLED_YAML_GLOBAL] = undefined;
+        const r = bannerRequire(realRequire);
+        expect((r('yaml') as { parse: (s: string) => unknown }).parse('b: 2')).toEqual({ b: 2 });
+    });
+});
diff --git a/tests/scripts/hooks/concern_env.test.ts b/tests/scripts/hooks/concern_env.test.ts
index 18669f1d5d..d2ed038307 100644
--- a/tests/scripts/hooks/concern_env.test.ts
+++ b/tests/scripts/hooks/concern_env.test.ts
@@ -55,6 +55,36 @@ describe('concern_env — one scope per dispatch', () => {
         expect(process.env['LD_PRELOAD']).toBe('/evil.so');
     });
 
+    it('a dispatch that throws inside the scope still restores, and the next dispatch opens a real scope', () => {
+        const dispatch = (fail: boolean): void => {
+            const close = openConcernEnvScope(ROOT);
+            try {
+                const leave = enterConcernEnv(ROOT);
+                process.env['LEAKED_BY_A'] = '1';
+                if (fail) throw new Error('concern loop blew up');
+                leave();
+            } finally {
+                close();
+            }
+        };
+        expect(() => dispatch(true)).toThrow(/blew up/);
+        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
+        expect(process.env['LEAKED_BY_A']).toBeUndefined();
+        const close = openConcernEnvScope(ROOT);
+        expect(process.env['LD_PRELOAD']).toBeUndefined();
+        close();
+        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
+    });
+
+    it('an inherited name on the hardened copy does not keep a variable alive', () => {
+        const close = openConcernEnvScope(ROOT);
+        const leave = enterConcernEnv(ROOT);
+        process.env['toString'] = 'set-by-concern';
+        leave();
+        expect(Object.hasOwn(process.env, 'toString')).toBe(false);
+        close();
+    });
+
     it('a nested open is a no-op and does not end the outer scope', () => {
         const close = openConcernEnvScope(ROOT);
         const inner = openConcernEnvScope(ROOT);
diff --git a/tests/scripts/hooks/hooks_doctor.test.ts b/tests/scripts/hooks/hooks_doctor.test.ts
index acd19fbde2..dac5e1f4e1 100644
--- a/tests/scripts/hooks/hooks_doctor.test.ts
+++ b/tests/scripts/hooks/hooks_doctor.test.ts
@@ -79,6 +79,31 @@ describe('hooks_doctor — collect', () => {
         expect(chat?.last_feedback?.endsWith(path.join('session-b', 'chat-history.json'))).toBe(true);
     });
 
+    it('last_feedback ranks by the recorded run time: a newer quiet run in a summary beats an older warn file', () => {
+        const stateDir = path.join(tmp, 'agents', 'runtime', 'state', '.dispatcher');
+        const a = path.join(stateDir, 'session-warn');
+        const b = path.join(stateDir, 'session-quiet');
+        fs.mkdirSync(a, { recursive: true });
+        fs.mkdirSync(b, { recursive: true });
+        fs.writeFileSync(path.join(a, 'chat-history.json'), JSON.stringify({ concern: 'chat-history', completed_at: '2026-11-20T10:00:00Z' }));
+        const summary = path.join(b, 'summary.json');
+        fs.writeFileSync(
+            summary,
+            JSON.stringify({
+                schema_version: 2,
+                invocations: [
+                    { completed_at: '2026-11-20T11:00:00Z', concerns: [{ concern: 'chat-history', exit_code: 0 }] },
+                    { completed_at: '2026-11-20T12:00:00Z', concerns: [{ concern: 'other', exit_code: 0 }] },
+                ],
+            }),
+        );
+        // The summary's mtime is OLDER than the warn file's: ranking must not use it.
+        const past = Date.now() / 1000 - 3600;
+        fs.utimesSync(summary, past, past);
+        const chat = doctor.collect(tmp, loadManifest()).concerns.find((c) => c.concern === 'chat-history');
+        expect(chat?.last_feedback?.endsWith(path.join('session-quiet', 'summary.json'))).toBe(true);
+    });
+
     it('surfaces the concern state file', () => {
         const stateDir = path.join(tmp, 'agents', 'runtime', 'state');
         fs.mkdirSync(stateDir, { recursive: true });
````
