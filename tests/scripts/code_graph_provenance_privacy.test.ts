import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';
import type { MapProvenance } from '../../src/scripts/code_graph/map_model.js';
import { AUDIT_SUBJECTS, writeAuditFixture } from './code_graph/audit_fixture.js';

let root: string;
let mapDir: string;

const committedFiles = (d: string): string[] =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.name === '.build' ? [] : e.isDirectory() ? committedFiles(path.join(d, e.name)) : [path.join(d, e.name)]));

beforeAll(async () => {
    root = writeAuditFixture();
    fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
    mapDir = (await buildMap(root, {})).outDir;
}, 120_000);
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('no commit subject in a committed map file (H13)', () => {
    it('the commit tuple holds sha, date, author, PR and tickets only', () => {
        const prov = (JSON.parse(fs.readFileSync(path.join(mapDir, 'code', 'map.json'), 'utf-8')) as { model: { provenance: MapProvenance } }).model.provenance;
        expect(prov.commits.length).toBeGreaterThan(0);
        for (const c of prov.commits) expect(c).toHaveLength(5);
        expect(prov.commits.some((c) => c[3] === '#9')).toBe(true);
    });

    it.each(AUDIT_SUBJECTS.map((s) => [s]))('subject %j appears nowhere under the map folder outside .build/', (subject) => {
        const hits = committedFiles(mapDir).filter((f) => fs.readFileSync(f, 'utf-8').includes(subject));
        expect(hits.map((f) => path.relative(mapDir, f))).toEqual([]);
    });
});
