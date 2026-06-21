// Tests for src/scripts/evidence_report.ts — the Evidence Report scaffolder.
//
// 1:1 port of the Python behavioral contract (ADR-200 parity). Each case spawns
// the TS script via tsx as a real child process and asserts on the observable
// contract (stdout / stderr / written file / exit). A trailing golden-parity
// block runs python3 + tsx on identical fixtures and asserts byte-identical
// stdout+stderr+exit, skipped when python3 is absent.
//
// Non-determinism: `generated_at` (init header) and `head` (git short SHA) and
// the default `observed_at` (add) are time/repo-dependent. Tests pass an
// explicit `--observed-at`, normalize the header lines before comparing the
// written file, and assert on exit/stdout for the rest.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN = (() => {
    const env = process.env['TSX_BIN'];
    if (env) {
        return resolve(REPO_ROOT, env);
    }
    return join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
})();
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'evidence_report.ts');
const PY_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'evidence_report.py');
const SESSION_REL = 'agents/memory/knowledge/session/evidence-report.md';

interface RunResult {
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
}

function runTs(args: readonly string[], cwd: string = REPO_ROOT): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd, encoding: 'utf8' });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

function runPy(args: readonly string[], cwd: string = REPO_ROOT): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], { cwd, encoding: 'utf8' });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

function pythonAvailable(): boolean {
    const r = spawnSync('python3', ['--version'], { encoding: 'utf8' });
    return r.status === 0;
}
const HAVE_PYTHON = pythonAvailable();

let tmp: string;
beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'evrep-'));
});
afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

/** Normalize the time/repo-dependent header lines so init output is stable. */
function normHeader(s: string): string {
    return s
        .replace(/^generated_at:.*$/m, 'generated_at: NORM')
        .replace(/^head:.*$/m, 'head: NORM');
}

function readSession(root: string): string {
    return readFileSync(join(root, ...SESSION_REL.split('/')), 'utf-8');
}

