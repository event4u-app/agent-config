// Intent test for work_engine/__main__.ts (py2ts ADR-096 — work_engine
// TOP/integration layer).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` original is gone, so this now
// asserts the tsx entry-point's own contract directly. `__main__.ts` is the thin
// `python3 -m work_engine` entry shim twin: it imports `cli.main`, runs it with
// `process.argv.slice(2)`, and sets `process.exitCode` to its return code. A
// runner file imports the module after the real argv is in place — the import
// side-effect runs the entry. With no input it exits 2 (argparse error path).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SCRIPTS_ROOT = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const MAIN_TS = path.join(SCRIPTS_ROOT, 'work_engine', '__main__.ts');
const TSX_BIN = process.env['TSX_BIN'] ?? path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

interface Run {
    status: number;
    stdout: string;
    stderr: string;
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

let tmpTs: string;
beforeEach(() => {
    tmpTs = fs.mkdtempSync(path.join(os.tmpdir(), 'main-ts-'));
});
afterEach(() => {
    fs.rmSync(tmpTs, { recursive: true, force: true });
});

describe('__main__ — entry-point contract', () => {
    it('no input → exit 2 (argparse error path)', () => {
        const tsR = runTs(tmpTs, ['--no-hooks']);
        expect(tsR.status).toBe(2);
    });

    it('runs the entry and yields a numeric exit code', () => {
        const tsR = runTs(tmpTs, ['--no-hooks']);
        expect(typeof tsR.status).toBe('number');
    });
});
