import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
    bench,
    benchLoadSplit,
    benchRepo,
    distribution,
    makeFixture,
    ORDERS,
    parseArgs,
    percentile,
} from '../../src/scripts/bench_graph_feeder_latency.js';
import { NATIVE_CACHE_REL } from '../../src/scripts/code_graph/detect.js';
import { sqliteTwinPath } from '../../src/scripts/code_graph/sqlite_store.js';

describe('bench_graph_feeder_latency — step 3.5 of road-to-a-graph-that-feeds-the-gate', () => {
    it('takes nearest-rank percentiles, so p95 of twenty samples is the nineteenth', () => {
        const s = Array.from({ length: 20 }, (_, i) => i + 1);
        expect(percentile(s, 50)).toBe(10);
        expect(percentile(s, 95)).toBe(19);
        expect(percentile(s, 100)).toBe(20);
        expect(Number.isNaN(percentile([], 50))).toBe(true);
        expect(distribution([3, 1, 2])).toStrictEqual({ n: 3, p50: 2, p95: 3, max: 3 });
    });

    it('measures both arms on the same turn, with the feeder on its full path and the exit code unmoved', async () => {
        const r = await bench({ runs: 3, files: 3 });
        // The `with` arm must reach the path the step prices — an uncommitted
        // edit over a built graph — or the reading measures the short-circuit.
        expect(r.graphState).toBe('edited');
        // The `without` arm is the baseline only if its feeder finds no graph at all.
        expect(r.graphStateWithout).toBe('absent');
        expect(r.with.n).toBe(3);
        expect(r.without.n).toBe(3);
        expect(r.feederOnly.n).toBe(3);
        // Detector F refuses in both arms, and the graph does not change that.
        expect(r.exitCodes.with).toStrictEqual([1]);
        expect(r.exitCodes.without).toStrictEqual([1]);
        // The feeder's own work is real work, not a no-op that reads as free.
        expect(r.feederOnly.p50).toBeGreaterThan(0);
        // ...and it timed the real walk: a swallowed load failure reads `null`.
        expect(r.feederVerdicts).toStrictEqual(['untested']);
    }, 120_000);

    it('cycles orders that balance every call\'s position and direct predecessor', () => {
        const first = new Map<number, number>();
        const pairs = new Map<string, number>();
        for (const o of ORDERS) {
            expect([...o].sort()).toStrictEqual([0, 1, 2]);
            first.set(o[0] as number, (first.get(o[0] as number) ?? 0) + 1);
            for (let k = 1; k < o.length; k++) {
                const key = `${o[k - 1]}>${o[k]}`;
                pairs.set(key, (pairs.get(key) ?? 0) + 1);
            }
        }
        expect([...first.values()]).toStrictEqual([2, 2, 2]);
        // Six ordered pairs of distinct calls, each a direct predecessor equally often.
        expect(pairs.size).toBe(6);
        expect(new Set(pairs.values())).toStrictEqual(new Set([2]));
    });

    it('does not balance the predecessor across a round boundary, which is why the claim is within-round', () => {
        const boundary = new Map<string, number>();
        ORDERS.forEach((o, i) => {
            const next = ORDERS[(i + 1) % ORDERS.length] as readonly number[];
            const key = `${o[o.length - 1]}>${next[0]}`;
            boundary.set(key, (boundary.get(key) ?? 0) + 1);
        });
        // Six transitions: two are a call following itself, and the rest do not
        // cover the six distinct ordered pairs once each.
        expect([...boundary.keys()].filter((k) => k.split('>')[0] === k.split('>')[1])).toHaveLength(2);
        expect([...boundary.keys()].filter((k) => k.split('>')[0] !== k.split('>')[1]).length).toBeLessThan(6);
    });

    it('records every round\'s verdict over an existing repository, not only the last', async () => {
        const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'feeder-repo-')));
        try {
            const dir = await makeFixture(root, 2, true);
            const r = benchRepo({ repo: dir, edit: 'src/service.ts', runs: 3 });
            expect(r.feederOnly.n).toBe(3);
            expect(r.verdicts).toStrictEqual(['untested']);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    }, 120_000);

    it('decomposes the load term over a copy, leaving the measured repository without a twin', async () => {
        const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'feeder-split-')));
        try {
            const dir = await makeFixture(root, 2, true);
            const graph = path.join(dir, NATIVE_CACHE_REL);
            const twin = sqliteTwinPath(graph);
            fs.rmSync(twin, { force: true });
            const r = benchLoadSplit({ graph, runs: 2 });
            // `--repo` re-emits this file through `loadGraph`; the split must not.
            expect(fs.existsSync(twin)).toBe(false);
            for (const d of Object.values(r.stages)) expect(d.n).toBe(2);
            expect(r.loadGraph.n).toBe(2);
            // A small graph with unique ids gets its twin, so the attempt is not a
            // silent failure here; a real index that fails reads 0 instead.
            expect(r.twinWritten).toBe(2);
            expect(r.nodes).toBeGreaterThan(0);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    }, 120_000);

    it('refuses flag combinations it would otherwise silently misread', () => {
        expect(parseArgs(['--load-split', 'g.json'])).not.toBeNull();
        expect(parseArgs(['--load-split', 'g.json', '--repo', '.', '--edit', 'src/a.ts'])).toBeNull();
        expect(parseArgs(['--load-split', 'g.json', '--files', '9'])).toBeNull();
        expect(parseArgs(['--load-split'])).toBeNull();
        expect(parseArgs(['--repo', '.', '--edit', 'src/a.ts'])).not.toBeNull();
        expect(parseArgs(['--repo', '.', '--edit', 'src/a.ts', '--files', '9'])).toBeNull();
        expect(parseArgs(['--repo', '--edit', 'src/a.ts'])).toBeNull();
        expect(parseArgs(['--repo', '.'])).toBeNull();
    });

    it('leaves an unset home variable unset, not the string "undefined"', async () => {
        const saved = process.env.USERPROFILE;
        delete process.env.USERPROFILE;
        try {
            await bench({ runs: 1, files: 1 });
            expect('USERPROFILE' in process.env).toBe(false);
        } finally {
            if (saved !== undefined) process.env.USERPROFILE = saved;
        }
    }, 120_000);

    it('builds its fixture in its own repository even under an inherited GIT_DIR', async () => {
        // A git hook exports GIT_DIR, and a child `git -C <fixture>` obeys it over
        // `-C`: init/add/commit would then land on the HOST repository instead.
        const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'feeder-gitdir-')));
        const victim = path.join(root, 'victim');
        fs.mkdirSync(victim);
        const env: NodeJS.ProcessEnv = {
            ...process.env,
            GIT_AUTHOR_NAME: 't',
            GIT_AUTHOR_EMAIL: 't@example.com',
            GIT_COMMITTER_NAME: 't',
            GIT_COMMITTER_EMAIL: 't@example.com',
        };
        for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete env[k];
        const vgit = (...args: string[]): string =>
            execFileSync('git', ['-C', victim, ...args], { env, encoding: 'utf8' }).trim();
        vgit('init', '-q');
        fs.writeFileSync(path.join(victim, 'keep.txt'), 'keep\n');
        vgit('add', '-A');
        vgit('commit', '-q', '-m', 'victim');
        const head = vgit('rev-parse', 'HEAD');
        vi.stubEnv('GIT_DIR', path.join(victim, '.git'));
        // Re-import under the stubbed env, so a module-level env snapshot sees it too.
        vi.resetModules();
        try {
            const mod = await import('../../src/scripts/bench_graph_feeder_latency.js');
            const dir = await mod.makeFixture(root, 1, false);
            expect(vgit('rev-parse', 'HEAD')).toBe(head);
            expect(fs.existsSync(path.join(dir, '.git'))).toBe(true);
        } finally {
            vi.unstubAllEnvs();
            vi.resetModules();
            fs.rmSync(root, { recursive: true, force: true });
        }
    }, 120_000);
});
