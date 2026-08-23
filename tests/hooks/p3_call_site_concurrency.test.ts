/**
 * P3 call-site concurrency — the half `p3_state_concurrency.test.ts` cannot see.
 *
 * B1.3 of `road-to-per-turn-hook-economy-carry` asks for P3's and P4's closure to
 * be AUDITED rather than inherited. The audit found the gap this file closes.
 *
 * `p3_state_concurrency.test.ts` proves the lock PRIMITIVE
 * (`update_json_under_lock` / `update_text_under_lock`) — genuinely, with a
 * recorded pre-fix measurement. But two of its three cases drive an inline
 * re-implementation of the mutator inside a worker script; they never import or
 * reach `_record_rule_trips` or the dispatcher's `summary.json` rollup. Measured
 * 2026-08-23 by sabotage: hoisting the rule-trips read back OUTSIDE the lock at
 * its real call site (`dispatch_hook.ts:974`) left all three of those tests
 * GREEN. Only the `dispatch-issues.jsonl` case, which calls the production
 * `log_dispatch_issue`, went RED.
 *
 * So the primitive was pinned and the CALL SITES were not. This file spawns real
 * dispatcher processes and asserts the invariants on the files they write, which
 * is the only arrangement that fails when a call site regresses.
 *
 * Sabotage-proven (2026-08-23), each with a rebuilt bundle:
 *   - `invocations` list replaced by a single-rollup publish → RED, 1 of 8 survived.
 *   - the rule-trips read hoisted back OUTSIDE the lock → the end-to-end count
 *     assertion stayed GREEN, and that is a measured limit worth stating rather
 *     than hiding: eight real dispatchers do not overlap inside a
 *     read-modify-write that takes microseconds. `p3_state_concurrency.test.ts`
 *     reproduces that race only because its inline worker holds the window open
 *     with `Atomics.wait`, and production code carries no such delay and must
 *     not grow one for a test. So the rule-trips call site is pinned
 *     STRUCTURALLY below — which is what B1.3's verify actually asks for ("the
 *     current source shows the lock or the discriminator, with a test that
 *     fails when it is removed") — and the same sabotage takes THAT assertion
 *     RED. The end-to-end count is kept alongside it as a plain
 *     no-lost-increment regression check, not as a race proof.
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const BUNDLE = path.join(REPO_ROOT, 'dist', 'hooks', 'dispatch.js');

/** Eight, matching `p3_state_concurrency.test.ts` so the two read as one suite. */
const DISPATCHES = 8;

/** Recursively collect every `summary.json` under a root. */
function findSummaries(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) walk(p);
            else if (e.name === 'summary.json') out.push(p);
        }
    };
    walk(root);
    return out;
}

/**
 * Fire `DISPATCHES` real dispatchers at one workspace and one session, all
 * carrying the same seeded violation, and return the workspace root.
 *
 * A refusal exits non-zero on this host (host-native 2), so every call is
 * expected to reject; the exit code is asserted in `rule_trips.test.ts` and is
 * not re-asserted here. What matters is that all eight ran.
 */
async function runConcurrentDispatches(workspace: string): Promise<number> {
    const payload = JSON.stringify({
        session_id: 'p3-call-site',
        cwd: workspace,
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'git commit --no-verify -m x' },
    });
    // `spawn`, not `execFile`: `execFile` has no `input` option, so the payload
    // would never reach stdin and every dispatch would take the no-envelope
    // path — a different code path with a per-invocation session slot, which is
    // exactly the false red this test hit on its first run.
    const runs = Array.from({ length: DISPATCHES }, async () => {
        await new Promise<void>((resolve) => {
            const child = spawn(
                process.execPath,
                [
                    BUNDLE,
                    '--platform',
                    'claude',
                    '--event',
                    'pre_tool_use',
                    '--project-dir',
                    workspace,
                ],
                { stdio: ['pipe', 'ignore', 'ignore'] },
            );
            // A refusal exits non-zero; `close` resolves either way.
            child.on('close', () => {
                resolve();
            });
            child.on('error', () => {
                resolve();
            });
            child.stdin.end(payload);
        });
        return 1;
    });
    return (await Promise.all(runs)).length;
}

