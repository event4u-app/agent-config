<!-- evidence-type: analysis -->

# Ratification review — the hook-bundle budget becomes an allowlist and a backstop, and three per-dispatch fixed costs leave the dispatcher — round 3

You are an independent reviewer for a change in the `event4u/agent-config` repository. Gated files: the ratification gate, the dispatcher `hooks/dispatch_hook.ts`, two new dispatcher modules (`hooks/concern_env.ts`, `hooks/feedback_policy.ts`) and `src/config/hook-bundle-budget.json`. Under ADR-268 § 4 the change needs a two-provider verdict.

subject: 700a1fe84df103c281ddaffdfeb3c31cdf29426725ca5e3b027db93d86fe5078

(Base-revision gate digest over `.github/workflows/consistency.yml`, `src/config/hook-bundle-budget.json`, `src/scripts/check_kernel_edit_ratified.ts`, `src/scripts/hooks/concern_env.ts`, `src/scripts/hooks/dispatch_hook.ts`, `src/scripts/hooks/feedback_policy.ts` at commit `ec926e9106`. The head's gate, which no longer lists the budget file, computes `82171af3e0c47cb3de87b65b71cdaba14f33ebff94265b24efa553f75e3252a5` over the other five.)

The change is described in round 1 (`agents/evidence/council/hook-system-pays-ratification-r1-20261120.question.md`) and round 2 (`…-r2-20261120.question.md`), both committed.

## Round 2 and what changed (commit `ec926e9106`)

Refused 2/2. Each named point:

- **Re-entry isolation (both seats).** `concern_env.ts` keeps a stack of scopes. A nested open — a synchronous re-entry into dispatch from inside a concern — saves the outer concern's environment as it stands, applies its own hardened copy, and its close puts the outer environment back; inner concerns are reset to the inner hardened copy between each other. The outer concern is reset on leaving, as any concern. A close of a scope already ended by an enclosing close does nothing, so it cannot restore over an older environment. Full file below; tests below.
- **A throwing close (one seat).** The close function never throws: a failed restore is reported on stderr, so the `finally` around the concern loop cannot replace the dispatch's outcome.
- **Wrong single entry (both seats).** On the gate's own build `analyzeMetafile` now REQUIRES the output built from `src/scripts/hooks/dispatch_entry.ts`; the single-entry acceptance remains only for a `--metafile` fixture. An input without `bytesInOutput` is refused instead of counted as zero.
- **Timestamps (both seats).** `hooks_doctor` compares `Date.parse` instants, never strings; a non-file at the per-concern path is skipped. Tests for a warn falling between a summary's run of the target concern and its later run of another concern, and for differing fractional-second precision.
- **`raw_exit_code` in the summary (both seats: not shown).** It was in round 1's diff: `SUMMARY_KEYS` in `dispatch_hook.ts` gained `"raw_exit_code"` (excerpt below). It is asserted end to end by `tests/scripts/hooks/egress_stage.test.ts` ("a rewrite field in a concern reply never reaches the host"), which reads the concern's entry from `summary.json` and expects `raw_exit_code` 0 (excerpt below).
- **`require.resolve` (one seat).** The banner test now calls `r.resolve('yaml')` through the wrapped `require` and compares it with a real resolve.
- **Symlinked copies (one seat).** Not changed: two aliases of one physical copy are one copy; esbuild reports the path it bundled from, and two distinct directories are what the duplicate rule counts.
- **"Ordinary review" (both seats).** Concretely: a change to `hook-bundle-budget.json` merges through the repository's branch protection (pull request, required CI checks: Consistency and Tests) without a two-provider record. That is the owner's decision D2 in `agents/evidence/owner-directives/2026-11-20-hook-bundle-budget-and-hook-economy.md`. It is a governance change the owner made, recorded and cited; the question for this review is whether the code implements exactly that and nothing more.

Suites: 135 test files, 2,363 tests across the hook, dispatcher, composition and ratification-gate suites; the composition gate's self-test 4/4; the runtime load-set test green on four hot events.

## What to answer

1. Is each round-2 point closed? Name any that is not, with file and line.
2. Does anything here weaken a fail-closed guard, an exit-code contract, the hardening of a concern's child processes, or isolation between concerns?
3. Does the code expand authority beyond the owner's recorded decision D2?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## `src/scripts/hooks/concern_env.ts`, full content

````ts
/**
 * concern_env — the hardened environment in-process concerns run under, built
 * ONCE per dispatch instead of once per concern.
 *
 * In-process concerns may spawn their own children (git, dashboard regen), which
 * inherit `process.env`, so they run under the same hardened copy the spawn path
 * applies (`hardenedSpawnEnv`). The dispatcher used to copy the environment,
 * rebuild the hardened copy, delete and reassign, then restore — per concern.
 * Measured 0.2 ms per concern at 40 variables and up to 2 ms at 235, with 15 to
 * 20 concerns on a tool event (road-to-a-hook-system-that-pays-for-what-it-does
 * 2.3).
 *
 * Now: the dispatch opens one scope before its concern loop (saved environment
 * plus hardened copy, applied once) and closes it after. Each concern leaves
 * through {@link enterConcernEnv}'s release, which compares the environment
 * against the hardened copy and resets it only when the concern changed it —
 * so a variable one concern sets never reaches the next, which is the isolation
 * the per-concern rebuild bought.
 *
 * Outside an open scope (a direct call, a test) `enterConcernEnv` falls back to
 * the old per-concern save, harden and restore, so no caller depends on the
 * scope existing.
 */
import { hardenedSpawnEnv } from '../_lib/spawn_env.js';

interface Scope {
    readonly prev: NodeJS.ProcessEnv;
    readonly hardened: NodeJS.ProcessEnv;
}

/** Innermost last. A nested dispatch (a re-entry from inside a concern) pushes its own scope. */
const stack: Scope[] = [];

/** Make `process.env` equal `target`: drop keys it lacks, set the ones that differ. */
function replaceEnv(target: NodeJS.ProcessEnv): void {
    for (const k of Object.keys(process.env)) {
        if (!Object.hasOwn(target, k)) delete process.env[k];
    }
    for (const [k, v] of Object.entries(target)) {
        if (v !== undefined && process.env[k] !== v) process.env[k] = v;
    }
}

function drifted(target: NodeJS.ProcessEnv): boolean {
    const keys = Object.keys(process.env);
    if (keys.length !== Object.keys(target).length) return true;
    for (const k of keys) {
        if (!Object.hasOwn(target, k) || process.env[k] !== target[k]) return true;
    }
    return false;
}

/**
 * Open a dispatch scope: save the environment as it is now, apply its hardened
 * copy. Returns the close function, which restores the saved environment and
 * never throws (a failed restore is reported on stderr, so a `finally` that
 * calls it cannot replace the dispatch's own outcome). The caller closes it in a
 * `finally`, so a dispatch that throws still restores and leaves no scope open.
 *
 * A nested open — a synchronous re-entry into dispatch from inside a concern —
 * is a scope of its own: it saves the outer concern's environment as it stands,
 * hardens THAT, and its close puts it back. Inner concerns are reset to the inner
 * hardened copy between each other; the outer concern gets its own environment
 * back when the inner dispatch returns, and is reset on leaving as usual.
 */
export function openConcernEnvScope(packageRoot: string): () => void {
    const scope: Scope = { prev: { ...process.env }, hardened: hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: packageRoot }) };
    replaceEnv(scope.hardened);
    stack.push(scope);
    let closed = false;
    return () => {
        if (closed) return;
        closed = true;
        const at = stack.lastIndexOf(scope);
        // Already ended by an enclosing scope's close: that close restored an
        // older environment, which this one must not overwrite.
        if (at < 0) return;
        stack.splice(at);
        try {
            replaceEnv(scope.prev);
        } catch (err) {
            process.stderr.write(`concern_env: environment restore failed: ${err instanceof Error ? err.message : String(err)}\n`);
        }
    };
}

