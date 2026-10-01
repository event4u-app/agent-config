// Tests for src/scripts/check_hook_bundle_composition.ts.
//
// `road-to-a-hook-bundle-with-one-yaml-reader` 1.3 and 2.1. Two invariants over
// one artefact: the hook bundle carries ONE YAML reader, and its byte count sits
// under a recorded ceiling.
//
// The verdict functions are pure over an esbuild metafile, so every case here
// drives them with a planted metafile rather than a 1.5 MB build — which is also
// what makes the one-byte-over case expressible at all. One case does build the
// real bundle, because a pure function over a hand-written fixture proves the
// arithmetic and not that the gate is pointed at anything.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    YAML_PACKAGES,
    analyzeMetafile,
    buildMetafile,
    owningPackage,
    readBudget,
    verdict,
} from '../../src/scripts/check_hook_bundle_composition.js';

const REPO = path.resolve(__dirname, '..', '..');

/** An esbuild metafile with one output, built from `inputs` keyed by path. */
function metafile(outBytes: number, inputs: Record<string, number>): string {
    const entries: Record<string, { bytesInOutput: number }> = {};
    for (const [p, b] of Object.entries(inputs)) entries[p] = { bytesInOutput: b };
    return JSON.stringify({
        inputs: {},
        outputs: {
            'dist/hooks/dispatch.js': {
                entryPoint: 'src/scripts/hooks/dispatch_entry.ts',
                bytes: outBytes,
                inputs: entries,
                imports: [],
                exports: [],
            },
        },
    });
}

const BUDGET = { maxBytes: 1_500_000, maxYamlPackages: 1 };

describe('check_hook_bundle_composition — owningPackage', () => {
    it('attributes a node_modules path to its package, scoped names included', () => {
        expect(owningPackage('node_modules/yaml/dist/index.js')).toBe('yaml');
        expect(owningPackage('node_modules/js-yaml/dist/js-yaml.mjs')).toBe('js-yaml');
        expect(owningPackage('node_modules/@scope/pkg/x.js')).toBe('@scope/pkg');
    });

    it('attributes a nested node_modules path to the innermost package', () => {
        expect(owningPackage('node_modules/a/node_modules/yaml/dist/index.js')).toBe('yaml');
    });

    it('returns null for this tree\'s own sources', () => {
        expect(owningPackage('src/scripts/hooks/dispatch_entry.ts')).toBeNull();
    });
});

describe('check_hook_bundle_composition — analyzeMetafile', () => {
    it('sums bytes per package and counts the modules it inspected', () => {
        const a = analyzeMetafile(
            metafile(300, {
                'src/scripts/hooks/dispatch_entry.ts': 100,
                'node_modules/yaml/dist/index.js': 150,
                'node_modules/yaml/dist/parse.js': 50,
            }),
        );
        expect(a.bytes).toBe(300);
        expect(a.modules).toBe(3);
        expect(a.packageBytes.get('yaml')).toBe(200);
        expect(a.yamlPackages).toEqual(['yaml']);
    });

    it('ignores a package that contributes zero bytes rather than counting it as present', () => {
        const a = analyzeMetafile(
            metafile(100, {
                'node_modules/yaml/dist/index.js': 100,
                'node_modules/js-yaml/dist/js-yaml.mjs': 0,
            }),
        );
        expect(a.yamlPackages).toEqual(['yaml']);
    });

    it('throws on a metafile with no entry-point output rather than reporting zero', () => {
        expect(() => analyzeMetafile(JSON.stringify({ inputs: {}, outputs: {} }))).toThrow(/entry/u);
    });
});

describe('check_hook_bundle_composition — verdict, one YAML reader', () => {
    it('passes a bundle carrying exactly one YAML reader', () => {
        const a = analyzeMetafile(
            metafile(1000, { 'node_modules/yaml/dist/index.js': 1000 }),
        );
        expect(verdict(a, BUDGET)).toEqual([]);
    });

    it('fails a bundle carrying a second YAML reader, and names both', () => {
        const a = analyzeMetafile(
            metafile(1000, {
                'node_modules/yaml/dist/index.js': 600,
                'node_modules/js-yaml/dist/js-yaml.mjs': 400,
            }),
        );
        const findings = verdict(a, BUDGET);
        expect(findings).toHaveLength(1);
        expect(findings[0]).toContain('yaml');
        expect(findings[0]).toContain('js-yaml');
    });

    it('knows about every YAML package it claims to cap', () => {
        expect(YAML_PACKAGES).toContain('yaml');
        expect(YAML_PACKAGES).toContain('js-yaml');
    });
});

describe('check_hook_bundle_composition — verdict, the ceiling', () => {
    it('passes a bundle exactly at the ceiling', () => {
        const a = analyzeMetafile(metafile(1_500_000, { 'src/x.ts': 1_500_000 }));
        expect(verdict(a, BUDGET)).toEqual([]);
    });

    it('fails a planted bundle one byte over the ceiling', () => {
        const a = analyzeMetafile(metafile(1_500_001, { 'src/x.ts': 1_500_001 }));
        const findings = verdict(a, BUDGET);
        expect(findings).toHaveLength(1);
        expect(findings[0]).toContain('1500001');
        expect(findings[0]).toContain('1500000');
    });

    it('reports both findings when a bundle is over the ceiling AND carries two readers', () => {
        const a = analyzeMetafile(
            metafile(1_500_001, {
                'node_modules/yaml/dist/index.js': 1_000_000,
                'node_modules/js-yaml/dist/js-yaml.mjs': 500_001,
            }),
        );
        expect(verdict(a, BUDGET)).toHaveLength(2);
    });
});

describe('check_hook_bundle_composition — the budget file', () => {
    it('reads the committed ceiling and parser cap', () => {
        const b = readBudget(REPO);
        expect(b.maxBytes).toBeGreaterThan(0);
        expect(b.maxYamlPackages).toBe(1);
    });

    it('refuses a budget whose ceiling is not a positive integer', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hbb-'));
        try {
            fs.mkdirSync(path.join(dir, 'src', 'config'), { recursive: true });
            fs.writeFileSync(
                path.join(dir, 'src', 'config', 'hook-bundle-budget.json'),
                JSON.stringify({ max_bytes: 'lots', max_yaml_packages: 1 }),
            );
            expect(() => readBudget(dir)).toThrow(/max_bytes/u);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

// The one case that proves the gate is pointed at the real artefact. Everything
// above is arithmetic over a fixture and would stay green if `build:hooks` were
// renamed out from under it.
describe('check_hook_bundle_composition — against the real build', () => {
    it('builds the hook bundle and finds it under the committed ceiling with one reader', () => {
        const meta = buildMetafile(REPO);
        const a = analyzeMetafile(meta);
        expect(a.modules).toBeGreaterThan(100);
        expect(a.yamlPackages).toEqual(['yaml']);
        expect(verdict(a, readBudget(REPO))).toEqual([]);
    }, 120_000);
});
