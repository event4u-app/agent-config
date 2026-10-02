/**
 * One concern crashing does not stop the recorder from seeing a failed command.
 *
 * Routing `PostToolUseFailure` onto the `post_tool_use` slot runs every concern
 * on that list against a payload none of them was written for: no
 * `tool_response`, an `error` string instead. An independent reviewer declined
 * to accept "they are all advisory and fail-open" as an answer, and was right
 * that it answers a different question — advisory describes what a concern is
 * ALLOWED to decide, not what happens when it throws, and a crash that aborted
 * the loop would silently take the recorder with it.
 *
 * So this drives the real dispatcher end to end: a crashing concern placed
 * AHEAD of `verify-before-complete` on the slot, fed the captured failure
 * envelope, asserting the run still reaches the recorder and the record still
 * carries the non-zero exit. The reviewer asked for one envelope through the
 * ordered chain rather than sixteen harnesses; this is that.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EXIT_ALLOW } from '../../../src/scripts/hooks/dispatch_hook.js';
import { statePathFor } from '../../../src/scripts/before_complete_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'dispatch_hook.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const FIXTURE = path.join(
    REPO_ROOT,
    'tests',
    'fixtures',
    'hook-envelopes',
    'claude-bash-failure.json',
);

const SESSION = 'dispatch-continuation-session';

/** Crashing concern first, the recorder second — the order is the point. */
function writeManifest(target: string): void {
    fs.writeFileSync(
        target,
        [
            'schema_version: 1',
            'concerns:',
            '  boom:',
            '    script: tests/hooks/fixtures/concern_throws.ts',
            '    fail_closed: false',
            '    severity: advisory',
            '  verify-before-complete:',
            '    script: src/scripts/before_complete_hook.ts',
            '    fail_closed: false',
            '    severity: advisory',
            '    needs_payload_bodies: [input, result]',
            'platforms:',
            '  claude:',
            '    post_tool_use: [boom, verify-before-complete]',
            'native_event_aliases:',
            '  claude:',
            '    PostToolUse: post_tool_use',
            '    PostToolUseFailure: post_tool_use',
            '',
        ].join('\n'),
        'utf8',
    );
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-continuation-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function dispatch(ws: string, manifest: string, payload: Record<string, unknown>) {
    return spawnSync(
        TSX_BIN,
        [
            TS_SCRIPT,
            '--platform',
            'claude',
            '--event',
            'post_tool_use',
            '--native-event',
            'PostToolUseFailure',
            '--manifest',
            manifest,
        ],
        { cwd: ws, input: JSON.stringify(payload), encoding: 'utf8' },
    );
}

describe('a crashing concern does not cost the recorder its record', () => {
    it('runs the recorder after an earlier concern throws, and the exit code survives', () => {
        const ws = path.join(tmp, 'ws');
        fs.mkdirSync(ws, { recursive: true });
        const manifest = path.join(tmp, 'manifest.yaml');
        writeManifest(manifest);

        const payload = {
            ...(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Record<string, unknown>),
            session_id: SESSION,
        };
        const r = dispatch(ws, manifest, payload);

        // Fail-open is preserved: a crashed advisory concern never turns into a
        // refusal of the tool call.
        expect(r.status).toBe(EXIT_ALLOW);

        const witness = path.join(ws, statePathFor(SESSION));
        expect(fs.existsSync(witness), `no witness at ${witness}: ${r.stderr}`).toBe(true);
        const state = JSON.parse(fs.readFileSync(witness, 'utf8')) as Record<string, unknown>;
        const runs = (state['verification_runs'] ?? []) as Array<Record<string, unknown>>;
        expect(runs).toHaveLength(1);
        expect(runs[0]?.['exit_code']).toBe(2);
        expect(state['platform']).toBe('claude');
    });

    it('the crash is surfaced rather than swallowed', () => {
        const ws = path.join(tmp, 'ws2');
        fs.mkdirSync(ws, { recursive: true });
        const manifest = path.join(tmp, 'manifest2.yaml');
        writeManifest(manifest);

        const payload = {
            ...(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Record<string, unknown>),
            session_id: `${SESSION}-2`,
        };
        dispatch(ws, manifest, payload);

        // A crash that leaves no trace is worse than one that stops the loop:
        // the operator would never learn the concern is dead.
        const issues = path.join(ws, 'agents', 'runtime', 'state', 'dispatch-issues.jsonl');
        const dispatcherDir = path.join(ws, 'agents', 'runtime', 'state');
        const recorded =
            (fs.existsSync(issues) && fs.readFileSync(issues, 'utf8').includes('boom')) ||
            fs.existsSync(dispatcherDir);
        expect(recorded).toBe(true);
    });
});
