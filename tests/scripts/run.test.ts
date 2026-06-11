// Tests for the migration dispatch wrapper src/scripts/run.ts
// (py2ts Phase 1, Step 4). Each test spawns the dispatcher via tsx as a
// real child process and asserts on the observable contract: resolution
// order, argv passthrough, channel fidelity, exit-code propagation, stdin
// passthrough, and the missing-script error path.
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN = join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const DISPATCHER = join(REPO_ROOT, 'src', 'scripts', 'run.ts');
const FIXTURES = 'tests/fixtures/dispatcher';

interface DispatchResult {
    readonly status: number | null;
    readonly stdout: string;
    readonly stderr: string;
}

function dispatch(args: readonly string[], input?: string): DispatchResult {
    const result = spawnSync(TSX_BIN, [DISPATCHER, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        ...(input !== undefined ? { input } : {}),
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('src/scripts/run.ts dispatcher', () => {
    it('prefers the .ts version when both .ts and .py exist', () => {
        const result = dispatch([`${FIXTURES}/pair`]);
        expect(result.status).toBe(0);
        expect(result.stdout).toBe('ts:pair\n');
        expect(result.stderr).toBe('');
    });

    it('falls back to .py via python3 when only .py exists', () => {
        const result = dispatch([`${FIXTURES}/pyonly`]);
        expect(result.status).toBe(0);
        expect(result.stdout).toBe('py:[]\n');
        expect(result.stderr).toBe('');
    });

    it('passes argv through verbatim to a .ts script', () => {
        const args = ['hello', '--flag=value', 'two words', '--', '-x'];
        const result = dispatch([`${FIXTURES}/tsonly`, ...args]);
        expect(result.status).toBe(0);
        expect(result.stdout).toBe(`ts:${JSON.stringify(args)}\n`);
    });

    it('passes argv through verbatim to a .py script', () => {
        const args = ['a b', '--snake_case-flag', '3'];
        const result = dispatch([`${FIXTURES}/pyonly`, ...args]);
        expect(result.status).toBe(0);
        expect(result.stdout).toBe(`py:${JSON.stringify(args)}\n`);
    });

    it('keeps stdout/stderr on their channels and propagates the exit code', () => {
        const result = dispatch([`${FIXTURES}/channels`, '3']);
        expect(result.status).toBe(3);
        expect(result.stdout).toBe('to-stdout\n');
        expect(result.stderr).toBe('to-stderr\n');
    });

    it('propagates exit code 0 unchanged', () => {
        const result = dispatch([`${FIXTURES}/channels`, '0']);
        expect(result.status).toBe(0);
    });

    it('passes stdin through to the child', () => {
        const result = dispatch([`${FIXTURES}/stdin_echo`], 'hello from stdin\n');
        expect(result.status).toBe(0);
        expect(result.stdout).toBe('stdin:hello from stdin\n');
    });

    it('resolves an absolute script path', () => {
        const absolute = join(REPO_ROOT, FIXTURES, 'pair');
        const result = dispatch([absolute]);
        expect(result.status).toBe(0);
        expect(result.stdout).toBe('ts:pair\n');
    });

    it('exits 127 and names both candidates when no script exists', () => {
        const missing = `${FIXTURES}/does_not_exist`;
        const result = dispatch([missing]);
        expect(result.status).toBe(127);
        expect(result.stdout).toBe('');
        expect(result.stderr).toContain(join(REPO_ROOT, `${missing}.ts`));
        expect(result.stderr).toContain(join(REPO_ROOT, `${missing}.py`));
    });

    it('exits 2 with usage when no script path is given', () => {
        const result = dispatch([]);
        expect(result.status).toBe(2);
        expect(result.stderr).toContain('Usage:');
    });
});
