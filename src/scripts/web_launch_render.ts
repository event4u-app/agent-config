/**
 * `check_web_launch_readiness --render` — what a consumer build requests on
 * first paint, with no interaction and no consent given, recorded WITHOUT a
 * socket (road-to-a-page-that-says-what-it-loads Phase 3).
 *
 * The build is served from disk under a synthetic origin through Playwright's
 * route hook; every other request is aborted and recorded, never continued.
 * Scripts run, because a click-to-load wrapper is script; a WebSocket is routed
 * and closed without connecting. So the witness answers the one question static
 * reading cannot — does the request happen before the visitor acts — while
 * keeping the three properties of the `ui:render` Class-A path: per command,
 * nothing kept between runs, browser closed in `finally`.
 *
 * A `preconnect` is NOT visible to request interception; the static row keeps
 * sole ownership of it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { createRequire } from 'node:module';

import type * as PlaywrightTest from '@playwright/test';

export const SYNTHETIC_HOST = 'site.invalid';
const SYNTHETIC = `https://${SYNTHETIC_HOST}`;
const MAX_PAGES = 50;

export interface RecordedRequest {
    page: string;
    url: string;
}

export interface Witness {
    status: 'ok' | 'unverified';
    reason?: string;
    /** Every request to a non-synthetic origin: recorded and aborted. */
    requests: RecordedRequest[];
    /** Requests that left the machine. Empty by construction; a test asserts it. */
    continued: string[];
    pages: number;
}

const TYPES: Readonly<Record<string, string>> = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
};

function htmlPages(buildDir: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
            const abs = path.join(dir, e.name);
            if (e.isDirectory()) walk(abs);
            else if (/\.html?$/i.test(e.name)) out.push(path.relative(buildDir, abs).split(path.sep).join('/'));
        }
    };
    walk(buildDir);
    return out.slice(0, MAX_PAGES);
}

/** The file a synthetic URL names, confined to the build directory, or null. */
export function fileFor(buildDir: string, url: string): string | null {
    const u = new URL(url);
    let rel = decodeURIComponent(u.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const base = fs.realpathSync(buildDir);
    const abs = path.resolve(base, `.${rel}`);
    if (abs !== base && !abs.startsWith(base + path.sep)) return null;
    try {
        const real = fs.realpathSync(abs);
        if (!real.startsWith(base + path.sep)) return null;
        return fs.statSync(real).isFile() ? real : null;
    } catch {
        return null;
    }
}

/** The consumer's own Playwright, or null. This package declares it and never installs it. */
function loadPlaywright(): typeof PlaywrightTest | null {
    try {
        return createRequire(import.meta.url)('@playwright/test') as typeof PlaywrightTest;
    } catch {
        return null;
    }
}

/**
 * What the witness page may load: the synthetic origin is fulfilled from disk;
 * `data:`, `blob:` and `about:` stay in the page; everything else — any network
 * scheme, and `file:` — is aborted, and a network request is recorded.
 */
export function routeDecision(url: string): 'fulfil' | 'continue' | 'record-abort' | 'abort' {
    if (url.startsWith(`${SYNTHETIC}/`)) return 'fulfil';
    if (/^(data|blob|about):/i.test(url)) return 'continue';
    if (/^(https?|wss?):/i.test(url)) return 'record-abort';
    return 'abort';
}

export async function renderWitness(
    buildDir: string,
    opts: { settleMs?: number; playwright?: Pick<typeof PlaywrightTest, 'chromium'> | null } = {},
): Promise<Witness> {
    const pw = opts.playwright === undefined ? loadPlaywright() : opts.playwright;
    const empty = (reason: string): Witness => ({ status: 'unverified', reason, requests: [], continued: [], pages: 0 });
    if (pw === null) return empty('no Playwright driver is installed; the render witness did not run');
    const pages = htmlPages(buildDir);
    const requests: RecordedRequest[] = [];
    const continued: string[] = [];
    let browser: Awaited<ReturnType<typeof pw.chromium.launch>> | undefined;
    try {
        try {
            browser = await pw.chromium.launch({ headless: true });
        } catch (e) {
            return empty(`the browser could not start: ${(e as Error).message.split('\n')[0] ?? ''}`);
        }
        const context = await browser.newContext({ serviceWorkers: 'block', javaScriptEnabled: true });
        await context.routeWebSocket(/.*/, (ws) => {
            requests.push({ page: '(websocket)', url: ws.url() });
            void ws.close();
        });
        for (const rel of pages) {
            const page = await context.newPage();
            const blocked: string[] = [];
            await page.route('**/*', async (route) => {
                const url = route.request().url();
                const decision = routeDecision(url);
                if (decision === 'continue') return route.continue();
                if (decision !== 'fulfil') {
                    if (decision === 'record-abort') blocked.push(url);
                    return route.abort();
                }
                const file = fileFor(buildDir, url);
                if (file === null) return route.fulfill({ status: 404, body: '' });
                return route.fulfill({
                    status: 200,
                    headers: { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream' },
                    body: fs.readFileSync(file),
                });
            });
            page.on('requestfinished', (req) => {
                const url = req.url();
                if (/^https?:/i.test(url) && new URL(url).host !== SYNTHETIC_HOST) continued.push(url);
            });
            try {
                await page.goto(`${SYNTHETIC}/${rel}`, { waitUntil: 'load', timeout: 15_000 });
                await page.waitForLoadState('networkidle', { timeout: opts.settleMs ?? 2_000 }).catch(() => undefined);
            } catch {
                // A navigation that never settles still recorded what it requested.
            } finally {
                for (const url of blocked) if (/^https?:/i.test(url)) requests.push({ page: rel, url });
                await page.close();
            }
        }
        await context.close();
        return { status: 'ok', requests, continued, pages: pages.length };
    } finally {
        await browser?.close();
    }
}
