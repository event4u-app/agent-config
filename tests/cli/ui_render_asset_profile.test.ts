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
import type { AssetClass } from '../../src/cli/commands/uiRenderAsset.js';
import type { DeliveryMode } from '../../src/scripts/lint_svg_asset.js';

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
}

interface FixtureManifest {
    rows: FixtureRow[];
    controls: Array<{ id: string; file: string; must_not_report: string[] }>;
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
                // An absent devDependency is a capability fact, not a failure.
                expect(code).toBe(0);

                const manifest = manifestOf('absent-asset');
                expect(manifest.verification).toBe('unverified');
                expect(manifest.profile).toBe('asset');
                expect(manifest.captures).toEqual([]);
                expect(manifest.asset).toBeUndefined();
                expect(manifest.degradation_reason).toMatch(/@playwright\/test is not installed/);
                // Never a pass, and never a silent one: the honest state is on the
                // record, which is what the owner (3.1) reads as `static-only`.
                expect(manifest.verification).not.toBe('verified');

                // The page profile degrades identically — one absence path, not two.
                const pageCode = await mod.runUiRender({
                    target: path.join(FIXTURE_ROOT, 'hosts/img-delivery.html'),
                    projectRoot: tmpRoot,
                    slug: 'absent-page',
                });
                expect(pageCode).toBe(0);
                const pageManifest = manifestOf('absent-page');
                expect(pageManifest.verification).toBe('unverified');
                expect(pageManifest.profile).toBeUndefined();
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
