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
 * Playwright is a devDependency (`package.json:97`) and is therefore NOT
 * guaranteed present in a consumer install. The import is dynamic and the
 * absence path is a clean, explained exit rather than a stack trace — and it
 * reports `verification: unverified` instead of writing an empty manifest that
 * would read as a successful capture of nothing.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// Type-only: erased at build time, so it does NOT pull Playwright into the
// runtime graph. The value import stays dynamic below, which is what keeps a
// consumer install without the devDependency on the clean "unverified" path.
import type { chromium as Chromium } from '@playwright/test';

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
}

export const RENDER_REL = path.join('agents', 'runtime', 'state', 'render');

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

    let chromium: typeof Chromium;
    try {
        ({ chromium } = await import('@playwright/test'));
    } catch {
        const manifest: RenderManifest = {
            schema: 1,
            generated_at: new Date().toISOString(),
            target: opts.target,
            slug,
            captures: [],
            palette: [],
            type_families: [],
            verification: 'unverified',
            degradation_reason:
                '@playwright/test is not installed — it is a devDependency, so a consumer install has no browser. ' +
                'Install it, or scope any verdict to the static checks that actually ran.',
        };
        writeManifest(outDir, manifest);
        process.stderr.write(`[ui:render] ${manifest.degradation_reason}\n`);
        if (opts.json) process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
        // Exit 0, deliberately: an absent devDependency is a capability fact,
        // not a failure of this command. The manifest carries the honest state.
        return 0;
    }

    fs.mkdirSync(outDir, { recursive: true });
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

function writeManifest(outDir: string, manifest: RenderManifest): void {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}
