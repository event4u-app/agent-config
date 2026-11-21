<!-- evidence-type: analysis -->

# Ratification review — the hook-bundle budget becomes an allowlist and a backstop, and three per-dispatch fixed costs leave the dispatcher — round 8

You are an independent reviewer for a change in the `event4u/agent-config` repository. Gated files in this diff: `consistency.yml` (one step's name and comment), the dispatcher `hooks/dispatch_hook.ts`, new dispatcher modules `hooks/concern_env.ts` and `hooks/feedback_policy.ts`, and `src/config/hook-bundle-budget.json`. Under ADR-268 § 4 the change needs a two-provider verdict.

subject: 5a10403b0e3e7ef99fec703918701d2b79ba43b5d5d15cd64c1231fdb0db1de2

(Over those five files at commit `d3035561c3`. The base and the head copy of the gate now compute the same digest, because the gate is no longer changed.)

Rounds 4–7 (`agents/evidence/council/hook-system-pays-ratification-r4…r7-20261120.question.md`, committed) carry the full description and the full gated files.

## The governance part is out of this change

Rounds 6 and 7 refused one thing both seats agreed on: taking `hook-bundle-budget.json` off the ratification gate's watched set, so that an allowlist addition or a backstop raise would need no ratification. This change no longer does that. `check_kernel_edit_ratified.ts` and its tests are back to `origin/main` byte for byte; the budget file stays watched — its edit in THIS change is why this record exists. The question the seats raised — off entirely as the owner's directive D2 says, or only expansions watched as the council proposed — is posed to the owner as E5 on `agents/roadmaps/later/road-to-a-hook-system-with-isolated-guards.md`, with an implementation step that carries its own ratification. The budget file says so in its `max_bytes_note`.

## Round 7's technical points

1. **Repair-to-refusal through the actual host command (one seat).** New test in `tests/scripts/hook_load_set.test.ts`: it reads the verdict tail of the PreToolUse command `hooks/hooks.json` installs, runs a freshly built bundle under a preload that makes every `process.env` write throw (with `LD_PRELOAD` present so hardening must delete it), pipes the exit through that tail, and asserts exit 2 and "this tool call is refused".
2. **Reverse-order writes against a real file through the locked update (one seat).** New test in `feedback_policy.test.ts`: `update_json_under_lock` with `keepNewerOutcome` on a temp file — the later-completed warning is written, the earlier one arriving after it is `skipped`, and the file holds the later one.
3. **Distinct injected errors and propagation (one seat).** Round 7's test "when the rollback fails too, the original error propagates and the rollback failure is reported" (in the diff of round 7) covers it.

Suites: 135 test files, 2,375 tests; composition self-test 4/4; load-set test green.

## What to answer

1. Is anything in the five gated files, as now changed, a defect, or a weakening of a fail-closed guard, an exit-code contract, child-process hardening, or isolation between concerns?
2. Does this change expand any agent's authority?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## `src/config/hook-bundle-budget.json`, full

````
{
    "_comment": "Package allowlist and one wide backstop for the self-hosted hook bundle (dist/hooks/dispatch.js). Read by src/scripts/check_hook_bundle_composition.ts, which builds the bundle from source with --metafile. WHY: every concern is inlined into one bundle that every hook event loads, so a DEPENDENCY added for one concern is paid by all of them on every dispatch. The incident this exists for was a second YAML parser (95,846 bytes) that reached a release unseen. A new npm package in the bundle is now a red check with one line to add here, reviewed like any dependency. Own-code growth is what features are; it is not gated per byte.",
    "schema_version": 2,
    "registered_at": "2026-10-01",
    "owner": "maintainer",
    "review_by": "2027-10-01",
    "allowed_packages": ["yaml"],
    "allowed_packages_note": "The npm packages allowed to contribute bytes to the bundle. Adding one is a reviewed dependency decision, not a ceiling raise. A second YAML reader is refused by the same rule: only `yaml` is listed.",
    "max_bytes": 1915000,
    "max_bytes_note": "A backstop against slow creep, not a ratchet: the reading on 2026-11-20 (1,595,089 B) plus about 20 %, rounded (owner directive agents/evidence/owner-directives/2026-11-20-hook-bundle-budget-and-hook-economy.md, D1). Expected to fire a few times a year at most; when it does, look at what grew before moving the number. There is no shrink-only rule, no raise log and no per-chunk ceiling any more; the retired file is kept in git at 2eef08c00b and summarised in agents/evidence/analysis/hook-bundle-budget-retired-2026-11-20.md. This file stays on the ratification gate's watched set for now: whether it leaves it (owner directive D2) or only expansions stay watched (council 2026-11-20) is an open owner decision in agents/roadmaps/later/road-to-a-hook-system-with-isolated-guards.md.",
    "what_this_does_not_bound": "Latency: src/config/hook-latency-budget.json owns the wall-clock axis, and a module loaded at runtime outside the bundle is caught by tests/scripts/hook_load_set.test.ts, not here. Nor does it bound dist/install/install.mjs or dist/mcp/server.mjs, which carry their own module graphs."
}
````

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
 * Only an outcome worth looking at on its own keeps a file now, so a
 * `<concern>.json` means "this concern's latest NON-QUIET outcome", not its latest
 * outcome. Nothing deletes it: a delete would race a newer write from a parallel
 * dispatch in the same session. A write goes through the per-file lock and keeps
 * whichever outcome COMPLETED later ({@link keepNewerOutcome}), so two warnings
 * published in reverse completion order cannot leave the older one standing.
 * The one reader, `hooks_doctor`, ranks that file against the summary's runs by
 * recorded time, so a later quiet run still reads as the latest.
 */
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
 * The locked write's mutator: the incoming entry, unless the file already holds
 * an outcome that completed later (then `null`, a deliberate no-write).
 * Instants, not strings; an unreadable timestamp on either side lets the
 * incoming entry through, as the unconditional write did before.
 */
export function keepNewerOutcome<T extends Readonly<Record<string, unknown>>>(loaded: Partial<Record<string, unknown>>, entry: T): T | null {
    const held = typeof loaded['completed_at'] === 'string' ? Date.parse(loaded['completed_at']) : Number.NaN;
    const incoming = typeof entry['completed_at'] === 'string' ? Date.parse(entry['completed_at'] as string) : Number.NaN;
    if (!Number.isNaN(held) && !Number.isNaN(incoming) && held > incoming) return null;
    return entry;
}
````

## Diff of the dispatcher and the workflow against `origin/main` (whitespace re-indent of the concern loop ignored)

````diff
diff --git a/.github/workflows/consistency.yml b/.github/workflows/consistency.yml
index db12c9d2ac..623c340e1d 100644
--- a/.github/workflows/consistency.yml
+++ b/.github/workflows/consistency.yml
@@ -249,14 +249,13 @@ jobs:
       - name: Verify the host table's format column names only emitted paths
         run: ./scripts-run src/scripts/check_host_format_column --quiet
 
-      # One YAML reader in the hook bundle, and a byte ceiling on it. Unlike its
-      # two siblings (`check_hook_bundle_freshness` / `_content`) this one is NOT
-      # local-only: it builds its own bundle from source with `--metafile`
-      # instead of reading the untracked `dist/hooks/dispatch.js`, so what it
-      # bounds is a property of the commit rather than of one machine. That is
-      # the whole reason it can fail a pull request, which is where the second
-      # YAML parser it exists to catch would have been caught.
-      - name: Verify the hook bundle carries one YAML reader and stays under its byte ceiling
+      # Only allowlisted npm packages in the hook bundle, and a wide byte
+      # backstop. Unlike its two siblings (`check_hook_bundle_freshness` /
+      # `_content`) this one is NOT local-only: it builds its own bundle from
+      # source with `--metafile`, so what it bounds is a property of the commit
+      # rather than of one machine. That is why it can fail a pull request,
+      # which is where the second YAML parser it exists to catch belongs.
+      - name: Verify the hook bundle carries only allowlisted packages and stays under its backstop
         run: ./scripts-run src/scripts/check_hook_bundle_composition
 
       - name: Verify README size, word and time-to-first-command budgets
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index 16ac1faf33..40f8ed4234 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -40,7 +40,6 @@ import { tableFingerprint } from "./table_fingerprint.js";
 
 import { hardenedSpawnEnv } from "../_lib/spawn_env.js";
 import {
-  atomic_write_json,
   feedback_dir,
   is_replay_mode,
   update_json_under_lock,
@@ -73,6 +72,8 @@ import { _fallback_yaml } from './fallback_yaml.js';
 import { detectSurface } from '../_lib/surface.js';
 import { recordCapture, recordOpportunity } from "../_lib/collector_denominator.js";
 import { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN, EXIT_USAGE } from './exit_codes.js';
+import { enterConcernEnv, openConcernEnvScope } from './concern_env.js';
+import { isQuietAllow, keepNewerOutcome } from './feedback_policy.js';
 export { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN };
 export { _fallback_yaml } from './fallback_yaml.js';
 
@@ -621,11 +622,11 @@ function _run_concern_inproc(
   const prevStderrWrite = process.stderr.write;
   const prevArgv = process.argv;
   const prevCwd = process.cwd();
-  const prevEnv = { ...process.env };
 
   const started = performance.now();
   let rc = 0;
   setHookStdinOverride(_compactJsonDumps(envelope));
+  const leaveEnv = enterConcernEnv(REPO_ROOT);
   process.stdout.write = makeCapture((s) => {
     out += s;
   });
@@ -634,13 +635,7 @@ function _run_concern_inproc(
   });
   try {
     process.argv = [prevArgv[0] as string, scriptAbs, ...argsList];
-    // Same env-hardening the spawn path applied — concerns may spawn their
-    // own children (dashboard regen, git), which inherit process.env.
-    const hardened = hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: REPO_ROOT });
-    for (const k of Object.keys(process.env)) {
-      if (!(k in hardened)) delete process.env[k];
-    }
-    Object.assign(process.env, hardened);
+    // Hardened once per dispatch, reset only if this concern changed it: concern_env.ts.
     if (workspace !== prevCwd && _isDir(workspace)) {
       process.chdir(workspace);
     }
@@ -661,10 +656,7 @@ function _run_concern_inproc(
     process.stdout.write = prevStdoutWrite;
     process.stderr.write = prevStderrWrite;
     process.argv = prevArgv;
-    for (const k of Object.keys(process.env)) {
-      if (!(k in prevEnv)) delete process.env[k];
-    }
-    Object.assign(process.env, prevEnv);
+    leaveEnv();
     try {
       if (process.cwd() !== prevCwd) process.chdir(prevCwd);
     } catch {
@@ -822,9 +814,10 @@ function _write_feedback(
     return;
   }
   for (const entry of entries) {
+    if (isQuietAllow(entry)) continue; // summary.json carries it: feedback_policy.ts
     const target = path.join(fb_dir, `${entry["concern"]}.json`);
     try {
-      atomic_write_json(target, entry);
+      update_json_under_lock<FeedbackEntry>(target, (loaded) => keepNewerOutcome(loaded, entry));
     } catch (exc) {
       const msg = exc instanceof Error ? exc.message : String(exc);
       process.stderr.write(
@@ -835,6 +828,7 @@ function _write_feedback(
   const SUMMARY_KEYS = new Set([
     "concern",
     "exit_code",
+    "raw_exit_code",
     "severity",
     "decision",
     "reason",
@@ -1297,6 +1291,8 @@ export function main(argv?: string[]): number {
     keep_by_concern.map(([, keep]) => keep),
     egress.placeholder,
   );
+  const closeConcernEnv = openConcernEnvScope(REPO_ROOT);
+  try {
     for (const [concern, keep_classes] of keep_by_concern) {
       if (!_concern_matches_tool(concern, tool_name)) {
         continue;
@@ -1401,6 +1397,9 @@ export function main(argv?: string[]): number {
         payload_stubs: stubs_served,
       });
     }
+  } finally {
+    closeConcernEnv();
+  }
   const final_rc = _reduce(rcs);
   writeConcernTimings(String(envelope["event"] ?? ""), String(envelope["platform"] ?? ""), timing_samples);
   _write_feedback(envelope, session_id, feedback_entries, final_rc, started_at);
````

## The diff since round 7 (`git diff ad94bf9b45..d3035561c3`, code and tests)

````diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index fc12403054..f2883d0310 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -7,6 +7,6 @@
     "allowed_packages": ["yaml"],
     "allowed_packages_note": "The npm packages allowed to contribute bytes to the bundle. Adding one is a reviewed dependency decision, not a ceiling raise. A second YAML reader is refused by the same rule: only `yaml` is listed.",
     "max_bytes": 1915000,
-    "max_bytes_note": "A backstop against slow creep, not a ratchet: the reading on 2026-11-20 (1,595,089 B) plus about 20 %, rounded (owner directive agents/evidence/owner-directives/2026-11-20-hook-bundle-budget-and-hook-economy.md, D1). Expected to fire a few times a year at most; when it does, look at what grew before moving the number. There is no shrink-only rule, no raise log and no per-chunk ceiling any more; the retired file is kept in git at 2eef08c00b and summarised in agents/evidence/analysis/hook-bundle-budget-retired-2026-11-20.md.",
+    "max_bytes_note": "A backstop against slow creep, not a ratchet: the reading on 2026-11-20 (1,595,089 B) plus about 20 %, rounded (owner directive agents/evidence/owner-directives/2026-11-20-hook-bundle-budget-and-hook-economy.md, D1). Expected to fire a few times a year at most; when it does, look at what grew before moving the number. There is no shrink-only rule, no raise log and no per-chunk ceiling any more; the retired file is kept in git at 2eef08c00b and summarised in agents/evidence/analysis/hook-bundle-budget-retired-2026-11-20.md. This file stays on the ratification gate's watched set for now: whether it leaves it (owner directive D2) or only expansions stay watched (council 2026-11-20) is an open owner decision in agents/roadmaps/later/road-to-a-hook-system-with-isolated-guards.md.",
     "what_this_does_not_bound": "Latency: src/config/hook-latency-budget.json owns the wall-clock axis, and a module loaded at runtime outside the bundle is caught by tests/scripts/hook_load_set.test.ts, not here. Nor does it bound dist/install/install.mjs or dist/mcp/server.mjs, which carry their own module graphs."
 }
diff --git a/tests/scripts/hook_load_set.test.ts b/tests/scripts/hook_load_set.test.ts
index a6a24badb3..8a59275fac 100644
--- a/tests/scripts/hook_load_set.test.ts
+++ b/tests/scripts/hook_load_set.test.ts
@@ -72,6 +72,30 @@ describe('hook runtime load set', () => {
         }, 60_000);
     }
 
+    it('a dispatch whose concern environment cannot be hardened is refused by the generated host command', () => {
+        // The verdict tail of the PreToolUse command `hooks/hooks.json` installs.
+        const hooksJson = JSON.parse(fs.readFileSync(path.join(REPO, 'hooks', 'hooks.json'), 'utf-8')) as {
+            hooks: { PreToolUse: Array<{ hooks: Array<{ command: string }> }> };
+        };
+        const command = hooksJson.hooks.PreToolUse[0]?.hooks[0]?.command ?? '';
+        const tail = command.slice(command.indexOf('RC=$?'));
+        expect(tail.startsWith('RC=$?')).toBe(true);
+        // A preload that makes every env write fail once dispatch starts; LD_PRELOAD in the
+        // env forces the hardening to delete it, so the scope open must throw.
+        const preload = path.join(root, 'env-writes-fail.cjs');
+        fs.writeFileSync(
+            preload,
+            "const t = { ...process.env }; const fail = () => { throw new Error('injected env write failure'); };\n" +
+                'process.env = new Proxy(t, { set: fail, deleteProperty: fail });\n',
+        );
+        const payload = path.join(root, 'pre.json');
+        fs.writeFileSync(payload, JSON.stringify({ session_id: 'env-fail', hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: path.join(workspace, 'x.txt') }, cwd: workspace }));
+        const script = `"${process.execPath}" --require "${preload}" "${bundle}" --platform claude --event pre_tool_use --project-dir "${workspace}" < "${payload}" >/dev/null 2>&1; ${tail}`;
+        const r = spawnSync('bash', ['-c', script], { encoding: 'utf-8', env: { ...process.env, LD_PRELOAD: '', AGENT_CONFIG_REPLAY: '1' } });
+        expect(r.status).toBe(2);
+        expect(r.stderr).toContain('this tool call is refused');
+    }, 60_000);
+
     it('the tracer sees a runtime createRequire load — the class this check exists for', () => {
         const plant = path.join(root, 'dist', 'hooks', 'plant.mjs');
         fs.writeFileSync(
diff --git a/tests/scripts/hooks/feedback_policy.test.ts b/tests/scripts/hooks/feedback_policy.test.ts
index 3d59e2be01..b1ddf6a722 100644
--- a/tests/scripts/hooks/feedback_policy.test.ts
+++ b/tests/scripts/hooks/feedback_policy.test.ts
@@ -1,7 +1,13 @@
 // feedback_policy — only an outcome worth reading on its own keeps a
 // per-concern feedback file (road-to-a-hook-system-that-pays-for-what-it-does 2.4).
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
 import { describe, expect, it } from 'vitest';
 
+import { update_json_under_lock } from '../../../src/scripts/hooks/state_io.js';
+
 import { isQuietAllow, keepNewerOutcome } from '../../../src/scripts/hooks/feedback_policy.js';
 
 const allow = { concern: 'c', exit_code: 0, raw_exit_code: 0, decision: 'allow', reason: null };
@@ -38,3 +44,19 @@ describe('feedback_policy — keepNewerOutcome', () => {
         expect(keepNewerOutcome({ completed_at: '2026-11-20T10:00:00Z' }, e)).toBe(e);
     });
 });
+
+describe('feedback_policy — through the locked update on a real file', () => {
+    it('reverse-order publishes leave the later-completed warning on disk', () => {
+        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-order-'));
+        try {
+            const f = path.join(dir, 'c.json');
+            const later = { concern: 'c', decision: 'warn', completed_at: '2026-11-20T10:00:02Z' };
+            const earlier = { concern: 'c', decision: 'warn', completed_at: '2026-11-20T10:00:01Z' };
+            expect(update_json_under_lock(f, (loaded) => keepNewerOutcome(loaded, later))).toBe('written');
+            expect(update_json_under_lock(f, (loaded) => keepNewerOutcome(loaded, earlier))).toBe('skipped');
+            expect(JSON.parse(fs.readFileSync(f, 'utf-8')).completed_at).toBe(later.completed_at);
+        } finally {
+            fs.rmSync(dir, { recursive: true, force: true });
+        }
+    });
+});
````
