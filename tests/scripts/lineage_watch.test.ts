// Phase 10 of road-to-a-graph-that-follows-you — the upstream delta watch.
//
// A local fixture upstream (a path remote, no network) is pinned at its first
// commit, then moves three commits: one touching the edge's locator, one adding a
// top-level module, one unrelated. The watch must report exactly one `reverify`
// and one `candidate`; an unchanged source must cost one `ls-remote` and nothing
// else; a non-dry run writes one stub that names mechanisms and fresh ENC1
// locators only; and nothing runs when CI is set.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { sourceGateFindings } from '../_lib/source_gate.js';
import { lineageDir, mergeIntoLedger, readLedger, type EdgeRow } from '../../src/scripts/_lib/lineage_ledger.js';
import { runWatch, systemGit, type GitRunner } from '../../src/scripts/_lib/lineage_watch.js';
import { decrypt, encrypt } from '../../src/scripts/_lib/link_crypto.js';
import { sourceId } from '../../src/scripts/_lib/source_id.js';
import { main as lineageMain } from '../../src/scripts/code_graph/lineage_cli.js';

const KEY = 'lineage-watch-key-0123456789abcdef';
const temps: string[] = [];
afterEach(() => {
    while (temps.length > 0) fs.rmSync(temps.pop() as string, { recursive: true, force: true });
});
const tmp = (prefix: string): string => {
    const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
    temps.push(d);
    return d;
};
const sh = (cwd: string, ...args: string[]): string =>
    execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf-8' }).trim();
function put(dir: string, rel: string, body: string): void {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
}

interface Fixture {
    upstream: string;
    pin: string;
    root: string;
    home: string;
    id: string;
}

function fixture(move = true): Fixture {
    const upstream = tmp('lineage-watch-upstream-');
    sh(upstream, 'init', '-q', '-b', 'main');
    put(upstream, 'src/retry.ts', 'export const retries = 3;\n');
    put(upstream, 'README.md', '# widget\n');
    put(upstream, 'LICENSE', 'MIT\n');
    sh(upstream, 'add', '-A');
    sh(upstream, 'commit', '-q', '-m', 'pin');
    const pin = sh(upstream, 'rev-parse', 'HEAD');
    if (move) {
        put(upstream, 'src/retry.ts', 'export const retries = 5;\n');
        sh(upstream, 'commit', '-q', '-am', 'touch the locator');
        put(upstream, 'plugins/cache.ts', 'export const cache = new Map();\n');
        sh(upstream, 'add', '-A');
        sh(upstream, 'commit', '-q', '-m', 'a new module');
        put(upstream, 'README.md', '# widget, again\n');
        sh(upstream, 'commit', '-q', '-am', 'unrelated');
    }

    const root = tmp('lineage-watch-repo-');
    sh(root, 'init', '-q');
    put(root, 'provenance/mechanisms.jsonl', [
        { mechanism_id: 'retry-budget', verdict: 'adopt', realised_in: ['a.md'], decided_at: '2026-08-01' },
        { mechanism_id: 'readme-tone', verdict: 'adapt', realised_in: ['a.md'], decided_at: '2026-08-01' },
    ].map((r) => JSON.stringify(r)).join('\n') + '\n');
    put(root, 'a.md', '# a\n');
    put(root, 'agents/roadmaps/stubs/README.md', '# stubs\n');
    sh(root, 'add', '-A');
    sh(root, 'commit', '-q', '-m', 'fixture');

    const home = tmp('lineage-watch-home-');
    const id = sourceId(upstream, KEY);
    const edges: EdgeRow[] = [
        { source_id: id, mechanism_id: 'retry-budget', pin: encrypt(pin, KEY), locator: encrypt('src/retry.ts:1', KEY) },
        { source_id: id, mechanism_id: 'unread-edge', pin: 'unknown', locator: null },
    ];
    mergeIntoLedger(lineageDir({ EVENT4U_CONFIG_HOME: home }), {
        sources: [{ source_id: id, kind: 'repo', identity: encrypt(upstream, KEY), license: 'MIT', watch: false }],
        edges,
    });
    return { upstream, pin, root, home, id };
}

