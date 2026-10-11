/**
 * `ui:render --profile asset` — the engine witness. Steps 2.1, 2.2, 2.3 and 2.6
 * of `road-to-svg-with-a-witness`.
 *
 * The fixture is the authority here, not this file: every engine expectation is
 * read out of `tests/design-artifacts/fixtures/svg-assets/manifest.json`, whose
 * target table was committed (step 0.3) before any checker existed. A row this
 * file does not know about still runs, and a rule renamed in the fixture fails
 * here rather than quietly passing.
 *
 * These cases launch a real Chromium per render, so they carry their own
 * wall-clock budget rather than the suite's 30 s default.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { runUiRender } from '../../src/cli/commands/uiRender.js';
import type { RenderManifest } from '../../src/cli/commands/uiRender.js';
import type * as UiRenderModuleNs from '../../src/cli/commands/uiRender.js';
import {
    cropRect,
    gradeIconGrid,
    readIconReferencesDetailed,
} from '../../src/cli/commands/uiRenderAsset.js';
import type { AssetClass } from '../../src/cli/commands/uiRenderAsset.js';
import { parseRegistration } from '../../src/cli/commands/uiRenderAssetCompare.js';
import { parseElements } from '../../src/scripts/lint_svg_asset.js';
import type { DeliveryMode } from '../../src/scripts/lint_svg_asset.js';

type UiRenderModule = typeof UiRenderModuleNs;

const FIXTURE_ROOT = path.resolve(process.cwd(), 'tests/design-artifacts/fixtures/svg-assets');
const FIXTURE_MANIFEST = path.join(FIXTURE_ROOT, 'manifest.json');

interface FixtureRow {
    id: string;
    asset_class: AssetClass;
    delivery: DeliveryMode;
    layer: 'static' | 'engine';
    rule: string;
    file: string;
    twin: string;
    /**
     * The SOURCE raster this row is registered against, where the rule it
     * plants asks a question about the source. Step 1.2 of
     * `road-to-svg-from-a-live-session`: `geometry/near-white-hole` is about
     * what the source shows under a near-white region, and before this the
     * row carried no source for the engine to read.
     */
    source?: string;
    registration?: string;
}

interface FixtureManifest {
    rows: FixtureRow[];
    controls: Array<{
        id: string;
        file: string;
        must_not_report: string[];
        source?: string;
        registration?: string;
    }>;
    fill_ratio_thresholds: Record<string, number>;
    geometry_tolerances: Record<string, { silhouette_iou_min: number; max_boundary_distance_units: number }>;
}

/** The incumbent set the icon-grid reading is read FROM — never a declared grid (E6). */
const ICON_SET = [
    path.join(FIXTURE_ROOT, 'assets/hamburger-24-grid.svg'),
    path.join(FIXTURE_ROOT, 'assets/icon-off-grid.clean.svg'),
];

let tmpRoot: string;

beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-render-asset-'));
});

afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function manifestOf(slug: string): RenderManifest {
    const file = path.join(tmpRoot, 'agents', 'runtime', 'state', 'render', slug, 'manifest.json');
    return JSON.parse(fs.readFileSync(file, 'utf8')) as RenderManifest;
}

interface RenderArgs {
    file: string;
    slug: string;
    assetClass?: AssetClass;
    delivery?: DeliveryMode;
    compareTo?: string;
    registration?: string;
}

async function renderAsset(args: RenderArgs): Promise<RenderManifest> {
    const code = await runUiRender({
        target: args.file,
        projectRoot: tmpRoot,
        slug: args.slug,
        profile: 'asset',
        thresholds: FIXTURE_MANIFEST,
        iconSet: ICON_SET,
        ...(args.assetClass ? { assetClass: args.assetClass } : {}),
        ...(args.delivery ? { delivery: args.delivery } : {}),
        ...(args.compareTo ? { compareTo: args.compareTo } : {}),
        ...(args.registration ? { registration: parseRegistration(args.registration) ?? undefined } : {}),
    });
    expect(code, `ui:render exited ${code} for ${args.file}`).toBe(0);
    return manifestOf(args.slug);
}

function rulesOf(manifest: RenderManifest): string[] {
    return (manifest.asset?.findings ?? []).map((f) => f.rule);
}

