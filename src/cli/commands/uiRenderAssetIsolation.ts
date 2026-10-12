/**
 * Isolation of the asset under test — which is untrusted input — during its
 * own witness (16.5.0 release review).
 *
 * Scripts are disabled for the whole browser context, so a `<script>` or `on*`
 * handler in the asset never runs; that is also what keeps WebSocket and
 * WebRTC closed, since `page.route` intercepts neither. A request is allowed
 * only on the `file:`, `data:`, `blob:` and `about:` schemes, and a `file:`
 * request only when it resolves inside the project root or the asset's own
 * directory, so an asset cannot pull an arbitrary local file into a capture.
 * The comparison pages inline everything they read, so they allow no `file:`.
 *
 * The cost, accepted: a host document that builds its visual state with
 * JavaScript is witnessed as its static markup, not as it would run.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Page, Route } from '@playwright/test';

import { ALLOWED_SCHEMES } from './uiRenderAssetTypes.js';

/** The directories a `file:` request may resolve into for this asset. */
export function fileRootsFor(projectRoot: string, file: string): string[] {
    return [projectRoot, path.dirname(path.resolve(file))];
}

/** True unless `url` is a `file:` URL resolving outside `root` (symlinks followed). */
export function fileInside(url: string, root: string): boolean {
    if (!url.startsWith('file:')) return true;
    const real = (p: string): string => {
        try {
            return fs.realpathSync(p);
        } catch {
            return path.resolve(p);
        }
    };
    let target: string;
    try {
        target = real(fileURLToPath(url));
    } catch {
        return false;
    }
    const base = real(root);
    return target === base || target.startsWith(base + path.sep);
}

/**
 * May the witness page load `url`? A `file:` URL needs a root it resolves
 * inside; with no roots — a page that inlines everything it reads — none does.
 */
export function requestAllowed(url: string, fileRoots: readonly string[]): boolean {
    if (!ALLOWED_SCHEMES.some((s) => url.startsWith(s))) return false;
    return !url.startsWith('file:') || fileRoots.some((root) => fileInside(url, root));
}

/**
 * Route every request of `page` through `requestAllowed`, recording what was
 * refused. One opener for every witness page, so no page confines less than
 * another (16.5.0 review: the comparison pages checked the scheme only).
 */
export async function confinePage(
    page: Page,
    blocked: string[],
    fileRoots: readonly string[],
    fulfil?: (route: Route) => Promise<boolean>,
): Promise<void> {
    await page.route('**/*', async (route: Route) => {
        if (fulfil && (await fulfil(route))) return;
        const url = route.request().url();
        if (!requestAllowed(url, fileRoots)) {
            blocked.push(url);
            await route.abort();
            return;
        }
        await route.continue();
    });
}

/**
 * Add a stylesheet to the page. Not `page.addStyleTag`: it waits on a
 * page-script `onload`, which never fires with scripts disabled, while
 * `evaluate` runs outside the page's own scripts.
 */
export async function injectStyle(page: Page, css: string): Promise<void> {
    await page.evaluate((text: string) => {
        const style = document.createElement('style');
        style.textContent = text;
        (document.head ?? document.documentElement).appendChild(style);
    }, css);
}
