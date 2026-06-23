// Intent tests for the py2ts `implement_ticket/__main__` entry shim (ADR-200).
//
// `implement_ticket/__main__.ts` is the deprecated entry point: it imports
// `main` from the shipped `work_engine` CLI twin, runs it, and propagates the
// returned exit code. The python twin is gone (py2ts teardown), so these assert
// the tsx twin's OWN delegate-and-propagate contract directly — the same
// surface the former byte-parity rig exercised:
//   - it forwards argv to `cli.main` and propagates its exit code 1:1,
//   - with no state file and no input flag, cli.main fails (exit 2),
//   - with `--prompt-file`, cli.main builds the initial `.work-state.json`,
//     halts at refine, and the shim forwards the non-zero (exit 1).
//
// Scope: only the entry-shim's delegate-and-propagate behaviour. Argument
// PARSING / `--help` lives in the `work_engine/cli` twin (covered by
// `work_engine/cli.test.ts`), not here — so the cases drive argv the shim
// forwards verbatim and that `cli.main` resolves deterministically (a clean cwd
// has no `.work-state.json`). COLUMNS pinned to 80; no real repo state touched.
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

function env(): NodeJS.ProcessEnv {
    return { ...process.env, COLUMNS: '80' };
}

/** `tsx implement_ticket/__main__.ts` in `cwd` with `argv`. */
function runTs(cwd: string, argv: string[]): SpawnSyncReturns<string> {
    return spawnSync(TSX_BIN, [MAIN_TS, ...argv], { cwd, env: env(), encoding: 'utf8' });
}

describe('implement_ticket/__main__ — entry-shim intent', () => {
    let cwd: string;
    beforeEach(() => {
        // A pristine cwd → no `.work-state.json`, so cli.main's initial-state
        // resolution is deterministic.
        cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'it-main-'));
    });
    afterEach(() => {
        fs.rmSync(cwd, { recursive: true, force: true });
    });

    it('no args: delegates to cli.main → propagates exit 2 + "no state file" error', () => {
        const ts = runTs(cwd, []);
        // The shim forwarded cli.main's failure code, not 0.
        expect(ts.status, 'exit').toBe(2);
        expect(ts.stderr, 'stderr').toContain('No state file at .work-state.json');
        expect(ts.stderr, 'stderr').toContain('cannot build an initial state');
    });

    it('--prompt-file: delegates, builds initial state, propagates the halt exit (1)', () => {
        fs.writeFileSync(path.join(cwd, 'p.txt'), 'improve the thing\n', 'utf-8');
        const ts = runTs(cwd, ['--prompt-file', 'p.txt']);
        // cli.main halts at refine and returns a non-zero code; the shim forwards it.
        expect(ts.status, 'exit').toBe(1);
        expect(ts.stdout, 'stdout').toContain('[halt] outcome=blocked step=refine');
        expect(ts.stdout, 'stdout').toContain('@agent-directive: refine-prompt');

        // The delegated cli wrote the initial state file with the expected shape.
        const statePath = path.join(cwd, '.work-state.json');
        expect(fs.existsSync(statePath), '.work-state.json written').toBe(true);
        const state = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as {
            version: number;
            input: { kind: string; data: { raw: string } };
            outcomes: Record<string, string>;
        };
        expect(state.version).toBe(1);
        expect(state.input.kind).toBe('prompt');
        expect(state.input.data.raw).toBe('improve the thing\n');
        expect(state.outcomes['refine']).toBe('blocked');
    });
});
