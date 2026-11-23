<!-- evidence-type: analysis -->

# Ratification review — the hook-bundle budget becomes an allowlist and a backstop, and three per-dispatch fixed costs leave the dispatcher — round 23

You are an independent reviewer for a change in the `event4u/agent-config` repository. Gated files: `.github/workflows/consistency.yml` (one step's name and comment), the dispatcher `src/scripts/hooks/dispatch_hook.ts`, new dispatcher modules `src/scripts/hooks/concern_env.ts` and `src/scripts/hooks/feedback_policy.ts`, and `src/config/hook-bundle-budget.json`. The ratification gate itself is unchanged and the budget file stays on its watched set. Under ADR-268 § 4 the change needs a two-provider verdict.

subject: da561486a1dd1bbe31cc55a5f43858f7ada55f366e69415d27f2b850dfdfbe80

(Over those five files at commit `9bdade7760`; base and head gate agree. The five gated files are unchanged since round 21; this round adds tests only.)

Rounds 4–22 (`agents/evidence/council/hook-system-pays-ratification-r4…r22-20261120.question.md`, committed) carry the description and the earlier points; round 19 shows that envelope preparation reads no environment, rounds 21–22 show the doctor's selection code. This round shows the WHOLE change to the five gated files against the merge base `ac3c973fdd`, plus the composition checker's `main` and its CLI tests.

## Round 22 points

1. **The size guard is deliberately relaxed (one seat).** It is. The relaxation is the owner's decision, recorded in `agents/evidence/owner-directives/2026-11-20-hook-bundle-budget-and-hook-economy.md`: "**D1 — the byte ceiling stops being a ratchet.** One overall ceiling with real headroom; `shrink_only`, the `raise_log` obligation and the per-chunk and chunk-group ceilings end; the parser check stays and is generalised." Concretely: `max_bytes` 1,595,100 → 1,915,000 (+319,900 bytes, +20 %), 18 per-chunk ceilings, the chunk group, `shrink_only` and the 28-entry raise log removed; chunk sizes are still printed on every run, not gated.
2. **Evidence that the replacement checker fails closed (one seat).** CLI tests (below) run `main` as CI does. Against the committed budget with `--metafile`: at 1,915,000 bytes with only `yaml` → 0; one byte over → 1; an unlisted package below the backstop → 1; an allowlisted bundle above it → 1; an unlisted 1-byte package → 1. Against a temporary root without `--metafile`: a budget without `allowed_packages` → 2; a non-positive `max_bytes` → 2; a valid budget where the source build fails → 2. No path returns 0 without a measured, in-budget bundle.
3. **A writer-to-doctor regression (one seat).** Dispatcher end to end, then `hooks_doctor.collect` on the same workspace: an older block in `rewriter.json`, then a dispatch where `rewriter` is a quiet allow. Summary written → the doctor reports `summary.json`, whose `latest` row for `rewriter` says `allow`. Summary write failed (made a directory) → the doctor reports `rewriter.json`, which now holds the allow.

Suites: hook, load-set and composition tests 56 files, 1,141 tests; typecheck and lint clean on the changed files.

## What to answer

1. Are the round-22 points closed by what is shown?
2. Over the whole change to the five gated files, does anything weaken a fail-closed guard, an exit-code contract, child-process hardening, or isolation between concerns, or expand authority?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## `src/scripts/hooks/concern_env.ts`, full (new file)

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
    /** Set when a reset between concerns failed; the next concern must not start until it is repaired. */
    needsRepair: boolean;
}

/** Innermost last. A nested dispatch (a re-entry from inside a concern) pushes its own scope. */
const stack: Scope[] = [];

/** Set when a scope's closing restore failed; read and cleared by {@link assertConcernEnvRestored}. */
let restoreFailed: string | null = null;

/**
 * The environment still owed to the process. Invariant: non-null iff a restore
 * is owed and has not been replayed. Set by a failed closing restore and by a
 * failed rollback of a half-applied scope open; cleared by a successful replay
 * at the next open, or by a successful close (a full replace supersedes it).
 * Kept apart from {@link restoreFailed}: that one is this dispatch's verdict and
 * may be skipped when an error is already in flight; this one outlives the
 * dispatch (within the process — a new process starts from its own clean
 * environment), so the next scope in the same process recovers it before any
 * concern runs, and refuses to open when it cannot.
 */