describe('P3 call site — rule-trips increments survive concurrent dispatchers', () => {
    it('loses no trip across 8 real concurrent dispatches', async () => {
        if (!fs.existsSync(BUNDLE)) {
            console.warn('dist/hooks/dispatch.js missing — run `npm run build:hooks`; skipping');
            return;
        }
        const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-p3-cs-'));
        try {
            expect(await runConcurrentDispatches(workspace)).toBe(DISPATCHES);

            const target = path.join(workspace, 'agents', 'runtime', 'state', 'rule-trips.json');
            expect(fs.existsSync(target)).toBe(true);
            const doc = JSON.parse(fs.readFileSync(target, 'utf-8')) as {
                concerns: Record<string, { block: number }>;
            };
            // Every dispatch tripped the same concern exactly once. A read
            // outside the lock loses increments; this is the assertion that
            // sees it.
            expect(doc.concerns['block-no-verify']?.block).toBe(DISPATCHES);
        } finally {
            fs.rmSync(workspace, { recursive: true, force: true });
        }
    }, 60_000);
});

describe('P3 call site — summary.json retains every concurrent invocation', () => {
    it('keeps one rollup per dispatch across 8 real concurrent dispatches', async () => {
        if (!fs.existsSync(BUNDLE)) {
            console.warn('dist/hooks/dispatch.js missing — run `npm run build:hooks`; skipping');
            return;
        }
        const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-p3-cs2-'));
        try {
            expect(await runConcurrentDispatches(workspace)).toBe(DISPATCHES);

            const summaries = findSummaries(workspace);
            // One session → one summary file. Two would mean the per-session
            // path fanned out, which is a different defect and worth failing on.
            expect(summaries.length).toBe(1);
            const doc = JSON.parse(fs.readFileSync(summaries[0]!, 'utf-8')) as {
                schema_version: number;
                invocations: { invocation: string }[];
            };
            expect(doc.schema_version).toBe(2);
            // A singular publish keeps the LAST rollup only. The capped list
            // keeps all eight, since 8 < SUMMARY_INVOCATION_CAP (20).
            expect(doc.invocations.length).toBe(DISPATCHES);
            // The discriminator has to actually discriminate: eight rollups
            // sharing one id would satisfy a length check and prove nothing.
            expect(new Set(doc.invocations.map((i) => i.invocation)).size).toBe(DISPATCHES);
        } finally {
            fs.rmSync(workspace, { recursive: true, force: true });
        }
    }, 60_000);
});

describe('P3 call site — the rule-trips read sits inside the lock', () => {
    /**
     * A structural pin, and deliberately so. The defect P3 closed is a read
     * OUTSIDE `update_json_under_lock` whose value is then incremented inside
     * it; the observable consequence needs two writers inside one microsecond
     * window, which real dispatchers do not supply (see the header note). What
     * is decidable without a race is the shape: the mutator's `loaded` must be
     * the callback's own parameter, and nothing may pre-read the target above
     * it.
     *
     * Sabotage-proven 2026-08-23: hoisting the read to a `_pre` const above the
     * lock and shadowing `loaded` with it takes this RED.
     */
    it('reads no rule-trips state above the lock, and increments from the callback parameter', () => {
        const src = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'dispatch_hook.ts'),
            'utf-8',
        );
        const start = src.indexOf('function _record_rule_trips');
        expect(start, '_record_rule_trips not found — the audit anchor moved').toBeGreaterThan(-1);
        // Bound the slice at the next top-level declaration so the assertions
        // cannot drift into a neighbouring function.
        // Bound at the function's own closing brace at column 0, not at the
        // next doc comment: the first attempt used `\n/**` and the slice ran
        // past the function into a neighbour that legitimately calls
        // `readFileSync`, which is a false red rather than a finding.
        const after = src.indexOf('\n}\n', start);
        expect(after, 'no column-0 closing brace after the anchor').toBeGreaterThan(start);
        const raw = src.slice(start, after);
        // Comments must be stripped before asserting on absence: this function's
        // own comment explains the pre-fix shape and names `readFileSync`
        // verbatim, so a naive substring check on the raw body is red against
        // correct code. Second false red of this test's construction, kept
        // documented so a later edit does not reintroduce it.
        const body = raw
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .split('\n')
            .map((l) => l.replace(/\/\/.*$/, ''))
            .join('\n');

        // The lock is present and the target is read through its callback.
        expect(body).toContain('update_json_under_lock<JsonObject>(target, (loaded) =>');
        // Nothing reads the target before the lock. `readFileSync` anywhere in
        // this function is the exact pre-fix shape.
        expect(body).not.toContain('readFileSync');
    });
});
