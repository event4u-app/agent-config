import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { readSystems } from '../../src/scripts/code_graph/lanes/systems/index.js';
import type { LaneOutput } from '../../src/scripts/code_graph/lanes/lane_fact.js';

let root: string;
let out: LaneOutput;

beforeAll(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-importers-')));
    const w = (rel: string, body: unknown): void => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), JSON.stringify(body, null, 2));
    };
    // Two projects in one tree: the API declares lodash, the web app gets the same lodash through express.
    w('api/package.json', { name: 'api', dependencies: { lodash: '^4.17.0' } });
    w('api/package-lock.json', { name: 'api', lockfileVersion: 3, packages: { '': { name: 'api', dependencies: { lodash: '^4.17.0' } }, 'node_modules/lodash': { version: '4.17.21' } } });
    w('web/package.json', { name: 'web', devDependencies: { express: '^4.0.0' } });
    w('web/package-lock.json', { name: 'web', lockfileVersion: 3, packages: { '': { name: 'web', devDependencies: { express: '^4.0.0' } }, 'node_modules/express': { version: '4.19.2', dev: true, dependencies: { lodash: '^4.17.0' } }, 'node_modules/lodash': { version: '4.17.21', dev: true } } });
    out = readSystems(root);
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('per-workspace package identity (6.4, H11)', () => {
    it('keeps one node per ecosystem, name and version', () => {
        const lodash = out.facts.filter((f) => f.kind === 'package' && f.attrs['name'] === 'lodash');
        expect(lodash.map((f) => f.id)).toEqual(['package:npm:lodash@4.17.21']);
    });

    it('lists every importer with lockfile, workspace, specifier, relation and scope', () => {
        const rows = (out.facts.find((f) => f.id === 'package:npm:lodash@4.17.21')?.attrs['importers'] as string[]).map((r) => JSON.parse(r));
        expect(rows).toEqual([
            { lockfile: 'api/package-lock.json', workspace: 'api', specifier: '^4.17.0', relation: 'prod', scope: 'product' },
            { lockfile: 'web/package-lock.json', workspace: 'web', specifier: '^4.17.0', relation: 'transitive via express', scope: 'product' },
        ]);
    });
});
