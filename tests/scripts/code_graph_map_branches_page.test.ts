import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';

// Branches on the page only when asked for: a map drawn with --branches lists
// the indexed branches and how each differs from the checked-out one; a map
// drawn without says why it holds no branch.

let browser: Browser;
let root: string;
let withBranches: string;
let without: string;

async function open(html: string, hash: string): Promise<{ page: Page; errors: string[] }> {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'en-US' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(pathToFileURL(html).href + hash);
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    return { page, errors };
}

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-brpage-')));
    const w = (rel: string, body: string): void => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
    };
    const git = (...args: string[]): void => {
        execFileSync('git', args, { cwd: root, stdio: 'ignore', env: { ...process.env, GIT_AUTHOR_NAME: 'Dev', GIT_AUTHOR_EMAIL: 'd@x.invalid', GIT_COMMITTER_NAME: 'Dev', GIT_COMMITTER_EMAIL: 'd@x.invalid' } });
    };
    const lock = (v: string): string => JSON.stringify({ lockfileVersion: 3, packages: { '': { dependencies: { react: '>=18' } }, 'node_modules/react': { version: v } } }, null, 2);
    git('init', '-q', '-b', 'main');
    w('.gitignore', 'agents/\n');
    w('package.json', JSON.stringify({ dependencies: { react: '>=18' } }));
    w('package-lock.json', lock('18.2.0'));
    w('src/a.ts', "import * as React from 'react';\nexport const a = React;\n");
    git('add', '.');
    git('commit', '-qm', 'init');
    git('checkout', '-qb', 'feat-x');
    w('package-lock.json', lock('19.0.0'));
    git('commit', '-qam', 'react 19');
    git('checkout', '-q', 'main');
    fs.mkdirSync(path.join(root, 'agents'));
    withBranches = path.join((await buildMap(root, { branches: true })).outDir, 'index.html');
    const plain = path.join(root, 'agents', 'plain');
    without = path.join((await buildMap(root, { outDir: plain })).outDir, 'index.html');
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    fs.rmSync(root, { recursive: true, force: true });
});

describe('branches on the map', () => {
    it('lists each indexed branch and its difference from the checked-out one', async () => {
        const { page, errors } = await open(withBranches, '#/systems');
        await page.locator('[role="tab"]', { hasText: 'Branches' }).click();
        const text = (await page.locator('#av-main').textContent()) ?? '';
        expect(text).toMatch(/against main/);
        // The handover's local table: branch, commit, seen, parent, stand, direct packages against the current one.
        expect(text).toMatch(/feat-x\w{8}[\s\S]*npm:react 18\.2\.0 → 19\.0\.0/);
        expect(await page.locator('[role="radiogroup"][aria-label="Map kind"] [aria-checked="true"]').textContent()).toBe('Local with --branches');
        expect(errors).toEqual([]);
        await page.close();
    });

    it('a map drawn without --branches holds no branch and says why', async () => {
        const { page, errors } = await open(without, '#/systems');
        await page.locator('[role="tab"]', { hasText: 'Branches' }).click();
        expect(await page.locator('#sy-snap').textContent()).toMatch(/branch state not included[\s\S]*code-graph map --branches/);
        expect(fs.readFileSync(path.join(path.dirname(without), 'code', 'map.json'), 'utf-8')).not.toContain('feat-x');
        expect(errors).toEqual([]);
        await page.close();
    });
});
