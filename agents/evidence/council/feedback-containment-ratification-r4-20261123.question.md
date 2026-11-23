<!-- evidence-type: analysis -->
<!-- check-refs: skip -->

# Ratification review — every post-verdict diagnostic in the hook dispatcher is contained — round 4

You are an independent reviewer for a change in the `event4u/agent-config` repository. Gated files: `src/scripts/hooks/dispatch_hook.ts` and `src/scripts/hooks/feedback_policy.ts`. Under ADR-268 § 4 an edit to hook plumbing needs a two-provider verdict.

subject: bf0fc6eba2be821e18d79ff672dc6fba73067afa77f604172b94476b79a0d7f7

(Rounds 1–3 are `agents/evidence/council/feedback-containment-ratification-r1/r2/r3-20261123.question.md`.)

## What changed since round 3

One move, no behaviour change: the per-concern feedback write (`update_json_under_lock` with `keepNewerOutcome`, plus the "feedback write failed" stderr line) moved from the loop in `_write_feedback` into `writeConcernFeedback()` in `feedback_policy.ts`, still called inside `containFeedback` per entry. The timing call is on one line. The reason is the repository's source-size ratchet: `dispatch_hook.ts` had grown to 1505 lines against a 1500-line budget, and raising the baseline is treated as a defect. Hook suites: 108 files, 2037 tests passing, including the in-process test that makes the first per-concern write and the timing record throw.

## The diff to the gated files against `main`, complete

````diff
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index f190f57be1..ef6d05bc0a 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -72,7 +72,7 @@ import { detectSurface } from '../_lib/surface.js';
 import { recordCapture, recordOpportunity } from "../_lib/collector_denominator.js";
 import { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN, EXIT_USAGE } from './exit_codes.js';
 import { assertConcernEnvRestored, concernSpawnEnv, enterConcernEnv, openConcernEnvScope, recoverConcernEnv } from './concern_env.js';
-import { isQuietAllow, keepNewerOutcome, withLatestRuns } from './feedback_policy.js';
+import { containFeedback, isQuietAllow, withLatestRuns, writeConcernFeedback } from './feedback_policy.js';
 export { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN };
 export { _fallback_yaml } from './fallback_yaml.js';
 
@@ -893,9 +893,7 @@ function _write_feedback(
   // Quiet allows skip their own file only if the summary carrying them was written (feedback_policy.ts).
   for (const entry of entries) {
     if (summaryWritten && isQuietAllow(entry)) continue;
-    const target = path.join(fb_dir, `${entry["concern"]}.json`);
-    const written = update_json_under_lock<FeedbackEntry>(target, (loaded) => keepNewerOutcome(loaded, { ...entry, invocation }));
-    if (written === "failed") process.stderr.write(`dispatch_hook: feedback write failed for ${entry["concern"]}\n`);
+    containFeedback(`feedback write for ${String(entry["concern"])}`, () => writeConcernFeedback(fb_dir, entry, invocation));
   }
 }
 
@@ -1402,9 +1400,10 @@ export function main(argv?: string[]): number {
   }
   assertConcernEnvRestored(); // a failed restore refuses rather than allowing on a dirty process
   const final_rc = _reduce(rcs);
-  writeConcernTimings(String(envelope["event"] ?? ""), String(envelope["platform"] ?? ""), timing_samples);
-  _write_feedback(envelope, session_id, feedback_entries, final_rc, started_at);
-  _record_rule_trips(envelope, feedback_entries);
+  // The verdict is computed; no diagnostic write may stop it reaching the host.
+  containFeedback("timing record", () => writeConcernTimings(String(envelope["event"] ?? ""), String(envelope["platform"] ?? ""), timing_samples));
+  containFeedback("feedback write", () => _write_feedback(envelope, session_id, feedback_entries, final_rc, started_at));
+  containFeedback("rule-trip record", () => _record_rule_trips(envelope, feedback_entries));
 
   // P0.1 host-semantics translation. The internal ladder (0/1/2) is written to
   // the feedback dir verbatim above — that record is unchanged. What leaves the
diff --git a/src/scripts/hooks/feedback_policy.ts b/src/scripts/hooks/feedback_policy.ts
index e1e62b5903..e758f64846 100644
--- a/src/scripts/hooks/feedback_policy.ts
+++ b/src/scripts/hooks/feedback_policy.ts
@@ -16,7 +16,42 @@
  * The one reader, `hooks_doctor`, ranks that file against the summary's runs by
  * recorded time, so a later quiet run still reads as the latest.
  */
+import * as path from 'node:path';
+
 import { EXIT_ALLOW } from './exit_codes.js';
+import { update_json_under_lock } from './state_io.js';
+
+/**
+ * Runs one diagnostic write so that nothing it throws reaches the caller. The
+ * dispatcher calls every feedback write after the verdict is computed; an
+ * exception escaping one would stop that verdict reaching the host. A failure
+ * is reported on stderr (itself guarded) and the write is skipped.
+ */
+export function containFeedback(label: string, write: () => void): void {
+    try {
+        write();
+    } catch (exc) {
+        try {
+            const msg = exc instanceof Error ? exc.message : String(exc);
+            process.stderr.write(`dispatch_hook: ${label} failed: ${msg}\n`);
+        } catch {
+            // stderr itself is gone; the verdict still matters more than the report
+        }
+    }
+}
+
+/**
+ * One concern's own feedback file, written under its lock with
+ * {@link keepNewerOutcome}. A write the lock reports as failed is named on
+ * stderr; the caller wraps this in {@link containFeedback} for anything thrown.
+ */
+export function writeConcernFeedback(fbDir: string, entry: Readonly<Record<string, unknown>>, invocation: string): void {
+    const concern = String(entry['concern']);
+    const written = update_json_under_lock<Record<string, unknown>>(path.join(fbDir, `${concern}.json`), (loaded) =>
+        keepNewerOutcome(loaded, { ...entry, invocation }),
+    );
+    if (written === 'failed') process.stderr.write(`dispatch_hook: feedback write failed for ${concern}\n`);
+}
 
 /** An entry that allowed, was not resolved from a crash, and gave no reason. */
 export function isQuietAllow(entry: Readonly<Record<string, unknown>>): boolean {
````

## What to answer

1. Does this change weaken a fail-closed guard, an exit-code contract, child-process hardening, or isolation between concerns, or expand any authority?
2. After this change, can any call between `_reduce(rcs)` and host emission in `main` still throw out of `main`? Name it if so.
3. Is anything in the diff unnecessary or wrong?

Close your reply with exactly one line in this form, and nothing after it:

`STANCE: <ratified | confirmed-non-expanding | refused> | CONFIDENCE: <high | med | low> | DEALBREAKER: <yes | no>`

Use `ratified` if the change is acceptable as shown. Use `confirmed-non-expanding` if it neither weakens a guard nor expands authority. Use `refused` if it is not acceptable, and give the reason in the text above the line.
