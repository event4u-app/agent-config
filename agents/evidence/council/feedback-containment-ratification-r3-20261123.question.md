<!-- evidence-type: analysis -->
<!-- check-refs: skip -->

# Ratification review — every post-verdict diagnostic in the hook dispatcher is contained — round 3

You are an independent reviewer for a change in the `event4u/agent-config` repository. Gated files: `src/scripts/hooks/dispatch_hook.ts` and `src/scripts/hooks/feedback_policy.ts`. Under ADR-268 § 4 an edit to hook plumbing needs a two-provider verdict.

subject: 64594b04c379bec86a0e466ad43c23cf4cee7725d3ed8f3767b98be10f5809cb

(The gate's digest over the two gated files at the change's head, base `origin/main` at `bffe05c3fe`. Rounds 1 and 2 reviewed an earlier subject; their prompts are `agents/evidence/council/feedback-containment-ratification-r1-20261123.question.md` and `…-r2-20261123.question.md`.)

## What changed since round 2

One reviewer asked that `writeConcernTimings(...)`, including its argument evaluation, run inside the containment helper. It now does, so all three post-verdict diagnostics (`writeConcernTimings`, `_write_feedback`, `_record_rule_trips`) run inside `containFeedback`. The in-process dispatcher test now also makes `writeConcernTimings` throw and asserts the containment report for it, alongside the throwing per-concern write. The closed-stderr test's inline comment no longer claims every write hits EPIPE.

Results: hook suites 108 files, 2033 tests passing; `tsc --noEmit` clean; eslint clean on the changed files.

## The diff to the gated files, complete

````diff
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index f190f57be1..392ecedc51 100644
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
 
@@ -1402,9 +1404,12 @@ export function main(argv?: string[]): number {
   }
   assertConcernEnvRestored(); // a failed restore refuses rather than allowing on a dirty process
   const final_rc = _reduce(rcs);
-  writeConcernTimings(String(envelope["event"] ?? ""), String(envelope["platform"] ?? ""), timing_samples);
-  _write_feedback(envelope, session_id, feedback_entries, final_rc, started_at);
-  _record_rule_trips(envelope, feedback_entries);
+  // The verdict is computed; no diagnostic write may stop it reaching the host.
+  containFeedback("timing record", () =>
+    writeConcernTimings(String(envelope["event"] ?? ""), String(envelope["platform"] ?? ""), timing_samples),
+  );
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
import type * as ConcernTimings from '../../../src/scripts/hooks/concern_timings.js';

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

vi.mock('../../../src/scripts/hooks/concern_timings.js', async (orig) => ({
    ...(await orig<typeof ConcernTimings>()),
    writeConcernTimings: () => {
        throw new Error('injected timing failure');
    },
}));

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
        expect(err.join('')).toContain('timing record failed: injected timing failure');
        const dir = feedback_dir(path.join(tmp, 'agents', 'runtime', 'state'), 'throws');
        expect(fs.existsSync(path.join(dir, 'guard.json'))).toBe(false);
        expect(JSON.parse(fs.readFileSync(path.join(dir, 'later.json'), 'utf8'))).toMatchObject({ concern: 'later', reason: 'fixture allow' });
    });
});
````

## Round 2 replies, verbatim except their stance lines

### Reviewer A

````text
## Independent Review – Round 2

### Agreement with Round 1 Reviewers

**Reviewer A (ratified | high | no):**
- ✓ Implementation was always technically correct
- ✓ Test suite gaps existed in round 1
- ✓ The new `feedback_write_throws.test.ts` closes those gaps
- ✓ The two-level wrapping serves distinct, valuable purposes

**Reviewer B (REQUEST_CHANGES):**
- ✓ The `String()` conversions at line 1407 run outside containment
- ✓ Round 1 tests didn't exercise the throw path
- ✓ The dispatcher-level test with actual throw was needed
- ⚠️ However: the timing conversions are safe in practice (see below)

### New Points and Refinements

