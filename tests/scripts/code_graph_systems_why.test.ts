import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { produceAreas, WHY_CHAIN_CAP } from '../../src/scripts/code_graph/map_area_payloads.js';
import type { SystemsPackage } from '../../src/scripts/code_graph/map_areas.js';

let root: string;
let pkgs: SystemsPackage[];
const pkg = (name: string): SystemsPackage => pkgs.find((p) => p.name === name)!;

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-why-')));
    const w = (rel: string, body: unknown): void => fs.writeFileSync(path.join(root, rel), typeof body === 'string' ? body : JSON.stringify(body, null, 2));
    const deps = { express: '^4.19.0', compression: '^1.7.0' };
    w('package.json', { name: 'app', dependencies: deps });
    w('package-lock.json', {
        name: 'app',
        lockfileVersion: 3,
        packages: {
            '': { name: 'app', dependencies: deps },
            'node_modules/express': { version: '4.19.2', dependencies: { 'body-parser': '1.20.2' } },
            'node_modules/body-parser': { version: '1.20.2', dependencies: { bytes: '3.1.2' } },
            'node_modules/compression': { version: '1.7.4', dependencies: { bytes: '3.0.0 || 3.1.2' } },
            'node_modules/bytes': { version: '3.1.2' },
        },
    });
    w('app.js', "const express = require('express');\nconst compression = require('compression');\nmodule.exports = express().use(compression());\n");
    const { graph } = await buildFromRepo(root, null, { lanes: true });
    pkgs = produceAreas(root, graph).areas.systems!.packages;
}, 120_000);
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('why and who, precomputed and bounded (6.5, H11)', () => {
    it('express: a direct package has one chain, its declaration with the spec', () => {
        expect(pkg('express').why).toEqual([['express@4.19.2 (^4.19.0)']]);
        expect(pkg('express').subtree).toBe(2);
        expect(pkg('express').dependents).toBe(0);
    });

    it('every chain to a shared package, each hop with the spec it was required by', () => {
        expect(pkg('bytes').why).toEqual([
            ['compression@1.7.4 (^1.7.0)', 'bytes@3.1.2 (3.0.0 || 3.1.2)'],
            ['express@4.19.2 (^4.19.0)', 'body-parser@1.20.2 (1.20.2)', 'bytes@3.1.2 (3.1.2)'],
        ]);
        expect(pkg('bytes').dependents).toBe(3);
        expect(pkg('bytes').subtree).toBe(0);
    });

    it('caps the chains per package', () => {
        expect(WHY_CHAIN_CAP).toBe(20);
        for (const p of pkgs) expect(p.why.length).toBeLessThanOrEqual(WHY_CHAIN_CAP);
    });
});
