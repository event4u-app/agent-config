// Tests for src/scripts/new_roadmap.ts — the gate-clean roadmap skeleton.
//
// The point of these assertions is WHERE they get their expectations from.
// A generator that embeds four gate conventions drifts from the gates the day
// one of them changes, and then teaches the wrong form authoritatively. So the
// caps and the enum come from the gate modules themselves, never from a copy:
// change LIGHTWEIGHT_PHASE_CAP in the gate and this test moves with it.
import { describe, expect, it } from 'vitest';

import { skeleton } from '../../src/scripts/new_roadmap.js';
import {
    LIGHTWEIGHT_LINE_CAP,
    LIGHTWEIGHT_PHASE_CAP,
    _read_complexity,
} from '../../src/scripts/lint_roadmap_complexity.js';
import { MARKER_RE } from '../../src/scripts/lint_plan_risk_register.js';

const DATE = '2026-08-20';

describe('the emitted skeleton satisfies each gate convention', () => {
    const lw = skeleton('probe-slug', 'lightweight', DATE);

    it('declares a complexity value the gate accepts', () => {
        // _read_complexity returns null for a value outside the enum, which is
        // exactly how `bounded` / `medium` / `small` got into the tree.
        expect(_read_complexity(lw)).toBe('lightweight');
        expect(_read_complexity(skeleton('x', 'structural', DATE))).toBe('structural');
    });

    it('stays inside the lightweight caps, read from the gate', () => {
        expect(lw.split('\n').length).toBeLessThanOrEqual(LIGHTWEIGHT_LINE_CAP);
        const phases = (lw.match(/^## Phase\b/gm) ?? []).length;
        expect(phases).toBeGreaterThan(0);
        expect(phases).toBeLessThanOrEqual(LIGHTWEIGHT_PHASE_CAP);
    });

    it('writes the acceptance heading in the form the extractor matches', () => {
        // End-anchored AND case-sensitive. 10 of 22 roadmaps carrying such a
        // section wrote the lower-case form and were invisible to it.
        const AC_RE = /^##\s+Acceptance Criteria\s*$/m;
        expect(AC_RE.test(lw)).toBe(true);
    });

    it('carries the risk-review marker in the form the gate parses', () => {
        const markerLine = lw.split('\n').find((l) => l.includes('risk-review'));
        expect(markerLine).toBeDefined();
        expect(MARKER_RE.test(markerLine as string)).toBe(true);
    });

    it('uses a legal risk type', () => {
        const row = lw.split('\n').find((l) => l.startsWith('| 1 |'));
        expect(row).toBeDefined();
        const type = (row as string).split('|')[3]?.trim();
        expect(['product', 'implementation']).toContain(type);
    });

    it('anchors the risk row on a heading that exists in the same file', () => {
        // dangling_anchor was hit while authoring the roadmap that asked for
        // this generator: the row said `Phase 0 — the measurement` and the
        // heading read `0. The measurement`.
        const row = lw.split('\n').find((l) => l.startsWith('| 1 |')) as string;
        const anchor = row.split('|')[6]?.trim() as string;
        expect(lw).toContain(`## ${anchor}`);
    });

    it('has one open step, so the roadmap is trackable and not empty', () => {
        expect((lw.match(/^- \[ \] /gm) ?? []).length).toBeGreaterThan(0);
    });

    it('ships as draft, so emitting one does not silently grow the ready estate', () => {
        expect(lw).toMatch(/^status: draft$/m);
    });
});
