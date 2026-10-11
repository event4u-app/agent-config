import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    type DeliveryMode,
    type Finding,
    preservationReadout,
    safetySeverity,
    pathDataError,
    pathExtent,
    scanHostHtml,
    scanSvg,
    maskComments,
    staticBox,
    tokenisePath,
    vectorVerdict,
    parseElements,
} from '../../src/scripts/lint_svg_asset.js';
import { smilVerdict } from '../../src/scripts/_lib/svg_motion.js';
import { parseDocument } from '../../src/scripts/_lib/svg_dom.js';

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
    'structure/degenerate-gradient': 'svg-structure-degenerate-gradient',
    'structure/not-well-formed': 'svg-structure-not-well-formed',
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

/**
 * Finding 2.3 of `road-to-svg-rules-in-the-dispatch-path`, from the R2
 * completion review: `parseElements` strips comments and the content-level
 * regex rules did not, so the two disagreed about what the file contains.
 * The disagreement is silent in both directions — a finding appears that
 * should not, and a finding disappears that should.
 */
describe('a-commented-out-reference-is-not-a-reference', () => {
    it('a-commented-out-reference-is-not-a-reference', () => {
        // A `<defs>` entry whose ONLY use sits inside a comment is unused. The
        // regex rule used to read the commented `url(#g)` as a live reference
        // and report the file clean.
        const commentedUse = [
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img">',
            '  <title>t</title>',
            '  <defs><linearGradient id="g"><stop offset="0" stop-color="#000"/></linearGradient></defs>',
            '  <!-- <rect width="24" height="24" fill="url(#g)"/> -->',
            '  <rect width="24" height="24" fill="#123456"/>',
            '</svg>',
        ].join('\n');
        expect(scanSvg(commentedUse, 'a.svg').map((f) => f.rule)).toContain('svg-structure-unused-defs');

        // The same file with the use UNCOMMENTED is clean on that rule — so
        // the assertion above is about the comment and not about the shape.
        const liveUse = commentedUse.replace('<!-- <rect width="24"', '<rect width="24"').replace('/> -->', '/>');
        expect(scanSvg(liveUse, 'a.svg').map((f) => f.rule)).not.toContain('svg-structure-unused-defs');

        // And the mirror: a reference whose target id exists ONLY inside a
        // comment is dangling, because the id is not in the document.
        const commentedTarget = [
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img">',
            '  <title>t</title>',
            '  <!-- <linearGradient id="g"><stop offset="0"/></linearGradient> -->',
            '  <rect width="24" height="24" fill="url(#g)"/>',
            '</svg>',
        ].join('\n');
        expect(scanSvg(commentedTarget, 'b.svg').map((f) => f.rule)).toContain(
            'svg-structure-dangling-reference',
        );
    });

    it('masking preserves every offset, so reported lines still name the right line', () => {
        const src = 'line one\n<!-- two\nthree -->\nline four\n';
        const masked = maskComments(src);
        expect(masked.length).toBe(src.length);
        expect(masked.split('\n').length).toBe(src.split('\n').length);
        expect(masked.split('\n')[0]).toBe('line one');
        expect(masked.split('\n')[3]).toBe('line four');
        expect(masked).not.toContain('two');
        // An unterminated comment masks to end of input — what a browser does.
        expect(maskComments('a\n<!-- b\nc\n')).toBe('a\n      \n \n');
    });

    it('an inline ignore marker still works, because it lives in a comment', () => {
        // The one place the RAW text is still the right input. Masking this
        // would silently disable every `svg-asset-disable` marker in the tree.
        const withIgnore = [
            '<svg viewBox="0 0 24 24">',
            '  <!-- svg-asset-disable svg-a11y-no-accessible-name -->',
            '  <circle cx="12" cy="12" r="6"/>',
            '</svg>',
        ].join('\n');
        const rules = scanSvg(withIgnore, 'c.svg').map((f) => f.rule);
        expect(rules).not.toContain('svg-a11y-no-accessible-name');
        // The marker suppresses that rule and nothing else.
        expect(rules).toContain('svg-structure-missing-xmlns');
    });
});

