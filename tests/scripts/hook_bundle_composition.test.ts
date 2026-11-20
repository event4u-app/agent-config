// Tests for src/scripts/check_hook_bundle_composition.ts.
//
// Two invariants over one artefact: every npm package in the hook bundle is on
// the committed allowlist (which is what keeps a second YAML reader out), and
// its byte count sits under a wide backstop
// (road-to-a-hook-system-that-pays-for-what-it-does 1.1, 1.2).
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
    analyzeMetafile,
    buildChunkBytes,
    buildMetafile,
    main as compositionMain,
    owningPackage,
    readBudget,
    unlistedPackages,
    verdict,
} from '../../src/scripts/check_hook_bundle_composition.js';
import { buildChunk, HOOK_CHUNKS, main as hookChunksMain } from '../../src/scripts/hook_chunks.mjs';
import { verifyBundle } from '../../src/scripts/hooks/bundle_integrity.js';

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

const BUDGET = { maxBytes: 1_500_000, allowedPackages: ['yaml'] };

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
        expect([...a.packageBytes.keys()]).toEqual(['yaml']);
    });

    it('ignores a package that contributes zero bytes rather than counting it as present', () => {
        const a = analyzeMetafile(
            metafile(100, {
                'node_modules/yaml/dist/index.js': 100,
                'node_modules/js-yaml/dist/js-yaml.mjs': 0,
            }),
        );
        expect([...a.packageBytes.keys()]).toEqual(['yaml']);
        expect(unlistedPackages(a, BUDGET)).toEqual([]);
    });

    it('fails a package bundled from two copies on disk, a nested duplicate under the same name', () => {
        const a = analyzeMetafile(
            metafile(1000, { 'node_modules/yaml/dist/index.js': 600, 'node_modules/x/node_modules/yaml/dist/index.js': 400 }),
        );
        expect(a.duplicated).toEqual(['yaml']);
        expect(verdict(a, BUDGET).some((f) => f.includes('more than one copy'))).toBe(true);
    });

    it('refuses an entry output with no byte count or no inputs instead of reading it as empty', () => {
        const noBytes = JSON.stringify({ outputs: { o: { entryPoint: 'src/scripts/hooks/dispatch_entry.ts', inputs: { 'src/x.ts': { bytesInOutput: 1 } } } } });
        const noInputs = JSON.stringify({ outputs: { o: { entryPoint: 'src/scripts/hooks/dispatch_entry.ts', bytes: 10, inputs: {} } } });
        expect(() => analyzeMetafile(noBytes)).toThrow(/byte count or no inputs/u);
        expect(() => analyzeMetafile(noInputs)).toThrow(/byte count or no inputs/u);
    });

    it('measures the dispatch entry when the metafile carries several entry outputs', () => {
        const json = JSON.stringify({
            outputs: {
                other: { entryPoint: 'src/other.ts', bytes: 5, inputs: { 'src/other.ts': { bytesInOutput: 5 } } },
                main: { entryPoint: 'src/scripts/hooks/dispatch_entry.ts', bytes: 7, inputs: { 'src/a.ts': { bytesInOutput: 7 } } },
            },
        });
        expect(analyzeMetafile(json).bytes).toBe(7);
        const ambiguous = JSON.stringify({
            outputs: {
                a: { entryPoint: 'src/a.ts', bytes: 5, inputs: { 'src/a.ts': { bytesInOutput: 5 } } },
                b: { entryPoint: 'src/b.ts', bytes: 7, inputs: { 'src/b.ts': { bytesInOutput: 7 } } },
            },
        });
        expect(() => analyzeMetafile(ambiguous)).toThrow(/none is/u);
    });

    it('on the gate\'s own build, a single output built from another entry is refused, not measured', () => {
        const wrong = JSON.stringify({ outputs: { o: { entryPoint: 'src/other.ts', bytes: 5, inputs: { 'src/other.ts': { bytesInOutput: 5 } } } } });
        expect(() => analyzeMetafile(wrong, { requireEntry: true })).toThrow(/none is/u);
        expect(analyzeMetafile(wrong).bytes).toBe(5);
    });

    it('refuses byte counts no build could write: negative, fractional, unsafe', () => {
        for (const bad of [-1, 1.5, Number.MAX_SAFE_INTEGER + 2]) {
            const out = JSON.stringify({ outputs: { o: { entryPoint: 'src/scripts/hooks/dispatch_entry.ts', bytes: bad, inputs: { 'src/a.ts': { bytesInOutput: 1 } } } } });
            const inp = JSON.stringify({ outputs: { o: { entryPoint: 'src/scripts/hooks/dispatch_entry.ts', bytes: 9, inputs: { 'src/a.ts': { bytesInOutput: bad } } } } });
            expect(() => analyzeMetafile(out), String(bad)).toThrow();
            expect(() => analyzeMetafile(inp), String(bad)).toThrow();
        }
    });

    it('refuses an inputs list that is an array, not a path-keyed object', () => {
        const json = JSON.stringify({ outputs: { o: { entryPoint: 'src/scripts/hooks/dispatch_entry.ts', bytes: 9, inputs: [{ bytesInOutput: 9 }] } } });
        expect(() => analyzeMetafile(json)).toThrow(/byte count or no inputs/u);
    });

    it('refuses an input with no bytesInOutput instead of counting it as zero', () => {
        const json = JSON.stringify({
            outputs: { o: { entryPoint: 'src/scripts/hooks/dispatch_entry.ts', bytes: 9, inputs: { 'node_modules/left-pad/x.js': {} } } },
        });
        expect(() => analyzeMetafile(json)).toThrow(/bytesInOutput/u);
    });

    it('throws on a metafile with no entry-point output rather than reporting zero', () => {
        expect(() => analyzeMetafile(JSON.stringify({ inputs: {}, outputs: {} }))).toThrow(/entry/u);
    });
});

