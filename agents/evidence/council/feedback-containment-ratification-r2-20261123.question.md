<!-- evidence-type: analysis -->
<!-- check-refs: skip -->

# Ratification review — every post-verdict feedback write in the hook dispatcher is contained — round 2

You are an independent reviewer for a change in the `event4u/agent-config` repository. Gated files: `src/scripts/hooks/dispatch_hook.ts` and `src/scripts/hooks/feedback_policy.ts`. Under ADR-268 § 4 an edit to hook plumbing needs a two-provider verdict.

subject: c2b424d8b5072ac8d262d4b024333239a4987dcea4a2132c28bdef7faa57b9ad

(Same subject as round 1: the gated files have not changed. Round 1's prompt is `agents/evidence/council/feedback-containment-ratification-r1-20261123.question.md`.)

## What changed since round 1

Only tests. Round 1 asked for a dispatcher-level case in which a feedback write THROWS, with exact assertions. `tests/scripts/hooks/feedback_write_throws.test.ts` drives the real `main` in-process; the locked JSON writer is replaced so that it throws for the first concern's file and behaves normally otherwise. It asserts the host-facing exit code (2, Claude Code's refusal code), the fixture's refusal reason on stderr, the containment report, that the throwing concern has no file, and that the later concern's feedback was written. With both containment wrappers replaced by a plain call, this test fails with the injected error escaping `main`. The end-to-end file now asserts exit code 2 and the fixture's reason rather than comparing two runs, and the closed-stderr comment claims only what it observes.

Results: hook suites 108 files, 2033 tests passing; `tsc --noEmit` clean; eslint clean on both test files.

## The diff to the gated files, complete (unchanged)

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

## `tests/scripts/hooks/feedback_write_throws.test.ts`, complete

````ts
// A per-concern feedback write that THROWS (not one that reports "failed")
// must neither stop the computed verdict reaching the host nor skip the
// feedback of the concerns after it. Driven through the real dispatcher
// `main`, with only the locked JSON writer and the stdin read replaced.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as TtyModule from 'node:tty';
import type * as StdinPolicy from '../../../src/scripts/hooks/stdin_failure_policy.js';
import type * as StateIo from '../../../src/scripts/hooks/state_io.js';

const PAYLOAD = JSON.stringify({ session_id: 'throws', tool_name: 'Bash', tool_input: { command: 'ls' } });

vi.mock('node:tty', async (orig) => ({ ...(await orig<typeof TtyModule>()), isatty: () => false }));
vi.mock('../../../src/scripts/hooks/stdin_failure_policy.js', async (orig) => ({
    ...(await orig<typeof StdinPolicy>()),
    stdinReadFailure: () => ({ text: PAYLOAD, failure: null }),
}));
vi.mock('../../../src/scripts/hooks/state_io.js', async (orig) => {
    const real = await orig<typeof StateIo>();
    return {
        ...real,
        update_json_under_lock: ((target: string, mutate: never) =>
            path.basename(target) === 'guard.json'
                ? (() => {
                      throw new Error('injected lock failure');
                  })()
                : real.update_json_under_lock(target, mutate)) as typeof real.update_json_under_lock,
    };
});

const { main } = await import('../../../src/scripts/hooks/dispatch_hook.js');
const { feedback_dir } = await import('../../../src/scripts/hooks/state_io.js');

