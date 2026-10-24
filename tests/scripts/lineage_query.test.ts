// Steps 9.1 and 9.2 of road-to-a-graph-that-follows-you — lineage queries and the gaps view.
//
// `of`, `gaps` and `rejected` answer from the tracked, source-free ledger of a
// fixture repo; `from` needs the local ledger and the key, and refuses without
// either. EVENT4U_CONFIG_HOME always points at a temp dir.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { loadGraph } from '../../src/scripts/code_graph/query.js';
import { lineageDir, mergeIntoLedger, PIN_UNKNOWN } from '../../src/scripts/_lib/lineage_ledger.js';
import { gaps, latestDecisions, lineageOf, readDecisions } from '../../src/scripts/_lib/lineage_query.js';
import { encrypt } from '../../src/scripts/_lib/link_crypto.js';
import { sourceId } from '../../src/scripts/_lib/source_id.js';
import { main as lineageMain } from '../../src/scripts/code_graph/lineage_cli.js';

const KEY = 'lineage-query-key-0123456789abcdef';
const temps: string[] = [];
afterEach(() => {
    while (temps.length > 0) fs.rmSync(temps.pop() as string, { recursive: true, force: true });
});
const tmp = (prefix: string): string => {
    const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
    temps.push(d);
    return d;
};

