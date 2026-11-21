<!-- evidence-type: analysis -->

# Ratification review — the hook-bundle budget becomes an allowlist and a backstop, and three per-dispatch fixed costs leave the dispatcher — round 5

You are an independent reviewer for a change in the `event4u/agent-config` repository. Gated files: the ratification gate `check_kernel_edit_ratified.ts`, its workflow `consistency.yml`, the dispatcher `hooks/dispatch_hook.ts`, new dispatcher modules `hooks/concern_env.ts` and `hooks/feedback_policy.ts`, and `src/config/hook-bundle-budget.json`. Under ADR-268 § 4 the change needs a two-provider verdict.

subject: 1d67b0f7b75d4f5ffeb660be76ec6db1f5e904f3ebace1cbeaa281d293b37c24

(Base-revision gate digest over those six files at commit `bd3c61cc96`. The head's gate, which no longer lists the budget file, computes `2b6916817c565e8c16293f3b89efde649ed38605be0bf1459105f4a9a025c440` over the other five.)

Round 4 (`agents/evidence/council/hook-system-pays-ratification-r4-20261120.question.md`, committed, self-contained) carries the full description and the full gated files. Both seats confirmed there: nested isolation, stale releases, cleanup safety, byte-count validation, `raw_exit_code`, and that the D2 scope is implemented as recorded with no expansion beyond it. Both refused on what follows; this round shows each fix in full.

## Round 4 points and the fixes (commit `bd3c61cc96`)

1. **A failed reset could leave the next concern on an unhardened environment (one seat).** The scope now carries `needsRepair`. A release whose reset throws sets it. Every concern's ENTRY checks `needsRepair || drifted(hardened)` and re-applies the hardened copy before the concern runs; if that re-application throws too, the throw escapes the dispatch and the host command turns the missing verdict into a refusal (fail-closed). So no concern starts on an environment other than its scope's hardened baseline — whatever left it drifted (a failed reset, or dispatcher code between concerns). Test: "a concern never starts on a drifted environment".
2. **A quiet allow left an earlier warning file standing (both seats).** The per-concern file means "this concern's latest outcome". After a quiet allow the dispatcher now removes that file (`dropStaleFeedback`, a forced `rmSync`: one unlink that usually finds nothing, never a locked write). Test in `feedback_policy.test.ts`. `hooks_doctor` additionally ranks by recorded run time (round 2), so its "last feedback" is right either way.
3. **`inputs` as an array (both seats).** `analyzeMetafile` requires `inputs` to be a non-array object with at least one key. Test "refuses an inputs list that is an array".

Suites: 135 test files, 2,370 tests (hook, dispatcher, composition, ratification gate); composition self-test 4/4; load-set test green.

## What to answer

1. Are the three round-4 points closed by what is shown?
2. Does any shown change weaken a fail-closed guard, an exit-code contract, child-process hardening, or isolation between concerns?

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
    replaceEnv(hardened);
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

## `src/scripts/hooks/feedback_policy.ts`, full

````
/**
 * feedback_policy — which concern outcomes get their own feedback file.
 *
 * The dispatcher's per-session `summary.json` carries every concern's entry.
 * A per-concern `<concern>.json` used to be written for every concern on every
 * dispatch: about 16 locked atomic writes per tool event, each overwritten by
 * the next dispatch (road-to-a-hook-system-that-pays-for-what-it-does 2.4).
 * Only an outcome worth looking at on its own keeps a file now; `hooks_doctor`
 * falls back to the summary for the rest.
 */
import * as fs from 'node:fs';

import { EXIT_ALLOW } from './exit_codes.js';

/** An entry that allowed, was not resolved from a crash, and gave no reason. */
export function isQuietAllow(entry: Readonly<Record<string, unknown>>): boolean {
    return (
        entry['exit_code'] === EXIT_ALLOW &&
        entry['raw_exit_code'] === EXIT_ALLOW &&
        entry['decision'] === 'allow' &&
        (entry['reason'] ?? null) === null
    );
}

/**
 * After a quiet allow, remove the concern's per-concern file if an earlier
 * non-quiet run left one: the file means "this concern's latest outcome", and a
 * warning the concern no longer gives must not stand as that. One `unlink` that
 * usually finds nothing (ENOENT), never a locked write.
 */
export function dropStaleFeedback(file: string): void {
    try {
        fs.rmSync(file, { force: true });
    } catch {
        /* a file we cannot remove is reported by nothing: the summary stays the record */
    }
}
````

## `tests/scripts/hooks/concern_env.test.ts`, full

````
// concern_env — the hardened environment is built once per dispatch, and a
// variable one concern sets never reaches the next
// (road-to-a-hook-system-that-pays-for-what-it-does 2.3).
import { spawnSync } from 'node:child_process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enterConcernEnv, openConcernEnvScope, reportQuietly } from '../../../src/scripts/hooks/concern_env.js';

const ROOT = '/pkg-root';
let saved: NodeJS.ProcessEnv;

beforeEach(() => {
    saved = { ...process.env };
    process.env['LD_PRELOAD'] = '/evil.so';
    process.env['CONCERN_ENV_KEEP'] = 'kept';
});

afterEach(() => {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
});

describe('concern_env — one scope per dispatch', () => {
    it('hardens once: injection vectors are gone inside the scope and back after it', () => {
        const close = openConcernEnvScope(ROOT);
        expect(process.env['LD_PRELOAD']).toBeUndefined();
        expect(process.env['AGENT_CONFIG_PACKAGE_ROOT']).toBe(ROOT);
        expect(process.env['CONCERN_ENV_KEEP']).toBe('kept');
        close();
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
        expect(process.env['AGENT_CONFIG_PACKAGE_ROOT']).toBe(saved['AGENT_CONFIG_PACKAGE_ROOT']);
    });

    it('a variable one concern sets, changes or deletes does not reach the next concern', () => {
        const close = openConcernEnvScope(ROOT);
        const leaveA = enterConcernEnv(ROOT);
        process.env['LEAKED_BY_A'] = '1';
        process.env['CONCERN_ENV_KEEP'] = 'changed';
        delete process.env['AGENT_CONFIG_PACKAGE_ROOT'];
        leaveA();
        const leaveB = enterConcernEnv(ROOT);
        expect(process.env['LEAKED_BY_A']).toBeUndefined();
        expect(process.env['CONCERN_ENV_KEEP']).toBe('kept');
        expect(process.env['AGENT_CONFIG_PACKAGE_ROOT']).toBe(ROOT);
        leaveB();
        close();
        expect(process.env['LEAKED_BY_A']).toBeUndefined();
    });

    it('outside a scope, a concern still runs hardened and restores what it found', () => {
        const leave = enterConcernEnv(ROOT);
        expect(process.env['LD_PRELOAD']).toBeUndefined();
        process.env['LEAKED_BY_A'] = '1';
        leave();
        expect(process.env['LEAKED_BY_A']).toBeUndefined();
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
    });

    it('a dispatch that throws inside the scope still restores, and the next dispatch opens a real scope', () => {
        const dispatch = (fail: boolean): void => {
            const close = openConcernEnvScope(ROOT);
            try {
                const leave = enterConcernEnv(ROOT);
                process.env['LEAKED_BY_A'] = '1';
                if (fail) throw new Error('concern loop blew up');
                leave();
            } finally {
                close();
            }
        };
        expect(() => dispatch(true)).toThrow(/blew up/);
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
        expect(process.env['LEAKED_BY_A']).toBeUndefined();
        const close = openConcernEnvScope(ROOT);
        expect(process.env['LD_PRELOAD']).toBeUndefined();
        close();
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
    });

    it('an inherited name on the hardened copy does not keep a variable alive', () => {
        const close = openConcernEnvScope(ROOT);
        const leave = enterConcernEnv(ROOT);
        process.env['toString'] = 'set-by-concern';
        leave();
        expect(Object.hasOwn(process.env, 'toString')).toBe(false);
        close();
    });

    it('a re-entrant dispatch is a scope of its own: inner concerns and their children never see the outer concern\'s changes', () => {
        const childSees = (name: string): string =>
            spawnSync(process.execPath, ['-e', `process.stdout.write(process.env[${JSON.stringify(name)}] ?? 'unset')`], { encoding: 'utf-8' }).stdout;
        const closeOuter = openConcernEnvScope(ROOT);
        const leaveOuter = enterConcernEnv(ROOT);
        process.env['OUTER_CONCERN_SET'] = 'outer';
        // The outer concern re-enters dispatch synchronously.
        const closeInner = openConcernEnvScope(ROOT);
        expect(process.env['OUTER_CONCERN_SET']).toBeUndefined();
        expect(childSees('OUTER_CONCERN_SET')).toBe('unset');
        expect(childSees('LD_PRELOAD')).toBe('unset');
        const leaveInnerA = enterConcernEnv(ROOT);
        process.env['INNER_A_SET'] = 'a';
        leaveInnerA();
        const leaveInnerB = enterConcernEnv(ROOT);
        expect(process.env['INNER_A_SET']).toBeUndefined();
        expect(process.env['OUTER_CONCERN_SET']).toBeUndefined();
        leaveInnerB();
        closeInner();
        expect(process.env['OUTER_CONCERN_SET']).toBe('outer'); // the outer concern gets its own env back
        leaveOuter();
        expect(process.env['OUTER_CONCERN_SET']).toBeUndefined(); // and is reset on leaving, as any concern
        closeOuter();
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
    });

    it('a concern never starts on a drifted environment: entry repairs what a failed or skipped reset left', () => {
        const close = openConcernEnvScope(ROOT);
        const leaveA = enterConcernEnv(ROOT);
        leaveA();
        // Whatever left this behind — a reset that threw, dispatcher code between concerns — the next entry clears it.
        process.env['LEFT_BEHIND'] = '1';
        process.env['LD_PRELOAD'] = '/evil.so';
        const leaveB = enterConcernEnv(ROOT);
        expect(process.env['LEFT_BEHIND']).toBeUndefined();
        expect(process.env['LD_PRELOAD']).toBeUndefined();
        leaveB();
        close();
    });

    it('a release that outlives its scope does nothing', () => {
        const closeOuter = openConcernEnvScope(ROOT);
        const closeInner = openConcernEnvScope(ROOT);
        const staleRelease = enterConcernEnv(ROOT); // bound to the inner scope
        closeInner();
        process.env['OUTER_LEVEL_STATE'] = 'kept';
        staleRelease();
        expect(process.env['OUTER_LEVEL_STATE']).toBe('kept');
        closeOuter();
    });

    it('reporting a cleanup failure never throws, even when stderr does', () => {
        const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => {
            throw new Error('stderr closed');
        });
        try {
            expect(() => reportQuietly('environment restore failed', new Error('x'))).not.toThrow();
        } finally {
            spy.mockRestore();
        }
    });

    it('closing twice, or out of order, never leaves a scope behind', () => {
        const closeOuter = openConcernEnvScope(ROOT);
        const closeInner = openConcernEnvScope(ROOT);
        closeOuter();
        closeInner();
        closeOuter();
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
        const leave = enterConcernEnv(ROOT); // no scope open: the per-concern fallback
        expect(process.env['LD_PRELOAD']).toBeUndefined();
        leave();
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
    });
});
````