describe('ui:render --profile asset', () => {
    it(
        'every-engine-row-found-and-twins-clean',
        async () => {
            expect(
                fs.existsSync(FIXTURE_MANIFEST),
                `the planted-defect fixture manifest is missing at ${FIXTURE_MANIFEST} — step 0.1 has not landed`,
            ).toBe(true);
            const fixture = JSON.parse(fs.readFileSync(FIXTURE_MANIFEST, 'utf8')) as FixtureManifest;
            const engineRows = fixture.rows.filter((r) => r.layer === 'engine');
            expect(engineRows.length, 'the fixture declares no engine rows').toBeGreaterThan(0);

            for (const row of engineRows) {
                const planted = await renderAsset({
                    file: path.join(FIXTURE_ROOT, row.file),
                    slug: `engine-${row.id}-planted`,
                    assetClass: row.asset_class,
                    delivery: row.delivery,
                    ...(row.source ? { compareTo: path.join(FIXTURE_ROOT, row.source) } : {}),
                    ...(row.registration ? { registration: row.registration } : {}),
                });
                expect(planted.profile, `${row.id}: the manifest must declare the asset profile`).toBe('asset');
                expect(planted.verification, `${row.id}: Playwright resolved, so this is a real reading`).toBe(
                    'verified',
                );
                expect(
                    rulesOf(planted),
                    `${row.id}: the planted file must report ${row.rule} — findings were ` +
                        JSON.stringify(planted.asset?.findings ?? []),
                ).toContain(row.rule);

                const twin = await renderAsset({
                    file: path.join(FIXTURE_ROOT, row.twin),
                    slug: `engine-${row.id}-twin`,
                    assetClass: row.asset_class,
                    delivery: row.delivery,
                    ...(row.source ? { compareTo: path.join(FIXTURE_ROOT, row.source) } : {}),
                    ...(row.registration ? { registration: row.registration } : {}),
                });
                expect(
                    rulesOf(twin),
                    `${row.id}: the one-edit twin must NOT report ${row.rule} — findings were ` +
                        JSON.stringify(twin.asset?.findings ?? []),
                ).not.toContain(row.rule);
            }

            // The three controls bound the whole table: a rule that fires here is
            // the false red Risk 1 is about (R12), not a finding.
            for (const control of fixture.controls) {
                if (!control.file.endsWith('.svg')) continue;
                const reading = await renderAsset({
                    file: path.join(FIXTURE_ROOT, control.file),
                    slug: `control-${control.id}`,
                    ...(control.source ? { compareTo: path.join(FIXTURE_ROOT, control.source) } : {}),
                    ...(control.registration ? { registration: control.registration } : {}),
                });
                for (const rule of control.must_not_report) {
                    expect(rulesOf(reading), `${control.id} must never report ${rule}`).not.toContain(rule);
                }
            }

            // The readings the roadmap names which are not findings: the delivered
            // file's digest, the two backgrounds with their source, the per-class
            // threshold with ITS source, and the sizes.
            const icon = manifestOf('engine-icon-off-grid-planted').asset;
            expect(icon?.digest).toMatch(/^[0-9a-f]{64}$/);
            expect(icon?.digest).toBe(
                (await import('node:crypto'))
                    .createHash('sha256')
                    .update(fs.readFileSync(path.join(FIXTURE_ROOT, 'assets/icon-off-grid.svg')))
                    .digest('hex'),
            );
            expect(icon?.sizes.map((s) => s.label)).toEqual(['16', '16', '24', '24', '48', '48']);
            expect(icon?.sizes.map((s) => s.background)).toEqual([
                'light',
                'dark',
                'light',
                'dark',
                'light',
                'dark',
            ]);
            // No tokens.json under the temp project root, and the manifest SAYS so
            // rather than presenting the fallback as the project's own colours.
            expect(icon?.backgrounds.source).toBe('fallback');
            expect(icon?.backgrounds.light).toBe('#ffffff');
            expect(icon?.backgrounds.dark).toBe('#111111');
            expect(icon?.fill_ratio_threshold_source).toBe('manifest');
            expect(icon?.fill_ratio_threshold).toBe(fixture.fill_ratio_thresholds['icon']);
            expect(icon?.asset_class_inferred).toBe(false);

            // An element outside the viewBox is reported by index and id (2.1).
            const overflow = manifestOf('engine-text-overflows-box-planted').asset;
            expect(overflow?.outside_view_box.length).toBeGreaterThan(0);
            expect(overflow?.outside_view_box[0]).toMatchObject({ tag: 'text' });
            expect(typeof overflow?.outside_view_box[0]?.index).toBe('number');

            // The resolved family, not the declared one (R1).
            const serif = manifestOf('engine-default-serif-fallback-planted').asset;
            expect(serif?.texts[0]?.resolved_family).toMatch(/times/i);
            expect(serif?.texts[0]?.first_family_resolved).toBe(false);
            const serifTwin = manifestOf('engine-default-serif-fallback-twin').asset;
            expect(serifTwin?.texts[0]?.first_family_resolved).toBe(true);

            // Draw-on dead time is a NUMBER from getTotalLength against the dash
            // (R8), and the intentional spinner is not in the set at all (R9/R12).
            const dash = manifestOf('engine-guessed-dash-planted').asset;
            expect(dash?.draw_on[0]?.total_length).toBeCloseTo(215, 0);
            expect(dash?.draw_on[0]?.dead_fraction).toBeGreaterThan(0.2);
            expect(manifestOf('engine-guessed-dash-twin').asset?.draw_on[0]?.dead_fraction).toBeLessThan(0.05);
            expect(manifestOf('control-spinner-intentional-dash').asset?.draw_on).toEqual([]);

            // An image document is unreachable by media emulation (R5), so the
            // reading says so instead of claiming a pass.
            const img = manifestOf('engine-img-delivery-no-picture-route-planted').asset;
            expect(img?.reduced_motion.witnessable).toBe(false);
            expect(img?.reduced_motion.frames_equal).toBeNull();
            expect(img?.reduced_motion.reason).toMatch(/image document/i);
            expect(img?.reduced_motion.host_picture_route).toBe(false);
            expect(
                manifestOf('engine-img-delivery-no-picture-route-twin').asset?.reduced_motion.host_picture_route,
            ).toBe(true);
        },
        600_000,
    );

    it(
        'page-manifest-unchanged-except-generated-at',
        async () => {
            const page = path.join(tmpRoot, 'page.html');
            fs.writeFileSync(
                page,
                '<!doctype html><html><head><meta charset="utf-8"><title>p</title></head>' +
                    '<body style="font-family:system-ui;color:#0f172a"><h1>Heading</h1><p>Body</p></body></html>',
            );

            const first = await runUiRender({ target: page, projectRoot: tmpRoot, slug: 'page-a' });
            const second = await runUiRender({ target: page, projectRoot: tmpRoot, slug: 'page-b' });
            expect(first).toBe(0);
            expect(second).toBe(0);

            const a = manifestOf('page-a') as unknown as Record<string, unknown>;
            const b = manifestOf('page-b') as unknown as Record<string, unknown>;

            // The page profile's key set is exactly what it was before the asset
            // profile existed. A new key here — `profile`, `asset`, anything —
            // is the second manifest schema E8 forbids.
            expect(Object.keys(a).sort()).toEqual(
                ['captures', 'generated_at', 'palette', 'schema', 'slug', 'target', 'type_families', 'verification'].sort(),
            );
            expect(a['profile']).toBeUndefined();
            expect(a['asset']).toBeUndefined();
            expect(a['schema']).toBe(1);

            // `generated_at` is written per run (uiRender.ts :172, :250, :270 —
            // the roadmap cites :144/:212/:232, which is the same three writes
            // before this change moved them down),
            // so the comparison drops that one key and nothing else. The slug is
            // the output directory, not a reading, so it is normalised too.
            delete a['generated_at'];
            delete b['generated_at'];
            const normalise = (m: Record<string, unknown>): string =>
                JSON.stringify(m).split('page-a').join('<slug>').split('page-b').join('<slug>');
            expect(normalise(b)).toBe(normalise(a));
        },
        180_000,
    );

    it(
        'absent-path-reads-unverified',
        async () => {
            vi.resetModules();
            vi.doMock('@playwright/test', () => {
                throw new Error("Cannot find package '@playwright/test'");
            });
            try {
                const mod = await import('../../src/cli/commands/uiRender.js');
                const code = await mod.runUiRender({
                    target: path.join(FIXTURE_ROOT, 'assets/loose-viewbox.svg'),
                    projectRoot: tmpRoot,
                    slug: 'absent-asset',
                    profile: 'asset',
                    assetClass: 'icon',
                    delivery: 'inline',
                    thresholds: FIXTURE_MANIFEST,
                });
                // asset-profile-exits-nonzero-on-unverified. Changed by step
                // 2.1(a) of `road-to-svg-review-followups`, review claim C2:
                // the asset profile used to exit 0 here, so a turn whose only
                // check was `ui:render --profile asset` looked like a check
                // that passed while nothing had rendered. The code is distinct
                // from 1, which this command uses for an internal error.
                expect(code).toBe(mod.EXIT_RENDERER_ABSENT);
                expect(code).not.toBe(0);

                const manifest = manifestOf('absent-asset');
                expect(manifest.verification).toBe('unverified');
                expect(manifest.profile).toBe('asset');
                expect(manifest.captures).toEqual([]);
                expect(manifest.asset).toBeUndefined();
                expect(manifest.degradation_reason).toMatch(/@playwright\/test is not installed/);
                // Never a pass, and never a silent one: the honest state is on the
                // record, which is what the owner (3.1) reads as `static-only`.
                expect(manifest.verification).not.toBe('verified');
                // renderer-absent-manifest-carries-static-digest. The token the
                // gate reads, beside the prose a human reads, and the static
                // witness bound to the SAME bytes — so the static-only
                // discharge is one file read rather than a search for a
                // separately-stored lint run (precision (i)).
                expect(manifest.reason).toBe('renderer-absent');
                expect(manifest.goal).toBe('unassessed');
                expect(manifest.static).toBeDefined();
                expect(manifest.static?.digest).toBe(
                    (await import('node:crypto'))
                        .createHash('sha256')
                        .update(fs.readFileSync(path.join(FIXTURE_ROOT, 'assets/loose-viewbox.svg'), 'utf8'))
                        .digest('hex'),
                );
                expect(typeof manifest.static?.errors).toBe('number');

                // The page profile degrades identically — one absence path, not two.
                const pageCode = await mod.runUiRender({
                    target: path.join(FIXTURE_ROOT, 'hosts/img-delivery.html'),
                    projectRoot: tmpRoot,
                    slug: 'absent-page',
                });
                // The PAGE profile keeps exit 0 — an absent devDependency is a
                // capability fact there, and nothing gates on a page render.
                expect(pageCode).toBe(0);
                const pageManifest = manifestOf('absent-page');
                expect(pageManifest.verification).toBe('unverified');
                expect(pageManifest.profile).toBeUndefined();
                expect(pageManifest.reason).toBeUndefined();
                expect(pageManifest.static).toBeUndefined();
            } finally {
                vi.doUnmock('@playwright/test');
                vi.resetModules();
            }
        },
        120_000,
    );

    it(
        'geometry-within-tolerance-and-font-delta-degrades',
        async () => {
            const fixture = JSON.parse(fs.readFileSync(FIXTURE_MANIFEST, 'utf8')) as FixtureManifest;

            // (a) Two renders of the same frame where nothing geometric moved —
            // the before/after of an edit that only touched a comment.
            const source = path.join(FIXTURE_ROOT, 'assets/text-overflows-box.clean.svg');
            const edited = path.join(tmpRoot, 'text-box-edited.svg');
            fs.writeFileSync(
                edited,
                fs.readFileSync(source, 'utf8').replace('<!-- clean twin', '<!-- an edit that moved no geometry; clean twin'),
            );
            const same = await renderAsset({
                file: source,
                slug: 'compare-same',
                assetClass: 'illustration',
                delivery: 'inline',
                compareTo: edited,
            });
            const within = same.asset?.comparison;
            expect(within, 'the comparison must be recorded in the manifest').toBeDefined();
            expect(within?.verdict).toBe('pass');
            expect(within?.tolerance_source).toBe('manifest');
            expect(within?.tolerance).toEqual(fixture.geometry_tolerances['illustration']);
            expect(within?.silhouette_iou ?? 0).toBeGreaterThanOrEqual(
                fixture.geometry_tolerances['illustration']?.silhouette_iou_min ?? 1,
            );
            expect(within?.max_boundary_distance_units ?? 99).toBeLessThanOrEqual(
                fixture.geometry_tolerances['illustration']?.max_boundary_distance_units ?? 0,
            );
            // The sub-pixel offset is part of the reading, not a hidden fudge (S12).
            expect(within?.sub_pixel_offset).toMatchObject({ dx_units: 0, dy_units: 0 });
            // A one-device-pixel anti-aliasing band is excluded, and the reading says how wide it was.
            expect(within?.anti_alias_band_units ?? 0).toBeGreaterThan(0);

            // (b) A delta whose only cause is a different resolved font reads
            // `degraded`, with BOTH families named — never `fail`.
            const fontDelta = await renderAsset({
                file: path.join(FIXTURE_ROOT, 'assets/default-serif-fallback.clean.svg'),
                slug: 'compare-font',
                assetClass: 'illustration',
                delivery: 'inline',
                compareTo: path.join(FIXTURE_ROOT, 'assets/default-serif-fallback.svg'),
            });
            const font = fontDelta.asset?.comparison;
            expect(font?.verdict).toBe('degraded');
            expect(font?.font_only_delta).toBe(true);
            expect(font?.texts.length).toBeGreaterThan(0);
            const names = `${font?.texts[0]?.baseline_family} | ${font?.texts[0]?.candidate_family}`;
            expect(names).toMatch(/system-ui/i);
            expect(names).toMatch(/times/i);
            expect(font?.reason).toMatch(/system-ui/i);
            expect(font?.reason).toMatch(/times/i);

            // (c) A raster source with no declared registration is `unverified` —
            // never the best of several guesses (S9, S12).
            const raster = path.join(tmpRoot, 'source.png');
            fs.writeFileSync(
                raster,
                Buffer.from(
                    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
                    'base64',
                ),
            );
            const unregistered = await renderAsset({
                file: path.join(FIXTURE_ROOT, 'assets/near-white-hole.clean.svg'),
                slug: 'compare-raster-unregistered',
                assetClass: 'mark',
                delivery: 'inline',
                compareTo: raster,
            });
            expect(unregistered.asset?.comparison?.verdict).toBe('unverified');
            expect(unregistered.asset?.comparison?.reason).toMatch(/registration/i);
        },
        300_000,
    );

    it(
        'network-is-aborted-during-the-witness',
        async () => {
            // An asset cannot fetch during its own witness. The host carries a
            // remote reference; the manifest records it as aborted, by URL.
            const asset = path.join(tmpRoot, 'reaches-out.svg');
            fs.writeFileSync(
                asset,
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" role="img"><title>Reaches out</title>' +
                    '<image href="https://example.invalid/tracker.png" x="0" y="0" width="8" height="8"/>' +
                    '<rect x="4" y="4" width="40" height="40" fill="#2563eb"/></svg>',
            );
            const reading = await renderAsset({
                file: asset,
                slug: 'network-abort',
                assetClass: 'mark',
                delivery: 'inline',
            });
            expect(reading.asset?.network.aborted).toBeGreaterThan(0);
            expect(reading.asset?.network.blocked_urls.join(' ')).toContain('https://example.invalid/tracker.png');
        },
        180_000,
    );

    it(
        'smil-is-frozen-by-pause-and-seek-not-by-the-screenshot-flag',
        async () => {
            // R6: three captures 300 ms apart read cx 21.3, 46.3, 70.9 under
            // `screenshot({ animations: 'disabled' })`, while pauseAnimations()
            // plus setCurrentTime(1) held 100 and 100. The falsifiable form of
            // that here: the same declared times produce the SAME bytes across
            // two independent runs, and t = 0 and t = end agree while t = mid
            // does not — a free-running animation satisfies neither.
            const animated = path.join(FIXTURE_ROOT, 'hosts/pulse-animated.svg');
            const first = await renderAsset({
                file: animated,
                slug: 'smil-seek-a',
                assetClass: 'animated',
                delivery: 'inline',
            });
            const second = await renderAsset({
                file: animated,
                slug: 'smil-seek-b',
                assetClass: 'animated',
                delivery: 'inline',
            });

            const a = first.asset?.frames ?? [];
            const b = second.asset?.frames ?? [];
            expect(a.map((f) => f.label)).toEqual(['start', 'mid', 'end']);
            expect(a.map((f) => f.t)).toEqual([0, 0.5, 1]);
            expect(a.map((f) => f.digest)).toEqual(b.map((f) => f.digest));
            expect(a[0]?.digest).not.toBe(a[1]?.digest);
            expect(a[0]?.digest).toBe(a[2]?.digest);
            expect(first.asset?.distinct_frames).toBe(2);
        },
        300_000,
    );
});

