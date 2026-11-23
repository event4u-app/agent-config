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