1. **The new test directly proves the core property.** `feedback_write_throws.test.ts` mocks `update_json_under_lock` to throw for `guard.json`, runs the real `main`, asserts exit code 2 (Claude's refusal code), verifies the fixture's refusal reason on stderr, and confirms the later concern's feedback was written. This is exactly what Reviewer B requested in round 1.

2. **The timing conversions are theoretically unprotected but practically safe.** At line 1407, `String(envelope["event"] ?? "")` and `String(envelope["platform"] ?? "")` evaluate before `writeConcernTimings` enters its internal protection. However, `envelope` is JSON-parsed from stdin early in `main`. JSON.parse produces standard objects without custom toString/valueOf methods. `String(undefined)`, `String(null)`, `String("text")`, `String(123)` all succeed. The only way `String(x)` throws is if `x` has a throwing conversion method, which JSON.parse never creates. This is safe by invariant, though that invariant isn't stated.

3. **The comment's scope is broader than necessary.** Line 1408 claims "no diagnostic write may stop it reaching the host", but the PR title is "every post-verdict feedback write ... is contained". The timing write isn't feedback—it's a separate diagnostic. The implemented scope (feedback writes and rule-trip recording) matches the title and is fully protected by the tests.

4. **Test mutation adds confidence.** The claim that removing both containment wrappers causes the throw test to fail validates that the mechanism is necessary and working. The end-to-end assertions are now exact (exit code 2, refusal reason present) rather than comparative.

### Question Answers

**Q1: Does this weaken guards or expand authority?**
No. All changes occur after line 1405 where `_reduce(rcs)` computes the verdict. The containment affects only diagnostic writes. Concern isolation (`assertConcernEnvRestored`), child-process hardening, fail-closed behavior, and authority boundaries are untouched.

**Q2: Do tests establish throwing write cannot stop verdict?**
Yes. The new test forces a per-concern write to throw, confirms the refusal reaches the host (exit 2 + reason on stderr), and verifies later feedback survives. The unit tests prove `containFeedback` swallows exceptions. The end-to-end test proves an unusable state tree doesn't prevent verdict delivery. Together, these establish the property for the stated scope: feedback writes.

**Q3: Is anything unnecessary or wrong?**
No fundamental issues. Minor observations:
- Line 896: `String(entry["concern"])` outside inner try is safe (internal data)
- Line 1407: Timing conversions outside containment are safe by JSON invariant
- The comment could note that timing is covered by internal protection, not these wrappers

### Shipping Risk and Upside

**Risk:** Low. Defensive error handling with comprehensive test coverage. No authority changes, no complexity increase. The pattern is straightforward.

**Upside:** This unblocks ratification of a critical safety property. Ensures hosts receive computed verdicts even when diagnostic infrastructure fails (disk full, permission errors, concurrent locks). The two-level wrapping means partial feedback survives when one concern's write fails, valuable for debugging.

### Verdict Reasoning

The stated property—feedback writes cannot prevent verdict delivery—is established. The implementation is correct, the tests prove the mechanism, and the change strengthens fail-safe behavior without touching security boundaries. The timing conversions are outside the wrapped scope but safe by JSON invariant. Wrapping them would be belt-and-suspenders safety, appropriate for a follow-up but not blocking: they're not feedback writes (the PR's stated scope) and they're safe in practice.

The highest-leverage improvement would be moving `writeConcernTimings(...)` inside a containment wrapper for completeness, but this is refinement, not correction. The core property is proven.

[stance line omitted in this quote]
````

### Reviewer B

````text
The new regression proves that a thrown per-concern feedback write preserves the Claude refusal and lets the next concern’s write run. The dispatcher still has an unguarded timing call between verdict computation and host delivery, so the broader guarantee in the new comment is unsupported.

1. **Post-verdict timing can still interrupt delivery.** At `dispatch_hook.ts:1406–1410`, `writeConcernTimings(...)` and both `String(...)` conversions run outside containment. I agree with Reviewer B that the excerpt establishes neither that the inputs are already strings nor that the timing writer cannot throw. An exception there would bypass both new wrappers. I disagree with Reviewer A that the comment accurately scopes the guarantee.
2. **The throw regression covers the inner catch.** In `feedback_write_throws.test.ts`, the real `main` returns `2`, stderr contains the fixture’s refusal reason and the injected error report, `guard.json` is absent, and `later.json` contains the expected feedback. I agree with Reviewer A that this closes the original regression gap and with Reviewer B that it does not independently exercise a throw during feedback setup or rule-trip recording. The unusable-directory test verifies the subprocess’s refusal, but it does not establish that either operation threw. The inline comment beside `child.stderr.destroy()` also still claims every write hits `EPIPE`, which the test does not observe.
3. **The change is cohesive and preserves the visible security boundaries.** `assertConcernEnvRestored()` still runs before `_reduce(rcs)`, and the diff makes no changes to authorization, child-process hardening, concern isolation, or exit-code translation. The small callback helper fits the procedural code. The inner catch preserves later entries, while the outer catches protect verdict delivery from failures in feedback setup and rule-trip recording. The tests belong in the same PR.

**REQUEST_CHANGES** — The dispatcher still runs timing diagnostics outside containment after computing the verdict, leaving a path that can prevent host delivery. The highest-leverage change is to put the entire `writeConcernTimings(...)` statement, including argument evaluation, inside the existing containment helper.
````

## What to answer

1. Does this change weaken a fail-closed guard, an exit-code contract, child-process hardening, or isolation between concerns, or expand any authority?
2. After this change, can any call between `_reduce(rcs)` and host emission in `main` still throw out of `main`? Name it if so.
3. Is anything in the diff unnecessary or wrong?

Close your reply with exactly one line in this form, and nothing after it:

`STANCE: <ratified | confirmed-non-expanding | refused> | CONFIDENCE: <high | med | low> | DEALBREAKER: <yes | no>`

Use `ratified` if the change is acceptable as shown. Use `confirmed-non-expanding` if it neither weakens a guard nor expands authority. Use `refused` if it is not acceptable, and give the reason in the text above the line.