/**
 * Step 3.1 of `road-to-svg-review-followups`, review claim C11.
 *
 * Nesting, parentage and `#id` resolution are decided by a parse tree, never
 * by a pattern over the raw text. The three rows below are the ones a
 * text-pattern check misses, and they are planted in the committed corpus
 * (`manifest.json`) rather than invented here — the fixture is the contract.
 *
 * The parser is written rather than depended on, and the reasons were checked
 * rather than assumed: `package.json` carries no runtime XML parser,
 * `happy-dom` is dev-only, the three vendored tree-sitter grammars are php,
 * typescript and javascript, and Playwright is absent in a consumer.
 */
describe('regex-blind-rows-found-by-the-tree', () => {
    /** The rule ids one fixture reports — the shape every assertion below wants. */
    const rules = (rel: string, delivery: DeliveryMode): string[] => scan(rel, delivery).map((f) => f.rule);

    const row = (id: string): Row => {
        const r = manifest.rows.find((x) => x.id === id);
        if (!r) throw new Error(`row ${id} is not pre-registered in manifest.json`);
        return r;
    };

    it('regex-blind-rows-found-by-the-tree', () => {
        // (a) An id that is not in the document. The element parser never saw
        //     it; a pattern over the text reads it as defined and calls the
        //     file clean.
        const comment = row('id-only-in-a-comment');
        expect(rules(comment.file, comment.delivery)).toContain('svg-structure-dangling-reference');
        expect(scan(comment.twin, comment.delivery)).toEqual([]);

        // The two siblings of that case, which the corpus does not carry as
        // their own rows because they are the same defect under a different
        // hiding place.
        const head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img"><title>t</title>';
        const inCdata = `${head}<style><![CDATA[ /* <rect id="planted-badge"/> */ ]]></style><use href="#planted-badge"/></svg>`;
        expect(scanSvg(inCdata, 'a.svg').map((f) => f.rule)).toContain('svg-structure-dangling-reference');
        const inAttrValue = `${head}<rect data-note='id="planted-badge"' width="1" height="1"/><use href="#planted-badge"/></svg>`;
        expect(scanSvg(inAttrValue, 'b.svg').map((f) => f.rule)).toContain('svg-structure-dangling-reference');
        // And a `url(#…)` inside CDATA IS a real reference — a `<style>` block
        // is where SVG puts its CSS, so masking CDATA wholesale would have
        // broken the thing this row is about in the other direction.
        const realUse = `${head}<defs><linearGradient id="brand-grad"><stop offset="0"/></linearGradient></defs>` +
            `<style><![CDATA[ .a{fill:url(#brand-grad)} ]]></style><rect class="a" width="1" height="1"/></svg>`;
        expect(scanSvg(realUse, 'c.svg').map((f) => f.rule)).not.toContain('svg-structure-unused-defs');

        // (b) Mis-nested tags. Both present, both spelled correctly, and the
        //     document is not a tree — the case a flat element list cannot see.
        const nested = row('mis-nested-tags');
        expect(rules(nested.file, nested.delivery)).toContain('svg-structure-not-well-formed');
        expect(scan(nested.twin, nested.delivery)).toEqual([]);

        // (c) Parentage. A `<title>` inside a `<g>` names the group, so the
        //     graphic still has no accessible name.
        const title = row('title-not-a-direct-child');
        expect(rules(title.file, title.delivery)).toContain('svg-a11y-no-accessible-name');
        expect(scan(title.twin, title.delivery)).toEqual([]);
    });

    it('a file that is not well-formed is a finding, never a skipped file', () => {
        const doc = parseDocument('<svg><g><path/></g></path></svg>');
        expect(doc.errors.length).toBeGreaterThan(0);
        expect(doc.errors[0]?.line).toBe(1);
        expect(doc.errors[0]?.column).toBeGreaterThan(0);

        // An unclosed element is reported against where it OPENED, which is
        // the line a reader has to go to.
        const unclosed = parseDocument('<svg>\n  <g>\n    <rect/>\n');
        expect(unclosed.errors.map((e) => e.message).join(' ')).toContain('<g> is never closed');
        expect(unclosed.errors.find((e) => e.message.includes('<g>'))?.line).toBe(2);

        // A well-formed file produces no errors, so the assertions above are
        // about the files and not about a parser that always complains.
        expect(parseDocument(read('assets/hamburger-24-grid.svg')).errors).toEqual([]);
    });

    it('the tree and the flat element list agree on every committed fixture', () => {
        // Two scanners over the same bytes is a drift risk, and this is the
        // check that makes the risk visible instead of latent: the tree's
        // element order and names must equal the flat list's open tags, on
        // every fixture the corpus carries.
        const files = manifest.rows.flatMap((r) => [r.file, r.twin]);
        expect(files.length).toBeGreaterThan(20);
        for (const rel of files) {
            if (!rel.endsWith('.svg')) continue;
            const content = read(rel);
            const flat = parseElements(content)
                .filter((el) => !el.closing)
                .map((el) => el.name);
            const tree = parseDocument(content).elements.map((el) => el.name);
            expect(tree, `${rel}: the tree and the flat list disagree`).toEqual(flat);
        }
    });

    it('every node kind carries a line and a column', () => {
        const doc = parseDocument(
            '<?xml version="1.0"?>\n<!DOCTYPE svg>\n<svg>\n  <!-- c -->\n  <style><![CDATA[ x ]]></style>\n</svg>\n',
        );
        const kinds = new Set<string>();
        const walk = (nodes: readonly { kind: string; line: number; column: number; children: unknown[] }[]): void => {
            for (const n of nodes) {
                kinds.add(n.kind);
                expect(n.line, `${n.kind} has no line`).toBeGreaterThan(0);
                expect(n.column, `${n.kind} has no column`).toBeGreaterThan(0);
                walk(n.children as typeof nodes);
            }
        };
        walk(doc.roots as unknown as Parameters<typeof walk>[0]);
        for (const kind of ['pi', 'doctype', 'element', 'comment', 'cdata']) {
            expect(kinds, `no ${kind} node was produced`).toContain(kind);
        }
        expect(doc.errors).toEqual([]);
    });
});

