// Golden-parity tests for work_engine/__main__.ts vs __main__.py (ADR-096 py2ts
// Phase 1 — work_engine TOP/integration layer).
//
// `__main__.py` is the thin `python3 -m work_engine` entry shim: it imports
// `cli.main`, runs it, and exits with its return code. The twin sets
// `process.exitCode = main()`. Both are run as subprocesses in identical temp
// CWDs; the exit code + stdout + stderr are compared. The argv-passing path
// mirrors the cli test (a runner file forwards argv into the module).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { oracle2 } from '../../_lib/parity_oracle';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SCRIPTS_ROOT = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const MAIN_TS = path.join(SCRIPTS_ROOT, 'work_engine', '__main__.ts');
const TSX_BIN = process.env['TSX_BIN'] ?? path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

interface Run {
    status: number;
    stdout: string;
    stderr: string;
}

/**
 * Frozen Python-side result of `python3 -m work_engine ...argv`.
 *
 * The Python module is spawned in `cwd` (a per-test tmp dir) with
 * `PYTHONPATH=SCRIPTS_ROOT` so `work_engine` resolves. `oracle2` keys on
 * `kind:'module'` + the module name + PYTHONPATH (basename-stabilised) + argv,
 * NOT the volatile tmp `cwd` — the module's observable output here is
 * cwd-independent (BLOCKED stdout / arg-error stderr), so no `normalize` is
 * needed. Capture spawns python3 once; normal reads the frozen snapshot.
 */
function runPy(cwd: string, argv: string[]): Run {
    const r = oracle2({
        kind: 'module',
        target: 'work_engine',
        args: argv,
        env: { PYTHONPATH: SCRIPTS_ROOT },
        cwd,
    });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/**
 * Run the TS `__main__` entry. `__main__.ts` calls `main()` with no argv (it
 * reads `process.argv.slice(2)` inside `main`), so a runner file imports it
 * after the real argv is in place — the import side-effect runs the entry.
 */
function runTs(cwd: string, argv: string[]): Run {
    const runner = path.join(cwd, '_main_runner.ts');
    fs.writeFileSync(runner, `import ${JSON.stringify(MAIN_TS)};\n`, 'utf-8');
    try {
        const r = spawnSync('node', [TSX_BIN, runner, ...argv], { encoding: 'utf8', cwd });
        return { status: r.status ?? 0, stdout: r.stdout, stderr: r.stderr };
    } finally {
        fs.rmSync(runner, { force: true });
    }
}

let tmpPy: string;
let tmpTs: string;
beforeEach(() => {
    tmpPy = fs.mkdtempSync(path.join(os.tmpdir(), 'main-py-'));
    tmpTs = fs.mkdtempSync(path.join(os.tmpdir(), 'main-ts-'));
});
afterEach(() => {
    fs.rmSync(tmpPy, { recursive: true, force: true });
    fs.rmSync(tmpTs, { recursive: true, force: true });
});

const py = hasPython3();
const describeParity = py ? describe : describe.skip;

describeParity('__main__ — entry-point parity', () => {
    it('no input → exit 2 + identical stderr', () => {
        const pyR = runPy(tmpPy, ['--no-hooks']);
        const tsR = runTs(tmpTs, ['--no-hooks']);
        expect(tsR.status).toBe(2);
        expect(pyR.status).toBe(2);
        expect(tsR.stderr).toBe(pyR.stderr);
    });

    it('fresh ticket → BLOCKED exit 1 + identical stdout', () => {
        const fixture = JSON.stringify({ id: 'T-1', title: 'x' });
        fs.writeFileSync(path.join(tmpPy, 'ticket.json'), fixture, 'utf-8');
        fs.writeFileSync(path.join(tmpTs, 'ticket.json'), fixture, 'utf-8');
        const pyR = runPy(tmpPy, ['--no-hooks', '--ticket-file', 'ticket.json']);
        const tsR = runTs(tmpTs, ['--no-hooks', '--ticket-file', 'ticket.json']);
        expect(tsR.status).toBe(pyR.status);
        expect(tsR.stdout).toBe(pyR.stdout);
    });
});

describe('__main__ — runs the entry without throwing', () => {
    it('TS entry executes and yields a numeric exit code', () => {
        const tsR = runTs(tmpTs, ['--no-hooks']);
        expect(typeof tsR.status).toBe('number');
    });
});
