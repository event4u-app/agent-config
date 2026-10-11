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

import type * as PlaywrightTest from '@playwright/test';
import type * as UiRenderAsset from '../../src/cli/commands/uiRenderAsset.js';

import { scanHostHtml, scanSvg, type DeliveryMode } from '../../src/scripts/lint_svg_asset.js';
import { smilVerdict } from '../../src/scripts/_lib/svg_motion.js';

/**
 * The engine half stays a guarded dynamic import even here, because the report
 * treats that layer as optional by design: without it every engine row reads
 * `unverified`, never a pass.
 */
type AssetClass = 'icon' | 'mark' | 'illustration' | 'diagram' | 'animated';
type AssetRenderModule = typeof UiRenderAsset;

async function loadAssetRenderer(): Promise<AssetRenderModule | null> {
    try {
        return (await import('../../src/cli/commands/uiRenderAsset.js')) as AssetRenderModule;
    } catch {
        return null;
    }
}

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
    'accessibility/generic-id-collision': 'svg-a11y-duplicate-id',
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
    file: string;
    /** A planted defect, or a control that must stay silent. */
    kind: 'planted' | 'control';
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

/**
 * Every row's reading.
 *
 * `engine` is a real browser pass when one resolves and `unverified` when none
 * does — never a pass. That asymmetry is the whole reason the two layers are
 * reported in separate columns instead of collapsed into one verdict.
 */
export async function measure(
    root: string,
    manifest: Manifest,
    browser: EngineBrowser | null,
): Promise<RowReading[]> {
    const out: RowReading[] = [];
    for (const row of manifest.rows) {
        out.push(await measureRow(root, row, browser));
    }
    // The controls belong in this table too. The baseline table carries them,
    // and 5.1 asks for identical row sets — a measured table that quietly drops
    // the three files whose whole job is to stay silent would be measuring the
    // easy half.
    for (const control of manifest.controls) {
        const fired = scanOne(root, control.file, 'inline').map(taxonomyOf);
        const offending = control.must_not_report.filter((r) => fired.includes(r));
        out.push({
            id: control.id,
            file: control.file,
            kind: 'control',
            layer: 'static',
            rule: control.must_not_report.join(' / '),
            answeredBy: 'must stay silent',
            plantedFound: null,
            twinFindings: offending.length,
            note: offending.length ? `fired: ${offending.join(', ')}` : '',
        });
    }
    return out;
}

/** A minimal structural type, so this module does not import Playwright's types. */
export type EngineBrowser = PlaywrightTest.Browser;

async function measureRow(root: string, row: Row, browser: EngineBrowser | null): Promise<RowReading> {
    {
        if (row.id in DQ4_ROWS) {
            const planted = smilVerdict(readFile(root, row.file));
            const twin = smilVerdict(readFile(root, row.twin));
            return {
                id: row.id,
                file: row.file,
                kind: 'planted',
                layer: row.layer,
                rule: row.rule,
                answeredBy: 'lint_design_quality DQ4',
                plantedFound: planted === DQ4_ROWS[row.id],
                twinFindings: twin === 'routed' ? 0 : 1,
                note: 'inline SVG in a host document — the route can live outside the graphic',
            };
        }
        if (row.layer === 'engine') {
            if (!browser) {
                return {
                    id: row.id,
                    file: row.file,
                    kind: 'planted',
                    layer: 'engine',
                    rule: row.rule,
                    answeredBy: 'ui:render --profile asset',
                    plantedFound: null,
                    twinFindings: null,
                    note: 'unverified — no browser resolved; never reported as a pass',
                };
            }
            const planted = await engineRules(root, browser, row, row.file);
            const twin = await engineRules(root, browser, row, row.twin);
            return {
                id: row.id,
                file: row.file,
                kind: 'planted',
                layer: 'engine',
                rule: row.rule,
                answeredBy: 'ui:render --profile asset',
                plantedFound: planted.includes(row.rule),
                twinFindings: twin.filter((r) => r === row.rule).length,
                note: twin.length ? `twin also reports: ${[...new Set(twin)].join(', ')}` : '',
            };
        }
        const expected = TAXONOMY_TO_RULE[row.rule];
        if (!expected) {
            return {
                id: row.id,
                file: row.file,
                kind: 'planted',
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
            file: row.file,
            kind: 'planted',
            layer: row.layer,
            rule: row.rule,
            answeredBy: `lint_svg_asset ${expected}`,
            plantedFound: planted.includes(expected),
            twinFindings: new Set(twin).size,
            note: '',
        };
    }
}

/** The engine layer's finding ids for one file. */
async function engineRules(
    root: string,
    browser: EngineBrowser,
    row: Row,
    rel: string,
): Promise<string[]> {
    const outDir = path.join(root, 'agents', 'runtime', 'state', 'render', `fixture-${row.id}-${path.basename(rel)}`);
    // The icon-grid reading needs a reference SET to read the grid, stroke and
    // padding OFF — decision E6: the grid is read from the incumbent set's own
    // SVGs, never declared or vendored. The fixture carries no icon-set key, so
    // the two on-grid icons in the corpus stand in for one. Without a set, or
    // without a reference sharing the candidate's viewBox, the reading is
    // `unverified` with a reason — never a pass and never a finding.
    const iconSet =
        row.asset_class === 'icon'
            ? ['assets/hamburger-24-grid.svg', 'assets/icon-off-grid.clean.svg'].map((f) =>
                  path.join(root, FIXTURE_REL, f),
              )
            : undefined;
    const renderer = await loadAssetRenderer();
    if (!renderer) return [];
    const result = await renderer.runAssetRender(browser as never, {
        file: path.join(root, FIXTURE_REL, rel),
        projectRoot: root,
        outDir,
        assetClass: row.asset_class as AssetClass,
        delivery: row.delivery,
        thresholdsFile: path.join(root, FIXTURE_REL, 'manifest.json'),
        iconSet,
    });
    return result.reading.findings.map((f) => f.rule);
}

/**
 * Every rule that fires on a file the corpus declares CLEAN — every one-edit
 * twin and every control, each read at its own declared class and delivery.
 */
export async function collectCleanFindings(
    root: string,
    manifest: Manifest,
    browser: EngineBrowser | null,
): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    const note = (rule: string, file: string): void => {
        const list = out.get(rule) ?? [];
        if (!list.includes(file)) list.push(file);
        out.set(rule, list);
    };
    const seen = new Set<string>();
    for (const row of manifest.rows) {
        for (const rel of [row.twin]) {
            if (seen.has(rel)) continue;
            seen.add(rel);
            for (const rule of scanOne(root, rel, row.delivery)) note(taxonomyOf(rule), rel);
            if (browser && row.layer === 'engine') {
                for (const rule of await engineRules(root, browser, row, rel)) note(rule, rel);
            }
        }
    }
    for (const control of manifest.controls) {
        if (seen.has(control.file)) continue;
        seen.add(control.file);
        for (const rule of scanOne(root, control.file, 'inline')) note(taxonomyOf(rule), control.file);
    }
    return out;
}

