/**
 * road-to-experience-loop-broadening steps 8.1 and 8.2.
 *
 * 8.1 verify: existing `triggers.json` files parse unchanged, and the gap
 *             report is produced with zero live-harness calls.
 * 8.2 verify: no step in this roadmap invokes a live routing harness.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadCases, readTriggersFile } from '../../src/scripts/description_route_check.js';
import {
    SHIFT_AXES,
    gapReport,
    isShiftAxis,
    pairShifts,
    type ShiftQuery,
} from '../../src/scripts/_lib/trigger_shift.js';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');
const PILOT = path.join(repoRoot, 'src/skills/code-intelligence/evals/triggers.json');

describe('8.1 — the field is additive, and that is asserted rather than trusted', () => {
    it('the pilot file still parses through the production reader', () => {
        const cases = readTriggersFile('code-intelligence', PILOT);
        expect(cases.length).toBeGreaterThan(0);
        expect(cases.every((c) => typeof c.prompt === 'string' && typeof c.expect === 'boolean')).toBe(true);
    });

    it('the production reader ignores shift_of entirely', () => {
        // Every reader of triggers.json in this tree key-picks, and no JSON
        // Schema governs the file, so an unknown key cannot break a parse. The
        // shifted twins arrive as ordinary cases -- which is exactly what
        // backward-compatible means here.
        const cases = readTriggersFile('code-intelligence', PILOT);
        const raw = JSON.parse(fs.readFileSync(PILOT, 'utf-8')) as { queries: ShiftQuery[] };
        expect(cases).toHaveLength(raw.queries.length);
        expect(Object.keys(cases[0]!).sort()).toEqual(['expect', 'prompt', 'unit']);
    });

    it('the whole corpus still loads', () => {
        // The wider blast radius: 94 files go through loadCases, and a malformed
        // pilot would surface here rather than only in its own file.
        const all = loadCases(repoRoot);
        expect(all.length).toBeGreaterThan(100);
        expect(all.filter((c) => c.unit === 'code-intelligence').length).toBeGreaterThanOrEqual(12);
    });

    it('the pilot carries real pairs on two axes', () => {
        const raw = JSON.parse(fs.readFileSync(PILOT, 'utf-8')) as { queries: ShiftQuery[] };
        const { pairs, dangling } = pairShifts(raw.queries);
        expect(dangling).toEqual([]);
        expect(pairs.length).toBe(2);
        expect(new Set(pairs.map((p) => p.axis))).toEqual(new Set(['wrapper', 'temporal']));
    });
});

describe('8.1 — the gap report, and what it deliberately does not count', () => {
    const base: ShiftQuery = { q: 'base prompt', trigger: true };
    const shifted: ShiftQuery = {
        q: 'shifted prompt',
        trigger: true,
        shift_of: { of: 'base prompt', axis: 'phrasing' },
    };

    it('reports a degradation when the base holds and the shift does not', () => {
        const r = gapReport([base, shifted], (p) => p === 'base prompt');
        expect(r.pairs).toBe(1);
        expect(r.degradations).toBe(1);
        expect(r.rows[0]!.degraded).toBe(true);
    });

    it('does NOT count a pair whose base already fails', () => {
        // That says the corpus row is wrong or the description never worked --
        // it says nothing about generalisation, which is what this measures.
        const r = gapReport([base, shifted], () => false);
        expect(r.pairs).toBe(1);
        expect(r.degradations).toBe(0);
    });

    it('counts nothing when both hold', () => {
        const r = gapReport([base, shifted], () => true);
        expect(r.degradations).toBe(0);
    });

    it('reports a dangling twin instead of silently dropping it', () => {
        const orphan: ShiftQuery = {
            q: 'orphan',
            trigger: true,
            shift_of: { of: 'a base that is not here', axis: 'phrasing' },
        };
        const r = gapReport([orphan], () => true);
        expect(r.dangling).toBe(1);
        expect(r.pairs).toBe(0);
    });

    it('an unknown axis is dangling, not silently accepted', () => {
        const bad = { q: 'x', trigger: true, shift_of: { of: 'base prompt', axis: 'vibes' } } as unknown as ShiftQuery;
        expect(pairShifts([base, bad]).dangling).toHaveLength(1);
        expect(isShiftAxis('vibes')).toBe(false);
    });

    it('carries the two axes a purely textual shift cannot express', () => {
        expect(SHIFT_AXES).toContain('host-framing');
        expect(SHIFT_AXES).toContain('context-availability');
    });
});

describe('8.2 — the live-floors park stays parked', () => {
    it('the parked roadmap is still in later/, not reopened here', () => {
        expect(
            fs.existsSync(path.join(repoRoot, 'agents/roadmaps/later/road-to-routing-assurance-live-floors.md')),
        ).toBe(true);
    });

    it('the shift module has no path to a routing harness at all', () => {
        // Stronger than "does not call one": the router is a caller-supplied
        // predicate, so there is no harness reference to follow. A future author
        // cannot reach a live backend without changing this file's imports,
        // which is a visible act in a diff.
        const src = fs.readFileSync(path.join(repoRoot, 'src/scripts/_lib/trigger_shift.ts'), 'utf-8');
        expect(src).not.toMatch(/^import .*(description_route_check|cross_model_smoke)/m);
        expect(src).not.toMatch(/cached-live|fetch\(|https?:\/\//);
    });
});
