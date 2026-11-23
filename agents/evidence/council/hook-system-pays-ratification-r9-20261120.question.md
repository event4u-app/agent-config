<!-- evidence-type: analysis -->

# Ratification review — the hook-bundle budget becomes an allowlist and a backstop, and three per-dispatch fixed costs leave the dispatcher — round 9

You are an independent reviewer for a change in the `event4u/agent-config` repository. Gated files: `consistency.yml` (one step's name and comment), the dispatcher `hooks/dispatch_hook.ts`, new dispatcher modules `hooks/concern_env.ts` and `hooks/feedback_policy.ts`, and `src/config/hook-bundle-budget.json`. The ratification gate itself is unchanged and the budget file stays on its watched set (round 8). Under ADR-268 § 4 the change needs a two-provider verdict.

subject: ab988f69dee920d32ff05cc8be8808a649f8d6d1bcdfc7f3959b656a23e53c45

(Over those five files at commit `9c6bb2d8c7`; base and head gate agree.)

Rounds 4–8 (`agents/evidence/council/hook-system-pays-ratification-r4…r8-20261120.question.md`, committed) carry the full description and files. Round 8: both seats found the rest sound and refused on two points, both fixed here.

## Round 8 points

1. **Stdin override installed before the environment entry (both seats).** In `_run_concern_inproc` the order is now `const leaveEnv = enterConcernEnv(REPO_ROOT);` THEN `setHookStdinOverride(…)`, so a repair that throws leaves no override and no captured stdout/stderr behind (excerpt below).
2. **A failed closing restore could still yield a normal verdict (one seat).** A scope close that cannot restore records the failure; the dispatcher calls `assertConcernEnvRestored()` right AFTER the `finally` that closes the scope, which throws when the mark is set. That line is reached only when no error is in flight, so an in-flight dispatch error propagates unchanged and is not masked; a dispatch whose environment could not be put back gives no verdict, and the generated host command refuses the call. Tests: the close fails → the check throws and clears its mark; with an error in flight the original error propagates. The host-refusal test now also asserts that the dispatcher's own stderr shows the injected fault was the one reached.

Note on rounds 3 and 8: round 3 asked that cleanup never replace the dispatch's outcome; round 8 asked that a failed restore prevent an allow. Both hold: the close itself never throws (an error in flight stays the error), and the restore check after the `finally` turns a clean-but-unrestored dispatch into a refusal.

Suites: 135 test files, 2,376 tests; composition self-test 4/4; load-set test green.

## What to answer

1. Are both round-8 points closed by what is shown?
2. Does anything in the five gated files, as now changed, weaken a fail-closed guard, an exit-code contract, child-process hardening, or isolation between concerns, or expand authority?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## `src/scripts/hooks/concern_env.ts`, full

````
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
    /** Set when a reset between concerns failed; the next concern must not start until it is repaired. */
    needsRepair: boolean;
}

/** Innermost last. A nested dispatch (a re-entry from inside a concern) pushes its own scope. */
const stack: Scope[] = [];

/** Set when a scope's closing restore failed; read and cleared by {@link assertConcernEnvRestored}. */
let restoreFailed: string | null = null;

/**
 * Throws when the last scope close could not restore the environment, then
 * clears the mark. Called AFTER the `finally` that closes the scope, so it runs
 * only when no dispatch error is already in flight (that one propagates
 * unchanged): a dispatch whose environment could not be put back gives no
 * verdict, and the host command refuses the call.
 */
export function assertConcernEnvRestored(): void {
    const failed = restoreFailed;
    restoreFailed = null;
    if (failed !== null) throw new Error(`concern environment not restored: ${failed}`);
}

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

/** Report on stderr without ever throwing: a cleanup path must not replace the dispatch's outcome. */
export function reportQuietly(what: string, err: unknown): void {
    try {
        process.stderr.write(`concern_env: ${what}: ${err instanceof Error ? err.message : String(err)}\n`);
    } catch {
        /* nothing left to report through */
    }
}

/**
 * Open a dispatch scope. Returns the close function, which puts back the
 * environment as it was when the scope opened and never throws (a failed
 * restore is reported, so a `finally` that calls it cannot replace the
 * dispatch's own outcome). The caller closes it in a `finally`, so a dispatch
 * that throws still restores and leaves no scope open.
 *
 * The hardened copy a scope applies is derived from the ENCLOSING scope's
 * hardened copy when there is one, never from the live environment: a
 * synchronous re-entry into dispatch from inside a concern must not hand that
 * concern's changes to the inner concerns. The live environment is still saved,
 * so the outer concern gets its own environment back when the inner dispatch
 * returns.
 */