/**
 * Step 3.2 of `road-to-svg-review-followups` — the held-out real set, reported
 * beside the planted one and never merged into it.
 *
 * A promotion bar measured only on planted files says how well the checkers
 * find defects somebody chose for them. This set is the other half: files
 * written to be right, so a rule that starts firing on correct work has
 * somewhere to show up. The expectations are pre-registered in
 * `fixtures/svg-assets/README.md` under its "held-out real set" heading, and
 * this file re-derives them rather than restating them.
 */
describe('the-real-set-is-reported-separately', () => {
    const REAL = path.resolve(FIXTURES, '..', 'svg-real');

    it('the-real-set-is-reported-separately', () => {
        const files = fs
            .readdirSync(REAL)
            .filter((f) => f.endsWith('.svg'))
            .sort();
        // At least six, covering every asset class — the bar the step names.
        expect(files.length, 'the held-out real set is smaller than the step requires').toBeGreaterThanOrEqual(6);

        const readme = fs.readFileSync(path.join(FIXTURES, 'README.md'), 'utf-8');
        const section = readme.slice(readme.search(/^##\s.*[Rr]eal/m));
        expect(section.length, 'the README carries no held-out-real-set section').toBeGreaterThan(0);

        // Every class is present in the pre-registration.
        for (const cls of ['icon', 'mark', 'illustration', 'diagram', 'animated']) {
            expect(section, `the real set declares no ${cls}`).toContain(`| ${cls} |`);
        }

        const findings: Record<string, string[]> = {};
        for (const name of files) {
            // Every file is pre-registered; a file nobody declared is a file
            // whose reading nobody predicted.
            expect(section, `${name} is not pre-registered in the README`).toContain(`\`${name}\``);
            findings[name] = scanSvg(fs.readFileSync(path.join(REAL, name), 'utf-8'), name).map((f) => f.rule);
        }

        // The reading, asserted as the README records it. One finding, on the
        // one file that is genuinely unnamed.
        const total = Object.values(findings).reduce((n, f) => n + f.length, 0);
        expect(total, `real-set findings: ${JSON.stringify(findings)}`).toBe(1);
        expect(findings['recraft-asset-0001.svg']).toEqual(['svg-a11y-no-accessible-name']);

        // And it is a SEPARATE reading: no file of this set is a planted row,
        // so the two tables cannot silently merge.
        const planted = new Set(manifest.rows.flatMap((r) => [r.file, r.twin]));
        for (const name of files) {
            expect(planted.has(`assets/${name}`), `${name} is also a planted row`).toBe(false);
        }
    });
});

/** Step 3.1 of `road-to-svg-from-a-live-session` — cost the static layer can read. */
describe('degenerate-gradient-is-found', () => {
    it('degenerate-gradient-is-found', () => {
        const r = manifest.rows.find((x) => x.id === 'degenerate-gradient');
        expect(r, 'the row is not pre-registered in manifest.json').toBeDefined();
        const row = r as Row;
        expect(scan(row.file, row.delivery).map((f) => f.rule)).toContain('svg-structure-degenerate-gradient');
        expect(scan(row.twin, row.delivery)).toEqual([]);
    });

    it('a stop difference in OPACITY alone is not degenerate', () => {
        const grad = (stops: string): string =>
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" role="img"><title>t</title>' +
            `<defs><linearGradient id="t-fade">${stops}</linearGradient></defs>` +
            '<rect width="10" height="10" fill="url(#t-fade)"/></svg>';
        const fade = grad('<stop offset="0" stop-color="#000" stop-opacity="1"/><stop offset="1" stop-color="#000" stop-opacity="0"/>');
        expect(scanSvg(fade, 'a.svg').map((f) => f.rule)).not.toContain('svg-structure-degenerate-gradient');
        // Same colour AND same opacity is the case the rule is about.
        const flat = grad('<stop offset="0" stop-color="#000" stop-opacity="1"/><stop offset="1" stop-color="#000" stop-opacity="1"/>');
        expect(scanSvg(flat, 'b.svg').map((f) => f.rule)).toContain('svg-structure-degenerate-gradient');
        // A `style` attribute carries the same stop properties and is read.
        const styled = grad('<stop offset="0" style="stop-color:#000"/><stop offset="1" style="stop-color:#000"/>');
        expect(scanSvg(styled, 'c.svg').map((f) => f.rule)).toContain('svg-structure-degenerate-gradient');
        // One stop is not a gradient to compare against itself.
        const single = grad('<stop offset="0" stop-color="#000"/>');
        expect(scanSvg(single, 'd.svg').map((f) => f.rule)).not.toContain('svg-structure-degenerate-gradient');
        // And a spelling difference is NOT read as identical — the conservative
        // direction, stated in the rule and pinned here.
        const spelled = grad('<stop offset="0" stop-color="#FFF"/><stop offset="1" stop-color="#ffffff"/>');
        expect(scanSvg(spelled, 'e.svg').map((f) => f.rule)).not.toContain('svg-structure-degenerate-gradient');
    });
});

describe("the two readings a completion review found wrong rather than missing", () => {
    it('an inline graphic keeps its own svg-asset-disable markers', () => {
        // Finding 16. `scanHostHtml` matched in the MASKED text and then sliced
        // the body out of it too, so the inner `scanSvg`'s `parseIgnores` read
        // a graphic whose every comment had been blanked to spaces — every
        // in-graphic suppression marker with it.
        const graphic =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' +
            '<!-- svg-asset-disable svg-a11y-no-accessible-name -->' +
            '<rect width="10" height="10" fill="#000"/></svg>';
        // The marker works on the standalone file — that is the control, and
        // without it a green host assertion proves only that the rule is quiet.
        expect(scanSvg(graphic, 'a.svg').map((f) => f.rule)).not.toContain('svg-a11y-no-accessible-name');
        const unmarked = graphic.replace(/<!--[\s\S]*?-->/, '');
        expect(scanSvg(unmarked, 'a.svg').map((f) => f.rule)).toContain('svg-a11y-no-accessible-name');

        // And it works the same way inside a host document.
        const host = `<!doctype html>\n<html><body>\n${graphic}\n</body></html>\n`;
        expect(scanHostHtml(host, 'a.html').map((f) => f.rule)).not.toContain('svg-a11y-no-accessible-name');
        const hostUnmarked = `<!doctype html>\n<html><body>\n${unmarked}\n</body></html>\n`;
        expect(scanHostHtml(hostUnmarked, 'a.html').map((f) => f.rule)).toContain('svg-a11y-no-accessible-name');

        // Said plainly, because a green assertion that would also be green on
        // the defect proves nothing: the four lines above pass EITHER WAY. The
        // function re-filters on host-absolute lines at the end, so the inert
        // inner pass is invisible to a short host — which is exactly why the
        // defect survived review of the output and had to be found by reading
        // the slice. The case BELOW is the one that separates them.
        //
        // `svg-asset-disable <rule>` without a line suffix suppresses the whole
        // FILE, and `parseIgnores` spells "whole file" as lines 1..10_000. Past
        // that depth the outer re-filter stops covering for the inner pass: the
        // finding's absolute line is outside the set, while its graphic-local
        // line is inside it. So on a deep host the suppression works only if
        // the graphic reached `scanSvg` with its own comments intact.
        const deep = `${'\n'.repeat(10_050)}${graphic}\n`;
        expect(scanHostHtml(deep, 'a.html').map((f) => f.rule)).not.toContain('svg-a11y-no-accessible-name');
        const deepUnmarked = `${'\n'.repeat(10_050)}${unmarked}\n`;
        expect(scanHostHtml(deepUnmarked, 'a.html').map((f) => f.rule)).toContain('svg-a11y-no-accessible-name');

        // The masking itself is unchanged: a graphic that lives INSIDE an HTML
        // comment is still not on the page and is still not scanned.
        const commented = `<!doctype html>\n<html><body>\n<!-- ${unmarked} -->\n</body></html>\n`;
        expect(scanHostHtml(commented, 'a.html')).toEqual([]);
    });

    it('path tokens read compact arc flags and a leading plus', () => {
        // Finding 17. `a 5 5 0 0130 30` is legal: the two flags are single
        // digits and may run together with what follows. The old number-or-
        // letter alternation read `0130` as ONE number, shifted every argument
        // after it, and returned a WRONG box rather than null.
        expect(tokenisePath('M 0 0 a 5 5 0 0130 30')).toEqual(['M', '0', '0', 'a', '5', '5', '0', '0', '1', '30', '30']);
        // The spaced spelling of the same path must tokenise identically, or
        // the two forms would disagree about the same geometry.
        expect(tokenisePath('M 0 0 a 5 5 0 0 1 30 30')).toEqual(tokenisePath('M 0 0 a 5 5 0 0130 30'));
        const compact = pathExtent('M 0 0 a 5 5 0 0130 30');
        expect(compact).not.toBeNull();
        expect(compact).toEqual(pathExtent('M 0 0 a 5 5 0 0 1 30 30'));
        // A leading `+` is legal and was dropped by the same alternation.
        expect(tokenisePath('M +10 +20')).toEqual(['M', '+10', '+20']);
        expect(pathExtent('M +10 +20 L +30 +40')).toEqual(pathExtent('M 10 20 L 30 40'));
    });
});

describe('what the second review round found in the geometry readings', () => {
    it('a compact arc is not reported as an unparseable path', () => {
        // Finding 5. `pathDataError` kept the superseded tokeniser after
        // `pathExtent` was fixed, so the same legal path that read as a wrong
        // BOX there read as a FINDING here — against a correct file, from the
        // rule whose job is to say a file cannot be read.
        expect(pathDataError('M 0 0 a 5 5 0 0130 30')).toBeNull();
        expect(pathDataError('M 0 0 a 5 5 0 0 1 30 30')).toBeNull();
        expect(pathDataError('M +10 +20 L +30 +40')).toBeNull();
        // Still a reader, not a rubber stamp: a short arc and a wrong command
        // letter are both still reported.
        expect(pathDataError('M 0 0 a 5 5 0 0 1 30')).not.toBeNull();
        expect(pathDataError('M 0 0 Q 1 1')).not.toBeNull();
        expect(pathDataError('M 0 0 k 1 1')).not.toBeNull();
    });

    it('a present-but-unreadable coordinate refuses the box', () => {
        // Finding 7. `num(k) ?? 0` conflated ABSENT with UNREADABLE, so a
        // percentage — which this function's doc promises to refuse — became 0.
        const el = (attrs: Record<string, string>) =>
            ({ name: 'rect', attrs, line: 1, start: 0, selfClosing: true, closing: false, raw: '' });
        // Absent still defaults to 0, which is what the SVG spec says.
        expect(staticBox(el({ width: '10', height: '10' }))).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
        // Present and unreadable is null, in both directions that matter: a
        // percentage and a unit.
        expect(staticBox(el({ x: '50%', width: '10', height: '10' }))).toBeNull();
        expect(staticBox(el({ y: '2em', width: '10', height: '10' }))).toBeNull();
        // And a readable one is still read.
        expect(staticBox(el({ x: '4', y: '4', width: '10', height: '10' }))).toEqual({
            minX: 4,
            minY: 4,
            maxX: 14,
            maxY: 14,
        });
    });
});

describe('what the third review round found by running the code', () => {
    it('a processing instruction ends at ?>, not at the first >', () => {
        // Finding 3. This branch shared the DOCTYPE's first-`>` search, so a
        // legal PI whose quoted pseudo-attribute contains a `>` ended early and
        // the rest was parsed as markup — `<script/>` became a real element and
        // the file was reported `svg-safety-active-content` at severity
        // `error`, on a document with no script in it.
        const pi =
            '<?xml-stylesheet href="a.css?x=1><script/>"?>\n' +
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img">' +
            '<title>t</title><rect width="24" height="24"/></svg>\n';
        expect(scanSvg(pi, 'pi.svg')).toEqual([]);

        // The rule itself is untouched: a real script is still found, which is
        // what makes the assertion above a fix rather than a suppression.
        const real =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img">' +
            '<title>t</title><script/><rect width="24" height="24"/></svg>\n';
        expect(scanSvg(real, 'real.svg').map((f) => f.rule)).toContain('svg-safety-active-content');
    });
});

describe('what the fourth review round found', () => {
    it('a stray closing tag costs one error, not two', () => {
        // Finding 2. The recovery branch popped the stack even when NOTHING on
        // it matched, so a `</g>` with no `<g>` detached the `<svg>` — and the
        // real `</svg>` at the end then had no open element and the file
        // collected a second error it had not earned. Cascading is what that
        // branch exists to prevent.
        const stray =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img">\n' +
            '  <title>A square</title>\n' +
            '  </g>\n' +
            '  <rect width="24" height="24" fill="#000"/>\n' +
            '</svg>\n';
        const errs = scanSvg(stray, 'a.svg').filter((f) => f.rule === 'svg-structure-not-well-formed');
        expect(errs).toHaveLength(1);
        expect(errs[0]?.snippet).toContain('</g>');

        // A MATCHING mis-nesting still recovers by unwinding to it, which is
        // the case the branch was written for and must keep.
        const mis =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img">\n' +
            '  <title>t</title>\n' +
            '  <g><a><rect width="24" height="24"/></g></a>\n' +
            '</svg>\n';
        expect(
            scanSvg(mis, 'b.svg').filter((f) => f.rule === 'svg-structure-not-well-formed').length,
        ).toBeGreaterThan(0);
        // And a well-formed file still reports nothing at all.
        const good =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img">\n' +
            '  <title>t</title><g><rect width="24" height="24"/></g>\n</svg>\n';
        expect(scanSvg(good, 'c.svg')).toEqual([]);
    });

    it('an arc contributes its sweep, not only its endpoints', () => {
        // Finding 4. `M 10 12 A 20 20 0 0 1 90 12` read as a box of zero
        // height while the curve reaches y = -28: a wrong NUMBER feeding the
        // icon-grid padding and the hole and translucent masks, not a missing
        // one.
        const up = pathExtent('M 10 12 A 20 20 0 0 1 90 12');
        expect(up?.minY).toBeCloseTo(-28, 6);
        expect(up?.maxY).toBeCloseTo(12, 6);
        // The other sweep flag bulges the other way, by the same amount.
        const down = pathExtent('M 10 12 A 20 20 0 0 0 90 12');
        expect(down?.maxY).toBeCloseTo(52, 6);
        expect(down?.minY).toBeCloseTo(12, 6);
        // A near-full circle is its own bounding box.
        const circle = pathExtent('M 12 2 A 10 10 0 1 1 11.99 2');
        expect(circle?.minX).toBeCloseTo(2, 1);
        expect(circle?.maxX).toBeCloseTo(22, 1);
        expect(circle?.maxY).toBeCloseTo(22, 1);
        // A zero radius is a straight line per the spec — endpoints only, and
        // no NaN from the conversion.
        expect(pathExtent('M 0 0 A 0 0 0 0 1 10 10')).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
        // A quarter arc curving inward adds nothing beyond its endpoints,
        // which is the case a too-generous bound would get wrong.
        const quarter = pathExtent('M 0 10 A 10 10 0 0 1 10 0');
        expect(quarter?.minX).toBeCloseTo(0, 6);
        expect(quarter?.maxX).toBeCloseTo(10, 6);
    });
});
