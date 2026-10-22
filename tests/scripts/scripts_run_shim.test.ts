import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHIM = join(REPO_ROOT, 'scripts-run');

interface Run {
    pid: number;
    code: number | null;
    stdout: string;
    stderr: string;
}

const run = (args: string[], input = ''): Promise<Run> =>
    new Promise((resolve) => {
        const child = spawn(SHIM, args, { cwd: '/' });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (c: Buffer) => (stdout += c.toString()));
        child.stderr.on('data', (c: Buffer) => (stderr += c.toString()));
        child.on('close', (code) => resolve({ pid: child.pid ?? -1, code, stdout, stderr }));
        child.stdin.end(input);
    });

describe('scripts-run — one tsx boot, unchanged pass-through', () => {
    it('passes argv, stdin, stdout, stderr and the exit code through, from any cwd', async () => {
        const r = await run(['tests/fixtures/scripts_run_shim/echo', '3', 'a b'], 'in');
        expect(r.code).toBe(3);
        expect(JSON.parse(r.stdout)).toMatchObject({ argv: ['3', 'a b'], stdin: 'in' });
        expect(r.stderr).toContain('to-stderr');
    });

    it('runs the script under the tsx it exec-ed into, not under a second tsx', async () => {
        // bash execs tsx, so the spawned pid IS tsx; tsx's own child runs the
        // script. Through run.ts there is a node process in between.
        const r = await run(['tests/fixtures/scripts_run_shim/echo', '0']);
        expect(JSON.parse(r.stdout).ppid).toBe(r.pid);
    });

    it('still exits 127 with the run.ts message for a missing script', async () => {
        const r = await run(['tests/fixtures/scripts_run_shim/does_not_exist']);
        expect(r.code).toBe(127);
        expect(r.stderr).toContain('no script found');
    });
});
