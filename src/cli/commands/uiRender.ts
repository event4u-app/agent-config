/**
 * `agent-config ui:render <path|url>` — headless capture, then exit.
 *
 * Step E3.1 of `road-to-frontend-power`. Captures DOM, computed styles and a
 * screenshot at three viewports — desktop, 375 px and 320 px — into
 * `agents/runtime/state/render/<slug>/`, then terminates.
 *
 * CLASS A, and the boundary is the whole design constraint. `docs/contracts/
 * no-runtime-boundary.md` plus ADR-124 put a *resident* browser, a dev-server
 * bridge and a watcher in Class B, which is prohibited in core. A headless
 * render per command is Class A because it terminates and its state is a
 * rebuildable directory. So:
 *
 *   - the browser is closed in a `finally`, on every path including a throw;
 *   - nothing is cached between invocations;
 *   - no listener, no watch mode, no `--serve` flag exists to add one.
 *
 * Live-browser iteration stays out of scope (recorded as a null in R3.1). The
 * in-scope substitute is a turn-scoped variant capture built on this command.
 *
 * WHY 320 px is captured: the fidelity roadmap's AC-6 asserts a 320 px floor
 * and had no primitive to measure it with, which is why its
 * `b-page-capture-primitive` closed as a recorded null. This supplies the
 * primitive, so that null's own reopening condition fires.
 *
 * Playwright is a devDependency (`package.json:111`) and is therefore NOT
 * guaranteed present in a consumer install. The import is dynamic and the
 * absence path is a clean, explained exit rather than a stack trace — and it
 * reports `verification: unverified` instead of writing an empty manifest that
 * would read as a successful capture of nothing.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Type-only: erased at build time, so it does NOT pull Playwright into the
// runtime graph. The value import stays dynamic below, which is what keeps a
// consumer install without the devDependency on the clean "unverified" path.
import type { chromium as Chromium } from '@playwright/test';

import { runAssetRender } from './uiRenderAsset.js';
import type { AssetClass, AssetReading, Registration } from './uiRenderAsset.js';
import { scanHostHtml, scanSvg } from '../../scripts/lint_svg_asset.js';
import type { DeliveryMode } from '../../scripts/lint_svg_asset.js';

/** The three viewports E3.1 names. Widths are the contract, not a preference. */
export const VIEWPORTS = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile-375', width: 375, height: 812 },
    { name: 'mobile-320', width: 320, height: 640 },
] as const;

/** Computed properties captured per element — the A1.5 delta inputs, plus the overflow signals. */
export const CAPTURED_PROPERTIES = [
    'color',
    'background-color',
    'border-color',
    'font-family',
    'font-size',
    'line-height',
    'overflow-x',
    'overflow-y',
] as const;

export interface ViewportCapture {
    viewport: string;
    width: number;
    height: number;
    screenshot: string;
    dom: string;
    styles: string;
    document_scroll_width: number;
    horizontal_overflow: boolean;
}

export interface RenderManifest {
    schema: 1;
    generated_at: string;
    target: string;
    slug: string;
    captures: ViewportCapture[];
    palette: string[];
    type_families: string[];
    verification: 'verified' | 'degraded' | 'unverified';
    degradation_reason?: string;
    /**
     * Step 2.2, and the whole of its contract: the two asset keys below are
     * OPTIONAL and written only by `--profile asset`. `schema` stays `1` and no
     * second manifest schema exists — a reader of today's page manifest sees
     * exactly what it saw before this profile existed, because an absent
     * optional key is not serialised at all.
     */
    profile?: 'asset';
    asset?: AssetReading;
    /**
     * WHY the verification is not `verified`, as a token rather than as prose,
     * and only when the COMMAND can say why.
     *
     * Step 2.1 of `road-to-svg-review-followups` (D8). `degradation_reason` is
     * a sentence for a human; the turn-end gate has to tell an ABSENT renderer
     * from one that ran and failed, because the first is a capability fact a
     * consumer cannot fix and the second is a real failure. The status
     * vocabulary above is unchanged — a fourth status would have been a
     * grammar change where a reason field was what was missing.
     *
     * TWO tokens. Finding 12 of the third review removed a third and finding 5
     * of the fourth found that this block still said "Three tokens" and that
     * the removal had left a SECOND doc comment stacked under it — two blocks
     * describing one field, the older one wrong. Merged into this one.
     *
     * `pass-cap-reached` used to be in this union and nothing ever wrote it.
     * Finding 12 of the third completion review, and it is the right call in
     * the other direction: the pass cap is a count of the AGENT's render
     * passes, which one invocation of this command cannot see. It belongs in
     * the agent's own report, where the skill asks for it, and a manifest
     * field that can only ever be unset is a field a reader will one day
     * believe.
     */
    reason?: 'renderer-absent' | 'render-failed';
    /**
     * Whether the GRAPHIC is right, which no renderer and no skill may answer.
     *
     * Step 2.3. `verified` says a digest-bound render happened and the witness
     * found no errors; it has never said "the user's goal is met", and it was
     * read that way. `unassessed` is the only value any automated layer writes;
     * `accepted` / `rejected` come from an owner statement or a pre-registered
     * scenario witness.
     */
    goal?: 'unassessed' | 'accepted' | 'rejected';
    /**
     * The static witness, run by the ASSET profile itself on the renderer-absent
     * path, bound to the same digest.
     *
     * Precision (i) of step 2.1: without this the gate's static-only discharge
     * would have to find a separately-stored `lint_svg_asset` run and trust how
     * it was named. One file, one digest, one read.
     */
    static?: { errors: number; digest: string };
}

