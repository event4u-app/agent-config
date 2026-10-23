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

import type { chromium as Chromium } from '@playwright/test';

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
        views: Array<{ view: string; labels: number; outside: number; overlapping: number }>;
    }>;
}

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
    let chromium: typeof Chromium;
    try {
        ({ chromium } = await import('@playwright/test'));
    } catch {
        return { verification: 'unverified', reason: '@playwright/test is not installed (a devDependency)', viewports: [] };
    }
    let browser: Awaited<ReturnType<typeof chromium.launch>>;
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
            const read = async (view: string): Promise<{ view: string; labels: number; outside: number; overlapping: number }> => {
                const r = (await page.evaluate(() => (window as unknown as { __mapLabelBoxes: { boxes: Box[]; width: number; height: number } }).__mapLabelBoxes)) as {
                    boxes: Box[];
                    width: number;
                    height: number;
                };
                return { view, labels: r.boxes.length, ...labelProblems(r.boxes, r.width, r.height) };
            };
            const views = [await read('overview')];
            const firstArea = page.locator('#panel .plist button').first();
            if ((await firstArea.count()) > 0) {
                await firstArea.click();
                views.push(await read('largest-area'));
            }
            const horizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
            out.viewports.push({ name: vp.name, pageErrors, externalRequests, horizontalScroll, views });
            if (pageErrors || externalRequests || horizontalScroll || views.some((v) => v.outside || v.overlapping)) {
                out.verification = 'failed';
            }
            await page.close();
        }
    } finally {
        await browser.close();
    }
    return out;
}
