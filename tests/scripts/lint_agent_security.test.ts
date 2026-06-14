// Tests for src/scripts/lint_agent_security.ts (py2ts — ADR-094).
//
// No pytest suite exists, so this is a golden-parity suite: it runs python3 vs
// tsx for every read mode (default report, --sarif, --quiet) on the REAL src/
// tree and asserts stdout/stderr/exit + the written SARIF file are
// byte-identical. The umbrella runner shells out to the four Python child
// linters (which have no TS twins), so both runtimes observe the same child
// output in the same repo. The SARIF file is written under a tmp dir so the
// test leaves zero git drift.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_agent_security.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_agent_security.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe.runIf(hasPython3())('lint_agent_security — golden parity (python3 vs tsx)', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-agent-sec-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    for (const args of [[], ['--quiet']]) {
        it(`stdout/stderr/exit match for: ${args.join(' ') || '(default)'}`, () => {
            const py = spawnSync('python3', [PY_SCRIPT, ...args], {
                encoding: 'utf8',
                cwd: REPO_ROOT,
            });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
                encoding: 'utf8',
                cwd: REPO_ROOT,
            });
            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
        });
    }

    it('--sarif writes a byte-identical SARIF file + matching stdout', () => {
        const pyOut = path.join(tmp, 'py.sarif');
        const tsOut = path.join(tmp, 'ts.sarif');
        const py = spawnSync('python3', [PY_SCRIPT, '--sarif', pyOut], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--sarif', tsOut], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        expect(ts.status).toBe(py.status);
        // The only stdout difference is the SARIF path echo; normalise it.
        const norm = (s: string, p: string): string => s.split(p).join('SARIFPATH');
        expect(norm(ts.stdout, tsOut)).toBe(norm(py.stdout, pyOut));
        expect(ts.stderr).toBe(py.stderr);

        const pyText = fs.readFileSync(pyOut, 'utf-8');
        const tsText = fs.readFileSync(tsOut, 'utf-8');
        expect(tsText).toBe(pyText);
        // Sanity: it parses as a SARIF 2.1.0 document.
        const parsed = JSON.parse(tsText) as { version: string };
        expect(parsed.version).toBe('2.1.0');
    });

    it('--sarif creates missing parent directories (mkdir parents=True)', () => {
        const pyOut = path.join(tmp, 'a', 'b', 'py.sarif');
        const tsOut = path.join(tmp, 'c', 'd', 'ts.sarif');
        spawnSync('python3', [PY_SCRIPT, '--sarif', pyOut], { encoding: 'utf8', cwd: REPO_ROOT });
        spawnSync(TSX_BIN, [TS_SCRIPT, '--sarif', tsOut], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(fs.readFileSync(tsOut, 'utf-8')).toBe(fs.readFileSync(pyOut, 'utf-8'));
    });
});

describe('lint_agent_security — legacy-literal guard (ADR-051)', () => {
    it('ts has the same .agent-src.uncondensed count as py', () => {
        const py = fs.readFileSync(PY_SCRIPT, 'utf-8');
        const ts = fs.readFileSync(TS_SCRIPT, 'utf-8');
        const count = (s: string): number => (s.match(/\.agent-src\.uncondensed/g) ?? []).length;
        expect(count(ts)).toBe(count(py));
    });
});