/** The linter's own id back to the pre-registered taxonomy id, where one maps. */
function taxonomyOf(linterRule: string): string {
    for (const [taxonomy, rule] of Object.entries(TAXONOMY_TO_RULE)) {
        if (rule === linterRule) return taxonomy;
    }
    return linterRule;
}

function cell(value: boolean | number | null, trueWord = 'found', falseWord = 'MISSED'): string {
    if (value === null) return 'unverified';
    if (typeof value === 'boolean') return value ? trueWord : falseWord;
    return String(value);
}

export function renderMeasuredTable(readings: readonly RowReading[]): string {
    const lines = [
        '| file | layer | pre-registered rule | answered by | planted | twin findings |',
        '|---|---|---|---|---|---|',
    ];
    for (const r of readings) {
        lines.push(
            `| \`${r.file}\` | ${r.layer} | \`${r.rule}\` | ${r.answeredBy} | ` +
                `${r.kind === 'control' ? 'n/a — control' : cell(r.plantedFound)} | ${cell(r.twinFindings)} |`,
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
/**
 * The bar, measured over EVERY clean file in the corpus — not over the rule's
 * own twin alone.
 *
 * Measured during the Phase 2 run and the reason this column is corpus-wide:
 * `structure/loose-viewbox` reports its own twin cleanly and still fires on
 * `assets/text-overflows-box.clean.svg` (fill ratio 0.300 against the
 * `illustration` threshold 0.40) and on the support file
 * `hosts/pulse-animated.svg` (0.112 against `animated` 0.35). Both are correct
 * readings of the declared per-class thresholds. But a rule that reds a
 * DIFFERENT row's clean file has not cleared a zero-false-positive bar in any
 * sense a consumer would recognise, and a column that measured only the rule's
 * own twin would have scored it `yes` — which is the laundering this table
 * exists to make impossible.
 */
export function renderPromotionTable(
    readings: readonly RowReading[],
    previous: ReadonlyMap<string, number>,
    cleanFindings: ReadonlyMap<string, readonly string[]>,
): string {
    const lines = [
        '| rule | file | layer | true findings on planted | twin findings run 1 | twin findings run 2 | meets bar |',
        '|---|---|---|---|---|---|---|',
    ];
    for (const r of readings) {
        if (r.kind === 'control') continue;
        const offenders = cleanFindings.get(r.rule) ?? [];
        const run1 = previous.get(r.file);
        const run2 = r.plantedFound === null ? null : offenders.length;
        const bothZero = run1 === 0 && run2 === 0;
        const meets = r.plantedFound === true && bothZero ? 'yes' : 'no';
        const where = offenders.length ? ` (${offenders.join(', ')})` : '';
        lines.push(
            `| \`${r.rule}\` | \`${r.file}\` | ${r.layer} | ${cell(r.plantedFound, '1+', '0')} | ` +
                `${run1 === undefined ? 'pending' : String(run1)} | ${cell(run2)}${where} | ${meets} |`,
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

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
    const root = process.cwd();
    const manifestPath = path.join(root, FIXTURE_REL, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        process.stderr.write(`[report_svg_fixture_layers] fixture manifest not found: ${manifestPath}\n`);
        return 1;
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Manifest;

    // `--static-only` is for a host with no browser, and for a reader who wants
    // the cheap half. It changes what the engine column SAYS, never whether the
    // column exists: an absent reading stays `unverified`, never a pass.
    const staticOnly = argv.includes('--static-only');
    let browser: EngineBrowser | null = null;
    if (!staticOnly) {
        try {
            const { chromium } = (await import('@playwright/test')) as typeof PlaywrightTest;
            browser = (await chromium.launch({ headless: true })) as unknown as EngineBrowser;
        } catch {
            browser = null;
        }
    }

    let readings: RowReading[];
    try {
        readings = await measure(root, manifest, browser);
    } finally {
        // The Class-A boundary: no browser survives this command, on any path.
        await (browser as { close?: () => Promise<void> } | null)?.close?.();
    }

    // Run 1's twin counts, if a previous run left them in the README.
    const readmePath = path.join(root, FIXTURE_REL, 'README.md');
    const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf-8') : '';
    const previous = new Map<string, number>();
    for (const line of readme.split('\n')) {
        const m = /^\|\s*`[^`]+`\s*\|\s*`([^`]+)`\s*\|\s*(static|engine)\s*\|[^|]*\|\s*(\d+|pending|unverified)[^|]*\|\s*(\d+|pending|unverified)[^|]*\|\s*(yes|no)\s*\|$/.exec(
            line,
        );
        if (m && /^\d+$/.test(m[4] ?? '')) previous.set(m[1] as string, Number(m[4]));
    }

    const measured = renderMeasuredTable(readings);
    let cleanFindings: Map<string, string[]>;
    let sweepBrowser: EngineBrowser | null = null;
    try {
        if (!staticOnly) {
            try {
                const { chromium } = (await import('@playwright/test')) as typeof PlaywrightTest;
                sweepBrowser = (await chromium.launch({ headless: true })) as unknown as EngineBrowser;
            } catch {
                sweepBrowser = null;
            }
        }
        cleanFindings = await collectCleanFindings(root, manifest, sweepBrowser);
    } finally {
        await (sweepBrowser as { close?: () => Promise<void> } | null)?.close?.();
    }
    const promotion = renderPromotionTable(readings, previous, cleanFindings);
    const candidates = readings.filter((r) => r.kind === 'planted');
    const missCount = candidates.filter((r) => (cleanFindings.get(r.rule) ?? []).length > 0).length;
    const candidateCount = candidates.length;
    const meetsCount = candidateCount - missCount;

    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ engine: browser !== null, readings }, null, 2)}\n`);
        return 0;
    }

    if (argv.includes('--write')) {
        let next = replaceSection(
            readme,
            '## § Measured — every layer on (step 5.1)',
            'Identical row set to the baseline table above, which is the point: a row that\n' +
                'appears in one and not the other is a row somebody stopped measuring. The\n' +
                'engine layer reads `unverified` wherever the asset profile did not run — never\n' +
                'a pass.\n\n' +
                measured,
        );
        next = replaceSection(
            next,
            '## § Promotion bar (step 5.2)',
            'The BAR a later promotion would have to cite, not the promotion. Every rule here\n' +
                'ships advisory (decision E5). A rule becomes a blocking candidate only at zero\n' +
                'twin findings across TWO CONSECUTIVE measured runs and at least one true finding\n' +
                'on its planted row — two runs rather than one, because a single run cannot tell a\n' +
                'rule that is stable from a rule that happened to be quiet. Promoting any of them\n' +
                'stays outside this roadmap.\n\n' +
                'The twin column is measured over EVERY clean file in the corpus, not over the\n' +
                "rule's own twin alone — a rule that reds a different row's clean file has not\n" +
                'cleared a zero-false-positive bar in any sense a consumer would recognise, and a\n' +
                'column scoped to its own twin would have scored it `yes`.\n\n' +
                `**Outcome of this run: ${meetsCount} of ${candidateCount} rules meet the bar, ${missCount} do not.** ` +
                'Each miss names the clean file it fired on, in its own row.\n\n' +
                promotion,
        );
        fs.writeFileSync(readmePath, next);
        process.stdout.write(`✅  report_svg_fixture_layers: wrote both tables into ${FIXTURE_REL}/README.md\n`);
        return 0;
    }

    process.stdout.write(`## § Measured — every layer on (step 5.1)\n\n${measured}\n\n`);
    process.stdout.write(`## § Promotion bar (step 5.2)\n\n${promotion}\n`);
    return 0;
}

/* c8 ignore start — entrypoint guard */
const invokedDirectly =
    typeof process !== 'undefined' &&
    Array.isArray(process.argv) &&
    /report_svg_fixture_layers\.(ts|js)$/.test(process.argv[1] ?? '');
if (invokedDirectly) void main().then((code) => process.exit(code));
/* c8 ignore stop */