function countingGit(): { git: GitRunner; calls: string[][] } {
    const calls: string[][] = [];
    const git: GitRunner = (args, cwd) => {
        calls.push(args);
        return systemGit(args, cwd);
    };
    return { git, calls };
}

async function run(argv: string[], f: Fixture, env: Record<string, string> = {}): Promise<{ rc: number; out: string; err: string }> {
    let out = '';
    let err = '';
    const rc = await lineageMain(argv, {
        env: { EVENT4U_CONFIG_HOME: f.home, ...env },
        keys: [KEY],
        now: () => new Date('2026-10-24T12:00:00Z'),
        stdout: (s) => void (out += s),
        stderr: (s) => void (err += s),
    });
    return { rc, out, err };
}

describe('watch enable', () => {
    it('is off by default and switched on per source', async () => {
        const f = fixture();
        const dir = lineageDir({ EVENT4U_CONFIG_HOME: f.home });
        expect(readLedger(dir).sources[0]?.watch).toBe(false);
        const none = await run(['watch', '--dry-run', '--root', f.root], f);
        expect(none.rc).toBe(0);
        expect(none.out).toMatch(/0 watched source\(s\)/);
        expect((await run(['watch', 'enable', f.id], f)).rc).toBe(0);
        expect(readLedger(dir).sources[0]?.watch).toBe(true);
        expect((await run(['watch', 'disable', f.id], f)).rc).toBe(0);
        expect(readLedger(dir).sources[0]?.watch).toBe(false);
        expect((await run(['watch', 'enable', 'src_0000000000'], f)).rc).toBe(1);
    });
});

describe('one watch run (10.1)', () => {
    it('reports exactly one reverify and one candidate for the three upstream commits', async () => {
        const f = fixture();
        await run(['watch', 'enable', f.id], f);
        const dir = lineageDir({ EVENT4U_CONFIG_HOME: f.home });
        const report = runWatch({ dir, keys: [KEY], rows: [], git: systemGit, env: {} });
        expect(report).toHaveLength(1);
        const classes = report[0]?.findings.map((x) => x.class).sort();
        expect(classes).toEqual(['candidate', 'reverify']);
        const reverify = report[0]?.findings.find((x) => x.class === 'reverify');
        expect(reverify?.mechanism_id).toBe('retry-budget');
        expect(report[0]?.findings.find((x) => x.class === 'candidate')?.locator).toBe('plugins');
    });

    it('an unchanged source costs one ls-remote and nothing else', async () => {
        const f = fixture(false);
        await run(['watch', 'enable', f.id], f);
        const { git, calls } = countingGit();
        const report = runWatch({ dir: lineageDir({ EVENT4U_CONFIG_HOME: f.home }), keys: [KEY], rows: [], git, env: {} });
        expect(report[0]?.status).toBe('unchanged');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.[0]).toBe('ls-remote');
    });

    it('a locator change on a rejected mechanism is a reopen, a deleted locator is drift, a license change alerts', async () => {
        const f = fixture();
        put(f.upstream, 'LICENSE', 'Apache-2.0\n');
        fs.rmSync(path.join(f.upstream, 'src', 'retry.ts'));
        sh(f.upstream, 'commit', '-q', '-am', 'relicense and drop');
        await run(['watch', 'enable', f.id], f);
        const dir = lineageDir({ EVENT4U_CONFIG_HOME: f.home });
        const report = runWatch({ dir, keys: [KEY], rows: [], git: systemGit, env: {} });
        expect(report[0]?.findings.map((x) => x.class).sort()).toEqual(['candidate', 'drift', 'license-alert']);

        put(f.upstream, 'src/retry.ts', 'export const retries = 9;\n');
        sh(f.upstream, 'add', '-A');
        sh(f.upstream, 'commit', '-q', '-m', 'back again');
        const rows = [{ mechanism_id: 'retry-budget', verdict: 'reject' as const, reason: 'too eager', decided_at: '2026-08-02' }];
        const again = runWatch({ dir, keys: [KEY], rows, git: systemGit, env: {} });
        expect(again[0]?.findings.find((x) => x.mechanism_id === 'retry-budget')?.class).toBe('reopen');
    });

    it('a re-import that moves the pin is what the next watch compares against', async () => {
        const f = fixture();
        await run(['watch', 'enable', f.id], f);
        const dir = lineageDir({ EVENT4U_CONFIG_HOME: f.home });
        const head = sh(f.upstream, 'rev-parse', 'HEAD');
        const added = mergeIntoLedger(dir, {
            sources: [],
            edges: [{ source_id: f.id, mechanism_id: 'retry-budget', pin: encrypt(head, KEY), locator: encrypt('src/retry.ts:1', KEY) }],
        }, [KEY]);
        expect(added.edges).toBe(1);
        const report = runWatch({ dir, keys: [KEY], rows: [], git: systemGit, env: {} });
        expect(report[0]?.pin).toBe(head);
        expect(report[0]?.status).toBe('unchanged');
    });

    it('a dry run writes no report and no stub', async () => {
        const f = fixture();
        await run(['watch', 'enable', f.id], f);
        const res = await run(['watch', '--dry-run', '--root', f.root], f);
        expect(res.rc).toBe(0);
        expect(res.out).toMatch(/reverify\s+retry-budget/);
        expect(fs.readdirSync(path.join(f.root, 'agents', 'roadmaps', 'stubs'))).toEqual(['README.md']);
        expect(fs.existsSync(path.join(lineageDir({ EVENT4U_CONFIG_HOME: f.home }), 'watch'))).toBe(false);
    });
});

