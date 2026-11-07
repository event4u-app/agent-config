/**
 * Child process for the browser acceptance grader (`browser-acceptance`). Runs one
 * produced HTML page in headless Chromium and executes the held-back acceptance
 * spec against it, printing one JSON line.
 *
 * The happy-dom grader cannot score what needs layout and real input: a drag by
 * mouse or by touch, a breakpoint, horizontal overflow. This worker can, because
 * the browser lays the page out and dispatches trusted input events.
 *
 * The page is untrusted model output. It is loaded with `setContent`, every
 * network request is aborted, and the parent gives the process a timeout.
 * `@playwright/test` is a devDependency and is imported dynamically, so a consumer
 * install without it, or without the Chromium build, reports `unknown`. So does
 * `axe-core`: when it is not installed, the axe check is reported unmeasured.
 *
 * Usage: bench_artifact_browser_worker <spec.json>
 *   spec = { html_path, tests: [{name, steps}], render: {width, height, locale} }
 */
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import process from 'node:process';

type Step = Record<string, unknown>;
interface Spec {
    html_path: string;
    tests: { name: string; steps: Step[] }[];
    render: { width: number; height: number; locale: string };
}
type Page = any; // eslint-disable-line @typescript-eslint/no-explicit-any
interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

const center = (b: Box): [number, number] => [b.x + b.width / 2, b.y + b.height / 2];

async function box_of(page: Page, sel: unknown): Promise<Box | null> {
    const el = page.locator(String(sel)).first();
    return (await el.count()) === 0 ? null : ((await el.boundingBox()) as Box | null);
}

/** A drag in eight moves, so a handler that needs movement past a threshold sees it. */
async function drag(page: Page, s: Step): Promise<string | null> {
    const from = await box_of(page, s['from']);
    const to = await box_of(page, s['to']);
    if (!from || !to) return `drag: no box for ${String(from ? s['to'] : s['from'])}`;
    const [x0, y0] = center(from);
    const [x1, y1] = center(to);
    const path: [number, number][] = Array.from({ length: 8 }, (_, i) => [x0 + ((x1 - x0) * (i + 1)) / 8, y0 + ((y1 - y0) * (i + 1)) / 8]);
    if (s['pointer'] === 'touch') {
        const cdp = await page.context().newCDPSession(page);
        const touch = (type: string, x: number, y: number): Promise<unknown> =>
            cdp.send('Input.dispatchTouchEvent', {
                type,
                touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
            });
        await touch('touchStart', x0, y0);
        for (const [x, y] of path) await touch('touchMove', x, y);
        await touch('touchEnd', x1, y1);
        await cdp.detach();
    } else {
        await page.mouse.move(x0, y0);
        await page.mouse.down();
        for (const [x, y] of path) await page.mouse.move(x, y);
        await page.mouse.up();
    }
    await page.waitForTimeout(50);
    return null;
}

async function act(page: Page, s: Step): Promise<string | null> {
    const what = s['do'];
    if (what === 'viewport') {
        await page.setViewportSize({
            width: Number(s['width']),
            height: Number(s['height'] ?? 800),
        });
        await page.waitForTimeout(50);
        return null;
    }
    if (what === 'drag') return drag(page, s);
    const el = page.locator(String(s['selector'])).first();
    if ((await el.count()) === 0) return `no element ${String(s['selector'])}`;
    if (what === 'click') await el.click({ timeout: 2_000 });
    else if (what === 'focus') await el.focus();
    else if (what === 'press') await page.keyboard.press(String(s['key']));
    else return `unknown action ${String(what)}`;
    await page.waitForTimeout(30);
    return null;
}