export const RENDER_REL = path.join('agents', 'runtime', 'state', 'render');

/**
 * `--profile asset` with no renderer. Distinct from 1, which this command
 * already uses for an internal error (a missing path, a URL handed to the
 * asset profile), because a caller has to tell "nothing rendered" from
 * "you called it wrong" — the first is a consumer's ordinary state.
 */
export const EXIT_RENDERER_ABSENT = 3;

/**
 * The families whose ERROR means the file is broken, as opposed to improvable.
 *
 * Finding 4 of the third completion review, reproduced by running `scanSvg`:
 * an ordinary stroke icon with no `<title>` yields exactly one error —
 * `svg-a11y-no-accessible-name` — so `errors` was never 0, the static-only
 * discharge never fired, and a consumer with no Playwright was refused by a
 * BLOCKING turn-end gate on every `.svg` they wrote, with no way out. That is
 * the opposite of the path's stated purpose, which the obligation module's own
 * header spells out: it exists so a Playwright-less install is not refused
 * forever.
 *
 * `structure` is "this file does not parse or does not resolve" and `safety`
 * is "this file does something it should not". Both are brokenness, and both
 * SHOULD stop a discharge taken without a render. Accessibility, motion and
 * geometry are readings about a file that works — they are reported by the
 * design pass in their own right, and a missing title is not a reason to
 * refuse a turn on a machine that could not render.
 */
const BLOCKING_FAMILIES = ['svg-structure-', 'svg-safety-'];

/**
 * The static witness, bound to the bytes it read.
 *
 * `errors` counts `severity: 'error'` findings in the blocking families only —
 * see `BLOCKING_FAMILIES` for which, and for the refusal that made the
 * distinction necessary. A warning is a reading, not a refusal, and the
 * static-only discharge in the turn-end gate is about whether the file is
 * BROKEN. The digest is of the SAME bytes, so a later reader can tell whether
 * this reading describes the file in front of it.
 */
export function staticWitness(
    absFile: string,
    delivery?: DeliveryMode | undefined,
): { errors: number; digest: string } | null {
    // THE DIGEST IS OF THE BYTES, the scan is of the decoded text.
    //
    // Finding 2 of the sixth completion review: three places hash "the file"
    // and two of them hashed the UTF-8 DECODED string while the render hashed
    // the raw buffer. For any file the decode is not byte-exact over — a BOM,
    // a lone surrogate, an invalid sequence replaced by U+FFFD — the two
    // digests differ forever, so the gate never matches a render to the file
    // it rendered and the obligation can never be discharged. One definition,
    // and it is the one a digest normally means.
    let bytes: Buffer;
    try {
        bytes = fs.readFileSync(absFile);
    } catch {
        return null;
    }
    const content = bytes.toString('utf8');
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    // The DELIVERY MODE is threaded through. Finding 6 of this change's second
    // completion review: `scanSvg` grades an undeclared mode as `inline`, the
    // strictest, because that is the safe default for a file whose embedding
    // nobody stated. Here the embedding WAS stated — `--delivery img` is on the
    // same command line — so defaulting raised the safety family to `error` for
    // an asset that cannot execute anything, and a correct `img`-delivered file
    // was refused the static-only discharge it qualifies for.
    // AN HTML HOST IS SCANNED AS A HOST, NOT AS A GRAPHIC.
    //
    // Finding 1 of the fourth completion review, reproduced on this repo's own
    // `hosts/img-delivery-static.html` fixture: `scanSvg` over a host document
    // reports `svg-structure-not-well-formed` for every HTML void element —
    // `<meta>` and `<img>` never close, which is correct HTML and malformed
    // XML — so the witness read 2 errors where `scanHostHtml` over the same
    // bytes reports none. Under the blocking-family count those are structure
    // errors, so a correct host document could not discharge its obligation.
    const scan = /\.html?$/i.test(absFile) ? scanHostHtml : scanSvg;
    const errors = scan(content, path.basename(absFile), { delivery }).filter(
        (f) => f.severity === 'error' && BLOCKING_FAMILIES.some((fam) => f.rule.startsWith(fam)),
    ).length;
    return { errors, digest };
}