describe('check_hook_bundle_composition — verdict, the package allowlist', () => {
    it('passes a bundle carrying only listed packages', () => {
        const a = analyzeMetafile(
            metafile(1000, { 'node_modules/yaml/dist/index.js': 1000 }),
        );
        expect(verdict(a, BUDGET)).toEqual([]);
    });

    it('fails a bundle carrying a second YAML reader, and names the unlisted one', () => {
        const a = analyzeMetafile(
            metafile(1000, {
                'node_modules/yaml/dist/index.js': 600,
                'node_modules/js-yaml/dist/js-yaml.mjs': 400,
            }),
        );
        const findings = verdict(a, BUDGET);
        expect(findings).toHaveLength(1);
        expect(findings[0]).toContain('js-yaml (400 B)');
    });

    it('fails any unlisted package, not only one with YAML in its name', () => {
        const a = analyzeMetafile(
            metafile(1000, { 'node_modules/yaml/dist/index.js': 900, 'node_modules/@scope/parser/x.js': 100 }),
        );
        expect(unlistedPackages(a, BUDGET)).toEqual(['@scope/parser']);
        expect(verdict(a, BUDGET)).toHaveLength(1);
    });

    it('passes a package once it is listed', () => {
        const a = analyzeMetafile(metafile(1000, { 'node_modules/yaml/dist/index.js': 900, 'node_modules/left-pad/x.js': 100 }));
        expect(verdict(a, { ...BUDGET, allowedPackages: ['yaml', 'left-pad'] })).toEqual([]);
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
    it('reads the committed backstop and allowlist, and carries no ratchet fields', () => {
        const b = readBudget(REPO);
        expect(b.maxBytes).toBeGreaterThan(0);
        expect(b.allowedPackages).toEqual(['yaml']);
        const raw = fs.readFileSync(path.join(REPO, 'src', 'config', 'hook-bundle-budget.json'), 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        for (const k of ['shrink_only', 'raise_log', 'chunks', 'chunk_groups', 'max_yaml_packages']) expect(parsed[k], k).toBeUndefined();
        expect(raw.length).toBeLessThan(3 * 1024);
    });

    it('refuses a budget without an allowlist', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hbb-'));
        try {
            fs.mkdirSync(path.join(dir, 'src', 'config'), { recursive: true });
            fs.writeFileSync(path.join(dir, 'src', 'config', 'hook-bundle-budget.json'), JSON.stringify({ max_bytes: 10 }));
            expect(() => readBudget(dir)).toThrow(/allowed_packages/u);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('refuses a budget whose ceiling is not a positive integer', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hbb-'));
        try {
            fs.mkdirSync(path.join(dir, 'src', 'config'), { recursive: true });
            fs.writeFileSync(
                path.join(dir, 'src', 'config', 'hook-bundle-budget.json'),
                JSON.stringify({ max_bytes: 'lots', allowed_packages: ['yaml'] }),
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
    it('builds the hook bundle and finds it under the backstop with listed packages only', () => {
        const meta = buildMetafile(REPO);
        const a = analyzeMetafile(meta);
        expect(a.modules).toBeGreaterThan(100);
        expect([...a.packageBytes.keys()]).toEqual(['yaml']);
        expect(verdict(a, readBudget(REPO))).toEqual([]);
    }, 120_000);
});

describe('chunk builds — one definition, used by the build and by the gate', () => {
    const ENTRY = 'src/scripts/_lib/egress_engine.ts';

    it('package.json builds chunks through the one definition', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf-8')) as { scripts: Record<string, string> };
        expect(pkg.scripts['build:hook-chunks']).toBe('node src/scripts/hook_chunks.mjs');
    });

    it('measures the bytes the definition builds', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunk-measure-'));
        try {
            const out = path.join(dir, 'c.cjs');
            buildChunk(REPO, ENTRY, out);
            expect(buildChunkBytes(REPO, ENTRY)).toBe(fs.statSync(out).size);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }, 60_000);

    it('the build script writes every defined chunk and a matching digest sidecar', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunk-main-'));
        try {
            expect(hookChunksMain(['--out-dir', dir])).toBe(0);
            for (const c of HOOK_CHUNKS) {
                const out = path.join(dir, c.outfile);
                expect(fs.existsSync(out), c.outfile).toBe(true);
                expect(verifyBundle(out).state, c.outfile).toBe('ok');
            }
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }, 60_000);

    it('refuses to measure an entry no chunk is defined for', () => {
        expect(() => buildChunkBytes(REPO, 'src/scripts/_lib/no_such_chunk.ts')).toThrow(/defines no chunk/);
    });
});

describe('check_hook_bundle_composition — the CLI against the committed budget', () => {
    const run = (outBytes: number, inputs: Record<string, number>): number => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'composition-cli-'));
        const fixture = path.join(dir, 'meta.json');
        fs.writeFileSync(fixture, metafile(outBytes, inputs));
        const quiet = (): boolean => true;
        const out = process.stdout.write;
        const err = process.stderr.write;
        process.stdout.write = quiet as typeof process.stdout.write;
        process.stderr.write = quiet as typeof process.stderr.write;
        try {
            return compositionMain(['--metafile', fixture], REPO);
        } finally {
            process.stdout.write = out;
            process.stderr.write = err;
            fs.rmSync(dir, { recursive: true, force: true });
        }
    };
    const committed = (JSON.parse(fs.readFileSync(path.join(REPO, 'src', 'config', 'hook-bundle-budget.json'), 'utf-8')) as { max_bytes: number }).max_bytes;

    it('exits 0 at the committed backstop with listed packages only', () => {
        expect(committed).toBe(1_915_000);
        expect(run(committed, { 'node_modules/yaml/dist/index.js': 1000, 'src/x.ts': committed - 1000 })).toBe(0);
    });

    it('exits 1 one byte over the committed backstop', () => {
        expect(run(committed + 1, { 'src/x.ts': committed + 1 })).toBe(1);
    });

    it('exits 1 on an unlisted package below the backstop, and on an allowlisted bundle above it', () => {
        expect(run(1000, { 'node_modules/yaml/dist/index.js': 900, 'node_modules/left-pad/x.js': 100 })).toBe(1);
        expect(run(committed + 1, { 'node_modules/yaml/dist/index.js': committed + 1 })).toBe(1);
    });

    it('exits 2 on an invalid budget and on a failed build, never 0', () => {
        const quiet = (): boolean => true;
        const err = process.stderr.write;
        const out = process.stdout.write;
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'composition-root-'));
        try {
            process.stderr.write = quiet as typeof process.stderr.write;
            process.stdout.write = quiet as typeof process.stdout.write;
            fs.mkdirSync(path.join(dir, 'src', 'config'), { recursive: true });
            const budget = path.join(dir, 'src', 'config', 'hook-bundle-budget.json');
            // No allowlist: refused before anything is measured.
            fs.writeFileSync(budget, JSON.stringify({ max_bytes: 1000 }));
            expect(compositionMain([], dir)).toBe(2);
            fs.writeFileSync(budget, JSON.stringify({ max_bytes: -1, allowed_packages: ['yaml'] }));
            expect(compositionMain([], dir)).toBe(2);
            // A valid budget in a root with no sources: the build fails, and the gate does not pass.
            fs.writeFileSync(budget, JSON.stringify({ max_bytes: 1000, allowed_packages: ['yaml'] }));
            expect(compositionMain([], dir)).toBe(2);
        } finally {
            process.stderr.write = err;
            process.stdout.write = out;
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }, 120_000);

    it('exits 1 on an unlisted package of any size', () => {
        expect(run(1000, { 'node_modules/yaml/dist/index.js': 999, 'node_modules/js-yaml/x.js': 1 })).toBe(1);
    });
});