describe('evidence_report.ts', () => {
    it('init writes the three-bucket skeleton', () => {
        const r = runTs(['--root', tmp, 'init', '--task', 'demo'], tmp);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toBe(`Evidence Report written: ${SESSION_REL}\n`);
        const body = readSession(tmp);
        expect(body).toContain('task: demo');
        expect(body).toContain('## Verified (confirmed this session)');
        expect(body).toContain('## Assumed (from card) — hypothesis, confirm before use');
        expect(body).toContain('## Gaps (missing evidence)');
    });

    it('init with no task uses (unnamed)', () => {
        runTs(['--root', tmp, 'init'], tmp);
        expect(readSession(tmp)).toContain('task: (unnamed)');
    });

    it('add to verified inserts a provenance line', () => {
        runTs(['--root', tmp, 'init', '--task', 't'], tmp);
        const r = runTs(
            [
                '--root',
                tmp,
                'add',
                '--bucket',
                'verified',
                '--claim',
                'X exists',
                '--source',
                'a.ts:10',
                '--observed-at',
                '2026-01-01T00:00:00+00:00',
            ],
            tmp,
        );
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toBe('Added to [verified]: X exists\n');
        expect(readSession(tmp)).toContain(
            '- X exists  `[observed_at=2026-01-01T00:00:00+00:00 · source=a.ts:10]`',
        );
    });

    it('add to gaps includes searched / not_searched', () => {
        runTs(['--root', tmp, 'init'], tmp);
        const r = runTs(
            [
                '--root',
                tmp,
                'add',
                '--bucket',
                'gaps',
                '--claim',
                'Y unknown',
                '--searched',
                'a,b',
                '--not-searched',
                'c',
                '--observed-at',
                '2026-01-01T00:00:00+00:00',
            ],
            tmp,
        );
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(readSession(tmp)).toContain(
            '- Y unknown  `[observed_at=2026-01-01T00:00:00+00:00 · searched=a,b · not_searched=c]`',
        );
    });

    it('add truncates long claims at 60 chars in stdout', () => {
        runTs(['--root', tmp, 'init'], tmp);
        const claim = 'A'.repeat(80);
        const r = runTs(
            ['--root', tmp, 'add', '--bucket', 'verified', '--claim', claim, '--observed-at', 'x'],
            tmp,
        );
        expect(r.stdout).toBe(`Added to [verified]: ${'A'.repeat(60)}…\n`);
    });

    it('add before init fails with exit 1 on stderr', () => {
        const r = runTs(['--root', tmp, 'add', '--bucket', 'verified', '--claim', 'x'], tmp);
        expect(r.status).toBe(1);
        expect(r.stderr).toBe('No evidence-report.md found; run `init` first.\n');
    });

    it('git-state clean in a quiescent repo', () => {
        spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: tmp });
        spawnSync('git', ['config', 'user.email', 't@e.x'], { cwd: tmp });
        spawnSync('git', ['config', 'user.name', 't'], { cwd: tmp });
        const r = runTs(['--root', tmp, 'git-state'], tmp);
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('clean\n');
    });

    it('git-state detects an in-progress merge (exit 3)', () => {
        spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: tmp });
        // Fabricate a live merge marker in the git dir.
        const gd = join(tmp, '.git');
        mkdirSync(gd, { recursive: true });
        writeFileSync(join(gd, 'MERGE_HEAD'), 'deadbeef\n');
        const r = runTs(['--root', tmp, 'git-state'], tmp);
        expect(r.status).toBe(3);
        expect(r.stdout).toBe('git-op-in-progress: merge\n');
    });

    it('git-state outside a repo exits 3 on stderr', () => {
        const r = runTs(['--root', tmp, 'git-state'], tmp);
        expect(r.status).toBe(3);
        expect(r.stderr).toBe('Not a git repository or git not found.\n');
    });

    it('no subcommand exits 2', () => {
        const r = runTs([]);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('the following arguments are required: subcommand');
    });

    it('invalid subcommand exits 2', () => {
        const r = runTs(['bogus']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain("invalid choice: 'bogus'");
    });

    it('add with missing required flags exits 2', () => {
        const r = runTs(['add']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('the following arguments are required: --bucket, --claim');
    });

    it('add with invalid bucket choice exits 2', () => {
        const r = runTs(['add', '--bucket', 'nope', '--claim', 'x']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain("argument --bucket: invalid choice: 'nope'");
    });

    // --- golden parity vs python3 -------------------------------------------
    describe.skipIf(!HAVE_PYTHON || !existsSync(PY_SCRIPT))('golden parity', () => {
        /** Build a committed git repo so `head` resolves to a short SHA. */
        function gitRepo(dir: string): void {
            spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
            spawnSync('git', ['config', 'user.email', 't@e.x'], { cwd: dir });
            spawnSync('git', ['config', 'user.name', 't'], { cwd: dir });
            spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });
            writeFileSync(join(dir, 'f'), 'x\n');
            spawnSync('git', ['add', '-A'], { cwd: dir });
            spawnSync('git', ['commit', '-q', '-m', 'c'], { cwd: dir });
        }

        it('init written file byte-identical (header normalized)', () => {
            const pyDir = join(tmp, 'py');
            const tsDir = join(tmp, 'ts');
            mkdirSync(pyDir);
            mkdirSync(tsDir);
            gitRepo(pyDir);
            gitRepo(tsDir);
            const py = runPy(['--root', pyDir, 'init', '--task', 'demo task'], pyDir);
            const ts = runTs(['--root', tsDir, 'init', '--task', 'demo task'], tsDir);
            // stdout uses the relative session path → identical.
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
            // Written file matches once the time/SHA header lines are normalized.
            expect(normHeader(readSession(tsDir))).toBe(normHeader(readSession(pyDir)));
        });

        it('add (verified + gaps) written file byte-identical', () => {
            const pyDir = join(tmp, 'py2');
            const tsDir = join(tmp, 'ts2');
            mkdirSync(pyDir);
            mkdirSync(tsDir);
            gitRepo(pyDir);
            gitRepo(tsDir);
            const seq: string[][] = [
                ['init', '--task', 'demo'],
                [
                    'add',
                    '--bucket',
                    'verified',
                    '--claim',
                    'Card claims X holds',
                    '--source',
                    'a.ts:10',
                    '--version',
                    'v1',
                    '--observed-at',
                    '2026-01-01T00:00:00+00:00',
                ],
                [
                    'add',
                    '--bucket',
                    'gaps',
                    '--claim',
                    'Y not yet searched',
                    '--searched',
                    'a,b',
                    '--not-searched',
                    'c,d',
                    '--observed-at',
                    '2026-01-01T00:00:00+00:00',
                ],
            ];
            for (const a of seq) {
                const py = runPy(['--root', pyDir, ...a], pyDir);
                const ts = runTs(['--root', tsDir, ...a], tsDir);
                expect(ts.stdout).toBe(py.stdout);
                expect(ts.stderr).toBe(py.stderr);
                expect(ts.status).toBe(py.status);
            }
            expect(normHeader(readSession(tsDir))).toBe(normHeader(readSession(pyDir)));
        });

        it('git-state clean byte-identical', () => {
            const dir = join(tmp, 'g');
            mkdirSync(dir);
            gitRepo(dir);
            const py = runPy(['--root', dir, 'git-state'], dir);
            const ts = runTs(['--root', dir, 'git-state'], dir);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });

        it('git-state merge-in-progress byte-identical', () => {
            const dir = join(tmp, 'gm');
            mkdirSync(dir);
            gitRepo(dir);
            writeFileSync(join(dir, '.git', 'MERGE_HEAD'), 'deadbeef\n');
            const py = runPy(['--root', dir, 'git-state'], dir);
            const ts = runTs(['--root', dir, 'git-state'], dir);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });

        it('add before init byte-identical', () => {
            const dir = join(tmp, 'ni');
            mkdirSync(dir);
            const args = ['--root', dir, 'add', '--bucket', 'verified', '--claim', 'x'];
            const py = runPy(args, dir);
            const ts = runTs(args, dir);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });

        it('arg-error paths byte-identical', () => {
            for (const args of [[], ['bogus'], ['add'], ['add', '--bucket', 'nope', '--claim', 'x']]) {
                const py = runPy(args);
                const ts = runTs(args);
                expect(ts.stdout, JSON.stringify(args)).toBe(py.stdout);
                expect(ts.stderr, JSON.stringify(args)).toBe(py.stderr);
                expect(ts.status, JSON.stringify(args)).toBe(py.status);
            }
        });
    });
});
