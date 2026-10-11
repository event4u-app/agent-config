import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    type DeliveryMode,
    type Finding,
    preservationReadout,
    safetySeverity,
    scanHostHtml,
    scanSvg,
    vectorVerdict,
    parseElements,
} from '../../src/scripts/lint_svg_asset.js';
import { smilVerdict } from '../../src/scripts/_lib/svg_motion.js';

/**
 * Steps 1.1, 1.2 and 1.5 of `road-to-svg-with-a-witness`, measured against the
 * fixture corpus Phase 0 pre-registered.
 *
 * The corpus is the contract, not this file: `manifest.json` names every
 * planted row, its taxonomy rule id, its layer and its one-edit twin, and it
 * was committed BEFORE any checker existed so a threshold could not be chosen
 * to fit what a rule already reported.
 *
 * `TAXONOMY_TO_RULE` is the one place the pre-registered ids meet the linter's
 * own ids, and it is written out rather than derived so a reader can see
 * exactly which rule answers which planted row. Renaming a linter rule without
 * touching this table reds here, which is the intent — a rule that quietly
 * stops answering its planted row is the failure a corpus test exists to catch.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(HERE, '..', 'design-artifacts', 'fixtures', 'svg-assets');

interface Row {
    id: string;
    asset_class: string;
    delivery: DeliveryMode;
    layer: 'static' | 'engine';
    rule: string;
    file: string;
    twin: string;
    twin_kind: string;
    note?: string;
}
interface Control {
    id: string;
    file: string;
    must_not_report: string[];
    note?: string;
}
interface Surgical {
    id: string;
    before: string;
    allowed_ids: string[];
    good: string;
    bad: string;
    moved_neighbour: string;
}
interface Manifest {
    rows: Row[];
    controls: Control[];
    surgical: Surgical[];
}

const manifest = JSON.parse(
    fs.readFileSync(path.join(FIXTURES, 'manifest.json'), 'utf-8'),
) as Manifest;

const read = (rel: string): string => fs.readFileSync(path.join(FIXTURES, rel), 'utf-8');

function scan(rel: string, delivery: DeliveryMode): Finding[] {
    const content = read(rel);
    return /\.svg$/i.test(rel)
        ? scanSvg(content, rel, { delivery })
        : scanHostHtml(content, rel, { delivery });
}

/** Pre-registered taxonomy id → the rule this linter actually emits. */
const TAXONOMY_TO_RULE: Record<string, string> = {
    'structure/element-outside-viewbox': 'svg-structure-outside-viewbox',
    'structure/missing-xmlns': 'svg-structure-missing-xmlns',
    'structure/unparseable-path-data': 'svg-structure-unparseable-path',
    'structure/unused-defs-entry': 'svg-structure-unused-defs',
    'structure/dangling-reference': 'svg-structure-dangling-reference',
    'safety/active-content': 'svg-safety-active-content',
    'safety/internal-dtd-subset': 'svg-safety-internal-subset',
    'safety/external-reference': 'svg-safety-external-reference',
    'vector-honesty/embedded-raster': 'svg-vector-embedded-raster',
    'accessibility/generic-id-collision': 'svg-a11y-generic-id',
    'accessibility/meaningful-without-name': 'svg-a11y-no-accessible-name',
    'accessibility/double-name': 'svg-a11y-double-name',
    'motion/keysplines-out-of-range': 'svg-motion-keysplines-range',
    'motion/transform-origin-without-box': 'svg-motion-transform-box',
    'motion/no-reduced-motion-branch': 'svg-motion-no-reduced-motion',
    'motion/smil-css-only-branch': 'svg-motion-smil-css-only',
    'motion/d-morph-command-mismatch': 'svg-motion-d-morph-mismatch',
};

