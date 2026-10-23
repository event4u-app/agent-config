#!/usr/bin/env tsx
/**
 * Cost readings for the code graph and its map (road-to-a-map-that-draws-itself 8.1).
 *
 *   tsx internal/bench/code-graph/map_cost.ts <root> [--synthetic <n>]
 *
 * With `--synthetic <n>`, `<root>` is first filled with `n` generated
 * TypeScript files in 50 coupled packages (a fresh scratch directory is
 * expected). Then, against `<root>`: a cold engine build, the SQLite twin's
 * emission alone, the map build, the size of index.html, and `query` p50 / p95
 * over 40 seeds on the path the engine actually takes (index or JSON).
 *
 * Prints one JSON object. Wall-clock, so the numbers vary by machine; they are
 * recorded with the commit and the machine class, never as a promise.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';

import { buildFromRepo } from '../../../src/scripts/code_graph/build.js';
import { buildMap } from '../../../src/scripts/code_graph/map.js';
import { loadGraph, query } from '../../../src/scripts/code_graph/query.js';
import { emitSqliteTwin, INDEXED_READ_MIN_EDGES } from '../../../src/scripts/code_graph/sqlite_store.js';
import { serializeGraph } from '../../../src/scripts/code_graph/build.js';

function synthesise(root: string, n: number): void {
    const packages = 50;
    for (let i = 0; i < n; i++) {
        const pkg = i % packages;
        const dir = path.join(root, 'src', `pkg${pkg}`);
        fs.mkdirSync(dir, { recursive: true });
        const peer = (i + packages) % n;
        const other = (i * 7 + 3) % n;
        const imports = [peer, ...(i % 10 === 0 ? [other] : [])]
            .filter((j) => j !== i)
            .map((j) => `import { f${j} } from '../pkg${j % packages}/m${j}.js';`)
            .join('\n');
        fs.writeFileSync(
            path.join(dir, `m${i}.ts`),
            `${imports}\nexport function f${i}(x: number): number {\n    return x + 1;\n}\nexport class C${i} {\n    run(): number { return f${i}(1); }\n}\n`,
        );
    }
}

function pct(sorted: number[], q: number): number {
    return Math.round((sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0) * 100) / 100;
}

async function main(): Promise<void> {
    const [rootArg, flag, nArg] = process.argv.slice(2);
    if (!rootArg) {
        process.stderr.write('usage: map_cost.ts <root> [--synthetic <n>]\n');
        process.exit(2);
    }
    const root = path.resolve(rootArg);
    if (flag === '--synthetic') synthesise(root, Number(nArg ?? 10_000));
    const cache = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'map-cost-')), 'code-graph-v1.json');

    let t = performance.now();
    const built = await buildFromRepo(root, cache);
    const engineBuildMs = performance.now() - t;

    t = performance.now();
    const twin = emitSqliteTwin(built.graph, serializeGraph(built.graph), cache);
    const twinMs = performance.now() - t;

    const outDir = path.join(path.dirname(cache), 'map');
    t = performance.now();
    const map = await buildMap(root, { outDir, cachePath: cache });
    const mapMs = performance.now() - t;
    const htmlBytes = fs.statSync(path.join(outDir, 'index.html')).size;

    const g = loadGraph(cache);
    const seeds = built.graph.nodes
        .filter((n) => n.kind === 'function' || n.kind === 'method' || n.kind === 'class')
        .map((n) => n.id)
        .filter((_, i, all) => i % Math.max(1, Math.floor(all.length / 40)) === 0)
        .slice(0, 40);
    const times: number[] = [];
    for (const s of seeds) {
        const q0 = performance.now();
        query(g, s, 1500);
        times.push(performance.now() - q0);
    }
    times.sort((a, b) => a - b);

    const r = (x: number): number => Math.round(x);
    process.stdout.write(
        `${JSON.stringify(
            {
                root: path.basename(root),
                files: built.fileCount,
                nodes: built.graph.nodes.length,
                edges: built.graph.edges.length,
                engine_build_ms: r(engineBuildMs),
                twin_written: twin,
                twin_emission_ms: r(twinMs),
                map_build_ms: r(mapMs),
                areas: map.model.areas.length,
                largest_area_share: Math.round(
                    ((map.model.areas.find((a) => a.kind === 'area')?.files.length ?? 0) /
                        Math.max(1, map.model.files.filter((f) => f.area >= 0).length)) *
                        1000,
                ) / 10,
                index_html_bytes: htmlBytes,
                query_path: built.graph.edges.length >= INDEXED_READ_MIN_EDGES ? 'index' : 'json',
                query_ms_p50: pct(times, 0.5),
                query_ms_p95: pct(times, 0.95),
                seeds: seeds.length,
            },
            null,
            2,
        )}\n`,
    );
    g.close?.();
}

main().catch((e) => {
    process.stderr.write(`${(e as Error).stack ?? String(e)}\n`);
    process.exit(3);
});