export function openConcernEnvScope(packageRoot: string): () => void {
    const prev = { ...process.env };
    const enclosing = stack[stack.length - 1];
    const hardened =
        enclosing === undefined
            ? hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: packageRoot })
            : { ...enclosing.hardened, AGENT_CONFIG_PACKAGE_ROOT: packageRoot };
    const scope: Scope = { prev, hardened, needsRepair: false };
    try {
        replaceEnv(hardened);
    } catch (err) {
        // A half-applied hardening must not outlive a scope the caller never got.
        try {
            replaceEnv(prev);
        } catch (rollbackErr) {
            reportQuietly('environment rollback failed', rollbackErr);
        }
        throw err;
    }
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
            restoreFailed = err instanceof Error ? err.message : String(err);
            reportQuietly('environment restore failed', err);
        }
    };
}

/**
 * Enter the environment for one concern; call the returned function when it has
 * run. The release resets only while its scope is still the innermost one: a
 * release that outlives its scope (the scope already closed) does nothing, so it
 * can never put an older hardened copy over the current scope.
 *
 * A reset that fails marks the scope; the next concern's entry repairs it first
 * and THROWS if it cannot, so no concern ever starts on an environment that is
 * not its hardened baseline. The throw escapes the dispatch, whose host command
 * turns a missing verdict into a refusal — fail-closed, for a case that needs
 * `process.env` assignment itself to fail twice.
 */
export function enterConcernEnv(packageRoot: string): () => void {
    const scope = stack[stack.length - 1];
    if (scope === undefined) return openConcernEnvScope(packageRoot);
    if (scope.needsRepair || drifted(scope.hardened)) {
        replaceEnv(scope.hardened);
        scope.needsRepair = false;
    }
    return () => {
        if (stack[stack.length - 1] !== scope) return;
        try {
            if (drifted(scope.hardened)) replaceEnv(scope.hardened);
        } catch (err) {
            scope.needsRepair = true;
            reportQuietly('environment reset failed', err);
        }
    };
}
````

## `_run_concern_inproc` and the loop scope in `dispatch_hook.ts`, excerpts

````ts
624:  const prevCwd = process.cwd();
625-
626-  const started = performance.now();
627-  let rc = 0;
628-  const leaveEnv = enterConcernEnv(REPO_ROOT); // first: if it throws, nothing below is installed yet
629-  setHookStdinOverride(_compactJsonDumps(envelope));
630-  process.stdout.write = makeCapture((s) => {
631-    out += s;
632-  });
1401-    closeConcernEnv();
1402-  }
1403:  assertConcernEnvRestored(); // a failed restore refuses rather than allowing on a dirty process
1404-  const final_rc = _reduce(rcs);
1405-  writeConcernTimings(String(envelope["event"] ?? ""), String(envelope["platform"] ?? ""), timing_samples);
1406-  _write_feedback(envelope, session_id, feedback_entries, final_rc, started_at);
1407-  _record_rule_trips(envelope, feedback_entries);
````

## The diff since round 8 (`git diff d3035561c3..9c6bb2d8c7`)

