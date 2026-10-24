/**
 * Render check for `agents/map/index.html`.
 *
 * The map draws its labels on a canvas, so a DOM overflow check passes while a
 * label is cut off or sits on top of another. This opens the page in a real
 * browser at the three widths `ui:render` uses and asks the viewer itself for
 * the boxes it placed (`window.__mapLabelBoxes`), in the overview and inside
 * the largest area. It also fails on a page error, on any request that is not
 * the file itself, and on horizontal scroll.
 *
 * Playwright is a devDependency: a consumer usually has no browser, and then
 * the result is `unverified` with the reason — never a pass.
 */
import { pathToFileURL } from 'node:url';

/**
 * The slice of Playwright this check drives, declared here rather than
 * imported: the package is a devDependency, and even a type-only import of it
 * makes this module look like it needs one at runtime.
 */
interface PwLocator {
    first(): PwLocator;
    count(): Promise<number>;
    click(): Promise<void>;
}
interface PwPage {
    on(event: 'pageerror', fn: () => void): void;
    on(event: 'request', fn: (r: { url(): string }) => void): void;
    goto(url: string): Promise<unknown>;
    waitForFunction(fn: () => boolean): Promise<unknown>;
    evaluate<T>(fn: () => T): Promise<T>;
    locator(selector: string): PwLocator;
    close(): Promise<void>;
}
interface PwBrowser {
    newPage(opts: { viewport: { width: number; height: number } }): Promise<PwPage>;
    close(): Promise<void>;
}
interface PwChromium {
    launch(): Promise<PwBrowser>;
}

export const MAP_VIEWPORTS = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile-375', width: 375, height: 812 },
    { name: 'mobile-320', width: 320, height: 640 },
] as const;

export interface MapRenderCheck {
    verification: 'verified' | 'failed' | 'unverified';
    reason?: string;
    viewports: Array<{
        name: string;
        pageErrors: number;
        externalRequests: number;
        horizontalScroll: boolean;
        views: Array<{ view: string; labels: number; outside: number; overlapping: number; orb?: OrbSpread }>;
        /** Area-list entries whose name is cut off, or whose colour dot sits on a line of its own. */
        sidebar: { entries: number; clipped: number; orphanedDot: number };
    }>;
}

/**
 * How the area bubbles of one orb view sit: overlapping near-side pairs, and how
 * far they bunch into one cap — the length of the mean of their unit vectors on
 * the sphere, 0 for an even spread and 1 for every bubble on one point.
 */
export interface OrbSpread {
    bubbles: number;
    concentration: number;
    overlapping: number;
}

/** Near-side bubbles overlapping by more than a sliver count; far-side ones are seen through the near side. */
export function orbSpread(nodes: ReadonlyArray<{ x: number; y: number; r: number; near: boolean; u?: number[] }>): OrbSpread {
    const near = nodes.filter((n) => n.near);
    let overlapping = 0;
    for (let i = 0; i < near.length; i++)
        for (let j = i + 1; j < near.length; j++) {
            const a = near[i] as (typeof near)[number];
            const b = near[j] as (typeof near)[number];
            // The viewer shrinks a crowded bubble down to a dot (ORB_DOT px): two dots touching
            // hide nothing, so only a pair where both still read as bubbles counts.
            if (a.r <= ORB_DOT || b.r <= ORB_DOT) continue;
            if (Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * ORB_OVERLAP_TOLERANCE) overlapping += 1;
        }
    const sum = [0, 0, 0];
    for (const n of nodes) for (let k = 0; k < 3; k++) sum[k] = (sum[k] as number) + (n.u?.[k] ?? 0);
    const concentration = nodes.length ? Math.hypot(...(sum as [number, number, number])) / nodes.length : 0;
    return { bubbles: nodes.length, concentration: Math.round(concentration * 100) / 100, overlapping };
}

/** The smallest radius the viewer shrinks a crowded orb bubble to (`viewer.js`). */
const ORB_DOT = 2;
/** Two bubbles overlap when their centres are closer than this share of their summed radii. */
const ORB_OVERLAP_TOLERANCE = 0.9;
/** Above this, the bubbles bunch into one cap. An even spread of 30 sits near 0.1; one hemisphere at 0.5. */
export const ORB_MAX_CONCENTRATION = 0.35;

interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Labels outside the canvas and label pairs that overlap — pure, so it is testable without a browser. */
export function labelProblems(boxes: readonly Box[], width: number, height: number): { outside: number; overlapping: number } {
    let outside = 0;
    let overlapping = 0;
    for (const b of boxes) if (b.x < 0 || b.y < 0 || b.x + b.w > width || b.y + b.h > height) outside += 1;
    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i] as Box;
            const c = boxes[j] as Box;
            if (a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h) overlapping += 1;
        }
    }
    return { outside, overlapping };
}

export async function verifyMap(htmlPath: string): Promise<MapRenderCheck> {
    let chromium: PwChromium;
    try {
        // Through a variable: a literal specifier lets every bundle that reaches
        // this module (the MCP server does, via cli.ts) try to inline a
        // devDependency it does not ship.
        const specifier = '@playwright/test';
        ({ chromium } = (await import(specifier)) as { chromium: PwChromium });
    } catch {
        return { verification: 'unverified', reason: '@playwright/test is not installed (a devDependency)', viewports: [] };
    }
    let browser: PwBrowser;
    try {
        browser = await chromium.launch();
    } catch (e) {
        return { verification: 'unverified', reason: `no browser could start: ${(e as Error).message.split('\n')[0]}`, viewports: [] };
    }
    const url = pathToFileURL(htmlPath).href;
    const out: MapRenderCheck = { verification: 'verified', viewports: [] };
    try {
        for (const vp of MAP_VIEWPORTS) {
            const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
            let pageErrors = 0;
            let externalRequests = 0;
            page.on('pageerror', () => {
                pageErrors += 1;
            });
            page.on('request', (r) => {
                if (r.url() !== url) externalRequests += 1;
            });
            await page.goto(url);
            await page.waitForFunction(() => (window as unknown as { __mapLabelBoxes?: unknown }).__mapLabelBoxes !== undefined);
            const read = async (view: string): Promise<{ view: string; labels: number; outside: number; overlapping: number; orb?: OrbSpread }> => {
                const r = (await page.evaluate(() => (window as unknown as { __mapLabelBoxes: { boxes: Box[]; width: number; height: number } }).__mapLabelBoxes)) as {
                    boxes: Box[];
                    width: number;
                    height: number;
                };
                const bubbles = await page.evaluate(
                    () => (window as unknown as { __mapOrbNodes?: Array<{ x: number; y: number; r: number; near: boolean; u?: number[] }> }).__mapOrbNodes ?? [],
                );
                return { view, labels: r.boxes.length, ...labelProblems(r.boxes, r.width, r.height), ...(bubbles.length ? { orb: orbSpread(bubbles) } : {}) };
            };
            const sidebar = await page.evaluate(() => {
                const entries = [...document.querySelectorAll('#panel .plist button')].filter((b) => b.querySelector('.swatch'));
                let clipped = 0;
                let orphanedDot = 0;
                for (const b of entries) {
                    const name = (b.querySelector('.fname') ?? b) as HTMLElement | null;
                    const dot = b.querySelector('.swatch') as HTMLElement | null;
                    if (name && name.scrollWidth > name.clientWidth + 1) clipped += 1;
                    if (name && dot && dot.getBoundingClientRect().top > name.getBoundingClientRect().bottom) orphanedDot += 1;
                }
                return { entries: entries.length, clipped, orphanedDot };
            });
            const views = [await read('overview')];
            // The orb, as it opens and turned half a revolution: the far side's labels
            // must stay hidden and the near side's must still fit and not overlap.
            const orb = page.locator('#dim');
            if ((await orb.count()) > 0) {
                await orb.click();
                views.push(await read('overview-orb'));
                await page.evaluate(() => {
                    for (let i = 0; i < 21; i++) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
                });
                views.push(await read('overview-orb-turned'));
                await orb.click();
            }
            const firstArea = page.locator('#panel .plist button').first();
            if ((await firstArea.count()) > 0) {
                await firstArea.click();
                views.push(await read('largest-area'));
            }
            const horizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
            out.viewports.push({ name: vp.name, pageErrors, externalRequests, horizontalScroll, views, sidebar });
            const orbBad = (o: OrbSpread | undefined): boolean =>
                !!o && (o.overlapping > 0 || (o.bubbles >= 6 && o.concentration > ORB_MAX_CONCENTRATION));
            if (
                pageErrors ||
                externalRequests ||
                horizontalScroll ||
                sidebar.clipped ||
                sidebar.orphanedDot ||
                views.some((v) => v.outside || v.overlapping || orbBad(v.orb))
            ) {
                out.verification = 'failed';
            }
            await page.close();
        }
    } finally {
        await browser.close();
    }
    return out;
}