/**
 * The three carried R2 findings of `road-to-svg-rules-in-the-dispatch-path`
 * that live on this surface. None of them needs a browser: each is a pure
 * reading that was wrong before a pixel was ever captured, which is also why
 * each one survived the engine suite being green.
 */
describe('carried R2 findings — the icon grid and the registration', () => {
    const svg = (body: string, vb = '0 0 24 24'): string =>
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img"><title>t</title>${body}</svg>`;

    const write = (dir: string, name: string, content: string): string => {
        const p = path.join(dir, name);
        fs.writeFileSync(p, content);
        return p;
    };

    it('primitive-drawn-reference-is-read', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icon-refs-'));

        // (a) A reference drawn ENTIRELY with primitives. The old reader
        //     scraped `d` only, found no finite extent, and dropped the file —
        //     after which the reading said no reference set had been supplied.
        const prims = write(
            dir,
            'prims.svg',
            svg('<rect x="2" y="2" width="20" height="20" fill="#000"/><circle cx="12" cy="12" r="6"/>'),
        );
        const readPrims = readIconReferencesDetailed([prims]);
        expect(readPrims.skipped).toEqual([]);
        expect(readPrims.refs).toHaveLength(1);
        // minX/minY = 2, maxX/maxY = 22 against a 0..24 box → 2 on every side.
        expect(readPrims.refs[0]?.padding).toBeCloseTo(2, 6);

        // (b) Relative path commands are WALKED, not read as absolute. The old
        //     regex read this as the points (3,3) and (18,0), giving an extent
        //     anchored near the origin and a padding of 0.
        const rel = write(dir, 'rel.svg', svg('<path d="m 3 3 l 18 0 l 0 18 l -18 0 z"/>'));
        const readRel = readIconReferencesDetailed([rel]);
        expect(readRel.skipped).toEqual([]);
        expect(readRel.refs[0]?.padding).toBeCloseTo(3, 6);
        // The same shape written absolutely must read the same padding — which
        // is the whole claim, and is false under the old reader.
        const abs = write(dir, 'abs.svg', svg('<path d="M 3 3 L 21 3 L 21 21 L 3 21 Z"/>'));
        expect(readIconReferencesDetailed([abs]).refs[0]?.padding).toBeCloseTo(
            readRel.refs[0]?.padding as number,
            6,
        );

        // (c) A file that genuinely cannot be read is REPORTED, never dropped
        //     silently, and the grading says so in its reason.
        const opaque = write(dir, 'opaque.svg', svg('<g transform="rotate(9)"><rect x="2" y="2" width="4" height="4"/></g>'));
        const readOpaque = readIconReferencesDetailed([opaque]);
        expect(readOpaque.refs).toEqual([]);
        expect(readOpaque.skipped).toHaveLength(1);

        const graded = gradeIconGrid(
            path.join(dir, 'candidate.svg'),
            { x: 0, y: 0, w: 24, h: 24 },
            parseElements(svg('<rect x="4" y="4" width="16" height="16"/>')),
            [opaque],
            null,
        );
        expect(graded.status).toBe('unverified');
        // The old reason claimed no set was supplied. One was.
        expect(graded.reason).not.toContain('no icon reference set was supplied');
        expect(graded.reason).toContain('opaque.svg');

        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('padding-is-measured-the-same-way-on-both-sides', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icon-pad-'));
        // One stroked shape, used as BOTH the reference and the candidate. A
        // file compared against itself must report its own padding, whatever
        // the stroke width is. Under the old code the candidate came from a
        // rendered box (half the stroke wider on each side) and the reference
        // from centreline coordinates, so this read one half-stroke short and
        // `structure/off-grid` could fire on a clean twin (Risk 7).
        const body = '<path d="M 4 4 L 20 4 L 20 20 L 4 20 Z" fill="none" stroke="#000" stroke-width="3"/>';
        const ref = write(dir, 'ref.svg', svg(body));
        const vb = { x: 0, y: 0, w: 24, h: 24 };
        const refRead = readIconReferencesDetailed([ref]);
        expect(refRead.refs[0]?.padding).toBeCloseTo(4, 6);

        const graded = gradeIconGrid(
            path.join(dir, 'candidate.svg'),
            vb,
            parseElements(svg(body)),
            [ref],
            // A rendered painted box that is deliberately WIDER than the
            // centreline — the old code read the candidate from exactly this.
            { x: 2.5, y: 2.5, w: 19, h: 19 },
        );
        expect(graded.status).toBe('read');
        expect(graded.padding).toBeCloseTo(refRead.refs[0]?.padding as number, 6);
        // And specifically NOT the painted-box number, which is what it used
        // to be: min(2.5, 2.5, 24-21.5, 24-21.5) = 2.5.
        expect(graded.padding).not.toBeCloseTo(2.5, 2);

        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('a-declared-scale-changes-the-reading', () => {
        // `Registration.scale` was parsed, validated, recorded in the manifest
        // and read by nothing, so `@2` was a silent no-op.
        const at1 = parseRegistration('10,20,100,200');
        const at2 = parseRegistration('10,20,100,200@2');
        expect(at1?.scale).toBe(1);
        expect(at2?.scale).toBe(2);

        expect(cropRect(at1)).toEqual({ x: 10, y: 20, width: 100, height: 200 });
        // The reading changes — this is the assertion the finding is about.
        expect(cropRect(at2)).toEqual({ x: 20, y: 40, width: 200, height: 400 });
        expect(cropRect(at2)).not.toEqual(cropRect(at1));

        // A half-scale capture reads smaller, so the direction is not an
        // accident of one factor.
        expect(cropRect(parseRegistration('10,20,100,200@0.5'))).toEqual({
            x: 5,
            y: 10,
            width: 50,
            height: 100,
        });

        // No registration stays no crop, and a zero scale is refused rather
        // than silently drawing an empty rect.
        expect(cropRect(null)).toBeNull();
        expect(parseRegistration('10,20,100,200@0')).toBeNull();
        expect(parseRegistration('10,20,100,200@-1')).toBeNull();
    });
});

/**
 * Steps 2.1 and 2.3 of `road-to-svg-review-followups`, as their own named
 * cases because the roadmap's `verify:` clauses select them by name.
 *
 * The renderer-absent path is driven through a module mock rather than by
 * uninstalling Playwright, which is the only way to reach it on a machine that
 * has the devDependency — and it is the path a consumer actually walks.
 */
describe('the asset profile reports its own absence honestly', () => {
    const withoutPlaywright = async <T>(fn: (mod: UiRenderModule) => Promise<T>): Promise<T> => {
        vi.resetModules();
        vi.doMock('@playwright/test', () => {
            throw new Error("Cannot find package '@playwright/test'");
        });
        try {
            return await fn(await import('../../src/cli/commands/uiRender.js'));
        } finally {
            vi.doUnmock('@playwright/test');
            vi.resetModules();
        }
    };

    it('asset-profile-exits-nonzero-on-unverified', async () => {
        await withoutPlaywright(async (mod) => {
            const code = await mod.runUiRender({
                target: path.join(FIXTURE_ROOT, 'assets/loose-viewbox.svg'),
                projectRoot: tmpRoot,
                slug: 'nonzero-asset',
                profile: 'asset',
                assetClass: 'icon',
                delivery: 'inline',
                thresholds: FIXTURE_MANIFEST,
            });
            // The hole review claim C2 named: a bare `ui:render --profile asset`
            // that rendered nothing used to exit 0, so a turn whose only check
            // was that call looked like a check that passed.
            expect(code).not.toBe(0);
            expect(code).toBe(mod.EXIT_RENDERER_ABSENT);
            // Distinct from the internal-error code, so a caller can tell
            // "nothing rendered" from "you called it wrong".
            expect(code).not.toBe(1);
            expect(manifestOf('nonzero-asset').verification).toBe('unverified');

            // The page profile is deliberately NOT changed by this.
            const pageCode = await mod.runUiRender({
                target: path.join(FIXTURE_ROOT, 'hosts/img-delivery.html'),
                projectRoot: tmpRoot,
                slug: 'nonzero-page',
            });
            expect(pageCode).toBe(0);
        });
    });

    it('renderer-absent-manifest-carries-static-digest', async () => {
        await withoutPlaywright(async (mod) => {
            const target = path.join(FIXTURE_ROOT, 'assets/loose-viewbox.svg');
            await mod.runUiRender({
                target,
                projectRoot: tmpRoot,
                slug: 'static-digest',
                profile: 'asset',
                assetClass: 'icon',
                delivery: 'inline',
                thresholds: FIXTURE_MANIFEST,
            });
            const m = manifestOf('static-digest');
            // The token the gate reads, told apart from a render that RAN and
            // failed — which discharges nothing.
            expect(m.reason).toBe('renderer-absent');
            // One file, one digest: the static-only discharge never has to find
            // a separately-stored lint run or trust how it was named.
            const expected = (await import('node:crypto'))
                .createHash('sha256')
                .update(fs.readFileSync(target, 'utf8'))
                .digest('hex');
            expect(m.static?.digest).toBe(expected);
            expect(m.static?.errors).toBe(0);

            // And a file that IS broken reports its errors, so `errors: 0` is
            // not simply what this field always says.
            const broken = path.join(tmpRoot, 'broken.svg');
            fs.writeFileSync(broken, '<svg viewBox="0 0 24 24"><use href="#nothing"/></svg>\n');
            await mod.runUiRender({
                target: broken,
                projectRoot: tmpRoot,
                slug: 'static-digest-broken',
                profile: 'asset',
                assetClass: 'icon',
                delivery: 'inline',
            });
            expect(manifestOf('static-digest-broken').static?.errors).toBeGreaterThan(0);
        });
    });

    it(
        'renderer-never-writes-goal-accepted',
        async () => {
            // Step 2.3. `verified` says a digest-bound render happened and the
            // witness found no errors. It has never said "the graphic is
            // right", and it was read that way — so the manifest carries the
            // second axis explicitly and the renderer only ever writes
            // `unassessed` into it.
            const verified = await renderAsset({
                file: path.join(FIXTURE_ROOT, 'assets/hamburger-24-grid.svg'),
                slug: 'goal-axis',
                assetClass: 'icon',
                delivery: 'inline',
            });
            expect(verified.verification).toBe('verified');
            expect(verified.goal).toBe('unassessed');
            expect(verified.goal).not.toBe('accepted');

            // Including on the absence path, where there is even less to claim.
            await withoutPlaywright(async (mod) => {
                await mod.runUiRender({
                    target: path.join(FIXTURE_ROOT, 'assets/hamburger-24-grid.svg'),
                    projectRoot: tmpRoot,
                    slug: 'goal-axis-absent',
                    profile: 'asset',
                    assetClass: 'icon',
                    delivery: 'inline',
                });
                expect(manifestOf('goal-axis-absent').goal).toBe('unassessed');
            });
        },
        180_000,
    );
});

/**
 * Phase 1 of `road-to-svg-from-a-live-session` — the witness stops warning
 * about what is not there.
 *
 * Both rules fired on a real conversion session's files: the motion rule on
 * all six, none of which contains `<animate`, `@keyframes` or `animation`, and
 * the hole rule six times on paint the owner had chosen and zero times on the
 * file the same owner rejected. A warning that appears on every file is a
 * warning an operator learns to scroll past, which is Risk 1 of the parent
 * roadmap arriving through a different door.
 */
describe('the witness stops warning about what is not there', () => {
    it(
        'static-file-through-img-has-no-motion-finding',
        async () => {
            // The control: a NON-animated SVG delivered through <img> with no
            // <picture> route. There is nothing for a route to stop.
            const clean = await renderAsset({
                file: path.join(FIXTURE_ROOT, 'hosts/img-delivery-static.html'),
                slug: 'img-static-control',
                assetClass: 'animated',
                delivery: 'img',
            });
            expect(rulesOf(clean)).not.toContain('motion/img-delivery-no-static-route');
            expect(clean.asset?.reduced_motion.host_picture_route).toBe(false);
            // The reading that decides it, recorded rather than inferred.
            expect(clean.asset?.reduced_motion.delivered_animates).toBe(false);

            // And the planted row still reports, so the gate silenced a false
            // positive rather than the rule.
            const planted = await renderAsset({
                file: path.join(FIXTURE_ROOT, 'hosts/img-delivery.html'),
                slug: 'img-animated-planted',
                assetClass: 'animated',
                delivery: 'img',
            });
            expect(rulesOf(planted)).toContain('motion/img-delivery-no-static-route');
            expect(planted.asset?.reduced_motion.delivered_animates).toBe(true);
        },
        240_000,
    );

    it(
        'near-white-hole-is-decided-by-the-source',
        async () => {
            // Same shape in both files. The SOURCE is the only difference, and
            // it is the thing the rule's own message was always conditional on.
            const hole = await renderAsset({
                file: path.join(FIXTURE_ROOT, 'assets/near-white-hole.svg'),
                slug: 'hole-with-source',
                assetClass: 'mark',
                delivery: 'inline',
                compareTo: path.join(FIXTURE_ROOT, 'assets/near-white-hole.source.svg'),
                registration: '0,0,100,100',
            });
            expect(rulesOf(hole)).toContain('geometry/near-white-hole');
            expect(hole.asset?.near_white_regions[0]?.source_verdict).toBe('hole');

            const paint = await renderAsset({
                file: path.join(FIXTURE_ROOT, 'assets/near-white-paint.svg'),
                slug: 'paint-with-source',
                assetClass: 'mark',
                delivery: 'inline',
                compareTo: path.join(FIXTURE_ROOT, 'assets/near-white-paint.source.svg'),
                registration: '0,0,100,100',
            });
            expect(rulesOf(paint)).not.toContain('geometry/near-white-hole');
            expect(paint.asset?.near_white_regions[0]?.source_verdict).toBe('paint');

            // Without a source the region is RECORDED and nothing is pushed —
            // absent evidence reported as absent, never as a finding and never
            // as clean. This is the case the six real files were in.
            const noSource = await renderAsset({
                file: path.join(FIXTURE_ROOT, 'assets/near-white-hole.svg'),
                slug: 'hole-without-source',
                assetClass: 'mark',
                delivery: 'inline',
            });
            expect(rulesOf(noSource)).not.toContain('geometry/near-white-hole');
            expect(noSource.asset?.near_white_regions).toHaveLength(1);
            expect(noSource.asset?.near_white_regions[0]?.source_verdict).toBe('no-source');
            // The region carries where it was measured, so a reader can repeat
            // the reading with a source of their own.
            expect(noSource.asset?.near_white_regions[0]?.centre).toEqual({ x: 50, y: 50 });
        },
        240_000,
    );
});

/**
 * Phase 2 of `road-to-svg-from-a-live-session` — the raster comparison passes
 * what was accepted.
 *
 * The witness failed the trace its owner accepted at 10:29Z, and ranked that
 * rejected trace above the accepted construction on every number. Two causes,
 * both measured: the background mask from the corner pixel folded neighbours
 * and halo into IoU, and the per-region breakdown was unreachable so the worst
 * region was always `whole`.
 */
describe('the raster comparison reads the subject, not the frame', () => {
    const CONV = path.join(FIXTURE_ROOT, 'conversion');

    it(
        'registered-raster-of-the-reference-passes',
        async () => {
            // The reference compared against a rendering of ITSELF, with an
            // unrelated mark and a soft glow inside the registration frame.
            const m = await renderAsset({
                file: path.join(CONV, 'subject-reference.svg'),
                slug: 'conv-busy-frame',
                assetClass: 'mark',
                delivery: 'inline',
                compareTo: path.join(CONV, 'source-busy-frame.png'),
                registration: '0,0,100,100@4',
            });
            const c = m.asset?.comparison;
            expect(c?.verdict, `reason: ${c?.reason ?? '(none)'}`).toBe('pass');
            // The foreign content is REPORTED rather than folded in — a
            // reading, with its own finding, and not a silent exclusion.
            expect(c?.raster?.foreign_content_share).toBeGreaterThan(0);
            expect(rulesOf(m)).toContain('geometry/foreign-content-in-frame');
            // And the subject itself is not cut.
            expect(c?.raster?.frame_edge_contact).toEqual([]);
            expect(rulesOf(m)).not.toContain('geometry/source-cut-by-frame');
        },
        240_000,
    );

    it(
        'source-cut-by-frame-is-found',
        async () => {
            // The crown-cut case: the subject runs off the top of the crop. A
            // trace of this crop agrees with it exactly, so IoU cannot see the
            // cut and the frame contact is the only signal there is.
            const m = await renderAsset({
                file: path.join(CONV, 'subject-reference.svg'),
                slug: 'conv-cut-frame',
                assetClass: 'mark',
                delivery: 'inline',
                compareTo: path.join(CONV, 'source-cut-by-frame.png'),
                registration: '0,0,100,100@4',
            });
            expect(rulesOf(m)).toContain('geometry/source-cut-by-frame');
            expect(m.asset?.comparison?.raster?.frame_edge_contact).toContain('top');
        },
        240_000,
    );

    it(
        'top-level-groups-become-regions',
        async () => {
            // `CompareSpec.regions` existed and nothing could pass it, so
            // `worst_region` was always `whole`. The file names its own parts.
            const m = await renderAsset({
                file: path.join(CONV, 'subject-reference.svg'),
                slug: 'conv-regions',
                assetClass: 'mark',
                delivery: 'inline',
                compareTo: path.join(CONV, 'source-busy-frame.png'),
                registration: '0,0,100,100@4',
            });
            const regions = m.asset?.comparison?.raster?.regions ?? [];
            const ids = regions.map((r) => r.region);
            // `whole` stays first — the reading every consumer already reads.
            expect(ids[0]).toBe('whole');
            expect(ids).toContain('badge');
            expect(ids).toContain('tick');
            // Each region carries its own numbers, so the worst is nameable.
            for (const r of regions) {
                expect(r.silhouette_iou).toBeGreaterThanOrEqual(0);
                expect(r.mean_colour_error).toBeGreaterThanOrEqual(0);
            }
            expect(['whole', 'badge', 'tick']).toContain(m.asset?.comparison?.raster?.worst_region);
        },
        240_000,
    );
});
