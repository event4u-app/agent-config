#!/usr/bin/env node
/**
 * report_svg_fixture_layers — Phase 5 of `road-to-svg-with-a-witness`.
 *
 * Re-runs the planted-defect corpus with every layer that exists and writes the
 * measured table and the promotion-bar table into the fixture README, beside
 * the baseline step 0.2 recorded.
 *
 * 5.1 exists because the baseline table records what the tree read BEFORE any
 * checker, and a claim in a skill is only worth what the same corpus reads
 * AFTER. The two tables carry identical row sets on purpose: a row that
 * appears in one and not the other is a row somebody stopped measuring.
 *
 * 5.2 records the BAR a later promotion would have to clear, not the
 * promotion. Every rule here ships advisory (decision E5), and the measured
 * condition for making one blocking is: zero findings on its clean twin across
 * TWO CONSECUTIVE measured runs, and at least one true finding on its planted
 * row. Two runs rather than one because a single run cannot distinguish a rule
 * that is stable from a rule that happened to be quiet.
 *
 * The engine layer is reported as `unverified` wherever the asset profile
 * cannot run — never as a pass. That is the same honesty the manifest's target
 * table pre-registered, and it is the reason this script does not silently
 * collapse the two layers into one column.
 *
 * Usage:
 *   report_svg_fixture_layers [--write] [--json]
 *
 * Without `--write` it prints the tables and touches nothing. Exit 0 always
 * unless the corpus itself cannot be read: this is a REPORT, and a report that
 * fails a build teaches a reader to stop running it.
 */
import fs from 'node:fs';
import path from 'node:path';

import { scanHostHtml, scanSvg, type DeliveryMode } from './lint_svg_asset.js';
import { smilVerdict } from './_lib/svg_motion.js';

const FIXTURE_REL = path.join('tests', 'design-artifacts', 'fixtures', 'svg-assets');

interface Row {
    id: string;
    asset_class: string;
    delivery: DeliveryMode;
    layer: 'static' | 'engine';
    rule: string;
    file: string;
    twin: string;
}
interface Control {
    id: string;
    file: string;
    must_not_report: string[];
}
interface Manifest {
    rows: Row[];
    controls: Control[];
    fill_ratio_thresholds: Record<string, number>;
}

