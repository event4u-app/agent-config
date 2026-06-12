// Tests for src/scripts/measure_skill_reduction.ts (py2ts Phase 8 / Wave 8c).
//
// No pytest suite exists → focused differential suite. The script is a
// read-only reporter over the legacy `.agent-src.uncondensed/skills` corpus.
//
// Real-repo reality the contract makes us replicate-and-flag: that legacy
// skills dir does NOT exist on the current src/-based layout. Unlike
// measure_patterns (which has an is_dir guard → exit 3), this script does an
// UN-GUARDED `sorted(SKILLS_DIR.iterdir())`, so a missing dir raises an
// uncaught FileNotFoundError → traceback → exit 1 with EMPTY stdout. The TS
// twin reproduces the crash (throwing on readdir ENOENT → exit 1, empty
// stdout). The traceback prose is interpreter-specific, so on the crash path
// only the exit code + empty stdout are compared. When the skills dir is
// present the default + --json shapes are byte-identical. Skipped without
// python3.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'measure_skill_reduction.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'measure_skill_reduction.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const SKILLS_DIR = path.join(REPO_ROOT, '.agent-src.uncondensed', 'skills');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
function skillsDirPresent(): boolean {
    return spawnSync('test', ['-d', SKILLS_DIR]).status === 0;
}
function runPy(args: string[]) {
    return spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
}
function runTs(args: string[]) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
}

describe.runIf(hasPython3())('measure_skill_reduction — golden parity (python3 vs tsx)', () => {
    it.skipIf(skillsDirPresent())(
        'missing skills dir → both crash exit 1, empty stdout (traceback prose not compared)',
        () => {
            const py = runPy([]);
            const ts = runTs([]);
            expect(py.status).toBe(1);
            expect(ts.status).toBe(1);
            expect(ts.stdout).toBe('');
            expect(py.stdout).toBe('');
        },
    );

    it.skipIf(skillsDirPresent())('missing skills dir → --json also crashes exit 1, empty stdout', () => {
        const py = runPy(['--json']);
        const ts = runTs(['--json']);
        expect(py.status).toBe(1);
        expect(ts.status).toBe(1);
        expect(ts.stdout).toBe('');
        expect(py.stdout).toBe('');
    });

    it.runIf(skillsDirPresent())('skills dir present → default + --json byte-identical', () => {
        for (const args of [[], ['--json']]) {
            const py = runPy(args);
            const ts = runTs(args);
            expect(ts.status, args.join(' ')).toBe(py.status);
            expect(ts.stdout, args.join(' ')).toBe(py.stdout);
            expect(ts.stderr, args.join(' ')).toBe(py.stderr);
        }
    });

    it('bad flag → exit code parity (argparse banner prose not compared)', () => {
        const py = runPy(['--bogus']);
        const ts = runTs(['--bogus']);
        expect(ts.status).toBe(py.status);
    });
});
