<!-- evidence-type: analysis -->
<!-- check-refs: skip -->

# Ratification review — every post-verdict feedback write in the hook dispatcher is contained — round 1

You are an independent reviewer for a change in the `event4u/agent-config` repository. Gated files: the dispatcher `src/scripts/hooks/dispatch_hook.ts` and its module `src/scripts/hooks/feedback_policy.ts`. Under ADR-268 § 4 an edit to hook plumbing needs a two-provider verdict.

subject: c2b424d8b5072ac8d262d4b024333239a4987dcea4a2132c28bdef7faa57b9ad

(The gate's digest over the two gated files at the change's head, base `origin/main` at `bffe05c3fe`.)

## Background

The merged change #3005 moved the dispatcher's per-concern feedback write to `update_json_under_lock()` and dropped the caller-side `try/catch` around it. In that change's ratification rounds 25 and 26, one seat refused on exactly this: an exception escaping a feedback write after `_reduce(rcs)` could stop the computed verdict from reaching the host. Round 26 additionally asked about `path.resolve` before the first `try` in `update_json_under_lock`, about `is_replay_mode()`, and about an asynchronous EPIPE on a closed stderr.

This change wraps every per-concern write, and both post-verdict calls in `main` (`_write_feedback`, `_record_rule_trips`), in `containFeedback()`. `writeConcernTimings`, the third post-verdict call, already wraps its body in its own `try` (`src/scripts/hooks/concern_timings.ts`) and is unchanged.

On the asynchronous stderr question: every dispatcher entry point calls `process.exit(main(…))` synchronously, so an `error` event emitted by stderr after `main` returns never runs. A `process.stderr.on('error')` listener was tried and removed: with it neutralised, the closed-stderr test below stays green, so the listener protected nothing.

## The diff to the gated files, complete

````diff
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index f190f57be1..6567c77c48 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -72,7 +72,7 @@ import { detectSurface } from '../_lib/surface.js';
 import { recordCapture, recordOpportunity } from "../_lib/collector_denominator.js";
 import { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN, EXIT_USAGE } from './exit_codes.js';
 import { assertConcernEnvRestored, concernSpawnEnv, enterConcernEnv, openConcernEnvScope, recoverConcernEnv } from './concern_env.js';
-import { isQuietAllow, keepNewerOutcome, withLatestRuns } from './feedback_policy.js';
+import { containFeedback, isQuietAllow, keepNewerOutcome, withLatestRuns } from './feedback_policy.js';
 export { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN };
 export { _fallback_yaml } from './fallback_yaml.js';
 
@@ -893,9 +893,11 @@ function _write_feedback(
   // Quiet allows skip their own file only if the summary carrying them was written (feedback_policy.ts).
   for (const entry of entries) {
     if (summaryWritten && isQuietAllow(entry)) continue;
-    const target = path.join(fb_dir, `${entry["concern"]}.json`);
-    const written = update_json_under_lock<FeedbackEntry>(target, (loaded) => keepNewerOutcome(loaded, { ...entry, invocation }));
-    if (written === "failed") process.stderr.write(`dispatch_hook: feedback write failed for ${entry["concern"]}\n`);
+    containFeedback(`feedback write for ${String(entry["concern"])}`, () => {
+      const target = path.join(fb_dir, `${entry["concern"]}.json`);
+      const written = update_json_under_lock<FeedbackEntry>(target, (loaded) => keepNewerOutcome(loaded, { ...entry, invocation }));
+      if (written === "failed") process.stderr.write(`dispatch_hook: feedback write failed for ${entry["concern"]}\n`);
+    });
   }
 }
 
@@ -1403,8 +1405,9 @@ export function main(argv?: string[]): number {
   assertConcernEnvRestored(); // a failed restore refuses rather than allowing on a dirty process
   const final_rc = _reduce(rcs);
   writeConcernTimings(String(envelope["event"] ?? ""), String(envelope["platform"] ?? ""), timing_samples);
-  _write_feedback(envelope, session_id, feedback_entries, final_rc, started_at);
-  _record_rule_trips(envelope, feedback_entries);
+  // The verdict is computed; no diagnostic write may stop it reaching the host.
+  containFeedback("feedback write", () => _write_feedback(envelope, session_id, feedback_entries, final_rc, started_at));
+  containFeedback("rule-trip record", () => _record_rule_trips(envelope, feedback_entries));
 
   // P0.1 host-semantics translation. The internal ladder (0/1/2) is written to
   // the feedback dir verbatim above — that record is unchanged. What leaves the
diff --git a/src/scripts/hooks/feedback_policy.ts b/src/scripts/hooks/feedback_policy.ts
index e1e62b5903..9505e8400d 100644
--- a/src/scripts/hooks/feedback_policy.ts
+++ b/src/scripts/hooks/feedback_policy.ts
@@ -18,6 +18,25 @@
  */
 import { EXIT_ALLOW } from './exit_codes.js';
 
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
 /** An entry that allowed, was not resolved from a crash, and gave no reason. */
 export function isQuietAllow(entry: Readonly<Record<string, unknown>>): boolean {
     return (
````

## The new test file, complete (`tests/scripts/hooks/feedback_containment.test.ts`)

````ts
// Feedback writes run after the verdict is computed; none of them may stop it
// reaching the host. Unit half: `containFeedback` swallows what a write throws.
// End-to-end half: a blocking dispatch whose feedback tree is unusable leaves
// with the same exit code and output as one whose tree is healthy.
import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { containFeedback } from '../../../src/scripts/hooks/feedback_policy.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'dispatch_hook.ts');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-containment-'));
});
afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('containFeedback', () => {
    it('runs the write when it succeeds', () => {
        let ran = 0;
        containFeedback('x', () => {
            ran += 1;
        });
        expect(ran).toBe(1);
    });

    it('a throwing write does not escape and is reported with its label', () => {
        const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        expect(() =>
            containFeedback('feedback write for guard', () => {
                throw new Error('lock release blew up');
            }),
        ).not.toThrow();
        expect(spy.mock.calls.map((c) => String(c[0])).join('')).toMatch(/feedback write for guard failed: lock release blew up/);
    });

    it('does not throw even when reporting the failure throws', () => {
        vi.spyOn(process.stderr, 'write').mockImplementation(() => {
            throw new Error('stderr closed');
        });
        expect(() =>
            containFeedback('x', () => {
                throw new Error('boom');
            }),
        ).not.toThrow();
    });
});

