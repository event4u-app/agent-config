import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { produceAreas } from '../../src/scripts/code_graph/map_area_payloads.js';
import type { SystemsPackage } from '../../src/scripts/code_graph/map_areas.js';

let root: string;
let lodash: SystemsPackage;

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-functions-')));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'app', dependencies: { lodash: '^4.17.0' } }));
    fs.writeFileSync(path.join(root, 'a.js'), "import { map, filter } from 'lodash';\nexport function f(xs) { map(xs); return filter(xs); }\nexport function g(xs) { return map(xs); }\n");
    fs.writeFileSync(path.join(root, 'b.js'), "import { map } from 'lodash';\nexport const h = (xs) => map(xs);\n");
    const { graph } = await buildFromRepo(root, null, { lanes: true });
    lodash = produceAreas(root, graph).areas.systems!.packages.find((p) => p.name === 'lodash')!;
}, 120_000);
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('functions per file with counts (6.6)', () => {
    it('names each function a file uses with the number of symbols that call it', () => {
        const a = lodash.usedBy.find((u) => u.file === 'a.js');
        expect(a?.names).toEqual(['filter', 'map']);
        expect(a?.counts).toEqual({ filter: 1, map: 2 });
        expect(lodash.usedBy.find((u) => u.file === 'b.js')?.counts).toEqual({ map: 1 });
    });

    it('sums them per package', () => {
        expect(lodash.functions).toEqual({ filter: 1, map: 3 });
    });
});
