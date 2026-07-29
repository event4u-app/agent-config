/**
 * Tests for the gate-coverage meta-gate (`src/scripts/check_gate_coverage.ts`).
 *
 * The guard exists because three CI-wired gates were found scanning a tree
 * emptied by the ADR-051 migration, each exiting 0. These tests pin the three
 * design rules the guard is built on, plus its own anti-self-blindness contract.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    type GateSpec,
    classify,
    load_manifest,
    parse_scanned,
} from '../../src/scripts/check_gate_coverage.js';

const spec = (over: Partial<GateSpec> = {}): GateSpec => ({
    id: 'some_gate',
    argv: [],
    min_scanned: 100,
    corpus: 'test corpus',
    status: 'enforced',
    ...over,
});

describe('parse_scanned — the machine-readable contract (design rule 1)', () => {
    it('reads the contract line wherever it sits in the output', () => {
        expect(parse_scanned('noise\nscanned: 429\nmore noise')).toBe(429);
        expect(parse_scanned('scanned: 0')).toBe(0);
    });

    it('returns null when the gate emitted no count — never guesses from prose', () => {
        // The whole point: a guard that infers counts from human output is the
        // fragile thing it replaces.
        expect(parse_scanned('✅  All 0 auto-rule descriptions ≤ 150 chars.')).toBeNull();
        expect(parse_scanned('Summary: 427 pass, 2 warn, 0 fail, 429 total')).toBeNull();
        expect(parse_scanned('')).toBeNull();
    });
});

describe('classify — baseline, not > 0 (design rule 3)', () => {
    it('a collapse from a large corpus to a few artefacts FAILS, though it is > 0', () => {
        // 428 → 3 is as broken as 428 → 0, and a zero-check cannot see it.
        const r = classify(spec({ min_scanned: 380 }), 3, false);
        expect(r.verdict).toBe('below_floor');
        expect(r.message).toMatch(/cannot certify/);
    });

    it('zero fails', () => {
        expect(classify(spec(), 0, false).verdict).toBe('below_floor');
    });

    it('at or above the floor passes', () => {
        expect(classify(spec({ min_scanned: 380 }), 380, false).verdict).toBe('ok');
        expect(classify(spec({ min_scanned: 380 }), 430, false).verdict).toBe('ok');
    });

    it('an enforced gate that reports nothing is a failure, not a pass', () => {
        expect(classify(spec(), null, false).verdict).toBe('silent');
    });

    it('a gate that cannot be executed fails rather than being skipped', () => {
        expect(classify(spec(), null, true).verdict).toBe('crashed');
    });
});

describe('classify — pending gates are reported, never silently skipped', () => {
    it('a pending gate never fails the build but is surfaced', () => {
        const r = classify(spec({ status: 'pending' }), null, false);
        expect(r.verdict).toBe('pending');
        expect(r.message).toMatch(/NOT enforced/);
    });

    it('a pending gate below its floor still does not fail — the floor is inert', () => {
        expect(classify(spec({ status: 'pending', min_scanned: 380 }), 0, false).verdict).toBe('pending');
    });
});

describe('load_manifest — the guard must not become the thing it catches', () => {
    const withManifest = (body: string, fn: (file: string) => void): void => {
        const dir = mkdtempSync(join(tmpdir(), 'gatecov-'));
        try {
            const f = join(dir, 'gate-coverage.yml');
            writeFileSync(f, body, 'utf8');
            fn(f);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    };

    it('an EMPTY gate list is a hard error — a coverage guard over nothing is vacuous', () => {
        withManifest('gates: []\n', (f) => {
            expect(() => load_manifest(f)).toThrow(/vacuous/);
        });
    });

    it('a missing manifest is a hard error, not an empty pass', () => {
        expect(() => load_manifest(join(tmpdir(), 'gatecov-does-not-exist.yml'))).toThrow(/not found/);
    });

    it('rejects a non-integer floor', () => {
        withManifest('gates:\n  - id: g\n    min_scanned: "many"\n', (f) => {
            expect(() => load_manifest(f)).toThrow(/min_scanned/);
        });
    });

    it('rejects an unknown status rather than treating it as enforced', () => {
        withManifest('gates:\n  - id: g\n    min_scanned: 1\n    status: maybe\n', (f) => {
            expect(() => load_manifest(f)).toThrow(/status/);
        });
    });

    it('parses argv so CI-identical invocation is declarable (design rule 2)', () => {
        withManifest('gates:\n  - id: g\n    argv: ["--all"]\n    min_scanned: 1\n', (f) => {
            expect(load_manifest(f)[0]?.argv).toEqual(['--all']);
        });
    });
});

describe('the real manifest', () => {
    it('loads, declares at least one ENFORCED gate, and every floor is a real bound', () => {
        const specs = load_manifest();
        expect(specs.length).toBeGreaterThan(0);
        expect(specs.some((s) => s.status === 'enforced')).toBe(true);
        for (const s of specs) {
            expect(s.corpus, `${s.id} must document what its count means`).not.toBe('');
        }
    });
});