let pendingRestore: NodeJS.ProcessEnv | null = null;

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
    if (pendingRestore !== null) {
        // A previous close could not put its environment back. Recover it first;
        // if that fails too, throw, and no concern runs on a dirty baseline.
        replaceEnv(pendingRestore);
        pendingRestore = null;
        restoreFailed = null;
    }
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
            // Still dirty: owe `prev` to the next scope, and keep the setup error as the one thrown.
            pendingRestore = prev;
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
            // A full replace supersedes whatever a nested close failed to restore:
            // the environment is restored now, so neither mark may outlive it.
            pendingRestore = null;
            restoreFailed = null;
        } catch (err) {
            pendingRestore = scope.prev;
            restoreFailed = err instanceof Error ? err.message : String(err);
            reportQuietly('environment restore failed', err);
        }
    };
}

/**
 * The environment a concern spawned as its own process gets. Inside a scope it
 * is a copy of the scope's hardened baseline — never the live environment, which
 * an earlier in-process concern may have left drifted if its reset failed — so a
 * child never inherits another concern's changes, repaired or not. Outside a
 * scope, the hardened copy of the live environment, as before.
 */
export function concernSpawnEnv(packageRoot: string): NodeJS.ProcessEnv {
    const scope = stack[stack.length - 1];
    if (scope === undefined) return hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: packageRoot });
    return { ...scope.hardened, AGENT_CONFIG_PACKAGE_ROOT: packageRoot };
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

## `src/config/hook-bundle-budget.json`, full (against base: removed `shrink_only`, its note, `raise_log` (28 entries), `chunks` (18 per-chunk ceilings), `chunk_groups`, `max_yaml_packages` and their notes; added `allowed_packages` and its note; `max_bytes` raised from 1,595,100 to 1,915,000 (+20 %, the one overall ceiling the owner set) and kept as the backstop, with a note; `schema_version` 2)

````json
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

## The other three gated files, diff against the merge base (`git diff -U2 ac3c973fdd...9bdade7760`)

````diff
diff --git a/.github/workflows/consistency.yml b/.github/workflows/consistency.yml
index db12c9d2ac..623c340e1d 100644
--- a/.github/workflows/consistency.yml
+++ b/.github/workflows/consistency.yml
@@ -250,12 +250,11 @@ jobs:
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
 
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index 16ac1faf33..41b159326a 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -39,7 +39,5 @@ import { writeConcernTimings, type ConcernTimingSample } from "./concern_timings
 import { tableFingerprint } from "./table_fingerprint.js";
 
