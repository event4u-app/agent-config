import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { buildMap } from '../../src/scripts/code_graph/map.js';
import { produceAreas } from '../../src/scripts/code_graph/map_area_payloads.js';
import type { SystemsPayload } from '../../src/scripts/code_graph/map_areas.js';
import { writeSystemsFixture } from './code_graph/systems_fixture.js';

// The Systems page drawn from a real build of the systems fixture: every row
// comes from the lane's facts, nothing from a sample payload.

let browser: Browser;
let root: string;
let html: string;
let systems: SystemsPayload;

async function open(hash: string): Promise<{ page: Page; errors: string[] }> {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'en-US' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(pathToFileURL(html).href + hash);
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    return { page, errors };
}

beforeAll(async () => {
    root = writeSystemsFixture();
    fs.mkdirSync(path.join(root, 'agents'));
    const { graph } = await buildFromRepo(root, null, { lanes: true });
    const { areas } = produceAreas(root, graph, { hunks: [] });
    systems = areas.systems as SystemsPayload;
    html = path.join((await buildMap(root, { areas })).outDir, 'index.html');
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    fs.rmSync(root, { recursive: true, force: true });
});

describe('the systems payload', () => {
    it('carries every package with the shortest path from its declaration', () => {
        const tokens = systems.packages.find((k) => k.name === 'js-tokens');
        expect(tokens?.path).toEqual(['react@18.2.0', 'loose-envify@1.4.0', 'js-tokens@4.0.0']);
        expect(tokens?.usedBy.map((u) => u.file)).toEqual(['src/app.ts']);
        expect(systems.packages[0]?.framework).toBe(true);
        expect(systems.runtimes.find((r) => r.name === 'php')?.disagrees).toBe(true);
        expect(systems.findings.map((f) => f.id).sort()).toEqual(['SY-1', 'SY-2', 'SY-3', 'SY-4']);
    });
});

describe('the Systems page', () => {
    it('lists every package and every runtime witness from the payload', async () => {
        const { page, errors } = await open('#/systems');
        expect(await page.locator('#av-main tbody tr').count()).toBe(systems.packages.length);
        await page.locator('[role="tab"]', { hasText: 'Runtimes' }).click();
        const witnesses = systems.runtimes.reduce((n, r) => n + r.witnesses.length, 0);
        expect(await page.locator('#av-main tbody tr').count()).toBe(witnesses);
        expect(await page.locator('#av-main').textContent()).toContain('witnesses disagree');
        expect(errors).toEqual([]);
        await page.close();
    });

    it('opens a transitive package with the path that installed it and the file that imports it', async () => {
        const { page, errors } = await open(`#/systems/${encodeURIComponent('package/js-tokens@4.0.0')}`);
        const detail = (await page.locator('#av-detail').textContent()) ?? '';
        expect(detail).toContain('react@18.2.0 → loose-envify@1.4.0 → js-tokens@4.0.0');
        expect(detail).toContain('src/app.ts');
        expect(errors).toEqual([]);
        await page.close();
    });

    it('shows its findings in the findings view', async () => {
        const { page, errors } = await open('#/systems');
        await page.locator('[role="tab"]', { hasText: 'Findings' }).click();
        const text = (await page.locator('#av-main').textContent()) ?? '';
        for (const id of ['SY-1', 'SY-2', 'SY-3', 'SY-4']) expect(text).toContain(id);
        expect(errors).toEqual([]);
        await page.close();
    });
});