function repo(rows: object[], files: string[] = ['src/kept.ts']): string {
    const root = tmp('lineage-query-repo-');
    fs.mkdirSync(path.join(root, 'provenance'), { recursive: true });
    fs.writeFileSync(path.join(root, 'provenance', 'mechanisms.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    for (const f of files) {
        fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
        fs.writeFileSync(path.join(root, f), 'x\n');
    }
    return root;
}

const ROWS = [
    { mechanism_id: 'kept-mechanism', verdict: 'adopt', realised_in: ['src/kept.ts:3'], decided_at: '2026-08-01' },
    { mechanism_id: 'moved-mechanism', verdict: 'adapt', realised_in: ['src/kept.ts', 'src/moved-away.ts'], decided_at: '2026-08-01' },
    { mechanism_id: 'open-gap', verdict: 'gap', roadmap: 'open', decided_at: '2026-08-02' },
    { mechanism_id: 'closed-gap', verdict: 'gap', roadmap: 'open', decided_at: '2026-08-02' },
    { mechanism_id: 'parked', verdict: 'deferred', roadmap: 'agents/roadmaps/road-to-later.md', decided_at: '2026-08-02' },
    { mechanism_id: 'closed-gap', verdict: 'adopt', realised_in: ['src/kept.ts'], decided_at: '2026-08-05' },
    { mechanism_id: 'turned-down', verdict: 'reject', reason: 'contradicts our retry budget', decided_at: '2026-08-03' },
    { mechanism_id: 'parked', verdict: 'reject', reason: 'not worth it', reopen_if: 'a second caller appears', decided_at: '2026-08-06' },
    { mechanism_id: 'dropped-gap', verdict: 'gap', roadmap: 'open', decided_at: '2026-08-02' },
    { mechanism_id: 'dropped-gap', verdict: 'reject', reason: 'decided against for good', decided_at: '2026-08-07' },
];

async function run(argv: string[], env: Record<string, string>, keys: string[] = [KEY]): Promise<{ rc: number; out: string; err: string }> {
    let out = '';
    let err = '';
    const rc = await lineageMain(argv, { env, keys, stdout: (s) => void (out += s), stderr: (s) => void (err += s) });
    return { rc, out, err };
}

describe('lineage of', () => {
    it('resolves realised_in and shows a deleted file as a broken edge', () => {
        const root = repo(ROWS);
        const [moved] = lineageOf(root, 'moved-mechanism');
        expect(moved?.realised).toEqual([
            { path: 'src/kept.ts', status: 'ok', in_graph: null },
            { path: 'src/moved-away.ts', status: 'broken', in_graph: null },
        ]);
    });

    it('resolves through the code graph when one is built, and still trusts the disk for breakage', async () => {
        const root = repo(
            [{ mechanism_id: 'docs-mechanism', verdict: 'adapt', realised_in: ['docs/guide.md', 'src/kept.ts', 'src/after.ts', 'src/gone.ts'], decided_at: '2026-08-01' }],
            ['docs/guide.md', 'src/kept.ts', 'src/gone.ts'],
        );
        fs.writeFileSync(path.join(root, 'src', 'kept.ts'), 'export const kept = 1;\n');
        fs.writeFileSync(path.join(root, 'src', 'gone.ts'), 'export const gone = 1;\n');
        const graphPath = path.join(root, 'graph.json');
        await buildFromRepo(root, graphPath);
        fs.rmSync(path.join(root, 'src', 'gone.ts'));
        fs.writeFileSync(path.join(root, 'src', 'after.ts'), 'export const after = 1;\n');
        const [e] = lineageOf(root, 'docs-mechanism', loadGraph(graphPath).byId);
        expect(e?.realised).toEqual([
            { path: 'docs/guide.md', status: 'ok', in_graph: true },
            { path: 'src/kept.ts', status: 'ok', in_graph: true },
            { path: 'src/after.ts', status: 'ok', in_graph: false },
            { path: 'src/gone.ts', status: 'broken', in_graph: true },
        ]);
        const res = await run(['of', 'docs-mechanism', '--root', root, '--graph', graphPath], { EVENT4U_CONFIG_HOME: tmp('lineage-query-home-') });
        expect(res.out).toMatch(/src\/after\.ts\s+ok\s+graph: not indexed/);
        expect(res.out).toMatch(/src\/gone\.ts\s+BROKEN\s+graph: indexed/);
    });

    it('answers by path as well as by id, with the line suffix stripped', () => {
        const root = repo(ROWS);
        expect(lineageOf(root, 'src/kept.ts').map((e) => e.mechanism_id).sort()).toEqual(['closed-gap', 'kept-mechanism', 'moved-mechanism']);
    });

    it('the CLI exits 1 on a broken edge and 0 when every edge resolves', async () => {
        const root = repo(ROWS);
        const env = { EVENT4U_CONFIG_HOME: tmp('lineage-query-home-') };
        const broken = await run(['of', 'moved-mechanism', '--root', root], env);
        expect(broken.rc).toBe(1);
        expect(broken.out).toMatch(/src\/moved-away\.ts\s+BROKEN/);
        const ok = await run(['of', 'kept-mechanism', '--root', root], env);
        expect(ok.rc).toBe(0);
        expect(ok.out).toMatch(/kept-mechanism\s+adopt/);
    });

    it('names an unknown mechanism rather than printing nothing', async () => {
        const res = await run(['of', 'nope', '--root', repo(ROWS)], { EVENT4U_CONFIG_HOME: tmp('lineage-query-home-') });
        expect(res.rc).toBe(1);
        expect(res.err).toMatch(/no mechanism/);
    });
});

describe('lineage gaps', () => {
    it('lists gap and deferred mechanisms with their owner, minus what a later row closed', () => {
        const rows = readDecisions(repo(ROWS));
        const view = gaps(rows);
        expect(view.map((g) => [g.mechanism_id, g.verdict, g.owner])).toEqual([
            ['open-gap', 'gap', 'open'],
            ['parked', 'deferred', 'agents/roadmaps/road-to-later.md'],
        ]);
        expect(view.find((g) => g.mechanism_id === 'parked')?.reopen_if).toBe('a second caller appears');
    });

    it('a later adopt closes a gap, and the gap no longer shows', async () => {
        const res = await run(['gaps', '--root', repo(ROWS)], { EVENT4U_CONFIG_HOME: tmp('lineage-query-home-') });
        expect(res.rc).toBe(0);
        expect(res.out).toMatch(/open-gap/);
        expect(res.out).not.toMatch(/closed-gap/);
        expect(res.out).not.toMatch(/dropped-gap/);
    });

    it('the latest decision is the one that counts', () => {
        expect(latestDecisions(readDecisions(repo(ROWS))).get('closed-gap')?.verdict).toBe('adopt');
    });
});

describe('lineage rejected', () => {
    it('lists the mechanisms whose latest decision is a rejection, with reason and reopen condition', async () => {
        const res = await run(['rejected', '--root', repo(ROWS)], { EVENT4U_CONFIG_HOME: tmp('lineage-query-home-') });
        expect(res.rc).toBe(0);
        expect(res.out).toMatch(/turned-down\s+contradicts our retry budget/);
        expect(res.out).toMatch(/parked\s+not worth it\s+reopen if: a second caller appears/);
        expect(res.out).not.toMatch(/kept-mechanism/);
    });
});

describe('lineage from', () => {
    const url = 'https://github.com/acme/widget';

    it('answers source → mechanisms from the local ledger with the key', async () => {
        const root = repo(ROWS);
        const home = tmp('lineage-query-home-');
        const id = sourceId(url, KEY);
        mergeIntoLedger(lineageDir({ EVENT4U_CONFIG_HOME: home }), {
            sources: [{ source_id: id, kind: 'repo', identity: encrypt(url, KEY), license: 'MIT', watch: false }],
            edges: [
                { source_id: id, mechanism_id: 'kept-mechanism', pin: encrypt('abc1234', KEY), locator: null },
                { source_id: id, mechanism_id: 'untracked-skill', pin: PIN_UNKNOWN, locator: null },
            ],
        });
        for (const q of [id, 'git@github.com:acme/widget.git']) {
            const res = await run(['from', q, '--root', root], { EVENT4U_CONFIG_HOME: home });
            expect(res.err).toBe('');
            expect(res.rc).toBe(0);
            expect(res.out).toContain(url);
            expect(res.out).toMatch(/kept-mechanism\s+adopt\s+pin abc1234/);
            expect(res.out).toMatch(/untracked-skill\s+\(no decision\)\s+pin unknown/);
        }
    });

    it('refuses without a local ledger', async () => {
        const res = await run(['from', url, '--root', repo(ROWS)], { EVENT4U_CONFIG_HOME: tmp('lineage-query-home-') });
        expect(res.rc).toBe(2);
        expect(res.err).toMatch(/no local lineage ledger/);
    });

    it('refuses without the key', async () => {
        const home = tmp('lineage-query-home-');
        mergeIntoLedger(lineageDir({ EVENT4U_CONFIG_HOME: home }), { sources: [], edges: [] });
        const res = await run(['from', url, '--root', repo(ROWS)], { EVENT4U_CONFIG_HOME: home }, []);
        expect(res.rc).toBe(2);
        expect(res.err).toMatch(/link_encryption_key/);
    });
});