let tmp: string;
let cwd: string;
beforeEach(() => {
    cwd = process.cwd();
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-throws-')));
});
afterEach(() => {
    process.chdir(cwd);
    vi.restoreAllMocks();
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('a feedback write that throws', () => {
    it('leaves the refusal intact and still writes the later concern\'s feedback', () => {
        const manifest = path.join(tmp, 'manifest.yaml');
        const concern = (name: string, script: string, severity: string): string[] => [
            `  ${name}:`,
            `    script: ${script}`,
            '    args: []',
            '    fail_closed: false',
            `    severity: ${severity}`,
            `    effect: ${severity === 'blocking' ? 'permission' : 'telemetry'}`,
        ];
        fs.writeFileSync(
            manifest,
            [
                'schema_version: 1',
                'concerns:',
                ...concern('guard', 'tests/hooks/fixtures/concern_blocks.ts', 'blocking'),
                ...concern('later', 'tests/hooks/fixtures/concern_allow.ts', 'advisory'),
                'platforms:',
                '  claude:',
                '    pre_tool_use: [guard, later]',
                '',
            ].join('\n'),
        );
        const out: string[] = [];
        const err: string[] = [];
        vi.spyOn(process.stdout, 'write').mockImplementation((s: string | Uint8Array) => (out.push(String(s)), true));
        vi.spyOn(process.stderr, 'write').mockImplementation((s: string | Uint8Array) => (err.push(String(s)), true));
        const prevReplay = process.env['AGENT_CONFIG_REPLAY'];
        delete process.env['AGENT_CONFIG_REPLAY'];
        let rc: number;
        try {
            rc = main(['--platform', 'claude', '--event', 'pre_tool_use', '--native-event', 'PreToolUse', '--manifest', manifest, '--project-dir', tmp]);
        } finally {
            if (prevReplay !== undefined) process.env['AGENT_CONFIG_REPLAY'] = prevReplay;
        }
        expect(rc).toBe(2); // Claude Code's native refusal code
        expect(err.join('')).toContain('fixture block'); // Claude reads a refusal's reason from stderr
        expect(err.join('')).toContain('feedback write for guard failed: injected lock failure');
        const dir = feedback_dir(path.join(tmp, 'agents', 'runtime', 'state'), 'throws');
        expect(fs.existsSync(path.join(dir, 'guard.json'))).toBe(false);
        expect(JSON.parse(fs.readFileSync(path.join(dir, 'later.json'), 'utf8'))).toMatchObject({ concern: 'later', reason: 'fixture allow' });
    });
});
````

## `tests/scripts/hooks/feedback_containment.test.ts`, complete

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
    function dispatch(ws: string): { status: number | null; stdout: string; stderr: string } {
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
        return { status: r.status, stdout: r.stdout, stderr: r.stderr };
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
        expect(ok.status).toBe(2); // Claude Code's native refusal code
        expect(ok.stderr).toContain('fixture block'); // the refusal came from the fixture, not a crash
        expect(bad.status).toBe(2);
        expect(bad.stderr).toContain('fixture block');
        expect(bad.stdout).toBe(ok.stdout);
        expect(fs.existsSync(path.join(healthy, 'agents', 'runtime', 'state'))).toBe(true);
    });

    // Pins observed behaviour only: with the host's stderr closed, the exit code
    // still arrives. It does not show that a write hit EPIPE.
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
        expect(ok.status).toBe(2);
        expect(status).toBe(2);
        expect(stdout).toBe(ok.stdout);
    });
});
````

## Round 1 replies, verbatim

### Reviewer A

````text
## Independent Review – Round 2

### Agreement with Prior Reviews

**Reviewer A (ratified | high | no):**
- ✓ Correct that no authority is expanded or guards weakened
- ✓ The `String()` safety analysis is sound (JSON-parsed values are safe)
- ✓ Implementation is technically correct
- ✗ "Ratified" is premature given test suite gaps

**Reviewer B (REQUEST_CHANGES):**
- ✓ End-to-end tests only exercise the return-failure path, not throws
- ✓ Test assertions are too weak (comparative rather than exact)
- ✓ The comment's guarantee overstates what this diff verifies
- ⚠️ However: the author documented attempting to trigger throws and failing, suggesting the wrapped operations handle errors via return values rather than exceptions

### New Points and Refinements

1. **The documented attempt to trigger throws matters.** The description states "no input found reaches a throw through the public entry". This suggests `update_json_under_lock` and related operations return error codes rather than throwing in practice. The `try/catch` is defensive programming for edge cases or internal errors, which is appropriate for critical safety properties.

2. **The per-concern wrapping has value beyond just containment.** The inner `containFeedback` at dispatch_hook.ts:896 means one concern's write failure (whether throw or return-failure) doesn't stop subsequent concerns' writes. This deserves verification: does a first-concern failure allow second-concern feedback to be written?

3. **Scope precision.** The comment at line 1408 makes a sweeping claim ("no diagnostic write may stop it reaching the host"), but the diff only shows three operations wrapped. We cannot verify from this diff:
   - Whether `writeConcernTimings`'s internal `try` covers all code paths
   - Whether host emission code after these lines can throw
   - Whether `path.resolve` inside `update_json_under_lock` (mentioned in round 26) throws before the first `try`

   The comment should state "these feedback writes are contained" rather than implying complete protection.