/**
 * The two static rows this linter deliberately does NOT answer.
 *
 * Both are inline SVG inside a host HTML document, where the reduced-motion
 * ROUTE may live in the host's own `<style>` or in a `<picture>` wrapper that
 * a `<svg>…</svg>` slice cannot see. Judging the route from inside the slice
 * would red every correctly covered inline animation, so DQ4 owns the inline
 * case (step 1.3) and reads the whole document. Asserted here against
 * `smilVerdict` — the reading both linters share — so the hand-off is pinned
 * rather than assumed.
 */
const OWNED_BY_DQ4: Record<string, 'no-route' | 'css-only'> = {
    'inline-smil-no-route': 'no-route',
    'inline-smil-css-only-route': 'css-only',
};

describe('every-static-row-found-and-twins-clean', () => {
    it('every-static-row-found-and-twins-clean', () => {
        const staticRows = manifest.rows.filter((r) => r.layer === 'static');
        expect(staticRows.length).toBeGreaterThan(15);

        const unanswered: string[] = [];
        const dirtyTwins: string[] = [];

        for (const row of staticRows) {
            if (row.id in OWNED_BY_DQ4) {
                // The hand-off, pinned in both directions.
                expect(smilVerdict(read(row.file)), row.id).toBe(OWNED_BY_DQ4[row.id]);
                expect(smilVerdict(read(row.twin)), `${row.id} twin`).toBe('routed');
                expect(scan(row.file, row.delivery), `${row.id} must not be answered here`).toEqual([]);
                continue;
            }

            const expected = TAXONOMY_TO_RULE[row.rule];
            expect(expected, `no mapping for pre-registered rule ${row.rule}`).toBeDefined();

            const planted = scan(row.file, row.delivery).map((f) => f.rule);
            if (!planted.includes(expected as string)) {
                unanswered.push(`${row.id}: expected ${expected}, got [${[...new Set(planted)].join(', ')}]`);
            }

            // Zero findings on the twin — not merely "not this rule". A twin
            // that reds for a second reason is a fixture defect, and the target
            // table pre-registered zero.
            const twin = [...new Set(scan(row.twin, row.delivery).map((f) => f.rule))];
            if (twin.length) dirtyTwins.push(`${row.id}: twin reports [${twin.join(', ')}]`);
        }

        expect(unanswered, unanswered.join('\n')).toEqual([]);
        expect(dirtyTwins, dirtyTwins.join('\n')).toEqual([]);
    });

    it('controls stay silent — the two reproduced false positives (R9, R12)', () => {
        for (const control of manifest.controls) {
            const rules = new Set(scan(control.file, 'inline').map((f) => f.rule));
            const mapped = control.must_not_report
                .map((t) => TAXONOMY_TO_RULE[t])
                .filter((r): r is string => Boolean(r));
            for (const rule of mapped) {
                expect(rules.has(rule), `${control.id} must not report ${rule}`).toBe(false);
            }
        }

        // D3 in both directions, which is the whole point of the vector family:
        // a raster beside one dummy path is NOT a true vector, and a mark built
        // from rect/circle IS one.
        const raster = vectorVerdict(parseElements(read('assets/raster-in-vector.svg')));
        expect(raster.trueVector).toBe(false);
        expect(raster.rasterElements).toBeGreaterThan(0);

        const primitives = vectorVerdict(parseElements(read('assets/primitive-only-mark.svg')));
        expect(primitives.trueVector).toBe(true);
        expect(primitives.rasterElements).toBe(0);
        expect(read('assets/primitive-only-mark.svg')).not.toMatch(/<path\b/);
    });

    it('a motion rule binds per element, not per file (R9)', () => {
        // The planted file carries a CORRECT twin element beside the wrong one.
        // A file-scoped "does this file mention transform-box" test passes it,
        // which is the divergence R9 recorded.
        const planted = read('assets/transform-origin-no-box.svg');
        expect(planted).toMatch(/transform-box/);
        const findings = scanSvg(planted, 'assets/transform-origin-no-box.svg');
        expect(findings.map((f) => f.rule)).toContain('svg-motion-transform-box');
        expect(findings.filter((f) => f.rule === 'svg-motion-transform-box')).toHaveLength(1);
    });
});