async function expect_step(page: Page, s: Step): Promise<string | null> {
    const kind = s['expect'];
    const sel = String(s['selector'] ?? '');
    const re = (p: unknown): RegExp => new RegExp(String(p), 'i');
    if (kind === 'order') {
        const got = (await page.locator(sel).evaluateAll((els: Element[], a: string) => els.map((e) => e.getAttribute(a) ?? ''), String(s['attribute']))) as string[];
        const want = s['equals'] as string[];
        return got.join(',') === want.join(',') ? null : `${sel} order ${got.join(',')} != ${want.join(',')}`;
    }
    if (kind === 'text' || kind === 'attr') {
        const el = page.locator(sel).first();
        if ((await el.count()) === 0) return `no element ${sel}`;
        const v =
            kind === 'text'
                ? String(await el.textContent())
                      .replace(/\s+/g, ' ')
                      .trim()
                : ((await el.getAttribute(String(s['attribute']))) ?? '');
        return re(s['match']).test(v) ? null : `${sel}${kind === 'attr' ? `@${String(s['attribute'])}` : ''} "${v.slice(0, 60)}" !~ ${String(s['match'])}`;
    }
    if (kind === 'visible' || kind === 'hidden') {
        const el = page.locator(sel).first();
        const vis = (await el.count()) > 0 && (await el.isVisible());
        return vis === (kind === 'visible') ? null : `${sel} is not ${kind}`;
    }
    if (kind === 'focused') {
        const ok = (await page
            .locator(sel)
            .first()
            .evaluate((e: Element) => e === document.activeElement)
            .catch(() => false)) as boolean;
        return ok ? null : `${sel} does not have focus`;
    }
    if (kind === 'layout') {
        const a = await box_of(page, s['a']);
        const b = await box_of(page, s['b']);
        if (!a || !b) return `layout: no box for ${String(a ? s['b'] : s['a'])}`;
        const tol = 2;
        const ok = s['relation'] === 'below' ? b.y >= a.y + a.height - tol : b.x >= a.x + a.width - tol && b.y < a.y + a.height;
        return ok ? null : `layout: ${String(s['b'])} is not ${String(s['relation'])} ${String(s['a'])}`;
    }
    if (kind === 'no-overflow') {
        const [sw, cw] = (await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth])) as [number, number];
        return sw <= cw ? null : `horizontal overflow: scrollWidth ${sw} > ${cw}`;
    }
    return `unknown expectation ${String(kind)}`;
}

/** Serious and critical axe violations on the page as loaded; `unknown(...)` when axe-core is absent. */
async function axe_column(page: Page): Promise<string> {
    let src: string;
    try {
        src = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf-8');
    } catch {
        return 'unknown(axe-core not installed)';
    }
    await page.addScriptTag({ content: src });
    const ids = (await page.evaluate(async () => {
        type Axe = { run: (ctx: Document, o: object) => Promise<{ violations: { id: string; impact: string }[] }> };
        const { violations } = await (globalThis as unknown as { axe: Axe }).axe.run(document, { resultTypes: ['violations'] });
        return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
    })) as string[];
    return ids.length === 0 ? 'pass' : `fail(${ids.join(', ')})`;
}

async function main(): Promise<void> {
    const spec = JSON.parse(fs.readFileSync(process.argv[2] as string, 'utf-8')) as Spec;
    let pw: Page;
    try {
        pw = await import('@playwright/test');
    } catch {
        process.stdout.write(JSON.stringify({ unavailable: '@playwright/test not installed' }) + '\n');
        return;
    }
    if (!fs.existsSync(pw.chromium.executablePath())) {
        process.stdout.write(JSON.stringify({ unavailable: 'no playwright chromium installed' }) + '\n');
        return;
    }
    const html = fs.readFileSync(spec.html_path, 'utf-8');
    const browser = await pw.chromium.launch();
    const results: { name: string; status: 'pass' | 'fail'; detail?: string }[] = [];
    let axe = 'unknown(not run)';
    const new_context = (): Promise<Page> =>
        browser.newContext({
            viewport: { width: spec.render.width, height: spec.render.height },
            locale: spec.render.locale,
            reducedMotion: 'reduce',
            hasTouch: true,
            javaScriptEnabled: true,
        });
    try {
        for (const t of spec.tests) {
            const ctx = await new_context();
            await ctx.route('**/*', (r: Page) => r.abort());
            const page = await ctx.newPage();
            let failure: string | null = null;
            try {
                await page.setContent(html, { waitUntil: 'load', timeout: 10_000 });
                for (const s of t.steps) {
                    failure = s['do'] !== undefined ? await act(page, s) : await expect_step(page, s);
                    if (failure !== null) break;
                }
            } catch (e) {
                failure = `threw: ${(e as Error).message.split('\n')[0]}`;
            }
            await ctx.close();
            results.push({
                name: t.name,
                status: failure === null ? 'pass' : 'fail',
                ...(failure ? { detail: failure } : {}),
            });
        }
        const ctx = await new_context();
        await ctx.route('**/*', (r: Page) => r.abort());
        const page = await ctx.newPage();
        await page.setContent(html, { waitUntil: 'load', timeout: 10_000 });
        axe = await axe_column(page).catch((e: unknown) => `unknown(${(e as Error).message.split('\n')[0]})`);
        await ctx.close();
    } finally {
        await browser.close();
    }
    process.stdout.write(JSON.stringify({ results, axe }) + '\n');
}

void main().then(
    () => process.exit(0),
    (e: unknown) => {
        process.stdout.write(JSON.stringify({ error: (e as Error).message }) + '\n');
        process.exit(1);
    },
);