4. **Test assertion weakness is a real issue.** `expect(ok.status).not.toBe(0)` accepts `null` or any nonzero value. For a blocking fixture, assert `expect(ok.status).toBe(1)` (the dispatcher's block code). The stdout comparison should verify the presence of the block payload (`"decision":"block"`), not just that two runs produce identical output.

5. **The `String(entry["concern"])` observation is minor but correct.** It evaluates outside the `try` at line 896, but `entry` is internal `feedback_entries` data, not external input. Theoretical risk only.

### Questions Answered

**Q1: Does this weaken guards or expand authority?**  
No. This is purely defensive error handling. It strengthens the fail-safe property (verdict reaches host even when diagnostics fail) without touching authority, isolation, or fail-closed behavior.

**Q2: Can anything between `_reduce(rcs)` and host emission still throw?**  
The `String()` conversions are safe (JSON-parsed envelope). `writeConcernTimings` claims internal protection but isn't shown. Host emission code is outside the diff and unverifiable here. Within the shown scope, all feedback writes are wrapped.

**Q3: Unnecessary or wrong?**  
Implementation is correct. Issues are in the test suite (weak assertions) and documentation (overstated comment), not production code.

### Verdict Reasoning

The implementation correctly wraps post-verdict operations in nested try/catch blocks. The placement is sound. The concern is test coverage: no end-to-end verification that a thrown exception (vs. a "failed" return) is caught during real dispatch.

However, the author documented attempting to trigger throws without success, and the pattern (`if (written === "failed")`) suggests the wrapped operations use return values for error handling. The unit tests prove `containFeedback` works; the end-to-end tests prove verdicts survive write failures (even if only the return-failure path).

For a critical safety property that blocked prior ratification rounds, this gap is notable but not fatal. The core mechanism is correct. The test improvements (exact assertions, stronger oracles) would increase confidence but aren't blockers when:
1. The author tried and failed to trigger the throw path
2. The operations appear to handle errors internally
3. Unit tests verify the mechanism
4. The diff correctly places the wrappers

The change neither weakens guards nor expands authority. It strengthens a fail-safe property. The test assertions should be exact (verify exit code 1 and block payload presence) rather than comparative. The comment should scope its claim to what's shown.

**Highest-leverage change before merge:** Replace the comparative test assertions with exact checks: `expect(bad.status).toBe(1)` and verify the stdout contains `"decision":"block"`. This strengthens the oracle without requiring construction of an unmockable throw scenario.

---

STANCE: confirmed-non-expanding | CONFIDENCE: high | DEALBREAKER: no
````

### Reviewer B

````text
The diff preserves the fail-closed boundary. `assertConcernEnvRestored()` still runs before `_reduce(rcs)`, and the new catches apply only to diagnostic work after the verdict. The shown changes leave concern isolation, child-process hardening, authority, and exit-code translation untouched. I agree with Reviewers A and B on that point.

1. **Timing argument evaluation can still throw after the verdict.** At `dispatch_hook.ts:1407`, both `String(...)` calls run before `writeConcernTimings()` enters its internal `try`. Reviewer B correctly flags this. Reviewer A’s JSON argument is incorrect: `String(Symbol())` succeeds, but `String(JSON.parse('{"toString":null}'))` throws because the object has no usable primitive conversion. If earlier normalization guarantees strings for both fields, the path is unreachable. The supplied diff does not establish that invariant or show the subsequent host emission code, so the broader guarantee remains unverified.

2. **The integration tests can pass without proving a refusal reached the host.** In `feedback_containment.test.ts`, `expect(ok.status).not.toBe(0)` accepts `null` and unrelated nonzero exits, and equal stdout can mean two empty outputs. More importantly, the broken directory exercises a reported failure rather than a thrown write. I agree with Reviewer B that the suite needs a dispatcher-level regression for a throw. The closed-stderr test also never observes an attempted write or an `EPIPE`, so it cannot establish the mechanism claimed in its comment. Reviewer A gives it too much credit.

3. **Keep both catch levels and the small helper.** The outer catch protects verdict delivery and lets rule-trip recording proceed if feedback setup throws. The inner catch lets later concerns retain their feedback when one write throws, which is a separate benefit worth preserving. The callback fits the existing procedural code and adds little complexity. At `dispatch_hook.ts:896`, the dynamic label is built before the inner catch, so a coercion failure there would skip later entries even though the outer catch preserves the verdict. That is a minor issue if concern IDs are guaranteed strings. The implementation and its regression belong in one PR, and the diff shows no new security or authority issue.

**REQUEST_CHANGES** — The integration tests can pass without showing that the dispatcher delivers a valid host refusal after the exception this PR is meant to contain.

**Highest-leverage change before merge:** Add one dispatcher-level test that forces the first per-concern write to throw, asserts the exact host-facing exit code and refusal payload, and verifies that a later concern’s feedback was written.
````

## What to answer

1. Does this change weaken a fail-closed guard, an exit-code contract, child-process hardening, or isolation between concerns, or expand any authority?
2. Do the tests now establish that a throwing feedback write cannot stop the verdict? If not, what is missing?
3. Is anything in the diff unnecessary or wrong?

Close your reply with exactly one line in this form, and nothing after it:

`STANCE: <ratified | confirmed-non-expanding | refused> | CONFIDENCE: <high | med | low> | DEALBREAKER: <yes | no>`

Use `ratified` if the change is acceptable as shown. Use `confirmed-non-expanding` if it neither weakens a guard nor expands authority. Use `refused` if it is not acceptable, and give the reason in the text above the line.
