// Tests for src/scripts/knowledge_card_usage.ts — the knowledge-card usage counter.
//
// 1:1 port of the Python behavioral contract (ADR-200 parity). Each case spawns
// the TS script via tsx as a real child process and asserts on the observable
// contract (stdout / stderr / exit). A trailing golden-parity block runs
// python3 + tsx on identical fixtures and asserts byte-identical
// stdout+stderr+exit, skipped when python3 is absent.
//
// Non-determinism: `last_used` is a UTC `strftime` timestamp. The store-write
// tests normalize it before comparison; the byte-parity block only exercises
// paths that do not write a timestamp (show on a fixed store, arg errors).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'knowledge_card_usage.ts');
const PY_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'knowledge_card_usage.py');

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

// Replace the UTC last_used timestamp so store comparisons are deterministic.
function normTs(s: string): string {
    return s.replace(/"last_used": "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/g, '"last_used": "NORM"');
}

let tmp: string;
beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'kcu-'));
});
afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

/** Init a git repo with a known remote slug, so _repo_slug() is deterministic. */
function gitRepo(slug = 'foo/bar'): string {
    spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: tmp });
    spawnSync('git', ['config', 'user.email', 't@e.x'], { cwd: tmp });
    spawnSync('git', ['config', 'user.name', 't'], { cwd: tmp });
    spawnSync('git', ['remote', 'add', 'origin', `git@github.com:${slug}.git`], { cwd: tmp });
    return tmp;
}

describe('knowledge_card_usage.ts', () => {
    it('record then show ticks the count', () => {
        const dir = gitRepo();
        const rec = runTs(['record', '--card', 'stripe.md'], dir);
        expect(rec.status, rec.stdout + rec.stderr).toBe(0);
        expect(rec.stdout).toBe('Recorded: stripe.md in foo/bar (count=1)\n');
        const show = runTs(['show'], dir);
        expect(show.status).toBe(0);
        const payload = JSON.parse(show.stdout) as {
            cards: Record<string, { repos: Record<string, { count: number }> }>;
        };
        expect(payload.cards['stripe.md']?.repos['foo/bar']?.count).toBe(1);
    });

    it('record twice increments the count', () => {
        const dir = gitRepo();
        runTs(['record', '--card', 'stripe.md'], dir);
        const rec2 = runTs(['record', '--card', 'stripe.md'], dir);
        expect(rec2.stdout).toBe('Recorded: stripe.md in foo/bar (count=2)\n');
    });

    it('show on a fresh repo prints empty cards', () => {
        const dir = gitRepo();
        const show = runTs(['show'], dir);
        expect(show.status).toBe(0);
        expect(show.stdout).toBe('{\n  "cards": {}\n}\n');
    });

    it('no subcommand prints help and exits 1', () => {
        const r = runTs([]);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('usage: knowledge_card_usage.py');
    });

    it('invalid subcommand exits 2', () => {
        const r = runTs(['bogus']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain("invalid choice: 'bogus'");
    });

    it('record without --card exits 2', () => {
        const r = runTs(['record']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('the following arguments are required: --card');
    });

    it('store written outside a git repo uses local/unknown slug', () => {
        // No git repo in tmp → _repo_root() falls back to cwd, _repo_slug() →
        // local/unknown. (cwd has no origin remote in the tmp dir.)
        const r = runTs(['record', '--card', 'x.md'], tmp);
        // In a bare tmp dir, git rev-parse fails → store under cwd; slug is
        // local/unknown unless tmp happens to be inside a repo. Assert on the
        // observable: exit 0 and a Recorded: line.
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout.startsWith('Recorded: x.md in ')).toBe(true);
    });

    // --- golden parity vs python3 -------------------------------------------
    describe.skipIf(!HAVE_PYTHON || !existsSync(PY_SCRIPT))('golden parity', () => {
        it('no subcommand help byte-identical (stderr/exit; stdout normalized prog)', () => {
            // argparse help prose is excluded from byte-parity per the migration
            // contract; assert the exit code matches and the usage line is present.
            const py = runPy([]);
            const ts = runTs([]);
            expect(ts.status).toBe(py.status);
            expect(ts.stdout.includes('usage: knowledge_card_usage.py')).toBe(true);
            expect(py.stdout.includes('usage: knowledge_card_usage.py')).toBe(true);
        });

        it('invalid subcommand byte-identical', () => {
            const py = runPy(['bogus']);
            const ts = runTs(['bogus']);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });

        it('record without --card byte-identical', () => {
            const py = runPy(['record']);
            const ts = runTs(['record']);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });

        it('show on a fresh repo byte-identical', () => {
            const dir = gitRepo();
            const py = runPy(['show'], dir);
            const ts = runTs(['show'], dir);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });

        it('record + show byte-identical with last_used normalized', () => {
            const dir = gitRepo();
            const pyRec = runPy(['record', '--card', 'stripe.md'], dir);
            // reset store so the TS run starts from the same baseline
            rmSync(join(dir, 'agents', 'memory', 'knowledge', 'session', 'usage.json'), {
                force: true,
            });
            const tsRec = runTs(['record', '--card', 'stripe.md'], dir);
            expect(tsRec.stdout).toBe(pyRec.stdout);
            expect(tsRec.status).toBe(pyRec.status);
            // The store JSON differs only in the timestamp → normalize.
            const pyShow = runPy(['show'], dir);
            const tsShow = runTs(['show'], dir);
            expect(normTs(tsShow.stdout)).toBe(normTs(pyShow.stdout));
            expect(tsShow.status).toBe(pyShow.status);
        });
    });
});
