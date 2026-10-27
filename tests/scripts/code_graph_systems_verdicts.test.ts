import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { readSystems } from '../../src/scripts/code_graph/lanes/systems/index.js';
import type { LaneOutput } from '../../src/scripts/code_graph/lanes/lane_fact.js';
import { writeAuditPhpFixture } from './code_graph/audit_fixture.js';

let root: string;
let out: LaneOutput;
const pkg = (name: string) => out.facts.find((f) => f.kind === 'package' && f.attrs['name'] === name);

beforeAll(async () => {
    root = writeAuditPhpFixture();
    const edit = (rel: string, f: (d: Record<string, any>) => void): void => {
        const d = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf-8'));
        f(d);
        fs.writeFileSync(path.join(root, rel), JSON.stringify(d, null, 4));
    };
    edit('composer.json', (d) => {
        Object.assign(d.require, { 'acme/core': '^1.0', 'acme/ignored': '^1.0', 'acme/meta': '^1.0' });
        d.extra = { unused: ['acme/ignored'] };
    });
    edit('composer.lock', (d) => {
        const legacy = d.packages.find((p: { name: string }) => p.name === 'acme/legacy');
        legacy.require = { 'acme/core': '^1.0' };
        d.packages.push({ name: 'acme/core', version: '1.0.0', autoload: { 'psr-4': { 'Acme\\Core\\': 'src/' } } });
        d.packages.push({ name: 'acme/ignored', version: '1.0.0', autoload: { 'psr-4': { 'Acme\\Ignored\\': 'src/' } } });
        d.packages.push({ name: 'acme/meta', version: '1.0.0', type: 'metapackage', require: { 'acme/core': '^1.0' } });
    });
    fs.mkdirSync(path.join(root, 'tests/fixtures/demo'), { recursive: true });
    fs.writeFileSync(path.join(root, 'tests/fixtures/demo/composer.json'), JSON.stringify({ require: { 'acme/fixture-only': '^1.0' } }));
    const { graph } = await buildFromRepo(root, null, { lanes: false });
    out = readSystems(root, { graph });
}, 120_000);
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('systems verdict states (6.2, H11)', () => {
    it.each([
        ['dompdf/dompdf', 'used'],
        ['acme/core', 'used-through acme/legacy'],
        ['acme/unused', 'unused-candidate'],
        ['ghost/missing', 'not-installed'],
        ['acme/meta', 'virtual/meta'],
        ['acme/ignored', 'ignored (composer.json extra.unused)'],
    ])('%s → %s', (name, verdict) => {
        expect(pkg(name)?.attrs['verdict']).toBe(verdict);
    });

    it('raises SY-1 only on an unused candidate in product scope', () => {
        const flagged = out.facts.filter((f) => f.kind === 'package' && f.attrs['unused'] === true).map((f) => f.attrs['name']);
        expect(flagged).toContain('acme/unused');
        expect(flagged).not.toContain('acme/fixture-only');
        expect(flagged).not.toContain('ghost/missing');
        expect(flagged).not.toContain('acme/core');
        expect(pkg('acme/fixture-only')?.attrs['verdict']).toBe('unused-candidate');
    });
});
