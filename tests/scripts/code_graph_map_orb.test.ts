import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';
import { buildDemoMap } from '../../src/scripts/code_graph/map_demo.js';

// The orb turns without a stop on any axis, over the poles and on; and a file
// shows every trusted edge it has — in 2D and in 3D alike — or says how many a
// filter hides, never looking unconnected while it has edges.

let browser: Browser;
let small: string;
let demo: string;
let savedHome: string | undefined;
const dirs: string[] = [];

function tmp(prefix: string): string {
    const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
    dirs.push(d);
    return d;
}

beforeAll(async () => {
    savedHome = process.env['EVENT4U_CONFIG_HOME'];
    process.env['EVENT4U_CONFIG_HOME'] = path.join(tmp('cg-orb-home-'), 'home');
    const root = tmp('cg-orb-');
    fs.mkdirSync(path.join(root, 'agents'));
    for (const g of ['alpha', 'beta', 'gamma', 'delta']) {
        for (const n of ['a', 'b', 'c']) {
            const rel = path.join(root, 'src', g, `${n}.ts`);
            fs.mkdirSync(path.dirname(rel), { recursive: true });
            fs.writeFileSync(rel, n === 'a' ? `export const ${g}A = 1;\n` : `import { ${g}A } from './a';\nexport const ${g}${n} = ${g}A;\n`);
        }
    }
    small = path.join((await buildMap(root)).outDir, 'index.html');
    const droot = tmp('cg-orb-demo-');
    fs.mkdirSync(path.join(droot, 'agents'));
    demo = (await buildDemoMap(droot)).page;
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 240_000);
afterAll(async () => {
    await browser?.close();
    if (savedHome === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
    else process.env['EVENT4U_CONFIG_HOME'] = savedHome;
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

async function open(html: string, hash = '#/code'): Promise<Page> {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, locale: 'en-US' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(pathToFileURL(html).href + hash);
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    return page;
}

interface OrbNode { kind: string; idx: number; u: number[]; deg: number }
const orbNodes = (page: Page) => page.evaluate(() => (window as unknown as { __mapOrbNodes: OrbNode[] }).__mapOrbNodes);

/** The turn of one node around the screen's x axis, read from its rotated position. */
async function tilt(page: Page, idx: number): Promise<number> {
    const n = (await orbNodes(page)).find((x) => x.kind === 'area' && x.idx === idx)!;
    return Math.atan2(n.u[2]!, n.u[1]!);
}
function unwrap(prev: number, next: number): number {
    let d = next - prev;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
}

describe('the orb turns without a stop', () => {
    it('the up key keeps turning it over the pole, step after step', async () => {
        const page = await open(small);
        await page.click('#dim');
        const idx = (await orbNodes(page)).find((n) => n.kind === 'area')!.idx;
        let last = await tilt(page, idx);
        let total = 0;
        for (let i = 0; i < 30; i++) {
            await page.keyboard.press('ArrowUp');
            const now = await tilt(page, idx);
            const d = unwrap(last, now);
            expect(d, `step ${i}`).toBeGreaterThan(0.1);
            total += d;
            last = now;
        }
        expect(total).toBeGreaterThan(Math.PI * 1.2);
        await page.close();
    });

    it('a long vertical drag turns it on past the pole', async () => {
        const page = await open(small);
        await page.click('#dim');
        const idx = (await orbNodes(page)).find((n) => n.kind === 'area')!.idx;
        const box = (await page.locator('#stage').boundingBox())!;
        const x = box.x + box.width / 2;
        let y = box.y + box.height - 10;
        await page.mouse.move(x, y);
        await page.mouse.down();
        let last = await tilt(page, idx);
        let total = 0;
        // Upward only, one stretch: every step turns on by the same amount, over the pole too.
        const steps = Math.floor((box.height - 20) / 16);
        for (let i = 0; i < steps; i++) {
            y -= 16;
            await page.mouse.move(x, y);
            await page.waitForTimeout(20);
            const now = await tilt(page, idx);
            const d = Math.abs(unwrap(last, now));
            expect(d, `step ${i}`).toBeGreaterThan(0.08);
            total += d;
            last = now;
        }
        await page.mouse.up();
        expect(total).toBeGreaterThan(Math.PI);
        await page.close();
    });
});

describe('a file shows its edges in 2D and in 3D', () => {
    it('routes/api.php reaches every controller it routes to', async () => {
        const page = await open(demo);
        await page.fill('#search', 'routes/api.php');
        await page.locator('#results button').filter({ hasText: /^routes\/api\.php$/ }).click();
        const expected = await page.evaluate(() => {
            const data = JSON.parse(document.getElementById('map-data')!.textContent!) as { model: { files: Array<{ path: string; role: string }>; edges: number[][] } };
            const files = data.model.files;
            const i = files.findIndex((f) => f.path === 'routes/api.php');
            let shown = 0;
            let all = 0;
            for (const e of data.model.edges) {
                if (e[0] !== i && e[1] !== i) continue;
                all += 1;
                const other = files[e[0] === i ? e[1]! : e[0]!]!;
                if (other.role !== 'infra') shown += 1;
            }
            return { i, shown, all };
        });
        expect(expected.all).toBeGreaterThan(20);
        const view = () => page.evaluate(() => (window as unknown as { __mapView: { file: number; drawn: Array<{ kind: string; idx: number; deg: number }> } }).__mapView);
        const flat = await view();
        expect(flat.file).toBe(expected.i);
        const me = flat.drawn.find((d) => d.kind === 'file' && d.idx === expected.i)!;
        expect(me.deg).toBe(expected.shown);
        await page.click('#dim');
        const round = (await orbNodes(page)).find((n) => n.kind === 'file' && n.idx === expected.i)!;
        expect(round.deg).toBe(expected.shown);
        await page.close();
    });

    it('edges a filter hides are counted on the node, not dropped silently', async () => {
        const page = await open(demo);
        await page.fill('#search', 'routes/api.php');
        await page.locator('#results button').filter({ hasText: /^routes\/api\.php$/ }).click();
        await page.click('#t-sure');
        const hint = await page.evaluate(() => (window as unknown as { __mapHidden: Record<string, number> }).__mapHidden);
        const i = await page.evaluate(() => (window as unknown as { __mapView: { file: number } }).__mapView.file);
        expect(hint['file' + i]).toBeGreaterThan(20);
        await page.close();
    });
});
