<!-- evidence-type: analysis -->

# Ratification review — the hook-bundle budget becomes an allowlist and a backstop, and three per-dispatch fixed costs leave the dispatcher — round 7

You are an independent reviewer for a change in the `event4u/agent-config` repository. Gated files: the ratification gate `check_kernel_edit_ratified.ts`, its workflow `consistency.yml`, the dispatcher `hooks/dispatch_hook.ts`, new dispatcher modules `hooks/concern_env.ts` and `hooks/feedback_policy.ts`, and `src/config/hook-bundle-budget.json`. Under ADR-268 § 4 the change needs a two-provider verdict.

subject: 6da8bd7a4604a7c05770eee163c8781e2651a00d87f74f2cc231a2947533d044

(Base-revision gate digest over those six files at commit `ad94bf9b45`. The head's gate, which no longer lists the budget file, computes `49ac7110bcef972b44e3b3c41c82f82fb43bd94a0d16dd388ad455aa64960055` over the other five.)

Rounds 4–6 (`agents/evidence/council/hook-system-pays-ratification-r4/-r5/-r6-20261120.question.md`, committed) carry the full description and the full gated files. In round 6 one seat ratified; the other refused on the three points below. This round answers each with code, a test, or the exact workflow lines.

## Round 6 points

1. **Two warnings published in reverse completion order (one seat).** The per-concern write was an unconditional atomic replace — as it was before this change. It now goes through the per-file lock that `summary.json` already uses (`update_json_under_lock`) with the mutator `keepNewerOutcome`: the file keeps the outcome that COMPLETED later (instants, not strings); an unreadable timestamp on either side lets the write through, as before. Test: the later-completed warning publishes first, the earlier one arrives after it, and the file keeps the later one. Only non-quiet outcomes write, so the lock is not on the routine path.
2. **Host refusal on an unrecoverable repair, and a failed rollback (one seat).** An exception escaping the dispatch has one path, reproduced on 2026-11-20 with a top-level `throw` planted in a bundled module: the bundle exits 1, and the generated Claude host command turns any exit other than 0 or 2 into "the hook dispatcher did not return a verdict, so this tool call is refused" (the command's tail: `RC=$?; [ "$RC" = 0 ] || [ "$RC" = 2 ] || { echo '…refused…' >&2; exit 2; }`). An unrecoverable repair throws out of `enterConcernEnv`, which is called before the concern's own `try` in `_run_concern_inproc`, so it takes that path. New test: when the rollback of a half-applied scope fails too, the ORIGINAL error propagates and "environment rollback failed" is reported on stderr.
3. **Which digest CI validates, and what enforces the budget after the head gate drops it (one seat).** `consistency.yml`, step "Kernel / governance-hook edits carry a ratification artifact" (lines 940–962, unchanged by this change): it checks out the BASE revision into a worktree and runs `npx tsx "$BASE_DIR/src/scripts/check_kernel_edit_ratified.ts" --root "$PWD" --base-ref "$BASE_SHA"`, i.e. the base copy of the gate judges the head — and the base copy still lists the budget file, which is why this record's `subject` is the base digest over six files. Budget enforcement after this change is the composition gate, step at line 259 (`./scripts-run src/scripts/check_hook_bundle_composition`, shown in the workflow diff of round 4: only its name and comment changed), which fails a pull request on an unlisted or duplicated package, an over-backstop bundle, or an unreadable metafile.

Suites: 135 test files, 2,374 tests; composition self-test 4/4; load-set test green.

## What to answer

1. Are the three round-6 points closed by what is shown?
2. Does any shown change weaken a fail-closed guard, an exit-code contract, child-process hardening, or isolation between concerns?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

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

## `tests/scripts/hooks/feedback_policy.test.ts`, full

````
// feedback_policy — only an outcome worth reading on its own keeps a
// per-concern feedback file (road-to-a-hook-system-that-pays-for-what-it-does 2.4).
import { describe, expect, it } from 'vitest';

import { isQuietAllow, keepNewerOutcome } from '../../../src/scripts/hooks/feedback_policy.js';

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


describe('feedback_policy — keepNewerOutcome', () => {
    it('two warnings published in reverse completion order leave the later-completed one', () => {
        const later = { concern: 'c', decision: 'warn', completed_at: '2026-11-20T10:00:02Z' };
        const earlier = { concern: 'c', decision: 'warn', completed_at: '2026-11-20T10:00:01Z' };
        // The later-completed dispatch publishes first; the earlier one arrives after it.
        expect(keepNewerOutcome({}, later)).toBe(later);
        expect(keepNewerOutcome(later, earlier)).toBeNull();
        expect(keepNewerOutcome(earlier, later)).toBe(later);
    });

    it('compares instants, and lets the write through when either timestamp is unreadable', () => {
        expect(keepNewerOutcome({ completed_at: '2026-11-20T10:00:00.500Z' }, { completed_at: '2026-11-20T10:00:00Z' })).toBeNull();
        const e = { completed_at: 'not a date' };
        expect(keepNewerOutcome({ completed_at: '2026-11-20T10:00:00Z' }, e)).toBe(e);
    });
});
````

## `consistency.yml` lines 935–965 (unchanged)

````yaml
      # `required_providers` and have the base gate honour it.
      #
      # `node_modules` stays the head's (tsx lives there); only the SCRIPT and
      # its `_lib` imports resolve from the base worktree, because ESM resolves
      # relative imports against the importing file.
      - name: Kernel / governance-hook edits carry a ratification artifact
        if: github.event_name == 'pull_request'
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          GIT_CONFIG_COUNT: '1'
          GIT_CONFIG_KEY_0: diff.renames
          GIT_CONFIG_VALUE_0: 'false'
        run: |
          GATE=src/scripts/check_kernel_edit_ratified.ts
          BASE_DIR="$RUNNER_TEMP/ratification-base"
          if git cat-file -e "$BASE_SHA:$GATE" 2>/dev/null; then
            git worktree add --detach "$BASE_DIR" "$BASE_SHA" >/dev/null
            echo "Judging with the BASE revision's gate ($BASE_SHA)."
            npx tsx "$BASE_DIR/$GATE" --root "$PWD" --base-ref "$BASE_SHA"
          else
            # The bootstrap PR — the one that INTRODUCES the gate. There is no
            # base copy to judge with, so the head's own gate runs and the
            # independence of that run rests entirely on the ratification
            # artifact and on human review of this PR. Stated loudly rather
            # than hidden: this branch is sound exactly once.
            echo "::warning::BOOTSTRAP — no gate at the base revision; running the head's copy."
            echo "The independence of this run rests on the ratification artifact and human review."
            ./scripts-run src/scripts/check_kernel_edit_ratified --base-ref "$BASE_SHA"
          fi

      - name: Lint marketplace.json
````

## The diff since round 6 (`git diff ec407c76f8..ad94bf9b45`)

````diff
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index b5c9981754..40f8ed4234 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -40,7 +40,6 @@ import { tableFingerprint } from "./table_fingerprint.js";
 
 import { hardenedSpawnEnv } from "../_lib/spawn_env.js";
 import {
-  atomic_write_json,
   feedback_dir,
   is_replay_mode,
   update_json_under_lock,
@@ -74,7 +73,7 @@ import { detectSurface } from '../_lib/surface.js';
 import { recordCapture, recordOpportunity } from "../_lib/collector_denominator.js";
 import { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN, EXIT_USAGE } from './exit_codes.js';
 import { enterConcernEnv, openConcernEnvScope } from './concern_env.js';
-import { isQuietAllow } from './feedback_policy.js';
+import { isQuietAllow, keepNewerOutcome } from './feedback_policy.js';
 export { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN };
 export { _fallback_yaml } from './fallback_yaml.js';
 
@@ -818,7 +817,7 @@ function _write_feedback(
     if (isQuietAllow(entry)) continue; // summary.json carries it: feedback_policy.ts
     const target = path.join(fb_dir, `${entry["concern"]}.json`);
     try {
-      atomic_write_json(target, entry);
+      update_json_under_lock<FeedbackEntry>(target, (loaded) => keepNewerOutcome(loaded, entry));
     } catch (exc) {
       const msg = exc instanceof Error ? exc.message : String(exc);
       process.stderr.write(
diff --git a/src/scripts/hooks/feedback_policy.ts b/src/scripts/hooks/feedback_policy.ts
index 9210e8e79c..f024bc0c3b 100644
--- a/src/scripts/hooks/feedback_policy.ts
+++ b/src/scripts/hooks/feedback_policy.ts
@@ -8,9 +8,11 @@
  * Only an outcome worth looking at on its own keeps a file now, so a
  * `<concern>.json` means "this concern's latest NON-QUIET outcome", not its latest
  * outcome. Nothing deletes it: a delete would race a newer write from a parallel
- * dispatch in the same session. The one reader, `hooks_doctor`, ranks that file
- * against the summary's runs by recorded time, so a later quiet run still reads
- * as the latest.
+ * dispatch in the same session. A write goes through the per-file lock and keeps
+ * whichever outcome COMPLETED later ({@link keepNewerOutcome}), so two warnings
+ * published in reverse completion order cannot leave the older one standing.
+ * The one reader, `hooks_doctor`, ranks that file against the summary's runs by
+ * recorded time, so a later quiet run still reads as the latest.
  */
 import { EXIT_ALLOW } from './exit_codes.js';
 
@@ -24,3 +26,16 @@ export function isQuietAllow(entry: Readonly<Record<string, unknown>>): boolean
     );
 }
 
+
+/**
+ * The locked write's mutator: the incoming entry, unless the file already holds
+ * an outcome that completed later (then `null`, a deliberate no-write).
+ * Instants, not strings; an unreadable timestamp on either side lets the
+ * incoming entry through, as the unconditional write did before.
+ */
+export function keepNewerOutcome<T extends Readonly<Record<string, unknown>>>(loaded: Partial<Record<string, unknown>>, entry: T): T | null {
+    const held = typeof loaded['completed_at'] === 'string' ? Date.parse(loaded['completed_at']) : Number.NaN;
+    const incoming = typeof entry['completed_at'] === 'string' ? Date.parse(entry['completed_at'] as string) : Number.NaN;
+    if (!Number.isNaN(held) && !Number.isNaN(incoming) && held > incoming) return null;
+    return entry;
+}
diff --git a/tests/scripts/hooks/concern_env.test.ts b/tests/scripts/hooks/concern_env.test.ts
index 725bc5c172..b16ea87bb5 100644
--- a/tests/scripts/hooks/concern_env.test.ts
+++ b/tests/scripts/hooks/concern_env.test.ts
@@ -166,6 +166,28 @@ describe('concern_env — one scope per dispatch', () => {
             close();
         });
 
+        it('when the rollback fails too, the original error propagates and the rollback failure is reported', () => {
+            installFailingEnv();
+            const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
+            try {
+                writes = 0;
+                failing = false;
+                failAtWrite = 2;
+                // Fail every write from the second on: hardening and rollback both fail.
+                const orig = failAtWrite;
+                failAtWrite = null;
+                let n = 0;
+                process.env = new Proxy({ ...(process.env as Record<string, string>) }, {
+                    set: (t, k, v) => { n += 1; if (n >= orig) throw new Error('injected env write failure'); return Reflect.set(t, k, String(v)); },
+                    deleteProperty: (t, k) => { n += 1; if (n >= orig) throw new Error('injected env write failure'); return Reflect.deleteProperty(t, k); },
+                }) as NodeJS.ProcessEnv;
+                expect(() => openConcernEnvScope(ROOT)).toThrow(/injected env write failure/);
+                expect(spy.mock.calls.some((c) => String(c[0]).includes('environment rollback failed'))).toBe(true);
+            } finally {
+                spy.mockRestore();
+            }
+        });
+
         it('a scope whose hardening fails half-way rolls back what it applied and throws', () => {
             installFailingEnv();
             const before = { ...(process.env as Record<string, string>) };
diff --git a/tests/scripts/hooks/feedback_policy.test.ts b/tests/scripts/hooks/feedback_policy.test.ts
index 53f6169cc5..3d59e2be01 100644
--- a/tests/scripts/hooks/feedback_policy.test.ts
+++ b/tests/scripts/hooks/feedback_policy.test.ts
@@ -2,7 +2,7 @@
 // per-concern feedback file (road-to-a-hook-system-that-pays-for-what-it-does 2.4).
 import { describe, expect, it } from 'vitest';
 
-import { isQuietAllow } from '../../../src/scripts/hooks/feedback_policy.js';
+import { isQuietAllow, keepNewerOutcome } from '../../../src/scripts/hooks/feedback_policy.js';
 
 const allow = { concern: 'c', exit_code: 0, raw_exit_code: 0, decision: 'allow', reason: null };
 
@@ -21,3 +21,20 @@ describe('feedback_policy — isQuietAllow', () => {
     });
 });
 
+
+describe('feedback_policy — keepNewerOutcome', () => {
+    it('two warnings published in reverse completion order leave the later-completed one', () => {
+        const later = { concern: 'c', decision: 'warn', completed_at: '2026-11-20T10:00:02Z' };
+        const earlier = { concern: 'c', decision: 'warn', completed_at: '2026-11-20T10:00:01Z' };
+        // The later-completed dispatch publishes first; the earlier one arrives after it.
+        expect(keepNewerOutcome({}, later)).toBe(later);
+        expect(keepNewerOutcome(later, earlier)).toBeNull();
+        expect(keepNewerOutcome(earlier, later)).toBe(later);
+    });
+
+    it('compares instants, and lets the write through when either timestamp is unreadable', () => {
+        expect(keepNewerOutcome({ completed_at: '2026-11-20T10:00:00.500Z' }, { completed_at: '2026-11-20T10:00:00Z' })).toBeNull();
+        const e = { completed_at: 'not a date' };
+        expect(keepNewerOutcome({ completed_at: '2026-11-20T10:00:00Z' }, e)).toBe(e);
+    });
+});
````