describe('a blocking verdict survives an unusable feedback tree', () => {
    function dispatch(ws: string): { status: number | null; stdout: string } {
        const manifest = path.join(tmp, 'manifest.yaml');
        fs.writeFileSync(
            manifest,
            [
                'schema_version: 1',
                'concerns:',
                '  guard:',
                '    script: tests/hooks/fixtures/concern_blocks.ts',
                '    args: []',
                '    fail_closed: false',
                '    severity: blocking',
                '    effect: permission',
                'platforms:',
                '  claude:',
                '    pre_tool_use: [guard]',
                '',
            ].join('\n'),
        );
        const env: NodeJS.ProcessEnv = { ...process.env };
        delete env['AGENT_CONFIG_REPLAY'];
        const r = spawnSync(
            TSX_BIN,
            [TS_SCRIPT, '--platform', 'claude', '--event', 'pre_tool_use', '--native-event', 'PreToolUse', '--manifest', manifest],
            {
                cwd: ws,
                input: JSON.stringify({ session_id: 'containment', tool_name: 'Bash', tool_input: { command: 'ls' } }),
                encoding: 'utf8',
                env,
            },
        );
        return { status: r.status, stdout: r.stdout };
    }

    it('the host gets the same refusal whether or not feedback could be written', () => {
        const healthy = path.join(tmp, 'healthy');
        fs.mkdirSync(healthy, { recursive: true });
        const broken = path.join(tmp, 'broken');
        fs.mkdirSync(path.join(broken, 'agents', 'runtime'), { recursive: true });
        // A file where the state directory belongs: every feedback and rule-trip write fails.
        fs.writeFileSync(path.join(broken, 'agents', 'runtime', 'state'), 'not a directory');

        const ok = dispatch(healthy);
        const bad = dispatch(broken);
        expect(ok.status).not.toBe(0); // the fixture refused, so this is a real verdict
        expect(bad.status).toBe(ok.status);
        expect(bad.stdout).toBe(ok.stdout);
        expect(fs.existsSync(path.join(healthy, 'agents', 'runtime', 'state'))).toBe(true);
    });

    // Pins a property no listener provides: every entry calls `process.exit(main())`
    // synchronously, so an asynchronous EPIPE on stderr never runs before the exit.
    it('a host that closed stderr still gets the refusal while every feedback write fails', async () => {
        const healthy = path.join(tmp, 'healthy-2');
        fs.mkdirSync(healthy, { recursive: true });
        const broken = path.join(tmp, 'broken-2');
        fs.mkdirSync(path.join(broken, 'agents', 'runtime'), { recursive: true });
        fs.writeFileSync(path.join(broken, 'agents', 'runtime', 'state'), 'not a directory');
        const ok = dispatch(healthy);
        const manifest = path.join(tmp, 'manifest.yaml');
        const env: NodeJS.ProcessEnv = { ...process.env };
        delete env['AGENT_CONFIG_REPLAY'];
        const child = spawn(
            TSX_BIN,
            [TS_SCRIPT, '--platform', 'claude', '--event', 'pre_tool_use', '--native-event', 'PreToolUse', '--manifest', manifest],
            { cwd: broken, env, stdio: ['pipe', 'pipe', 'pipe'] },
        );
        child.stderr.destroy(); // the host's end of the pipe is gone: every stderr write hits EPIPE
        let stdout = '';
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (c: string) => {
            stdout += c;
        });
        child.stdin.end(JSON.stringify({ session_id: 'containment', tool_name: 'Bash', tool_input: { command: 'ls' } }));
        const status = await new Promise<number | null>((resolve) => child.on('close', (code) => resolve(code)));
        expect(status).toBe(ok.status);
        expect(stdout).toBe(ok.stdout);
    });
});
````

The fixture `tests/hooks/fixtures/concern_blocks.ts` drains stdin, prints `{"decision":"block","reason":"fixture block"}` and exits 1, which is the dispatcher's block code.

Results at the change's head: the new file 5/5, all hook suites (`tests/scripts/hooks/`, `tests/hooks/`) 107 files and 2032 tests passing, `tsc --noEmit` clean.

What the tests do not show: the end-to-end cases make every feedback write FAIL, which `update_json_under_lock` reports by return value. No end-to-end case makes a feedback write THROW, because no input found reaches a throw through the public entry. The throw path is covered by the unit tests of `containFeedback` only.

## What to answer

1. Does this change weaken a fail-closed guard, an exit-code contract, child-process hardening, or isolation between concerns, or expand any authority?
2. After this change, can any call between `_reduce(rcs)` and host emission in `main` still throw out of `main`? Name it if so.
3. Is anything in the diff unnecessary or wrong?

Close your reply with exactly one line in this form, and nothing after it:

`STANCE: <ratified | confirmed-non-expanding | refused> | CONFIDENCE: <high | med | low> | DEALBREAKER: <yes | no>`

Use `ratified` if the change is acceptable as shown. Use `confirmed-non-expanding` if it neither weakens a guard nor expands authority. Use `refused` if it is not acceptable, and give the reason in the text above the line.
