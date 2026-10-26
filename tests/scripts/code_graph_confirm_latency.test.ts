/**
 * `confirm` latency on this repository's own graph (ADR-303 consequence: a
 * confirm must be cheap enough that agents run it). Budget: p95 ≤ 50 ms for a
 * call re-reading 20 witnesses, index open included. The graph is built when
 * this checkout has none, so the measurement is always against the real tree.
 */
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { graphHome } from '../../src/scripts/code_graph/graph_home.js';
import { openGraphIndex } from '../../src/scripts/code_graph/sqlite_store.js';
import { confirmIds } from '../../src/scripts/code_graph/verify/confirm.js';

const REPO_ROOT = path.resolve(__dirname, '../..');
const BUDGET_MS = 50;
const RUNS = 40;

describe('3.3 — confirm latency on this repository', () => {
    it(`p95 of a 20-witness confirm stays at or under ${BUDGET_MS} ms`, async () => {
        const cache = graphHome(REPO_ROOT).cachePath;
        let index = openGraphIndex(cache);
        if (!index) {
            await buildFromRepo(REPO_ROOT, cache, { update: true });
            index = openGraphIndex(cache);
        }
        if (!index) throw new Error('no graph index for this repository after a build');
        const ids = index
            .idsInFiles(['src/scripts/code_graph/query.ts', 'src/scripts/code_graph/build.ts', 'src/scripts/code_graph/cli.ts', 'src/scripts/code_graph/sqlite_store.ts'])
            .sort()
            .slice(0, 20);
        index.close();
        expect(ids).toHaveLength(20);

        confirmIds(REPO_ROOT, cache, ids, { shadow: false });
        const times: number[] = [];
        let witnesses = 0;
        for (let i = 0; i < RUNS; i++) {
            const t0 = performance.now();
            const r = confirmIds(REPO_ROOT, cache, ids, { shadow: false });
            times.push(performance.now() - t0);
            expect(r.status).toBe('ok');
            witnesses = r.witnesses;
        }
        times.sort((a, b) => a - b);
        const p95 = times[Math.ceil(0.95 * times.length) - 1] as number;
        const p50 = times[Math.floor(0.5 * times.length)] as number;
        process.stdout.write(`confirm latency on this repository: ${witnesses} witnesses, p50 ${p50.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms over ${RUNS} runs (budget ${BUDGET_MS} ms)\n`);
        expect(witnesses).toBe(20);
        expect(p95).toBeLessThanOrEqual(BUDGET_MS);
    }, 300_000);
});