/** Pre-registered taxonomy id → the rule `lint_svg_asset` emits for it. */
export const TAXONOMY_TO_RULE: Readonly<Record<string, string>> = {
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
 * The two rows the static witness deliberately does not answer: inline SVG in a
 * host document, where the reduced-motion route may live outside the graphic.
 * DQ4 owns them (step 1.3), and the reading both linters share settles them.
 */
const DQ4_ROWS: Readonly<Record<string, 'no-route' | 'css-only'>> = {
    'inline-smil-no-route': 'no-route',
    'inline-smil-css-only-route': 'css-only',
};

export interface RowReading {
    id: string;
    layer: 'static' | 'engine';
    rule: string;
    answeredBy: string;
    plantedFound: boolean | null;
    twinFindings: number | null;
    note: string;
}

function readFile(root: string, rel: string): string {
    return fs.readFileSync(path.join(root, FIXTURE_REL, rel), 'utf-8');
}

function scanOne(root: string, rel: string, delivery: DeliveryMode): string[] {
    const content = readFile(root, rel);
    const findings = /\.svg$/i.test(rel)
        ? scanSvg(content, rel, { delivery })
        : scanHostHtml(content, rel, { delivery });
    return findings.map((f) => f.rule);
}

/** Every row's reading, with the engine layer honestly reported as unknown here. */
export function measure(root: string, manifest: Manifest, engineAvailable: boolean): RowReading[] {
    return manifest.rows.map((row): RowReading => {
        if (row.id in DQ4_ROWS) {
            const planted = smilVerdict(readFile(root, row.file));
            const twin = smilVerdict(readFile(root, row.twin));
            return {
                id: row.id,
                layer: row.layer,
                rule: row.rule,
                answeredBy: 'lint_design_quality DQ4',
                plantedFound: planted === DQ4_ROWS[row.id],
                twinFindings: twin === 'routed' ? 0 : 1,
                note: 'inline SVG in a host document — the route can live outside the graphic',
            };
        }
        if (row.layer === 'engine') {
            return {
                id: row.id,
                layer: 'engine',
                rule: row.rule,
                answeredBy: 'ui:render --profile asset',
                // Null in BOTH directions, and that is the honest reading: this
                // report does not drive a browser, so it knows the engine layer
                // exists without knowing what it read. The scenario suite
                // collects those numbers.
                plantedFound: null,
                twinFindings: null,
                note: engineAvailable
                    ? 'engine reading not collected by this report — run the scenario suite'
                    : 'unverified — no browser resolved; never reported as a pass',
            };
        }
        const expected = TAXONOMY_TO_RULE[row.rule];
        if (!expected) {
            return {
                id: row.id,
                layer: row.layer,
                rule: row.rule,
                answeredBy: '(unmapped)',
                plantedFound: null,
                twinFindings: null,
                note: 'no linter rule is mapped to this pre-registered taxonomy id',
            };
        }
        const planted = scanOne(root, row.file, row.delivery);
        const twin = scanOne(root, row.twin, row.delivery);
        return {
            id: row.id,
            layer: row.layer,
            rule: row.rule,
            answeredBy: `lint_svg_asset ${expected}`,
            plantedFound: planted.includes(expected),
            twinFindings: new Set(twin).size,
            note: '',
        };
    });
}

function cell(value: boolean | number | null, trueWord = 'found', falseWord = 'MISSED'): string {
    if (value === null) return 'unverified';
    if (typeof value === 'boolean') return value ? trueWord : falseWord;
    return String(value);
}

export function renderMeasuredTable(readings: readonly RowReading[]): string {
    const lines = [
        '| row | layer | pre-registered rule | answered by | planted | twin findings |',
        '|---|---|---|---|---|---|',
    ];
    for (const r of readings) {
        lines.push(
            `| ${r.id} | ${r.layer} | \`${r.rule}\` | ${r.answeredBy} | ` +
                `${cell(r.plantedFound)} | ${cell(r.twinFindings)} |`,
        );
    }
    return lines.join('\n');
}

/**
 * The 5.2 table. `run 1` is this run; `run 2` is left as `pending` until a
 * second measured run fills it, because the bar is explicitly TWO CONSECUTIVE
 * runs and a column pre-filled from one run would be the claim the bar exists
 * to prevent.
 */
export function renderPromotionTable(
    readings: readonly RowReading[],
    previous: ReadonlyMap<string, number>,
): string {
    const lines = [
        '| rule | layer | true findings on planted | twin findings run 1 | twin findings run 2 | meets bar |',
        '|---|---|---|---|---|---|',
    ];
    for (const r of readings) {
        const run1 = previous.get(r.id);
        const run2 = r.twinFindings;
        const bothZero = run1 === 0 && run2 === 0;
        const meets = r.plantedFound === true && bothZero ? 'yes' : 'no';
        lines.push(
            `| ${r.id} | ${r.layer} | ${cell(r.plantedFound, '1+', '0')} | ` +
                `${run1 === undefined ? 'pending' : String(run1)} | ${cell(run2)} | ${meets} |`,
        );
    }
    return lines.join('\n');
}

function replaceSection(readme: string, heading: string, body: string): string {
    const start = readme.indexOf(heading);
    if (start === -1) return `${readme.replace(/\n+$/, '')}\n\n${heading}\n\n${body}\n`;
    const after = readme.indexOf('\n## ', start + heading.length);
    const end = after === -1 ? readme.length : after;
    return `${readme.slice(0, start)}${heading}\n\n${body}\n${readme.slice(end)}`;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const root = process.cwd();
    const manifestPath = path.join(root, FIXTURE_REL, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        process.stderr.write(`[report_svg_fixture_layers] fixture manifest not found: ${manifestPath}\n`);
        return 1;
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Manifest;

    let engineAvailable = false;
    try {
        require.resolve('@playwright/test');
        engineAvailable = true;
    } catch {
        engineAvailable = false;
    }

    const readings = measure(root, manifest, engineAvailable);

    // Run 1's twin counts, if a previous run left them in the README.
    const readmePath = path.join(root, FIXTURE_REL, 'README.md');
    const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf-8') : '';
    const previous = new Map<string, number>();
    for (const line of readme.split('\n')) {
        const m = /^\|\s*([a-z0-9-]+)\s*\|\s*(static|engine)\s*\|.*\|\s*(\d+|pending|unverified)\s*\|\s*(\d+|pending|unverified)\s*\|\s*(yes|no)\s*\|$/.exec(
            line,
        );
        if (m && /^\d+$/.test(m[4] ?? '')) previous.set(m[1] as string, Number(m[4]));
    }

    const measured = renderMeasuredTable(readings);
    const promotion = renderPromotionTable(readings, previous);

    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ engineAvailable, readings }, null, 2)}\n`);
        return 0;
    }

    if (argv.includes('--write')) {
        let next = replaceSection(
            readme,
            '## Measured — every layer on (step 5.1)',
            'Identical row set to the baseline table above, which is the point: a row that\n' +
                'appears in one and not the other is a row somebody stopped measuring. The\n' +
                'engine layer reads `unverified` wherever the asset profile did not run — never\n' +
                'a pass.\n\n' +
                measured,
        );
        next = replaceSection(
            next,
            '## Promotion bar (step 5.2)',
            'The BAR a later promotion would have to cite, not the promotion. Every rule here\n' +
                'ships advisory (decision E5). A rule becomes a blocking candidate only at zero\n' +
                'twin findings across TWO CONSECUTIVE measured runs and at least one true finding\n' +
                'on its planted row — two runs rather than one, because a single run cannot tell a\n' +
                'rule that is stable from a rule that happened to be quiet. Promoting any of them\n' +
                'stays outside this roadmap.\n\n' +
                promotion,
        );
        fs.writeFileSync(readmePath, next);
        process.stdout.write(`✅  report_svg_fixture_layers: wrote both tables into ${FIXTURE_REL}/README.md\n`);
        return 0;
    }

    process.stdout.write(`## Measured — every layer on (step 5.1)\n\n${measured}\n\n`);
    process.stdout.write(`## Promotion bar (step 5.2)\n\n${promotion}\n`);
    return 0;
}

/* c8 ignore start — entrypoint guard */
const invokedDirectly =
    typeof process !== 'undefined' &&
    Array.isArray(process.argv) &&
    /report_svg_fixture_layers\.(ts|js)$/.test(process.argv[1] ?? '');
if (invokedDirectly) process.exit(main());
/* c8 ignore stop */