describe('safety-grade-follows-delivery-mode', () => {
    it('safety-grade-follows-delivery-mode', () => {
        const rel = 'assets/active-content-script.svg';
        const content = read(rel);

        // inline and a standalone document both execute in an origin that
        // matters, so active content is an error there.
        for (const mode of ['inline', 'document'] as DeliveryMode[]) {
            const active = scanSvg(content, rel, { delivery: mode }).filter(
                (f) => f.rule === 'svg-safety-active-content',
            );
            expect(active.length, mode).toBeGreaterThan(0);
            for (const f of active) expect(f.severity, mode).toBe('error');
        }

        // img and css-bg run nothing — reported as `inert`, and NEVER absent:
        // the same bytes can be inlined tomorrow with no edit to the file (E12).
        for (const mode of ['img', 'css-bg'] as DeliveryMode[]) {
            const active = scanSvg(content, rel, { delivery: mode }).filter(
                (f) => f.rule === 'svg-safety-active-content',
            );
            expect(active.length, mode).toBeGreaterThan(0);
            for (const f of active) expect(f.severity, mode).toBe('inert');
        }

        // An undeclared mode is graded as inline, the strictest — never as the
        // mode that happens to be convenient.
        const undeclared = scanSvg(content, rel).filter((f) => f.rule === 'svg-safety-active-content');
        expect(undeclared.length).toBeGreaterThan(0);
        for (const f of undeclared) expect(f.severity).toBe('error');

        expect(safetySeverity('inline')).toBe('error');
        expect(safetySeverity('document')).toBe('error');
        expect(safetySeverity('img')).toBe('inert');
        expect(safetySeverity('css-bg')).toBe('inert');

        // The clean twin is clean in EVERY mode — the grade follows the mode,
        // the finding follows the file.
        const twin = read('assets/active-content-script.clean.svg');
        for (const mode of ['inline', 'document', 'img', 'css-bg'] as DeliveryMode[]) {
            expect(scanSvg(twin, 'twin.svg', { delivery: mode }), mode).toEqual([]);
        }
    });

    it('a bare public DOCTYPE is clean; an internal subset is not', () => {
        const planted = scanSvg(read('assets/internal-dtd-entity.svg'), 'p.svg');
        expect(planted.map((f) => f.rule)).toContain('svg-safety-internal-subset');
        expect(scanSvg(read('assets/internal-dtd-entity.clean.svg'), 't.svg')).toEqual([]);
        expect(read('assets/internal-dtd-entity.clean.svg')).toMatch(/<!DOCTYPE svg PUBLIC/i);
    });
});

describe('surgical-edit-reports-exactly-the-moved-neighbour', () => {
    it('surgical-edit-reports-exactly-the-moved-neighbour', () => {
        for (const triple of manifest.surgical) {
            const before = read(triple.before);

            // The allowed edit touches only what it declared.
            expect(
                preservationReadout(before, read(triple.good), triple.allowed_ids),
                `${triple.id}: the good edit must report nothing`,
            ).toEqual([]);

            // The bad edit reports EXACTLY the moved neighbour — not a list that
            // happens to contain it. A readout that over-reports is as useless
            // as one that under-reports: both leave the reader to re-judge it.
            const bad = preservationReadout(before, read(triple.bad), triple.allowed_ids);
            expect(bad.map((c) => c.id), `${triple.id}`).toEqual([triple.moved_neighbour]);
            expect(bad[0]?.attribute, `${triple.id}`).not.toBe('');
        }
    });

    it('canonicalisation absorbs formatting, not geometry', () => {
        const a = '<svg><path id="p" d="M 10 10 L 20 20"/></svg>';
        const reformatted = '<svg><path d="M 10.0000 10  L 20 20.00" id="p"/></svg>';
        const moved = '<svg><path id="p" d="M 10 10 L 20 24"/></svg>';
        expect(preservationReadout(a, reformatted, [])).toEqual([]);
        expect(preservationReadout(a, moved, []).map((c) => c.attribute)).toEqual(['d']);
    });
});