describe('output is stubs, never code (10.2)', () => {
    it('writes one report locally and one stub naming mechanism ids and fresh ENC1 locators only', async () => {
        const f = fixture();
        await run(['watch', 'enable', f.id], f);
        const before = sh(f.root, 'status', '--porcelain');
        const res = await run(['watch', '--root', f.root], f);
        expect(res.err).toBe('');
        expect(res.rc).toBe(0);

        const stubs = fs.readdirSync(path.join(f.root, 'agents', 'roadmaps', 'stubs')).filter((n) => n !== 'README.md');
        expect(stubs).toEqual(['road-to-lineage-delta-2026-10-24.md']);
        const rel = `agents/roadmaps/stubs/${stubs[0] as string}`;
        const stub = fs.readFileSync(path.join(f.root, rel), 'utf-8');
        expect(stub).not.toContain('src_');
        expect(stub).not.toContain(f.upstream);
        expect(stub).not.toContain('retry.ts');
        expect(stub).toMatch(/## Mechanism `retry-budget`/);
        expect(sourceGateFindings(rel, stub)).toEqual([]);
        const tokens = stub.match(/ENC1:[A-Za-z0-9+/=]+/g) ?? [];
        expect(tokens.map((t) => decrypt(t, KEY)).sort()).toEqual(['plugins', 'src/retry.ts:1']);

        const reports = fs.readdirSync(path.join(lineageDir({ EVENT4U_CONFIG_HOME: f.home }), 'watch'));
        expect(reports).toEqual(['report-2026-10-24.md']);

        const after = sh(f.root, 'status', '--porcelain');
        const changed = after.split('\n').filter((l) => !before.split('\n').includes(l));
        expect(changed).toEqual([`?? ${rel}`]);
    });

    it('refuses to run when CI is set', async () => {
        const f = fixture();
        await run(['watch', 'enable', f.id], f);
        const { git, calls } = countingGit();
        expect(() => runWatch({ dir: lineageDir({ EVENT4U_CONFIG_HOME: f.home }), keys: [KEY], rows: [], git, env: { CI: 'true' } })).toThrow(/CI/);
        expect(calls).toHaveLength(0);
        const res = await run(['watch', '--root', f.root], f, { CI: 'true' });
        expect(res.rc).toBe(2);
        expect(res.err).toMatch(/CI/);
        expect(fs.readdirSync(path.join(f.root, 'agents', 'roadmaps', 'stubs'))).toEqual(['README.md']);
    });
});
