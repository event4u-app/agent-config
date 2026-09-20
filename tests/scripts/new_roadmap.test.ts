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
import { CHECKBOX_LINE } from '../../src/scripts/_lib/roadmap_checkboxes.js';

const DATE = '2026-08-20';

/** The dashboard's own checkbox vocabulary, global, for counting. */
const CHECKBOX_LINE_G = new RegExp(CHECKBOX_LINE.source, 'gm');

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

    it('emits the release-holds block COMMENTED OUT, with rule 28\'s authoring order', () => {
        // Step 1.4 of road-to-release-holds-that-refuse. The block has to be a
        // comment: the default is that a roadmap declares no hold, and emitting
        // a live `## Release holds` heading into every new file would make the
        // rare case the default shape. It also must not become a checkbox or a
        // phase — the caps test above would catch a phase, nothing would catch
        // a stray step.
        const open = lw.indexOf('<!-- Release holds');
        expect(open).toBeGreaterThan(-1);
        const close = lw.indexOf('-->', open);
        expect(close).toBeGreaterThan(open);
        const block = lw.slice(open, close);

        // The heading and the entry shape live INSIDE the comment.
        expect(block).toContain('## Release holds');
        expect(block).toContain('### hold: <kebab-id>');
        for (const field of ['**Channel:**', '**Opened by:**', '**Cleared by:**', '**State:**']) {
            expect(block).toContain(field);
        }
        // `Why not a guard:` is the field rule 28 makes mandatory.
        expect(block).toContain('**Why not a guard:**');
        // The authoring order, which is the half that keeps holds rare.
        expect(block).toContain('re-sequence -> guard -> hold');
        // The re-sequence note is what Phase 6 counts; without it the only
        // countable outcome is a refusal, which scores the best case as a loss.
        expect(block).toContain('resequenced:');
        // Both markers are named, so the checkbox binding is authorable.
        expect(block).toContain('opens-hold:');
        expect(block).toContain('clears-hold:');

        // Commented out means: no live heading, and no extra checkbox. The
        // block contributes ZERO checkboxes — asserted on the block rather than
        // on a whole-file total, which would pin an unrelated count (the
        // skeleton's own step 1.1 and AC-1) and move for the wrong reason.
        expect(/^## Release holds\s*$/m.test(lw)).toBe(false);
        expect(block.match(CHECKBOX_LINE_G)).toBeNull();
        expect(lw.replace(block, '').match(CHECKBOX_LINE_G)?.length).toBe(
            lw.match(CHECKBOX_LINE_G)?.length,
        );
    });

    it('ships as draft, so emitting one does not silently grow the ready estate', () => {
        expect(lw).toMatch(/^status: draft$/m);
    });
});