export function slugify(target: string): string {
    return (
        target
            .replace(/^https?:\/\//, '')
            .replace(/[^a-z0-9]+/gi, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase()
            .slice(0, 60) || 'render'
    );
}

/** Colour-ish computed values, normalised. Used to build the palette snapshot. */
export function collectPalette(styleRecords: ReadonlyArray<Record<string, string>>): string[] {
    const out = new Set<string>();
    for (const rec of styleRecords) {
        for (const key of ['color', 'background-color', 'border-color']) {
            const v = (rec[key] ?? '').trim().toLowerCase();
            if (!v || v === 'rgba(0, 0, 0, 0)' || v === 'transparent') continue;
            out.add(v);
        }
    }
    return [...out].sort();
}

/** First-choice families only — the A1.5 threshold is about the family that wins. */
export function collectTypeFamilies(styleRecords: ReadonlyArray<Record<string, string>>): string[] {
    const out = new Set<string>();
    for (const rec of styleRecords) {
        const fam = (rec['font-family'] ?? '').split(',')[0]?.trim().replace(/^["']|["']$/g, '').toLowerCase();
        if (fam) out.add(fam);
    }
    return [...out].sort();
}

export interface UiRenderOptions {
    target: string;
    json?: boolean | undefined;
    projectRoot?: string | undefined;
    slug?: string | undefined;
    /** `page` (the default, unchanged) or `asset` (step 2.1). */
    profile?: 'page' | 'asset' | undefined;
    assetClass?: AssetClass | undefined;
    delivery?: DeliveryMode | undefined;
    /** A JSON file carrying `fill_ratio_thresholds` / `geometry_tolerances`. */
    thresholds?: string | undefined;
    /** The incumbent icon set, read for its own grid — never declared (E6). */
    iconSet?: readonly string[] | undefined;
    /** Step 2.6: the other render of the same frame. */
    compareTo?: string | undefined;
    registration?: Registration | undefined;
}

export async function runUiRender(opts: UiRenderOptions): Promise<number> {
    const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
    const isUrl = /^https?:\/\//i.test(opts.target);
    const abs = isUrl ? opts.target : path.resolve(projectRoot, opts.target);
    if (!isUrl && !fs.existsSync(abs)) {
        process.stderr.write(`[ui:render] path not found: ${abs}\n`);
        return 1;
    }

    const slug = opts.slug ?? slugify(opts.target);
    const outDir = path.join(projectRoot, RENDER_REL, slug);
    const isAsset = opts.profile === 'asset';

    let chromium: typeof Chromium;
    try {
        ({ chromium } = await import('@playwright/test'));
    } catch {
        // Step 2.3, and the reason the absence path sits ABOVE the profile
        // branch rather than inside either one: both profiles reach it by
        // construction, so there is no second absence path to keep honest.
        // Step 2.1(i): on the ASSET profile the renderer-absent path runs the
        // static witness itself and binds it to the same digest, so the gate's
        // static-only discharge reads ONE file and never depends on how a
        // separate lint run was named or stored.
        const staticReading = isAsset && !isUrl ? staticWitness(abs, opts.delivery) : null;
        const manifest: RenderManifest = {
            schema: 1,
            generated_at: new Date().toISOString(),
            target: opts.target,
            slug,
            captures: [],
            palette: [],
            type_families: [],
            verification: 'unverified',
            ...(isAsset ? { profile: 'asset' as const, reason: 'renderer-absent' as const, goal: 'unassessed' as const } : {}),
            ...(staticReading ? { static: staticReading } : {}),
            degradation_reason:
                '@playwright/test is not installed — it is a devDependency, so a consumer install has no browser. ' +
                'Install it, or scope any verdict to the static checks that actually ran.',
        };
        writeManifest(outDir, manifest);
        process.stderr.write(`[ui:render] ${manifest.degradation_reason}\n`);
        if (opts.json) process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
        // The PAGE profile keeps exit 0: an absent devDependency is a
        // capability fact, not a failure of that command, and the manifest
        // carries the honest state.
        //
        // The ASSET profile exits NON-ZERO (step 2.1(a), review claim C2). The
        // turn-end gate's transcript path never sees an exit code, so a
        // non-zero exit alone does not close the hole — but the record path
        // reads one, and a bare `ui:render --profile asset` that rendered
        // nothing must not look like a check that passed. The code is distinct
        // from 1, which this command already uses for an internal error such as
        // a missing path or a URL handed to the asset profile.
        return isAsset ? EXIT_RENDERER_ABSENT : 0;
    }

    fs.mkdirSync(outDir, { recursive: true });

    if (isAsset) {
        if (isUrl) {
            process.stderr.write('[ui:render] --profile asset reads a file on disk, not a URL\n');
            return 1;
        }
        return runAssetProfile({ ...opts, projectRoot, abs, slug, outDir }, chromium);
    }

    const captures: ViewportCapture[] = [];
    const allStyles: Array<Record<string, string>> = [];
    let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

    try {
        browser = await chromium.launch({ headless: true });
        for (const vp of VIEWPORTS) {
            const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
            await page.goto(isUrl ? abs : `file://${abs}`, { waitUntil: 'load', timeout: 30_000 });

            const shot = path.join(outDir, `${vp.name}.png`);
            await page.screenshot({ path: shot, fullPage: true });

            const dom = await page.content();
            const domPath = path.join(outDir, `${vp.name}.dom.html`);
            fs.writeFileSync(domPath, dom);

            const styles = await page.evaluate((props: readonly string[]) => {
                const rows: Array<Record<string, string>> = [];
                for (const el of Array.from(document.querySelectorAll('*')).slice(0, 1500)) {
                    const cs = window.getComputedStyle(el);
                    const rec: Record<string, string> = { selector: el.tagName.toLowerCase() };
                    for (const p of props) rec[p] = cs.getPropertyValue(p);
                    rows.push(rec);
                }
                return rows;
            }, CAPTURED_PROPERTIES as unknown as string[]);
            allStyles.push(...styles);
            const stylePath = path.join(outDir, `${vp.name}.styles.json`);
            fs.writeFileSync(stylePath, `${JSON.stringify(styles, null, 2)}\n`);

            const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
            await page.close();

            captures.push({
                viewport: vp.name,
                width: vp.width,
                height: vp.height,
                screenshot: path.relative(projectRoot, shot).split(path.sep).join('/'),
                dom: path.relative(projectRoot, domPath).split(path.sep).join('/'),
                styles: path.relative(projectRoot, stylePath).split(path.sep).join('/'),
                document_scroll_width: scrollWidth,
                horizontal_overflow: scrollWidth > vp.width + 1,
            });
        }
    } catch (err) {
        const manifest: RenderManifest = {
            schema: 1,
            generated_at: new Date().toISOString(),
            target: opts.target,
            slug,
            captures,
            palette: collectPalette(allStyles),
            type_families: collectTypeFamilies(allStyles),
            verification: 'degraded',
            degradation_reason: `capture failed after ${captures.length} viewport(s): ${String(err)}`,
        };
        writeManifest(outDir, manifest);
        process.stderr.write(`[ui:render] ${manifest.degradation_reason}\n`);
        return 1;
    } finally {
        // The Class-A boundary. Closed on every path, throw included — this is
        // what keeps a resident browser from becoming an accident.
        await browser?.close();
    }

    const manifest: RenderManifest = {
        schema: 1,
        generated_at: new Date().toISOString(),
        target: opts.target,
        slug,
        captures,
        palette: collectPalette(allStyles),
        type_families: collectTypeFamilies(allStyles),
        verification: 'verified',
    };
    writeManifest(outDir, manifest);

    if (opts.json) process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    else {
        const overflow = manifest.captures.filter((c) => c.horizontal_overflow).map((c) => c.viewport);
        process.stdout.write(
            `✅  ui:render — ${manifest.captures.length} viewport(s), ${manifest.palette.length} colour(s), ` +
                `${manifest.type_families.length} family(ies)\n    ${path.relative(projectRoot, outDir)}\n` +
                (overflow.length ? `    ⚠️  horizontal overflow at: ${overflow.join(', ')}\n` : ''),
        );
    }
    return 0;
}

/**
 * The asset profile. Same manifest, same output directory, same Class-A
 * boundary — the browser is closed in a `finally` on every path including a
 * throw, exactly as the page profile closes its own.
 */
async function runAssetProfile(
    opts: UiRenderOptions & { projectRoot: string; abs: string; slug: string; outDir: string },
    chromium: typeof Chromium,
): Promise<number> {
    let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
    try {
        browser = await chromium.launch({ headless: true });
        const result = await runAssetRender(browser, {
            file: opts.abs,
            projectRoot: opts.projectRoot,
            outDir: opts.outDir,
            assetClass: opts.assetClass,
            delivery: opts.delivery,
            thresholdsFile: opts.thresholds,
            iconSet: opts.iconSet,
            compareTo: opts.compareTo,
            registration: opts.registration,
        });
        // Finding 8 of this change's completion review: ONE evaluation. The
        // spread below used to call this twice — once as the truthiness guard,
        // once for the value — so the verified path re-read the file, re-hashed
        // it and re-ran the whole rule suite, and the two reads could disagree
        // if the file moved between them.
        const staticReading = staticWitness(opts.abs, opts.delivery);
        const manifest: RenderManifest = {
            schema: 1,
            generated_at: new Date().toISOString(),
            target: opts.target,
            slug: opts.slug,
            captures: [],
            palette: [],
            type_families: [],
            verification: result.verification,
            profile: 'asset',
            // Step 2.3. Written on EVERY asset render, by the only layer that
            // could plausibly be mistaken for the one deciding it. A reader who
            // sees `verification: verified` and no goal field has to supply the
            // missing half themselves, which is exactly how `verified` came to
            // be read as "the graphic is right".
            goal: 'unassessed',
            asset: result.reading,
            // The static witness on the same digest, on the verified path too —
            // the gate's digest-match discharge reads the ASSET reading, but a
            // human comparing two manifests should not have to tell whether the
            // static layer ran from which path produced the file.
            ...(staticReading ? { static: staticReading } : {}),
            ...(result.degradationReason ? { degradation_reason: result.degradationReason } : {}),
            ...(result.verification === 'verified' ? {} : { reason: 'render-failed' as const }),
        };
        writeManifest(opts.outDir, manifest);
        if (opts.json) process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
        else {
            const r = result.reading;
            process.stdout.write(
                `✅  ui:render --profile asset — ${r.asset_class}` +
                    `${r.asset_class_inferred ? ' (inferred)' : ''}, ${r.sizes.length} capture(s), ` +
                    `${r.findings.length} finding(s), ${r.network.aborted} request(s) aborted\n` +
                    `    ${path.relative(opts.projectRoot, opts.outDir)}\n` +
                    r.findings.map((f) => `    ⚠️  ${f.rule} — ${f.detail}\n`).join(''),
            );
        }
        return 0;
    } catch (err) {
        const manifest: RenderManifest = {
            schema: 1,
            generated_at: new Date().toISOString(),
            target: opts.target,
            slug: opts.slug,
            captures: [],
            palette: [],
            type_families: [],
            verification: 'degraded',
            profile: 'asset',
            // A renderer that RAN and failed, which is not the same fact as a
            // renderer that is absent — the turn-end gate discharges an SVG
            // obligation on the second and never on the first.
            reason: 'render-failed',
            goal: 'unassessed',
            degradation_reason: `asset capture failed: ${String(err)}`,
        };
        writeManifest(opts.outDir, manifest);
        process.stderr.write(`[ui:render] ${manifest.degradation_reason}\n`);
        return 1;
    } finally {
        // The Class-A boundary, same clause as the page profile's.
        await browser?.close();
    }
}

function writeManifest(outDir: string, manifest: RenderManifest): void {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}
