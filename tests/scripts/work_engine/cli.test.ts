// Golden-parity tests for work_engine/cli.ts vs cli.py (ADR-096 py2ts Phase 1 —
// work_engine TOP/integration layer).
//
// `cli.py` is the work-engine CLI entry point (argparse). Both engines are
// driven as subprocesses on identical fixtures in identical temp CWDs, and the
// (exit code, stdout, stderr, persisted-state-file bytes) are compared
// byte-for-byte. The argparse `--help` prose is NOT a parity surface (ADR-096);
// only the exit code + the `usage:` token are asserted there.
//
// Python runs through the real `work_engine` package on sys.path; TS runs via
// `tsx -e` importing `cli.ts::main`. Hooks are disabled (`--no-hooks`) so the
// transport surface stays byte-stable independent of any settings file.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SCRIPTS_ROOT = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const CLI_TS = path.join(SCRIPTS_ROOT, 'work_engine', 'cli.ts');
const TSX_BIN = process.env['TSX_BIN'] ?? path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

interface Run {
    status: number;
    stdout: string;
    stderr: string;
}

/** Run the Python CLI in `cwd` with `argv`. */
function runPy(cwd: string, argv: string[]): Run {
    const code = [
        'import sys',
        `sys.path.insert(0, ${JSON.stringify(SCRIPTS_ROOT)})`,
        'from work_engine.cli import main',
        'sys.exit(main(sys.argv[1:]))',
    ].join('\n');
    const r = spawnSync('python3', ['-c', code, ...argv], { encoding: 'utf8', cwd });
    return { status: r.status ?? 0, stdout: r.stdout, stderr: r.stderr };
}

/**
 * Run the TS CLI (via tsx) in `cwd` with `argv`.
 *
 * `tsx -e <code> -- <args>` does not forward the trailing args into
 * `process.argv` (they are consumed by the `--` separator), so instead a tiny
 * runner `.ts` file is written into `cwd` and invoked with the argv directly —
 * which forwards `--help` and friends verbatim. The runner is `_`-prefixed and
 * lives only inside the per-test temp dir, so it never pollutes the state-file
 * comparison.
 */
function runTs(cwd: string, argv: string[]): Run {
    const runner = path.join(cwd, '_cli_runner.ts');
    const code = [
        `import { main } from ${JSON.stringify(CLI_TS)};`,
        'const rc = main(process.argv.slice(2));',
        'process.exitCode = rc;',
        '',
    ].join('\n');
    fs.writeFileSync(runner, code, 'utf-8');
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
    tmpPy = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-py-'));
    tmpTs = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-ts-'));
});
afterEach(() => {
    fs.rmSync(tmpPy, { recursive: true, force: true });
    fs.rmSync(tmpTs, { recursive: true, force: true });
});

const py = hasPython3();
const describeParity = py ? describe : describe.skip;

/** Write the same ticket fixture into both CWDs. */
function seedTicket(filename: string, payload: unknown): void {
    fs.writeFileSync(path.join(tmpPy, filename), JSON.stringify(payload), 'utf-8');
    fs.writeFileSync(path.join(tmpTs, filename), JSON.stringify(payload), 'utf-8');
}

function readStateMaybe(dir: string, name = '.work-state.json'): string | null {
    const p = path.join(dir, name);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null;
}

describeParity('cli main — full transport parity', () => {
    it('fresh ticket run halts BLOCKED at refine (exit 1) — same stdout + state', () => {
        // A ticket with a trivial title trips the refine deficiency gate →
        // BLOCKED at the first step. Deterministic, no agent directive needed.
        seedTicket('ticket.json', { id: 'T-1', title: 'x' });
        const pyR = runPy(tmpPy, ['--no-hooks', '--ticket-file', 'ticket.json']);
        const tsR = runTs(tmpTs, ['--no-hooks', '--ticket-file', 'ticket.json']);

        expect(tsR.status).toBe(pyR.status);
        expect(tsR.stdout).toBe(pyR.stdout);
        // The persisted state file must be byte-identical (v0 wire format).
        expect(readStateMaybe(tmpTs)).toBe(readStateMaybe(tmpPy));
    });

    it('missing input (no state file, no flags) → exit 2 + error on stderr', () => {
        const pyR = runPy(tmpPy, ['--no-hooks']);
        const tsR = runTs(tmpTs, ['--no-hooks']);
        expect(tsR.status).toBe(2);
        expect(pyR.status).toBe(2);
        expect(tsR.stderr).toBe(pyR.stderr);
        // No state file written on the error path.
        expect(readStateMaybe(tmpTs)).toBeNull();
        expect(readStateMaybe(tmpPy)).toBeNull();
    });

    it('non-object ticket file → exit 2 + identical error text', () => {
        seedTicket('bad.json', [1, 2, 3]);
        const pyR = runPy(tmpPy, ['--no-hooks', '--ticket-file', 'bad.json']);
        const tsR = runTs(tmpTs, ['--no-hooks', '--ticket-file', 'bad.json']);
        expect(tsR.status).toBe(2);
        expect(pyR.status).toBe(2);
        expect(tsR.stderr).toBe(pyR.stderr);
    });

    it('resumes a v1 state file to SUCCESS (exit 0) — same report + state', () => {
        // Pre-seed a v1 state file with every step already marked success so the
        // dispatcher walks straight to SUCCESS and prints the stored report.
        const v1 = {
            version: 1,
            input: { kind: 'ticket', data: { id: 'T-9', title: 'Resume me' } },
            intent: 'backend-coding',
            directive_set: 'backend',
            stack: null,
            ui_audit: null,
            ui_design: null,
            ui_review: null,
            ui_polish: null,
            contract: null,
            stitch: null,
            halts: [],
            persona: 'senior-engineer',
            memory: [],
            plan: null,
            changes: [],
            tests: null,
            verify: null,
            outcomes: {
                refine: 'success',
                memory: 'success',
                analyze: 'success',
                plan: 'success',
                implement: 'success',
                test: 'success',
                verify: 'success',
                report: 'success',
            },
            questions: [],
            report: 'DELIVERY REPORT BODY',
        };
        fs.writeFileSync(path.join(tmpPy, '.work-state.json'), JSON.stringify(v1, null, 2) + '\n', 'utf-8');
        fs.writeFileSync(path.join(tmpTs, '.work-state.json'), JSON.stringify(v1, null, 2) + '\n', 'utf-8');

        const pyR = runPy(tmpPy, ['--no-hooks']);
        const tsR = runTs(tmpTs, ['--no-hooks']);
        expect(tsR.status).toBe(pyR.status);
        expect(tsR.stdout).toBe(pyR.stdout);
        expect(readStateMaybe(tmpTs)).toBe(readStateMaybe(tmpPy));
    });
});

describeParity('cli main — argparse exit codes', () => {
    it('--help exits 0 (prose not byte-compared; usage token only)', () => {
        const pyR = runPy(tmpPy, ['--help']);
        const tsR = runTs(tmpTs, ['--help']);
        expect(tsR.status).toBe(0);
        expect(pyR.status).toBe(0);
        expect(tsR.stdout.startsWith('usage:')).toBe(true);
        expect(pyR.stdout.startsWith('usage:')).toBe(true);
    });

    it('unrecognized flag exits 2', () => {
        const pyR = runPy(tmpPy, ['--no-such-flag']);
        const tsR = runTs(tmpTs, ['--no-such-flag']);
        expect(tsR.status).toBe(2);
        expect(pyR.status).toBe(2);
    });
});