## `tests/scripts/hooks/feedback_policy.test.ts`, full

````
// feedback_policy — only an outcome worth reading on its own keeps a
// per-concern feedback file (road-to-a-hook-system-that-pays-for-what-it-does 2.4).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { dropStaleFeedback, isQuietAllow } from '../../../src/scripts/hooks/feedback_policy.js';

const allow = { concern: 'c', exit_code: 0, raw_exit_code: 0, decision: 'allow', reason: null };

describe('feedback_policy — isQuietAllow', () => {
    it('a plain allow is quiet', () => {
        expect(isQuietAllow(allow)).toBe(true);
        expect(isQuietAllow({ ...allow, reason: undefined })).toBe(true);
    });

    it('a warn, a block, a crash resolved to allow, a non-allow decision or a reason keep their file', () => {
        expect(isQuietAllow({ ...allow, exit_code: 1, decision: 'warn' })).toBe(false);
        expect(isQuietAllow({ ...allow, exit_code: 2, decision: 'block' })).toBe(false);
        expect(isQuietAllow({ ...allow, raw_exit_code: 3 })).toBe(false);
        expect(isQuietAllow({ ...allow, decision: 'ask' })).toBe(false);
        expect(isQuietAllow({ ...allow, reason: 'context injected' })).toBe(false);
    });
});

