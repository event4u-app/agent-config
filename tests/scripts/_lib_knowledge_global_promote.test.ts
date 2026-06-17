// Tests for src/scripts/_lib/knowledge_global_promote.ts — file-first usage
// signal + repo-slug / card-id derivation + promotion-suggestion decision.
//
// Golden-parity (ADR-200): python3 vs tsx on identical inputs, byte-identical
// stdout / stderr / exit. The usage sidecar is JSON with a `--date` injection
// point so the comparison is deterministic; the slug is pinned via a git
// remote in an isolated tmp repo.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN =
    process.env['TSX_BIN'] ??
    join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', '_lib', 'knowledge_global_promote.ts');
const PY_SCRIPT = join(REPO_ROOT, 'src', 'scripts', '_lib', 'knowledge_global_promote.py');

interface RunResult {
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
}

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();

let repo: string;
let home: string;
beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'kgp-repo-'));
    home = mkdtempSync(join(tmpdir(), 'kgp-home-'));
    spawnSync('git', ['init', '-q'], { cwd: repo });
    spawnSync('git', ['remote', 'add', 'origin', 'https://github.com/acme/widget.git'], { cwd: repo });
});
afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
});

function env(): NodeJS.ProcessEnv {
    return { ...process.env, EVENT4U_CONFIG_HOME: home };
}

function runTs(args: readonly string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: repo, encoding: 'utf8', env: env() });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}
function runPy(args: readonly string[]): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd: repo,
        encoding: 'utf8',
        env: { ...env(), PYTHONPATH: join(REPO_ROOT, 'src') },
    });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

function bothMatch(args: readonly string[]): RunResult {
    const ts = runTs(args);
    if (HAVE_PYTHON) {
        // Fresh store per implementation so each run sees an empty sidecar.
        rmSync(home, { recursive: true, force: true });
        const py = runPy(args);
        rmSync(home, { recursive: true, force: true });
        const ts2 = runTs(args);
        expect(ts2.stdout, `stdout ${args.join(' ')}`).toBe(py.stdout);
        expect(ts2.stderr, `stderr ${args.join(' ')}`).toBe(py.stderr);
        expect(ts2.status, `exit ${args.join(' ')}`).toBe(py.status);
        return ts2;
    }
    return ts;
}

describe('knowledge_global_promote.ts — slug', () => {
    it('repo slug derives from git origin basename', () => {
        const ts = runTs(['slug']);
        expect(ts.status).toBe(0);
        expect(ts.stdout.trim()).toBe('widget');
        bothMatch(['slug']);
    });
});

describe('knowledge_global_promote.ts — record-seen', () => {
    it('records a sighting with deterministic date', () => {
        const args = [
            'record-seen',
            'mycard',
            '--slug',
            'repo-a',
            '--tier',
            'public',
            '--source',
            'https://github.com/x/y',
            '--date',
            '2026-06-17',
        ];
        const ts = runTs(args);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toContain('"seen_in"');
        expect(ts.stdout).toContain('"promoted": false');
        bothMatch(args);
    });

    it('dedups repeated slug + keeps seen_in sorted', () => {
        // Two sightings of the same card in the same repo → seen_in stays [repo-a].
        runTs(['record-seen', 'c', '--slug', 'repo-b', '--tier', 'public', '--date', '2026-01-01']);
        const ts = runTs(['record-seen', 'c', '--slug', 'repo-a', '--tier', 'public', '--date', '2026-01-02']);
        expect(ts.status).toBe(0);
        // seen_in dedups + sorts: both repos present, repo-a before repo-b in seen_in.
        const seenIn = (JSON.parse(ts.stdout) as { seen_in: string[] }).seen_in;
        expect(seenIn).toEqual(['repo-a', 'repo-b']);
        if (HAVE_PYTHON) {
            rmSync(home, { recursive: true, force: true });
            runPy(['record-seen', 'c', '--slug', 'repo-b', '--tier', 'public', '--date', '2026-01-01']);
            const py = runPy(['record-seen', 'c', '--slug', 'repo-a', '--tier', 'public', '--date', '2026-01-02']);
            rmSync(home, { recursive: true, force: true });
            runTs(['record-seen', 'c', '--slug', 'repo-b', '--tier', 'public', '--date', '2026-01-01']);
            const ts2 = runTs(['record-seen', 'c', '--slug', 'repo-a', '--tier', 'public', '--date', '2026-01-02']);
            expect(ts2.stdout).toBe(py.stdout);
            expect(ts2.status).toBe(py.status);
        }
    });
});

describe('knowledge_global_promote.ts — candidates', () => {
    it('empty store → empty JSON list', () => {
        const ts = runTs(['candidates']);
        expect(ts.status).toBe(0);
        expect(ts.stdout.trim()).toBe('[]');
        bothMatch(['candidates']);
    });

    it('two distinct repos at threshold → suggested', () => {
        // auto_promote_threshold default = 2; record same card in two repos.
        runTs(['record-seen', 'sug', '--slug', 'repo-a', '--tier', 'public', '--date', '2026-01-01']);
        runTs(['record-seen', 'sug', '--slug', 'repo-b', '--tier', 'public', '--date', '2026-01-01']);
        const ts = runTs(['candidates']);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toContain('"card_id": "sug"');
        if (HAVE_PYTHON) {
            rmSync(home, { recursive: true, force: true });
            runPy(['record-seen', 'sug', '--slug', 'repo-a', '--tier', 'public', '--date', '2026-01-01']);
            runPy(['record-seen', 'sug', '--slug', 'repo-b', '--tier', 'public', '--date', '2026-01-01']);
            const py = runPy(['candidates']);
            rmSync(home, { recursive: true, force: true });
            runTs(['record-seen', 'sug', '--slug', 'repo-a', '--tier', 'public', '--date', '2026-01-01']);
            runTs(['record-seen', 'sug', '--slug', 'repo-b', '--tier', 'public', '--date', '2026-01-01']);
            const ts2 = runTs(['candidates']);
            expect(ts2.stdout).toBe(py.stdout);
            expect(ts2.status).toBe(py.status);
        }
    });

    it('proprietary card is never suggested', () => {
        runTs(['record-seen', 'priv', '--slug', 'repo-a', '--tier', 'proprietary', '--date', '2026-01-01']);
        runTs(['record-seen', 'priv', '--slug', 'repo-b', '--tier', 'proprietary', '--date', '2026-01-01']);
        const ts = runTs(['candidates']);
        expect(ts.stdout.trim()).toBe('[]');
    });
});

describe('knowledge_global_promote.ts — usage', () => {
    it('no subcommand → help, exit 1', () => {
        const ts = runTs([]);
        expect(ts.status).toBe(1);
        if (HAVE_PYTHON) {
            expect(ts.status).toBe(runPy([]).status);
        }
    });

    it('record-seen with no card_id → exit 2', () => {
        const ts = runTs(['record-seen']);
        expect(ts.status).toBe(2);
        if (HAVE_PYTHON) {
            expect(ts.status).toBe(runPy(['record-seen']).status);
        }
    });
});
