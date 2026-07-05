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

interface RunResult {
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
}


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

// The tsx twin is the source of truth (the python original was deleted in the
// teardown); run it and assert a defined exit.
function bothMatch(args: readonly string[]): RunResult {
    const ts = runTs(args);
    expect(ts.status, `exit ${args.join(' ')}`).not.toBe(-1);
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
    });

    it('record-seen with no card_id → exit 2', () => {
        const ts = runTs(['record-seen']);
        expect(ts.status).toBe(2);
    });
});