````diff
diff --git a/src/scripts/hooks/concern_env.ts b/src/scripts/hooks/concern_env.ts
index f9acec8c7e..7ce1f8ef1c 100644
--- a/src/scripts/hooks/concern_env.ts
+++ b/src/scripts/hooks/concern_env.ts
@@ -33,6 +33,22 @@ interface Scope {
 /** Innermost last. A nested dispatch (a re-entry from inside a concern) pushes its own scope. */
 const stack: Scope[] = [];
 
+/** Set when a scope's closing restore failed; read and cleared by {@link assertConcernEnvRestored}. */
+let restoreFailed: string | null = null;
+
+/**
+ * Throws when the last scope close could not restore the environment, then
+ * clears the mark. Called AFTER the `finally` that closes the scope, so it runs
+ * only when no dispatch error is already in flight (that one propagates
+ * unchanged): a dispatch whose environment could not be put back gives no
+ * verdict, and the host command refuses the call.
+ */
+export function assertConcernEnvRestored(): void {
+    const failed = restoreFailed;
+    restoreFailed = null;
+    if (failed !== null) throw new Error(`concern environment not restored: ${failed}`);
+}
+
 /** Make `process.env` equal `target`: drop keys it lacks, set the ones that differ. */
 function replaceEnv(target: NodeJS.ProcessEnv): void {
     for (const k of Object.keys(process.env)) {
@@ -107,6 +123,7 @@ export function openConcernEnvScope(packageRoot: string): () => void {
         try {
             replaceEnv(scope.prev);
         } catch (err) {
+            restoreFailed = err instanceof Error ? err.message : String(err);
             reportQuietly('environment restore failed', err);
         }
     };
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index 40f8ed4234..085fe14c94 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -72,7 +72,7 @@ import { _fallback_yaml } from './fallback_yaml.js';
 import { detectSurface } from '../_lib/surface.js';
 import { recordCapture, recordOpportunity } from "../_lib/collector_denominator.js";
 import { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN, EXIT_USAGE } from './exit_codes.js';
-import { enterConcernEnv, openConcernEnvScope } from './concern_env.js';
+import { assertConcernEnvRestored, enterConcernEnv, openConcernEnvScope } from './concern_env.js';
 import { isQuietAllow, keepNewerOutcome } from './feedback_policy.js';
 export { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN };
 export { _fallback_yaml } from './fallback_yaml.js';
@@ -625,8 +625,8 @@ function _run_concern_inproc(
 
   const started = performance.now();
   let rc = 0;
+  const leaveEnv = enterConcernEnv(REPO_ROOT); // first: if it throws, nothing below is installed yet
   setHookStdinOverride(_compactJsonDumps(envelope));
-  const leaveEnv = enterConcernEnv(REPO_ROOT);
   process.stdout.write = makeCapture((s) => {
     out += s;
   });
@@ -1400,6 +1400,7 @@ export function main(argv?: string[]): number {
   } finally {
     closeConcernEnv();
   }
+  assertConcernEnvRestored(); // a failed restore refuses rather than allowing on a dirty process
   const final_rc = _reduce(rcs);
   writeConcernTimings(String(envelope["event"] ?? ""), String(envelope["platform"] ?? ""), timing_samples);
   _write_feedback(envelope, session_id, feedback_entries, final_rc, started_at);
diff --git a/tests/scripts/hook_load_set.test.ts b/tests/scripts/hook_load_set.test.ts
index 8a59275fac..98a0ebeda6 100644
--- a/tests/scripts/hook_load_set.test.ts
+++ b/tests/scripts/hook_load_set.test.ts
@@ -90,10 +90,13 @@ describe('hook runtime load set', () => {
         );
         const payload = path.join(root, 'pre.json');
         fs.writeFileSync(payload, JSON.stringify({ session_id: 'env-fail', hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: path.join(workspace, 'x.txt') }, cwd: workspace }));
-        const script = `"${process.execPath}" --require "${preload}" "${bundle}" --platform claude --event pre_tool_use --project-dir "${workspace}" < "${payload}" >/dev/null 2>&1; ${tail}`;
+        const diag = path.join(root, 'dispatch-stderr.txt');
+        const script = `"${process.execPath}" --require "${preload}" "${bundle}" --platform claude --event pre_tool_use --project-dir "${workspace}" < "${payload}" >/dev/null 2>"${diag}"; ${tail}`;
         const r = spawnSync('bash', ['-c', script], { encoding: 'utf-8', env: { ...process.env, LD_PRELOAD: '', AGENT_CONFIG_REPLAY: '1' } });
         expect(r.status).toBe(2);
         expect(r.stderr).toContain('this tool call is refused');
+        // The intended fault was the one reached: the dispatcher died on the injected env write.
+        expect(fs.readFileSync(diag, 'utf-8')).toContain('injected env write failure');
     }, 60_000);
 
     it('the tracer sees a runtime createRequire load — the class this check exists for', () => {
diff --git a/tests/scripts/hooks/concern_env.test.ts b/tests/scripts/hooks/concern_env.test.ts
index b16ea87bb5..84fcfd0f9c 100644
--- a/tests/scripts/hooks/concern_env.test.ts
+++ b/tests/scripts/hooks/concern_env.test.ts
@@ -5,7 +5,7 @@ import { spawnSync } from 'node:child_process';
 
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 
-import { enterConcernEnv, openConcernEnvScope, reportQuietly } from '../../../src/scripts/hooks/concern_env.js';
+import { assertConcernEnvRestored, enterConcernEnv, openConcernEnvScope, reportQuietly } from '../../../src/scripts/hooks/concern_env.js';
 
 const ROOT = '/pkg-root';
 let saved: NodeJS.ProcessEnv;
@@ -188,6 +188,35 @@ describe('concern_env — one scope per dispatch', () => {
             }
         });
 
+        it('a failed closing restore makes the dispatch refuse, without masking an error already in flight', () => {
+            installFailingEnv();
+            const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
+            try {
+                // No error in flight: the close fails, and the check after the finally throws.
+                const close = openConcernEnvScope(ROOT);
+                failing = true;
+                close();
+                failing = false;
+                expect(() => assertConcernEnvRestored()).toThrow(/concern environment not restored/);
+                expect(() => assertConcernEnvRestored()).not.toThrow(); // the mark is cleared
+                // An error in flight: it propagates unchanged, and the close's failure does not replace it.
+                const dispatch = (): void => {
+                    const c = openConcernEnvScope(ROOT);
+                    try {
+                        failing = true;
+                        throw new Error('the dispatch error');
+                    } finally {
+                        c();
+                        failing = false;
+                    }
+                };
+                expect(() => dispatch()).toThrow(/the dispatch error/);
+            } finally {
+                spy.mockRestore();
+                try { assertConcernEnvRestored(); } catch { /* cleared for the next test */ }
+            }
+        });
+
         it('a scope whose hardening fails half-way rolls back what it applied and throws', () => {
             installFailingEnv();
             const before = { ...(process.env as Record<string, string>) };
````
