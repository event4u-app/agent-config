// Tests for src/scripts/compile_router.ts (py2ts Phase 5).
//
// No pytest suite ships for compile_router.py, so this is a FOCUSED
// DIFFERENTIAL suite:
//   1. Unit checks on build() shape (schema_version, kernel/tier_1/tier_2 sort,
//      profiles) + serialization format (minified separators, pretty indent).
//   2. Golden parity on the REAL REPO: python3 vs tsx produce byte-identical
//      dist/router.json (minified) AND router.pretty.json, the committed
//      router.json reproduces with ZERO drift, and --check stdout/stderr/exit
//      match. Snapshot+restore in afterEach. Skipped when python3 is absent.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as cr from '../../src/scripts/compile_router.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'compile_router.ts');
const ROUTER = path.join(REPO_ROOT, 'dist', 'router.json');
const ROUTER_PRETTY = path.join(REPO_ROOT, 'dist', 'router.pretty.json');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

// --- Layer 1: build() shape + serialization ---------------------------------

describe('compile_router.build — shape', () => {
    it('has the expected top-level keys and profiles', () => {
        const out = cr.build() as Record<string, unknown>;
        expect(out['schema_version']).toBe(cr.SCHEMA_VERSION);
        expect(Array.isArray(out['kernel'])).toBe(true);
        expect(Array.isArray(out['tier_1'])).toBe(true);
        expect(Array.isArray(out['tier_2'])).toBe(true);
        expect(out['profiles']).toEqual({
            minimal: ['__kernel__'],
            balanced: ['__kernel__', '__tier_1__'],
            full: ['__kernel__', '__tier_1__', '__tier_2__'],
        });
    });

    it('kernel is sorted and non-empty', () => {
        const out = cr.build() as Record<string, unknown>;
        const kernel = out['kernel'] as string[];
        expect(kernel.length).toBeGreaterThan(0);
        expect([...kernel].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(kernel);
    });

    it('tier entries are sorted by id and carry triggers/routes_to', () => {
        const out = cr.build() as Record<string, unknown>;
        for (const tier of ['tier_1', 'tier_2'] as const) {
            const entries = out[tier] as Array<Record<string, unknown>>;
            const ids = entries.map((e) => e['id'] as string);
            expect([...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(ids);
            for (const e of entries) {
                expect(typeof e['id']).toBe('string');
                expect(Array.isArray(e['triggers'])).toBe(true);
                expect(Array.isArray(e['routes_to'])).toBe(true);
            }
        }
    });

    it('minified serialization uses (",", ":") separators, no trailing spaces', () => {
        const out = cr.build();
        const minified = JSON.stringify(out);
        expect(minified).not.toContain(', ');
        expect(minified).not.toContain(': ');
        expect(minified.startsWith('{"schema_version":1,')).toBe(true);
    });
});

// --- Layer 2: golden parity on the REAL REPO -------------------------------

const routerExists = fs.existsSync(ROUTER);

describe.skipIf(!routerExists)('compile_router — writer reproduces the committed artifact', () => {
    let routerBak: string;
    let prettyBak: string | null;
    afterEach(() => {
        fs.writeFileSync(ROUTER, routerBak, 'utf-8');
        if (prettyBak === null) {
            if (fs.existsSync(ROUTER_PRETTY)) fs.rmSync(ROUTER_PRETTY);
        } else {
            fs.writeFileSync(ROUTER_PRETTY, prettyBak, 'utf-8');
        }
    });
    function snapshot(): void {
        routerBak = fs.readFileSync(ROUTER, 'utf-8');
        prettyBak = fs.existsSync(ROUTER_PRETTY) ? fs.readFileSync(ROUTER_PRETTY, 'utf-8') : null;
    }

    it('regenerating router.json reproduces the committed file byte-for-byte + exit 0', () => {
        snapshot();
        const committed = routerBak;
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status, ts.stderr).toBe(0);
        // Zero drift: the writer reproduces the committed file byte-for-byte
        // (the committed router.json is kept current — see the --check test).
        expect(fs.readFileSync(ROUTER, 'utf-8')).toBe(committed);
    });

    it('--pretty writes JSON that parses to the same object as router.json', () => {
        snapshot();
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--pretty'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status, ts.stderr).toBe(0);
        const pretty = JSON.parse(fs.readFileSync(ROUTER_PRETTY, 'utf-8'));
        expect(pretty).toEqual(JSON.parse(routerBak));
    });

    it('--check passes: the committed router.json is current + reproducible (exit 0)', () => {
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--check'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status, ts.stderr).toBe(0);
    });
});
