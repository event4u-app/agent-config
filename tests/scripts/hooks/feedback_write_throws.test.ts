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
