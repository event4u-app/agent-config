import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { runLaneReaders } from '../../src/scripts/code_graph/lane_runner.js';
import { buildMap, MAP_LANES } from '../../src/scripts/code_graph/map.js';
import { writeProvenanceFixture } from './code_graph/provenance_fixture.js';

let root: string;
let cacheDir: string;

beforeAll(() => {
    root = writeProvenanceFixture();
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-cache-lanes-'));
    fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
});
afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(cacheDir, { recursive: true, force: true });
});

describe('the map cache key includes the lane set (4.5, H24)', () => {
    it('rebuilds instead of drawing from a fresh but lane-less cache', async () => {
        const cachePath = path.join(cacheDir, 'no-lanes.json');
        await buildFromRepo(root, cachePath, { lanes: false });
        const res = await buildMap(root, { cachePath });
        expect(res.graphBuilt).toBe(true);
        const g = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as { lanes_run?: Array<{ lane: string }> };
        expect(g.lanes_run?.map((r) => r.lane).sort()).toEqual([...MAP_LANES].sort());
    }, 120_000);

    it('reuses a fresh cache that carries every lane', async () => {
        const cachePath = path.join(cacheDir, 'lanes.json');
        await buildFromRepo(root, cachePath, { lanes: true });
        const res = await buildMap(root, { cachePath });
        expect(res.graphBuilt).toBe(false);
    }, 120_000);

    it('names the same lanes the lane runner runs', async () => {
        const { graph } = await buildFromRepo(root, null, { lanes: false });
        expect(runLaneReaders(root, graph).graph.lanes_run?.map((r) => r.lane).sort()).toEqual([...MAP_LANES].sort());
    }, 120_000);
});