-import { hardenedSpawnEnv } from "../_lib/spawn_env.js";
 import {
-  atomic_write_json,
   feedback_dir,
   is_replay_mode,
@@ -74,4 +72,6 @@ import { detectSurface } from '../_lib/surface.js';
 import { recordCapture, recordOpportunity } from "../_lib/collector_denominator.js";
 import { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN, EXIT_USAGE } from './exit_codes.js';
+import { assertConcernEnvRestored, concernSpawnEnv, enterConcernEnv, openConcernEnvScope } from './concern_env.js';
+import { isQuietAllow, keepNewerOutcome, withLatestRuns } from './feedback_policy.js';
 export { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN };
 export { _fallback_yaml } from './fallback_yaml.js';
@@ -622,8 +622,8 @@ function _run_concern_inproc(
   const prevArgv = process.argv;
   const prevCwd = process.cwd();
-  const prevEnv = { ...process.env };
 
   const started = performance.now();
   let rc = 0;
+  const leaveEnv = enterConcernEnv(REPO_ROOT); // first: if it throws, nothing below is installed yet
   setHookStdinOverride(_compactJsonDumps(envelope));
   process.stdout.write = makeCapture((s) => {
@@ -635,11 +635,5 @@ function _run_concern_inproc(
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
@@ -662,8 +656,5 @@ function _run_concern_inproc(
     process.stderr.write = prevStderrWrite;
     process.argv = prevArgv;
-    for (const k of Object.keys(process.env)) {
-      if (!(k in prevEnv)) delete process.env[k];
-    }
-    Object.assign(process.env, prevEnv);
+    leaveEnv();
     try {
       if (process.cwd() !== prevCwd) process.chdir(prevCwd);
@@ -718,5 +709,6 @@ function _run_concern(concern: ConcernDef, envelope: JsonObject): RunResult {
   // vectors (loader / git-config / NODE_OPTIONS / …) before spawning each
   // concern, then set the package-root marker as an explicit override.
-  const concern_env = hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: REPO_ROOT });
+  // Inside a dispatch scope: its hardened baseline, never the live (possibly drifted) environment.
+  const concern_env = concernSpawnEnv(REPO_ROOT);
 
   const started = performance.now();
@@ -822,22 +814,16 @@ function _write_feedback(
     return;
   }
-  for (const entry of entries) {
-    const target = path.join(fb_dir, `${entry["concern"]}.json`);
-    try {
-      atomic_write_json(target, entry);
-    } catch (exc) {
-      const msg = exc instanceof Error ? exc.message : String(exc);
-      process.stderr.write(
-        `dispatch_hook: feedback write failed for ${entry["concern"]}: ${msg}\n`,
-      );
-    }
-  }
+  // pid + monotonic clock: unique per dispatch; per-concern files carry it too (doctor ties).
+  const invocation = `${String(process.pid)}-${process.hrtime.bigint().toString()}`;
+  let summaryWritten = false;
   const SUMMARY_KEYS = new Set([
     "concern",
     "exit_code",
+    "raw_exit_code",
     "severity",
     "decision",
     "reason",
     "duration_ms",
+    "completed_at", // the concern's own clock, so the doctor can rank a history row on it
     "payload_bodies",
     "payload_stubs",
@@ -885,24 +871,32 @@ function _write_feedback(
     // the hot path. A capped list needs one locked read-modify-write, which is
     // the same primitive `rule-trips.json` now uses for the same reason.
-    //
-    // `invocation` is pid + monotonic clock: unique per dispatch without a
-    // shared counter, and ordered within one process.
-    const invocation = `${String(process.pid)}-${process.hrtime.bigint().toString()}`;
-    update_json_under_lock<JsonObject>(path.join(fb_dir, "summary.json"), (loaded) => {
+    summaryWritten = update_json_under_lock<JsonObject>(path.join(fb_dir, "summary.json"), (loaded) => {
       const priorRaw = (loaded as JsonObject)["invocations"];
       const prior = Array.isArray(priorRaw) ? priorRaw : [];
       const next = [...prior, { invocation, ...summary }];
+      // Each concern's latest run, outside the cap, keep-newer: eviction never resurrects an older outcome.
+      const latest = withLatestRuns(loaded["latest"], entries, invocation);
       return {
         schema_version: 2,
         session_id,
+        latest,
         // Newest last, oldest dropped — the same rotation direction
         // `dispatch-issues.jsonl` uses, so a reader learns one convention.
         invocations: next.slice(Math.max(0, next.length - SUMMARY_INVOCATION_CAP)),
       };
-    });
+    }) === "written"; // it reports a failure; it does not throw one
+    if (!summaryWritten) process.stderr.write("dispatch_hook: summary write failed\n");
   } catch (exc) {
     const msg = exc instanceof Error ? exc.message : String(exc);
     process.stderr.write(`dispatch_hook: summary write failed: ${msg}\n`);
   }
+  // A quiet allow skips its own file only if the summary carrying it was written;
+  // else a failed summary could leave an older block standing as the latest.
+  for (const entry of entries) {
+    if (summaryWritten && isQuietAllow(entry)) continue; // feedback_policy.ts
+    const target = path.join(fb_dir, `${entry["concern"]}.json`);
+    const written = update_json_under_lock<FeedbackEntry>(target, (loaded) => keepNewerOutcome(loaded, { ...entry, invocation }));
+    if (written === "failed") process.stderr.write(`dispatch_hook: feedback write failed for ${entry["concern"]}\n`);
+  }
 }
 
@@ -1298,108 +1292,114 @@ export function main(argv?: string[]): number {
     egress.placeholder,
   );
-  for (const [concern, keep_classes] of keep_by_concern) {
-    if (!_concern_matches_tool(concern, tool_name)) {
-      continue;
-    }
-    const concern_envelope = applyPayloadFields(concern, shapes.shapeFor(keep_classes, egressViewFor(concern)));
-    const stubs_served = shapes.stubsFor(keep_classes);
-    // What was actually SERVED, not what was declared. Recording the
-    // declaration made the record wrong in both directions on a body-less
-    // event: a blocking `stop` concern read "input,result" for bodies it can
-    // never receive, and an advisory one read "none" while the full envelope
-    // went to it untouched.
-    const served_classes = shapes.servedBy(keep_classes);
-    const concern_started = _now_iso();
-    const { rc: rawRcResult, stderr: stderr_text, stdout: stdout_text, duration_ms } =
-      _run_concern(concern, concern_envelope);
-    timing_samples.push({ concern: String(concern["name"]), duration_us: duration_ms * 1000 });
-    let rc = rawRcResult;
-    const raw_rc = rc;
-    if (rc >= 3) {
-      // Resolved by DECLARED SEVERITY, no longer by `fail_closed:`. Every
-      // crash path has already written an `execution_failed` row, so a refusal
-      // here is traceable to a named failure. See `_resolve_execution_failure`.
-      rc = _resolve_execution_failure(concern, refusal_retry);
-      if (stderr_text) {
-        process.stderr.write(stderr_text);
+  const closeConcernEnv = openConcernEnvScope(REPO_ROOT);
+  try {
+    for (const [concern, keep_classes] of keep_by_concern) {
+      if (!_concern_matches_tool(concern, tool_name)) {
+        continue;
       }
-      // The escape, printed only where a denial can repeat — `stop` is bounded
-      // by the one-retry clause above. Reasoning: `noVerdictRefusalNotice`.
-      if (rc === EXIT_BLOCK && !refusal_retry) {
-        process.stderr.write(noVerdictRefusalNotice(String(concern["name"])));
+      const concern_envelope = applyPayloadFields(concern, shapes.shapeFor(keep_classes, egressViewFor(concern)));
+      const stubs_served = shapes.stubsFor(keep_classes);
+      // What was actually SERVED, not what was declared. Recording the
+      // declaration made the record wrong in both directions on a body-less
+      // event: a blocking `stop` concern read "input,result" for bodies it can
+      // never receive, and an advisory one read "none" while the full envelope
+      // went to it untouched.
+      const served_classes = shapes.servedBy(keep_classes);
+      const concern_started = _now_iso();
+      const { rc: rawRcResult, stderr: stderr_text, stdout: stdout_text, duration_ms } =
+        _run_concern(concern, concern_envelope);
+      timing_samples.push({ concern: String(concern["name"]), duration_us: duration_ms * 1000 });
+      let rc = rawRcResult;
+      const raw_rc = rc;
+      if (rc >= 3) {
+        // Resolved by DECLARED SEVERITY, no longer by `fail_closed:`. Every
+        // crash path has already written an `execution_failed` row, so a refusal
+        // here is traceable to a named failure. See `_resolve_execution_failure`.
+        rc = _resolve_execution_failure(concern, refusal_retry);
+        if (stderr_text) {
+          process.stderr.write(stderr_text);
+        }
+        // The escape, printed only where a denial can repeat — `stop` is bounded
+        // by the one-retry clause above. Reasoning: `noVerdictRefusalNotice`.
+        if (rc === EXIT_BLOCK && !refusal_retry) {
+          process.stderr.write(noVerdictRefusalNotice(String(concern["name"])));
+        }
       }
+      // P0.2 severity ceiling: an advisory concern can never block, on any host.
+      // This covers BOTH the concern emitting EXIT_BLOCK directly and the
+      // fail_closed promotion above turning a crash into a block.
+      if (rc === EXIT_BLOCK && _is_advisory(concern)) {
+        process.stderr.write(
+          `dispatch_hook: concern '${String(concern["name"])}' is declared ` +
+            `severity: advisory but returned BLOCK — downgraded to warn.\n`,
+        );
+        rc = EXIT_WARN;
+      }
+      rcs.push(rc);
+      const reply = _parse_concern_stdout(stdout_text);
+      permission_verdicts.push(_concern_permission_verdict(rc, reply, concern["effect"]));
+      // A concern states its reason either as JSON {"reason": …} on stdout
+      // (advisory concerns) or as a formatted stderr line (the block guards, e.g.
+      // `block-no-verify: BLOCKED — …`). Both are captured here so the emission
+      // layer can surface the REAL message instead of a generic label; before
+      // this, a rc=1 block discarded the concern's stderr entirely.
+      const stated =
+        typeof reply["reason"] === "string" && (reply["reason"] as string).trim()
+          ? (reply["reason"] as string).trim()
+          : stderr_text.trim();
+      // `additional_context` — the longer, model-facing half of a concern's
+      // reply. The contract has promised since v1 that it is forwarded and
+      // "concatenated with \n\n separators"
+      // (docs/contracts/hook-architecture-v1.md § reply shape), but nothing here
+      // ever read the key: `reason` is capped at ~200 chars by convention and is
+      // written for a human reading stderr, so every concern that put its
+      // actionable instruction in `additional_context` delivered it nowhere.
+      // Found 2026-08-06 by tracing why the language-mirror pin reached the model
+      // on no path; `pr_url_reminder` had the same silent gap, and its own header
+      // calls `additional_context` "what surfaces back to the model".
+      const extra =
+        typeof reply["additional_context"] === "string" &&
+        (reply["additional_context"] as string).trim()
+          ? (reply["additional_context"] as string).trim()
+          : "";
+      const message = [stated, extra].filter(Boolean).join("\n\n");
+      if (message) {
+        concern_messages.push({ rc, text: attributeRefusal(String(concern["name"]), rc === EXIT_BLOCK, injected(message)), def: concern });
+      }
+      if (
+        args.event === "session_start" &&
+        rc === EXIT_ALLOW &&
+        typeof reply["context"] === "string" &&
+        (reply["context"] as string).trim()
+      ) {
+        context_blocks.push(injected((reply["context"] as string).trim()));
+      }
+      collectUserNotice(notices, concern, reply, injected);
+      feedback_entries.push({
+        concern: String(concern["name"]),
+        exit_code: rc,
+        raw_exit_code: raw_rc,
+        severity: _severity_for(rc),
+        decision: (reply["decision"] || _severity_for(rc)) as JsonValue,
+        reason: (reply["reason"] ?? null) as JsonValue,
+        duration_ms: Math.floor(duration_ms),
+        started_at: concern_started,
+        completed_at: _now_iso(),
+        fail_closed: Boolean(concern["fail_closed"]),
+        // Step 2.1's counter — an EXPOSURE denominator, not a detector, and the
+        // review was right to refuse the stronger reading: these numbers are a
+        // function of the declaration and the payload shape, so they say how
+        // often a concern ran without a body, never whether it wanted one. The
+        // detector for the wanting-one case is the source-derived check in
+        // `lint_hook_manifest`, at authoring time, where it is decidable.
+        // A sorted class list and an integer — nothing that can hold a body.
+        payload_bodies: served_classes.join(",") || "none",
+        payload_stubs: stubs_served,
+      });
     }
-    // P0.2 severity ceiling: an advisory concern can never block, on any host.
-    // This covers BOTH the concern emitting EXIT_BLOCK directly and the
-    // fail_closed promotion above turning a crash into a block.
-    if (rc === EXIT_BLOCK && _is_advisory(concern)) {
-      process.stderr.write(
-        `dispatch_hook: concern '${String(concern["name"])}' is declared ` +
-          `severity: advisory but returned BLOCK — downgraded to warn.\n`,
-      );
-      rc = EXIT_WARN;
-    }
-    rcs.push(rc);
-    const reply = _parse_concern_stdout(stdout_text);
-    permission_verdicts.push(_concern_permission_verdict(rc, reply, concern["effect"]));
-    // A concern states its reason either as JSON {"reason": …} on stdout
-    // (advisory concerns) or as a formatted stderr line (the block guards, e.g.
-    // `block-no-verify: BLOCKED — …`). Both are captured here so the emission
-    // layer can surface the REAL message instead of a generic label; before
-    // this, a rc=1 block discarded the concern's stderr entirely.
-    const stated =
-      typeof reply["reason"] === "string" && (reply["reason"] as string).trim()
-        ? (reply["reason"] as string).trim()
-        : stderr_text.trim();
-    // `additional_context` — the longer, model-facing half of a concern's
-    // reply. The contract has promised since v1 that it is forwarded and
-    // "concatenated with \n\n separators"
-    // (docs/contracts/hook-architecture-v1.md § reply shape), but nothing here
-    // ever read the key: `reason` is capped at ~200 chars by convention and is
-    // written for a human reading stderr, so every concern that put its
-    // actionable instruction in `additional_context` delivered it nowhere.
-    // Found 2026-08-06 by tracing why the language-mirror pin reached the model
-    // on no path; `pr_url_reminder` had the same silent gap, and its own header
-    // calls `additional_context` "what surfaces back to the model".
-    const extra =
-      typeof reply["additional_context"] === "string" &&
-      (reply["additional_context"] as string).trim()
-        ? (reply["additional_context"] as string).trim()
-        : "";
-    const message = [stated, extra].filter(Boolean).join("\n\n");
-    if (message) {
-      concern_messages.push({ rc, text: attributeRefusal(String(concern["name"]), rc === EXIT_BLOCK, injected(message)), def: concern });
-    }
-    if (
-      args.event === "session_start" &&
-      rc === EXIT_ALLOW &&
-      typeof reply["context"] === "string" &&
-      (reply["context"] as string).trim()
-    ) {
-      context_blocks.push(injected((reply["context"] as string).trim()));
-    }
-    collectUserNotice(notices, concern, reply, injected);
-    feedback_entries.push({
-      concern: String(concern["name"]),
-      exit_code: rc,
-      raw_exit_code: raw_rc,
-      severity: _severity_for(rc),
-      decision: (reply["decision"] || _severity_for(rc)) as JsonValue,
-      reason: (reply["reason"] ?? null) as JsonValue,
-      duration_ms: Math.floor(duration_ms),
-      started_at: concern_started,
-      completed_at: _now_iso(),
-      fail_closed: Boolean(concern["fail_closed"]),
-      // Step 2.1's counter — an EXPOSURE denominator, not a detector, and the
-      // review was right to refuse the stronger reading: these numbers are a
-      // function of the declaration and the payload shape, so they say how
-      // often a concern ran without a body, never whether it wanted one. The
-      // detector for the wanting-one case is the source-derived check in
-      // `lint_hook_manifest`, at authoring time, where it is decidable.
-      // A sorted class list and an integer — nothing that can hold a body.
-      payload_bodies: served_classes.join(",") || "none",
-      payload_stubs: stubs_served,
-    });
+  } finally {
+    closeConcernEnv();
   }
+  assertConcernEnvRestored(); // a failed restore refuses rather than allowing on a dirty process
   const final_rc = _reduce(rcs);
   writeConcernTimings(String(envelope["event"] ?? ""), String(envelope["platform"] ?? ""), timing_samples);
diff --git a/src/scripts/hooks/feedback_policy.ts b/src/scripts/hooks/feedback_policy.ts
new file mode 100644
index 0000000000..8a1985a71a
--- /dev/null
+++ b/src/scripts/hooks/feedback_policy.ts
@@ -0,0 +1,122 @@
+/**
+ * feedback_policy — which concern outcomes get their own feedback file.
+ *
+ * The dispatcher's per-session `summary.json` carries every concern's entry.
+ * A per-concern `<concern>.json` used to be written for every concern on every
+ * dispatch: about 16 locked atomic writes per tool event, each overwritten by
+ * the next dispatch (road-to-a-hook-system-that-pays-for-what-it-does 2.4).
+ * Only an outcome worth looking at on its own keeps a file now, so a
+ * `<concern>.json` means "this concern's latest NON-QUIET outcome", not its latest
+ * outcome — except when the dispatch's summary write failed: then a quiet allow
+ * is written too, so the file never shows an older block as the latest outcome
+ * that no summary contradicts. Nothing deletes it: a delete would race a newer write from a parallel
+ * dispatch in the same session. A write goes through the per-file lock and keeps
+ * whichever outcome COMPLETED later ({@link keepNewerOutcome}), so two warnings
+ * published in reverse completion order cannot leave the older one standing.
+ * The one reader, `hooks_doctor`, ranks that file against the summary's runs by
+ * recorded time, so a later quiet run still reads as the latest.
+ */
+import { EXIT_ALLOW } from './exit_codes.js';
+
+/** An entry that allowed, was not resolved from a crash, and gave no reason. */
+export function isQuietAllow(entry: Readonly<Record<string, unknown>>): boolean {
+    return (
+        entry['exit_code'] === EXIT_ALLOW &&
+        entry['raw_exit_code'] === EXIT_ALLOW &&
+        entry['decision'] === 'allow' &&
+        (entry['reason'] ?? null) === null
+    );
+}
+
+
+/**
+ * The locked write's mutator: the incoming entry, unless the file already holds
+ * an outcome that completed later (then `null`, a deliberate no-write).
+ * Instants, not strings; an unreadable timestamp on either side lets the
+ * incoming entry through, as the unconditional write did before. Equal instants
+ * (millisecond resolution) are ordered by {@link compareRuns}, the same order
+ * `hooks_doctor` reads with; a full tie lets the incoming entry through.
+ */
+export function keepNewerOutcome<T extends Readonly<Record<string, unknown>>>(loaded: Partial<Record<string, unknown>>, entry: T): T | null {
+    const held = typeof loaded['completed_at'] === 'string' ? Date.parse(loaded['completed_at']) : Number.NaN;
+    const incoming = typeof entry['completed_at'] === 'string' ? Date.parse(entry['completed_at'] as string) : Number.NaN;
+    if (Number.isNaN(held) || Number.isNaN(incoming)) return entry;
+    return compareRuns(held, loaded['invocation'], incoming, entry['invocation']) > 0 ? null : entry;
+}
+
+/**
+ * The one order every reader and writer of these records uses, so they never
+ * disagree on which run is the latest: by completion instant, then — at an
+ * equal instant, where no real order exists — by `invocation` id as a string,
+ * an id beating none. Positive when run A is later. Equal instants with equal
+ * (or both absent) ids compare 0. Used by {@link keepNewerOutcome},
+ * {@link withLatestRuns} and `hooks_doctor`.
+ */
+export function compareRuns(atA: number, invocationA: unknown, atB: number, invocationB: unknown): number {
+    if (atA !== atB) return atA > atB ? 1 : -1;
+    const a = typeof invocationA === 'string' ? invocationA : null;
+    const b = typeof invocationB === 'string' ? invocationB : null;
+    if (a === b) return 0;
+    if (a === null) return -1;
+    if (b === null) return 1;
+    return a > b ? 1 : -1;
+}
+
+export interface LatestRun {
+    readonly invocation: string;
+    readonly completed_at: string | null;
+    /** The run's outcome, so the row still answers "what happened last" after the history rotated it out. */
+    readonly exit_code: number | null;
+    readonly decision: string | null;
+}
+
+/**
+ * The summary's `latest` map (one row per concern, outside the capped history:
+ * id, completion time and outcome) with this dispatch's runs folded in. Each row keeps whichever run COMPLETED
+ * later, by the concern's own `completed_at` and {@link keepNewerOutcome}'s rule,
+ * so a dispatch that publishes after a newer one cannot overwrite its row.
+ */
+export function withLatestRuns(
+    held: unknown,
+    entries: readonly Readonly<Record<string, unknown>>[],
+    invocation: string,
+): Record<string, LatestRun> {
+    // No prototype: a concern named `__proto__` is an ordinary key here.
+    const out = Object.create(null) as Record<string, LatestRun>;
+    if (held !== null && typeof held === 'object' && !Array.isArray(held)) {
+        for (const [k, v] of Object.entries(held as Record<string, unknown>)) {
+            if (isLatestRun(v)) {
+                const r = v as { exit_code?: unknown; decision?: unknown };
+                out[k] = {
+                    invocation: v.invocation,
+                    completed_at: v.completed_at,
+                    exit_code: typeof r.exit_code === 'number' ? r.exit_code : null,
+                    decision: typeof r.decision === 'string' ? r.decision : null,
+                };
+            }
+        }
+    }
+    for (const e of entries) {
+        const name = String(e['concern']);
+        const run: LatestRun = {
+            invocation,
+            completed_at: typeof e['completed_at'] === 'string' ? e['completed_at'] : null,
+            exit_code: typeof e['exit_code'] === 'number' ? e['exit_code'] : null,
+            decision: typeof e['decision'] === 'string' ? e['decision'] : null,
+        };
+        const prior = out[name];
+        out[name] = prior === undefined ? run : (keepNewerOutcome(prior as unknown as Record<string, unknown>, run) ?? prior);
+    }
+    return out;
+}
+
+/**
+ * A `latest` row that honours the contract: a string id and a readable
+ * completion instant. The writer keeps only such rows, and `hooks_doctor` reads
+ * only such rows, so the two never disagree on which row counts.
+ */
+export function isLatestRun(v: unknown): v is LatestRun & { completed_at: string } {
+    if (v === null || typeof v !== 'object') return false;
+    const r = v as { invocation?: unknown; completed_at?: unknown };
+    return typeof r.invocation === 'string' && typeof r.completed_at === 'string' && !Number.isNaN(Date.parse(r.completed_at));
+}
````

## Supporting, not gated: `check_hook_bundle_composition.ts` `main`

````ts
export function main(argv: readonly string[] = process.argv.slice(2), root: string = REPO_ROOT): number {
    const parsed = parseGateArgs('check_hook_bundle_composition', argv, {
        'self-test': { type: 'boolean' },
        metafile: { type: 'string' },
    });
    if (!parsed.ok) {
        process.stderr.write(`${parsed.message}\n`);
        return USAGE_EXIT;
    }
    if (parsed.values['self-test'] === true) {
        return selfTest();
    }
    const fixture = parsed.values.metafile;

    let budget: Budget;
    let json: string;
    try {
        budget = readBudget(root);
        json = fixture === undefined ? buildMetafile(root) : fs.readFileSync(fixture, 'utf-8');
    } catch (e) {
        process.stderr.write(`check_hook_bundle_composition: ${String(e instanceof Error ? e.message : e)}\n`);
        return 2;
    }

    let analysis: Analysis;
    try {
        analysis = analyzeMetafile(json, { requireEntry: fixture === undefined });
    } catch (e) {
        process.stderr.write(`check_hook_bundle_composition: ${String(e instanceof Error ? e.message : e)}\n`);
        return 1;
    }

    const findings = verdict(analysis, budget);
    const chunkSizes = new Map<string, number>();
    if (fixture === undefined) {
        try {
            for (const c of HOOK_CHUNKS) chunkSizes.set(c.entry, buildChunkBytes(root, c.entry));
        } catch (e) {
            process.stderr.write(`check_hook_bundle_composition: ${String(e instanceof Error ? e.message : e)}\n`);
            return 2;
        }
    }
    // Reported on BOTH paths, red included: a census that goes quiet exactly
    // when the gate fires is the shape `reportScanned` exists to prevent.
    reportScanned({
        gate: 'check_hook_bundle_composition',
        scanned: analysis.modules,
        units: 'bundled module(s)',
        roots: [LIVE_REL],
    });

    const packages = [...analysis.packageBytes].map(([p, b]) => `${p} ${String(b)} B`).join(', ');
    if (findings.length === 0) {
        process.stdout.write(
            `✅  hook bundle: ${String(analysis.bytes)} B / ${String(budget.maxBytes)} B backstop, ` +
                `packages [${packages}], ${String(analysis.modules)} modules\n`,
        );
        for (const [entry, bytes] of chunkSizes) process.stdout.write(`    chunk ${entry}: ${String(bytes)} B (reported, not gated)\n`);
        return 0;
    }
    process.stderr.write('❌  hook bundle composition is out of budget\n');
    for (const f of findings) process.stderr.write(`    - ${f}\n`);
    process.stderr.write(`    Budget: ${BUDGET_REL}\n`);
    return 1;
}
````

## Supporting, not gated: the CLI tests

````ts
describe('check_hook_bundle_composition — the CLI against the committed budget', () => {
    const run = (outBytes: number, inputs: Record<string, number>): number => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'composition-cli-'));
        const fixture = path.join(dir, 'meta.json');
        fs.writeFileSync(fixture, metafile(outBytes, inputs));
        const quiet = (): boolean => true;
        const out = process.stdout.write;
        const err = process.stderr.write;
        process.stdout.write = quiet as typeof process.stdout.write;
        process.stderr.write = quiet as typeof process.stderr.write;
        try {
            return compositionMain(['--metafile', fixture], REPO);
        } finally {
            process.stdout.write = out;
            process.stderr.write = err;
            fs.rmSync(dir, { recursive: true, force: true });
        }
    };
    const committed = (JSON.parse(fs.readFileSync(path.join(REPO, 'src', 'config', 'hook-bundle-budget.json'), 'utf-8')) as { max_bytes: number }).max_bytes;

    it('exits 0 at the committed backstop with listed packages only', () => {
        expect(committed).toBe(1_915_000);
        expect(run(committed, { 'node_modules/yaml/dist/index.js': 1000, 'src/x.ts': committed - 1000 })).toBe(0);
    });

    it('exits 1 one byte over the committed backstop', () => {
        expect(run(committed + 1, { 'src/x.ts': committed + 1 })).toBe(1);
    });

    it('exits 1 on an unlisted package below the backstop, and on an allowlisted bundle above it', () => {
        expect(run(1000, { 'node_modules/yaml/dist/index.js': 900, 'node_modules/left-pad/x.js': 100 })).toBe(1);
        expect(run(committed + 1, { 'node_modules/yaml/dist/index.js': committed + 1 })).toBe(1);
    });

    it('exits 2 on an invalid budget and on a failed build, never 0', () => {
        const quiet = (): boolean => true;
        const err = process.stderr.write;
        const out = process.stdout.write;
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'composition-root-'));
        try {
            process.stderr.write = quiet as typeof process.stderr.write;
            process.stdout.write = quiet as typeof process.stdout.write;
            fs.mkdirSync(path.join(dir, 'src', 'config'), { recursive: true });
            const budget = path.join(dir, 'src', 'config', 'hook-bundle-budget.json');
            // No allowlist: refused before anything is measured.
            fs.writeFileSync(budget, JSON.stringify({ max_bytes: 1000 }));
            expect(compositionMain([], dir)).toBe(2);
            fs.writeFileSync(budget, JSON.stringify({ max_bytes: -1, allowed_packages: ['yaml'] }));
            expect(compositionMain([], dir)).toBe(2);
            // A valid budget in a root with no sources: the build fails, and the gate does not pass.
            fs.writeFileSync(budget, JSON.stringify({ max_bytes: 1000, allowed_packages: ['yaml'] }));
            expect(compositionMain([], dir)).toBe(2);
        } finally {
            process.stderr.write = err;
            process.stdout.write = out;
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }, 120_000);

    it('exits 1 on an unlisted package of any size', () => {
        expect(run(1000, { 'node_modules/yaml/dist/index.js': 999, 'node_modules/js-yaml/x.js': 1 })).toBe(1);
    });
});
````
