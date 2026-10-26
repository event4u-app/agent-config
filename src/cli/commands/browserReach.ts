/**
 * How `ui:render` finds a browser without this package shipping one
 * (road-to-tells-a-near-miss-can-refute 2.1).
 *
 * `@playwright/test` is a devDependency, so a consumer install usually has no
 * renderer at all. Two cheaper paths are tried before the page profile degrades,
 * and neither adds a dependency: a `playwright-core` the consumer already has,
 * and a Chrome, Edge or Chromium installed on the machine, passed to Playwright
 * as `executablePath` when its own bundled browser is absent. Whether to ship
 * `playwright-core` or a CDP client is OQ-21, not decided here.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { chromium as Chromium } from '@playwright/test';

export interface BrowserReach {
    chromium: typeof Chromium;
    /** Set when Playwright's own browser is missing and a system one was found. */
    executablePath?: string;
    source: '@playwright/test' | 'playwright-core';
}

/** Where a system Chromium-family browser usually lives, per platform. */
export function systemBrowserCandidates(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] {
    const fromEnv = env['AGENT_CONFIG_BROWSER'] ? [env['AGENT_CONFIG_BROWSER']] : [];
    if (platform === 'darwin') {
        return [
            ...fromEnv,
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        ];
    }
    if (platform === 'win32') {
        const roots = [env['PROGRAMFILES'], env['PROGRAMFILES(X86)'], env['LOCALAPPDATA']].filter(
            (r): r is string => typeof r === 'string' && r !== '',
        );
        return [
            ...fromEnv,
            ...roots.flatMap((r) => [
                path.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe'),
                path.join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
                path.join(r, 'Chromium', 'Application', 'chrome.exe'),
            ]),
        ];
    }
    const dirs = (env['PATH'] ?? '').split(path.delimiter).filter(Boolean);
    const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];
    return [...fromEnv, ...dirs.flatMap((d) => names.map((n) => path.join(d, n)))];
}

/** The first candidate that exists, or null. */
export function findSystemBrowser(
    platform: NodeJS.Platform = process.platform,
    env: NodeJS.ProcessEnv = process.env,
    exists: (p: string) => boolean = fs.existsSync,
): string | null {
    return systemBrowserCandidates(platform, env).find((p) => exists(p)) ?? null;
}

/**
 * Resolve a Chromium driver and, when its bundled browser is missing, a system
 * browser to drive. `null` when neither Playwright package resolves — the caller
 * degrades exactly as before.
 */
export async function resolveBrowser(): Promise<BrowserReach | null> {
    let chromium: typeof Chromium | null = null;
    let source: BrowserReach['source'] = '@playwright/test';
    try {
        ({ chromium } = await import('@playwright/test'));
    } catch {
        try {
            const core = 'playwright-core';
            ({ chromium } = (await import(core)) as { chromium: typeof Chromium });
            source = 'playwright-core';
        } catch {
            return null;
        }
    }
    let bundled = false;
    try {
        bundled = fs.existsSync(chromium.executablePath());
    } catch {
        bundled = false;
    }
    if (bundled) return { chromium, source };
    const system = findSystemBrowser();
    return system === null ? { chromium, source } : { chromium, executablePath: system, source };
}