describe('feedback_policy — dropStaleFeedback', () => {
    it('a quiet allow removes the warning an earlier run left, and a missing file is not an error', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-policy-'));
        try {
            const f = path.join(dir, 'c.json');
            fs.writeFileSync(f, JSON.stringify({ decision: 'warn' }));
            dropStaleFeedback(f);
            expect(fs.existsSync(f)).toBe(false);
            expect(() => dropStaleFeedback(f)).not.toThrow();
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
````

## The diff since round 4 (`git diff 1157db0a5f..bd3c61cc96`)

````diff
diff --git a/src/scripts/check_hook_bundle_composition.ts b/src/scripts/check_hook_bundle_composition.ts
index 60edc82d19..fd358f1c4f 100644
--- a/src/scripts/check_hook_bundle_composition.ts
+++ b/src/scripts/check_hook_bundle_composition.ts
@@ -144,12 +144,13 @@ export function analyzeMetafile(json: string, opts: { requireEntry?: boolean } =
                 : `metafile carries ${String(entries.length)} entry output(s) and none is ${ENTRY_REL}`,
         );
     }
-    if (!isByteCount(out.bytes) || out.inputs === undefined || Object.keys(out.inputs).length === 0) {
+    const inputsOk = typeof out.inputs === 'object' && out.inputs !== null && !Array.isArray(out.inputs);
+    if (!isByteCount(out.bytes) || !inputsOk || Object.keys(out.inputs ?? {}).length === 0) {
         throw new Error('the entry output carries no byte count or no inputs — refusing to read it as an empty bundle');
     }
     const packageBytes = new Map<string, number>();
     const roots = new Map<string, Set<string>>();
-    for (const [p, v] of Object.entries(out.inputs)) {
+    for (const [p, v] of Object.entries(out.inputs as Record<string, { bytesInOutput?: number }>)) {
         if (!isByteCount(v.bytesInOutput)) {
             throw new Error(`input ${p} carries no valid bytesInOutput — refusing to attribute it`);
         }
@@ -161,7 +162,7 @@ export function analyzeMetafile(json: string, opts: { requireEntry?: boolean } =
         if (root !== null) roots.set(pkg, (roots.get(pkg) ?? new Set<string>()).add(root));
     }
     const duplicated = [...roots].filter(([, r]) => r.size > 1).map(([pkg]) => pkg).sort();
-    return { bytes: out.bytes, modules: Object.keys(out.inputs).length, packageBytes, duplicated };
+    return { bytes: out.bytes as number, modules: Object.keys(out.inputs as object).length, packageBytes, duplicated };
 }
 
 /** Packages contributing bytes that the budget does not list, sorted. */
diff --git a/src/scripts/hooks/concern_env.ts b/src/scripts/hooks/concern_env.ts
index 74c361c106..6cdebc02f5 100644
--- a/src/scripts/hooks/concern_env.ts
+++ b/src/scripts/hooks/concern_env.ts
@@ -26,6 +26,8 @@ import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
 interface Scope {
     readonly prev: NodeJS.ProcessEnv;
     readonly hardened: NodeJS.ProcessEnv;
+    /** Set when a reset between concerns failed; the next concern must not start until it is repaired. */
+    needsRepair: boolean;
 }
 
 /** Innermost last. A nested dispatch (a re-entry from inside a concern) pushes its own scope. */
@@ -80,7 +82,7 @@ export function openConcernEnvScope(packageRoot: string): () => void {
         enclosing === undefined
             ? hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: packageRoot })
             : { ...enclosing.hardened, AGENT_CONFIG_PACKAGE_ROOT: packageRoot };
-    const scope: Scope = { prev, hardened };
+    const scope: Scope = { prev, hardened, needsRepair: false };
     replaceEnv(hardened);
     stack.push(scope);
     let closed = false;
@@ -105,15 +107,26 @@ export function openConcernEnvScope(packageRoot: string): () => void {
  * run. The release resets only while its scope is still the innermost one: a
  * release that outlives its scope (the scope already closed) does nothing, so it
  * can never put an older hardened copy over the current scope.
+ *
+ * A reset that fails marks the scope; the next concern's entry repairs it first
+ * and THROWS if it cannot, so no concern ever starts on an environment that is
+ * not its hardened baseline. The throw escapes the dispatch, whose host command
+ * turns a missing verdict into a refusal — fail-closed, for a case that needs
+ * `process.env` assignment itself to fail twice.
  */
 export function enterConcernEnv(packageRoot: string): () => void {
     const scope = stack[stack.length - 1];
     if (scope === undefined) return openConcernEnvScope(packageRoot);
+    if (scope.needsRepair || drifted(scope.hardened)) {
+        replaceEnv(scope.hardened);
+        scope.needsRepair = false;
+    }
     return () => {
         if (stack[stack.length - 1] !== scope) return;
         try {
             if (drifted(scope.hardened)) replaceEnv(scope.hardened);
         } catch (err) {
+            scope.needsRepair = true;
             reportQuietly('environment reset failed', err);
         }
     };
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index b5c9981754..1850e2e682 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -74,7 +74,7 @@ import { detectSurface } from '../_lib/surface.js';
 import { recordCapture, recordOpportunity } from "../_lib/collector_denominator.js";
 import { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN, EXIT_USAGE } from './exit_codes.js';
 import { enterConcernEnv, openConcernEnvScope } from './concern_env.js';
-import { isQuietAllow } from './feedback_policy.js';
+import { dropStaleFeedback, isQuietAllow } from './feedback_policy.js';
 export { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN };
 export { _fallback_yaml } from './fallback_yaml.js';
 
@@ -815,7 +815,7 @@ function _write_feedback(
     return;
   }
   for (const entry of entries) {
-    if (isQuietAllow(entry)) continue; // summary.json carries it: feedback_policy.ts
+    if (isQuietAllow(entry)) { dropStaleFeedback(path.join(fb_dir, `${entry["concern"]}.json`)); continue; }
     const target = path.join(fb_dir, `${entry["concern"]}.json`);
     try {
       atomic_write_json(target, entry);
diff --git a/src/scripts/hooks/feedback_policy.ts b/src/scripts/hooks/feedback_policy.ts
index 18709f7a5d..16569513e9 100644
--- a/src/scripts/hooks/feedback_policy.ts
+++ b/src/scripts/hooks/feedback_policy.ts
@@ -8,6 +8,8 @@
  * Only an outcome worth looking at on its own keeps a file now; `hooks_doctor`
  * falls back to the summary for the rest.
  */
+import * as fs from 'node:fs';
+
 import { EXIT_ALLOW } from './exit_codes.js';
 
 /** An entry that allowed, was not resolved from a crash, and gave no reason. */
@@ -19,3 +21,17 @@ export function isQuietAllow(entry: Readonly<Record<string, unknown>>): boolean
         (entry['reason'] ?? null) === null
     );
 }
+
+/**
+ * After a quiet allow, remove the concern's per-concern file if an earlier
+ * non-quiet run left one: the file means "this concern's latest outcome", and a
+ * warning the concern no longer gives must not stand as that. One `unlink` that
+ * usually finds nothing (ENOENT), never a locked write.
+ */
+export function dropStaleFeedback(file: string): void {
+    try {
+        fs.rmSync(file, { force: true });
+    } catch {
+        /* a file we cannot remove is reported by nothing: the summary stays the record */
+    }
+}
diff --git a/tests/scripts/hook_bundle_composition.test.ts b/tests/scripts/hook_bundle_composition.test.ts
index 5317c208df..b9c93b6fc2 100644
--- a/tests/scripts/hook_bundle_composition.test.ts
+++ b/tests/scripts/hook_bundle_composition.test.ts
@@ -139,6 +139,11 @@ describe('check_hook_bundle_composition — analyzeMetafile', () => {
         }
     });
 
+    it('refuses an inputs list that is an array, not a path-keyed object', () => {
+        const json = JSON.stringify({ outputs: { o: { entryPoint: 'src/scripts/hooks/dispatch_entry.ts', bytes: 9, inputs: [{ bytesInOutput: 9 }] } } });
+        expect(() => analyzeMetafile(json)).toThrow(/byte count or no inputs/u);
+    });
+
     it('refuses an input with no bytesInOutput instead of counting it as zero', () => {
         const json = JSON.stringify({
             outputs: { o: { entryPoint: 'src/scripts/hooks/dispatch_entry.ts', bytes: 9, inputs: { 'node_modules/left-pad/x.js': {} } } },
diff --git a/tests/scripts/hooks/concern_env.test.ts b/tests/scripts/hooks/concern_env.test.ts
index 183c272486..c9637e1777 100644
--- a/tests/scripts/hooks/concern_env.test.ts
+++ b/tests/scripts/hooks/concern_env.test.ts
@@ -113,6 +113,20 @@ describe('concern_env — one scope per dispatch', () => {
         expect(process.env['LD_PRELOAD']).toBe('/evil.so');
     });
 
+    it('a concern never starts on a drifted environment: entry repairs what a failed or skipped reset left', () => {
+        const close = openConcernEnvScope(ROOT);
+        const leaveA = enterConcernEnv(ROOT);
+        leaveA();
+        // Whatever left this behind — a reset that threw, dispatcher code between concerns — the next entry clears it.
+        process.env['LEFT_BEHIND'] = '1';
+        process.env['LD_PRELOAD'] = '/evil.so';
+        const leaveB = enterConcernEnv(ROOT);
+        expect(process.env['LEFT_BEHIND']).toBeUndefined();
+        expect(process.env['LD_PRELOAD']).toBeUndefined();
+        leaveB();
+        close();
+    });
+
     it('a release that outlives its scope does nothing', () => {
         const closeOuter = openConcernEnvScope(ROOT);
         const closeInner = openConcernEnvScope(ROOT);
diff --git a/tests/scripts/hooks/feedback_policy.test.ts b/tests/scripts/hooks/feedback_policy.test.ts
index 438be1fb68..27d6b13177 100644
--- a/tests/scripts/hooks/feedback_policy.test.ts
+++ b/tests/scripts/hooks/feedback_policy.test.ts
@@ -1,8 +1,12 @@
 // feedback_policy — only an outcome worth reading on its own keeps a
 // per-concern feedback file (road-to-a-hook-system-that-pays-for-what-it-does 2.4).
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
 import { describe, expect, it } from 'vitest';
 
-import { isQuietAllow } from '../../../src/scripts/hooks/feedback_policy.js';
+import { dropStaleFeedback, isQuietAllow } from '../../../src/scripts/hooks/feedback_policy.js';
 
 const allow = { concern: 'c', exit_code: 0, raw_exit_code: 0, decision: 'allow', reason: null };
 
@@ -20,3 +24,18 @@ describe('feedback_policy — isQuietAllow', () => {
         expect(isQuietAllow({ ...allow, reason: 'context injected' })).toBe(false);
     });
 });
+
+describe('feedback_policy — dropStaleFeedback', () => {
+    it('a quiet allow removes the warning an earlier run left, and a missing file is not an error', () => {
+        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-policy-'));
+        try {
+            const f = path.join(dir, 'c.json');
+            fs.writeFileSync(f, JSON.stringify({ decision: 'warn' }));
+            dropStaleFeedback(f);
+            expect(fs.existsSync(f)).toBe(false);
+            expect(() => dropStaleFeedback(f)).not.toThrow();
+        } finally {
+            fs.rmSync(dir, { recursive: true, force: true });
+        }
+    });
+});
````