/** Enter the environment for one concern; call the returned function when it has run. */
export function enterConcernEnv(packageRoot: string): () => void {
    const scope = stack[stack.length - 1];
    if (scope === undefined) return openConcernEnvScope(packageRoot);
    return () => {
        if (drifted(scope.hardened)) replaceEnv(scope.hardened);
    };
}
````

## `dispatch_hook.ts` excerpts — the summary keys and the loop scope

````ts
829:  const SUMMARY_KEYS = new Set([
830-    "concern",
831-    "exit_code",
832-    "raw_exit_code",
833-    "severity",
834-    "decision",
835-    "reason",
836-    "duration_ms",
837-    "payload_bodies",
838-    "payload_stubs",
839-  ]);
1294-  );
1295:  const closeConcernEnv = openConcernEnvScope(REPO_ROOT);
1296-  try {
1297-    for (const [concern, keep_classes] of keep_by_concern) {
--
1401-  } finally {
1402:    closeConcernEnv();
1403-  }
1404-  const final_rc = _reduce(rcs);
````

## `egress_stage.test.ts` excerpt — the summary assertion

````ts
433:  it("a rewrite field in a concern reply never reaches the host (ADR-285)", () => {
434-    const ws = path.join(tmp, "ws-rewrite");
435-    fs.mkdirSync(ws, { recursive: true });
436-    const stdout = dispatch(ws, "protect", "pre_tool_use", "PreToolUse", {
437-      session_id: "egress-rewrite",
438-      tool_name: "Bash",
439-      tool_input: { command: "ls" },
440-    });
441-    expect(stdout.includes("updatedInput")).toBe(false);
442-    // The rewriting fixture did run and reply: without this the assertion above
443-    // would also pass for a fixture that never started.
444-    const dir = feedback_dir(path.join(ws, "agents", "runtime", "state"), "egress-rewrite");
445-    // A quiet allow has no file of its own (feedback_policy.ts); summary.json carries every entry.
446-    const summary = JSON.parse(fs.readFileSync(path.join(dir, "summary.json"), "utf8")) as {
447-      invocations: Array<{ concerns: Array<Record<string, unknown>> }>;
````

## The diff since round 2 (`git diff 7b9f836abb..ec926e9106`)

````diff
diff --git a/src/scripts/check_hook_bundle_composition.ts b/src/scripts/check_hook_bundle_composition.ts
index f04c38fe18..80f0a114f5 100644
--- a/src/scripts/check_hook_bundle_composition.ts
+++ b/src/scripts/check_hook_bundle_composition.ts
@@ -117,22 +117,26 @@ export function packageRoot(modulePath: string): string | null {
 /**
  * Parse an esbuild metafile and attribute the output built from {@link ENTRY_REL}.
  *
- * Refuses rather than defaulting: an output with no `bytes` or no `inputs`
- * would otherwise read as a clean zero-byte bundle, which is the silent green
- * this gate exists to replace. A metafile carrying exactly one entry output is
- * accepted whatever its entry is named (the self-test fixtures).
+ * Refuses rather than defaulting: an output with no `bytes`, no `inputs`, or an
+ * input with no `bytesInOutput` would otherwise read as a clean bundle, which is
+ * the silent green this gate exists to replace. With `requireEntry` (the gate's
+ * own build) the output MUST be the one built from {@link ENTRY_REL}; without
+ * it (a `--metafile` fixture) a single entry output is accepted whatever its
+ * entry is named.
  */
-export function analyzeMetafile(json: string): Analysis {
+export function analyzeMetafile(json: string, opts: { requireEntry?: boolean } = {}): Analysis {
     const meta = JSON.parse(json) as {
         outputs?: Record<string, { entryPoint?: string; bytes?: number; inputs?: Record<string, { bytesInOutput?: number }> }>;
     };
     const entries = Object.values(meta.outputs ?? {}).filter((o) => typeof o.entryPoint === 'string');
-    const out = entries.find((o) => o.entryPoint === ENTRY_REL) ?? (entries.length === 1 ? entries[0] : undefined);
+    const out =
+        entries.find((o) => o.entryPoint === ENTRY_REL) ??
+        (opts.requireEntry !== true && entries.length === 1 ? entries[0] : undefined);
     if (out === undefined) {
         throw new Error(
             entries.length === 0
                 ? 'metafile carries no entry-point output — refusing to report a composition for a build that produced nothing'
-                : `metafile carries ${String(entries.length)} entry outputs and none is ${ENTRY_REL}`,
+                : `metafile carries ${String(entries.length)} entry output(s) and none is ${ENTRY_REL}`,
         );
     }
     if (typeof out.bytes !== 'number' || out.inputs === undefined || Object.keys(out.inputs).length === 0) {
@@ -141,8 +145,11 @@ export function analyzeMetafile(json: string): Analysis {
     const packageBytes = new Map<string, number>();
     const roots = new Map<string, Set<string>>();
     for (const [p, v] of Object.entries(out.inputs)) {
+        if (typeof v.bytesInOutput !== 'number') {
+            throw new Error(`input ${p} carries no bytesInOutput — refusing to attribute it as zero`);
+        }
         const pkg = owningPackage(p);
-        const bytes = v.bytesInOutput ?? 0;
+        const bytes = v.bytesInOutput;
         if (pkg === null || bytes <= 0) continue;
         packageBytes.set(pkg, (packageBytes.get(pkg) ?? 0) + bytes);
         const root = packageRoot(p);
@@ -334,7 +341,7 @@ export function main(argv: readonly string[] = process.argv.slice(2), root: stri
 
     let analysis: Analysis;
     try {
-        analysis = analyzeMetafile(json);
+        analysis = analyzeMetafile(json, { requireEntry: fixture === undefined });
     } catch (e) {
         process.stderr.write(`check_hook_bundle_composition: ${String(e instanceof Error ? e.message : e)}\n`);
         return 1;
diff --git a/src/scripts/hooks/concern_env.ts b/src/scripts/hooks/concern_env.ts
index b0a15f9d9c..90f62b1b5f 100644
--- a/src/scripts/hooks/concern_env.ts
+++ b/src/scripts/hooks/concern_env.ts
@@ -28,7 +28,8 @@ interface Scope {
     readonly hardened: NodeJS.ProcessEnv;
 }
 
-let active: Scope | null = null;
+/** Innermost last. A nested dispatch (a re-entry from inside a concern) pushes its own scope. */
+const stack: Scope[] = [];
 
 /** Make `process.env` equal `target`: drop keys it lacks, set the ones that differ. */
 function replaceEnv(target: NodeJS.ProcessEnv): void {
@@ -50,33 +51,43 @@ function drifted(target: NodeJS.ProcessEnv): boolean {
 }
 
 /**
- * Open the dispatch-wide scope. Returns the close function, which restores the
- * environment the dispatch started with. The caller closes it in a `finally`,
- * so a dispatch that throws still restores the environment and leaves no scope
- * open for the next dispatch in the same process.
+ * Open a dispatch scope: save the environment as it is now, apply its hardened
+ * copy. Returns the close function, which restores the saved environment and
+ * never throws (a failed restore is reported on stderr, so a `finally` that
+ * calls it cannot replace the dispatch's own outcome). The caller closes it in a
+ * `finally`, so a dispatch that throws still restores and leaves no scope open.
  *
- * A nested open (a synchronous re-entry into dispatch from inside a concern)
- * returns a no-op closer and runs under the outer scope's hardened copy; the
- * outer close restores. Each concern still gets a drift reset on leaving.
+ * A nested open — a synchronous re-entry into dispatch from inside a concern —
+ * is a scope of its own: it saves the outer concern's environment as it stands,
+ * hardens THAT, and its close puts it back. Inner concerns are reset to the inner
+ * hardened copy between each other; the outer concern gets its own environment
+ * back when the inner dispatch returns, and is reset on leaving as usual.
  */
 export function openConcernEnvScope(packageRoot: string): () => void {
-    if (active !== null) return () => undefined;
-    const prev = { ...process.env };
-    const hardened = hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: packageRoot });
-    replaceEnv(hardened);
-    const scope: Scope = { prev, hardened };
-    active = scope;
+    const scope: Scope = { prev: { ...process.env }, hardened: hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: packageRoot }) };
+    replaceEnv(scope.hardened);
+    stack.push(scope);
+    let closed = false;
     return () => {
-        if (active !== scope) return;
-        replaceEnv(scope.prev);
-        active = null;
+        if (closed) return;
+        closed = true;
+        const at = stack.lastIndexOf(scope);
+        // Already ended by an enclosing scope's close: that close restored an
+        // older environment, which this one must not overwrite.
+        if (at < 0) return;
+        stack.splice(at);
+        try {
+            replaceEnv(scope.prev);
+        } catch (err) {
+            process.stderr.write(`concern_env: environment restore failed: ${err instanceof Error ? err.message : String(err)}\n`);
+        }
     };
 }
 
 /** Enter the environment for one concern; call the returned function when it has run. */
 export function enterConcernEnv(packageRoot: string): () => void {
-    const scope = active;
-    if (scope === null) return openConcernEnvScope(packageRoot);
+    const scope = stack[stack.length - 1];
+    if (scope === undefined) return openConcernEnvScope(packageRoot);
     return () => {
         if (drifted(scope.hardened)) replaceEnv(scope.hardened);
     };
diff --git a/src/scripts/hooks_doctor.ts b/src/scripts/hooks_doctor.ts
index 7cec5d81b8..97e4463bb5 100644
--- a/src/scripts/hooks_doctor.ts
+++ b/src/scripts/hooks_doctor.ts
@@ -143,9 +143,12 @@ function _latest_feedback(state_dir: string, concern: string): string | null {
   } catch {
     return null;
   }
-  let best: { p: string; at: string; detail: boolean } | null = null;
-  const consider = (p: string, at: string | null, detail: boolean): void => {
-    if (at === null) return;
+  // Compared as instants, never as strings: two writers may differ in
+  // fractional-second precision.
+  let best: { p: string; at: number; detail: boolean } | null = null;
+  const consider = (p: string, iso: string | null, detail: boolean): void => {
+    const at = iso === null ? Number.NaN : Date.parse(iso);
+    if (Number.isNaN(at)) return;
     if (best === null || at > best.at || (at === best.at && detail && !best.detail)) best = { p, at, detail };
   };
   for (const sess of sessions) {
@@ -164,7 +167,9 @@ function _latest_feedback(state_dir: string, concern: string): string | null {
 function _recorded_at(file: string): string | null {
   let mtime: string;
   try {
-    mtime = fs.statSync(file).mtime.toISOString();
+    const st = fs.statSync(file);
+    if (!st.isFile()) return null;
+    mtime = st.mtime.toISOString();
   } catch {
     return null;
   }
@@ -184,9 +189,9 @@ function _summary_last_run(summary: string, concern: string): string | null {
     };
     let last: string | null = null;
     for (const inv of doc.invocations ?? []) {
-      if (typeof inv.completed_at !== "string") continue;
+      if (typeof inv.completed_at !== "string" || Number.isNaN(Date.parse(inv.completed_at))) continue;
       if (!(inv.concerns ?? []).some((c) => c.concern === concern)) continue;
-      if (last === null || inv.completed_at > last) last = inv.completed_at;
+      if (last === null || Date.parse(inv.completed_at) > Date.parse(last)) last = inv.completed_at;
     }
     return last;
   } catch {
diff --git a/tests/scripts/hook_bundle_composition.test.ts b/tests/scripts/hook_bundle_composition.test.ts
index 9aeb270659..04442243bf 100644
--- a/tests/scripts/hook_bundle_composition.test.ts
+++ b/tests/scripts/hook_bundle_composition.test.ts
@@ -124,6 +124,19 @@ describe('check_hook_bundle_composition — analyzeMetafile', () => {
         expect(() => analyzeMetafile(ambiguous)).toThrow(/none is/u);
     });
 
+    it('on the gate\'s own build, a single output built from another entry is refused, not measured', () => {
+        const wrong = JSON.stringify({ outputs: { o: { entryPoint: 'src/other.ts', bytes: 5, inputs: { 'src/other.ts': { bytesInOutput: 5 } } } } });
+        expect(() => analyzeMetafile(wrong, { requireEntry: true })).toThrow(/none is/u);
+        expect(analyzeMetafile(wrong).bytes).toBe(5);
+    });
+
+    it('refuses an input with no bytesInOutput instead of counting it as zero', () => {
+        const json = JSON.stringify({
+            outputs: { o: { entryPoint: 'src/scripts/hooks/dispatch_entry.ts', bytes: 9, inputs: { 'node_modules/left-pad/x.js': {} } } },
+        });
+        expect(() => analyzeMetafile(json)).toThrow(/bytesInOutput/u);
+    });
+
     it('throws on a metafile with no entry-point output rather than reporting zero', () => {
         expect(() => analyzeMetafile(JSON.stringify({ inputs: {}, outputs: {} }))).toThrow(/entry/u);
     });
diff --git a/tests/scripts/hooks/bundled_yaml.test.ts b/tests/scripts/hooks/bundled_yaml.test.ts
index 2c55411ecf..a62a39ac6b 100644
--- a/tests/scripts/hooks/bundled_yaml.test.ts
+++ b/tests/scripts/hooks/bundled_yaml.test.ts
@@ -48,7 +48,7 @@ describe('bundled yaml handoff', () => {
         loaded = 0; // the banner itself requires node:url before it swaps `require`
         expect(r('yaml')).toBe(marker);
         expect(loaded).toBe(0);
-        expect(typeof r.resolve).toBe('function');
+        expect(r.resolve('yaml')).toBe(realRequire.resolve('yaml'));
         expect(r('node:path')).toBe(realRequire('node:path'));
         expect(loaded).toBe(1);
     });
diff --git a/tests/scripts/hooks/concern_env.test.ts b/tests/scripts/hooks/concern_env.test.ts
index d2ed038307..8792274048 100644
--- a/tests/scripts/hooks/concern_env.test.ts
+++ b/tests/scripts/hooks/concern_env.test.ts
@@ -85,12 +85,36 @@ describe('concern_env — one scope per dispatch', () => {
         close();
     });
 
-    it('a nested open is a no-op and does not end the outer scope', () => {
-        const close = openConcernEnvScope(ROOT);
-        const inner = openConcernEnvScope(ROOT);
-        inner();
+    it('a re-entrant dispatch is a scope of its own: inner concerns never see the outer concern\'s changes', () => {
+        const closeOuter = openConcernEnvScope(ROOT);
+        const leaveOuter = enterConcernEnv(ROOT);
+        process.env['OUTER_CONCERN_SET'] = 'outer';
+        // The outer concern re-enters dispatch synchronously.
+        const closeInner = openConcernEnvScope(ROOT);
+        const leaveInnerA = enterConcernEnv(ROOT);
+        process.env['INNER_A_SET'] = 'a';
+        leaveInnerA();
+        expect(process.env['INNER_A_SET']).toBeUndefined();
+        expect(process.env['OUTER_CONCERN_SET']).toBe('outer'); // the inner scope hardened the env as it stood
+        closeInner();
+        expect(process.env['OUTER_CONCERN_SET']).toBe('outer'); // the outer concern gets its env back
+        leaveOuter();
+        expect(process.env['OUTER_CONCERN_SET']).toBeUndefined(); // and is reset on leaving, as any concern
         expect(process.env['LD_PRELOAD']).toBeUndefined();
-        close();
+        closeOuter();
+        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
+    });
+
+    it('closing twice, or out of order, never leaves a scope behind', () => {
+        const closeOuter = openConcernEnvScope(ROOT);
+        const closeInner = openConcernEnvScope(ROOT);
+        closeOuter();
+        closeInner();
+        closeOuter();
+        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
+        const leave = enterConcernEnv(ROOT); // no scope open: the per-concern fallback
+        expect(process.env['LD_PRELOAD']).toBeUndefined();
+        leave();
         expect(process.env['LD_PRELOAD']).toBe('/evil.so');
     });
 });
diff --git a/tests/scripts/hooks/hooks_doctor.test.ts b/tests/scripts/hooks/hooks_doctor.test.ts
index dac5e1f4e1..6de02a997d 100644
--- a/tests/scripts/hooks/hooks_doctor.test.ts
+++ b/tests/scripts/hooks/hooks_doctor.test.ts
@@ -104,6 +104,40 @@ describe('hooks_doctor — collect', () => {
         expect(chat?.last_feedback?.endsWith(path.join('session-quiet', 'summary.json'))).toBe(true);
     });
 
+    it('last_feedback ranks a summary by the target concern\'s own last run, not by a later run of another concern', () => {
+        const stateDir = path.join(tmp, 'agents', 'runtime', 'state', '.dispatcher');
+        const a = path.join(stateDir, 'session-warn');
+        const b = path.join(stateDir, 'session-quiet');
+        fs.mkdirSync(a, { recursive: true });
+        fs.mkdirSync(b, { recursive: true });
+        // The warn falls BETWEEN the summary's run of chat-history (10:00) and its later run of another concern (12:00).
+        fs.writeFileSync(path.join(a, 'chat-history.json'), JSON.stringify({ completed_at: '2026-11-20T11:00:00Z' }));
+        fs.writeFileSync(
+            path.join(b, 'summary.json'),
+            JSON.stringify({
+                invocations: [
+                    { completed_at: '2026-11-20T10:00:00Z', concerns: [{ concern: 'chat-history' }] },
+                    { completed_at: '2026-11-20T12:00:00Z', concerns: [{ concern: 'other' }] },
+                ],
+            }),
+        );
+        const chat = doctor.collect(tmp, loadManifest()).concerns.find((c) => c.concern === 'chat-history');
+        expect(chat?.last_feedback?.endsWith(path.join('session-warn', 'chat-history.json'))).toBe(true);
+    });
+
+    it('last_feedback compares instants, not strings of different precision', () => {
+        const stateDir = path.join(tmp, 'agents', 'runtime', 'state', '.dispatcher');
+        const a = path.join(stateDir, 'session-a');
+        const b = path.join(stateDir, 'session-b');
+        fs.mkdirSync(a, { recursive: true });
+        fs.mkdirSync(b, { recursive: true });
+        // As strings '…10:00:00.500Z' sorts BEFORE '…10:00:00Z'; as instants it is later.
+        fs.writeFileSync(path.join(a, 'chat-history.json'), JSON.stringify({ completed_at: '2026-11-20T10:00:00.500Z' }));
+        fs.writeFileSync(path.join(b, 'chat-history.json'), JSON.stringify({ completed_at: '2026-11-20T10:00:00Z' }));
+        const chat = doctor.collect(tmp, loadManifest()).concerns.find((c) => c.concern === 'chat-history');
+        expect(chat?.last_feedback?.endsWith(path.join('session-a', 'chat-history.json'))).toBe(true);
+    });
+
     it('surfaces the concern state file', () => {
         const stateDir = path.join(tmp, 'agents', 'runtime', 'state');
         fs.mkdirSync(stateDir, { recursive: true });
````
