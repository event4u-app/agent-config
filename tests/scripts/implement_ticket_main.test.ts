// Golden-parity tests for the py2ts `implement_ticket/__main__` entry shim
// (ADR-200, Python→TypeScript migration).
//
// `implement_ticket/__main__.py` is a 15-line deprecated entry point: it
// imports `main` from `work_engine.cli`, runs it, and exits with the returned
// code (`sys.exit(main())`). The twin sets `process.exitCode = main()` from the
// shipped `work_engine` CLI twin. This test exercises the ENTRYPOINT contract —
// it imports, runs, and propagates the exit code / stdout / stderr of the
// delegated `cli.main` 1:1 — by running BOTH in identical clean temp cwds:
//   - `python3 -m implement_ticket [argv]` (the pinned Golden-Transcript
//     invocation; the package `__init__` deprecation aliases are import-time
//     side effects with no observable `-m` stdout/stderr),
//   - `tsx implement_ticket/__main__.ts [argv]`,
// comparing exit + stdout + stderr byte-for-byte (mirrors the sibling
// `work_engine/__main__.test.ts` model).
//
// Scope: only the entry-shim's delegate-and-propagate behaviour. The argument
// PARSING / `--help` banner lives in the `work_engine/cli` twin (covered by
// `work_engine/cli.test.ts`), not here — so the cases below drive argv that
// the shim forwards verbatim and that `cli.main` resolves deterministically
// (a clean cwd has no `.work-state.json`, so the error / halt outputs are
// stable). COLUMNS pinned to 80; no real repo state is touched.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// tests/scripts/implement_ticket_main.test.ts → two up is the repo root.
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SCRIPTS_ROOT = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const MAIN_TS = path.join(SCRIPTS_ROOT, 'implement_ticket', '__main__.ts');
const TSX_BIN =
    process.env['TSX_BIN'] ??
    path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function env(): NodeJS.ProcessEnv {
    return { ...process.env, COLUMNS: '80', PYTHONPATH: SCRIPTS_ROOT };
}

/** `python3 -m implement_ticket` semantics in `cwd` with `argv`. */
function runPy(cwd: string, argv: string[]): SpawnSyncReturns<string> {
    return spawnSync('python3', ['-m', 'implement_ticket', ...argv], { cwd, env: env(), encoding: 'utf8' });
}

/** `tsx implement_ticket/__main__.ts` in `cwd` with `argv`. */
function runTs(cwd: string, argv: string[]): SpawnSyncReturns<string> {
    return spawnSync(TSX_BIN, [MAIN_TS, ...argv], { cwd, env: env(), encoding: 'utf8' });
}

const py3 = hasPython3();

describe.runIf(py3)('implement_ticket/__main__ — entry-shim golden parity (python3 vs tsx)', () => {
    let cwd: string;
    beforeEach(() => {
        // A pristine cwd → no `.work-state.json`, so cli.main's initial-state
        // resolution is deterministic on both engines.
        cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'it-main-'));
    });
    afterEach(() => {
        fs.rmSync(cwd, { recursive: true, force: true });
    });

    /** Compare exit + stdout + stderr of the two delegated runs in the SAME argv. */
    function expectMatch(argv: string[]): { status: number | null } {
        const py = runPy(cwd, argv);
        const ts = runTs(cwd, argv);
        const label = JSON.stringify(argv);
        expect(ts.status, `exit ${label}`).toBe(py.status);
        expect(ts.stdout, `stdout ${label}`).toBe(py.stdout);
        expect(ts.stderr, `stderr ${label}`).toBe(py.stderr);
        return { status: py.status };
    }

    it('no args: delegates to cli.main → exit 2 + identical "no state file" error', () => {
        const { status } = expectMatch([]);
        // Sanity: the shim really propagated cli.main's failure code, not 0.
        expect(status).toBe(2);
    });

    it('--prompt-file: delegates, builds initial state, propagates the halt exit identically', () => {
        fs.writeFileSync(path.join(cwd, 'p.txt'), 'improve the thing\n', 'utf-8');
        const { status } = expectMatch(['--prompt-file', 'p.txt']);
        // cli.main halts at refine and returns a non-zero code; the shim forwards it.
        expect(status).toBe(1);
        // Both engines wrote the SAME initial state file via the delegated cli.
        // (The py run wrote it last — re-run TS into a fresh cwd to compare bytes.)
        const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'it-state-'));
        try {
            fs.writeFileSync(path.join(fresh, 'p.txt'), 'improve the thing\n', 'utf-8');
            const pyRun = runPy(fresh, ['--prompt-file', 'p.txt']);
            expect(pyRun.status).toBe(1);
            const pyState = fs.readFileSync(path.join(fresh, '.work-state.json'), 'utf-8');
            fs.rmSync(path.join(fresh, '.work-state.json'));
            const tsRun = runTs(fresh, ['--prompt-file', 'p.txt']);
            expect(tsRun.status).toBe(1);
            const tsState = fs.readFileSync(path.join(fresh, '.work-state.json'), 'utf-8');
            expect(tsState, 'delegated .work-state.json bytes').toBe(pyState);
        } finally {
            fs.rmSync(fresh, { recursive: true, force: true });
        }
    });
});
