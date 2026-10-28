import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap, renderHtml } from '../../src/scripts/code_graph/map.js';
import type { MapAreas } from '../../src/scripts/code_graph/map_areas.js';

// The Wissen route of the 2026-10-bf handover (road-to-map-views-from-the-handover,
// step 6.1). Without a knowledge source index the page keeps its lenses, its
// Filter aside and the one figure the map holds (Markdown doc nodes) and says
// why the rest is empty; with an index every count is the payload's.

let browser: Browser;
let bare: string;
let indexed: string;
let docs: number;
const roots: string[] = [];
const sources = [
    { name: 'Markdown-Doku', path: 'docs/', format: 'md', owner: 'project', read: 'map', note: 'Doc-Knoten', delete: 'git' },
    { name: 'Kuratierte Memory', path: 'agents/memory/*.yml', format: 'yaml', owner: 'project', read: 'no', gap: 'nicht im Index', delete: 'git' },
    { name: 'Host-Memory', path: 'vom Host verwaltet', format: 'md', owner: 'user', read: 'no', delete: '/agents user delete' },
];

async function open(html: string): Promise<{ page: Page; errors: string[] }> {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'de-DE' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(pathToFileURL(html).href + '#/knowledge');
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    return { page, errors };
}

beforeAll(async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-know-')));
    roots.push(root);
    fs.mkdirSync(path.join(root, 'agents'));
    fs.writeFileSync(path.join(root, 'a.ts'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(root, 'README.md'), '# Fixture\n');
    fs.writeFileSync(path.join(root, 'NOTES.md'), '# Notes\n');
    const res = await buildMap(root, { areas: {} });
    bare = path.join(res.outDir, 'index.html');
    const doc = JSON.parse(fs.readFileSync(path.join(res.outDir, 'code', 'map.json'), 'utf-8')) as { meta: Parameters<typeof renderHtml>[1]; model: Parameters<typeof renderHtml>[0] & { files: Array<{ role: string }> } };
    docs = doc.model.files.filter((f) => f.role === 'doc').length;
    indexed = path.join(res.outDir, 'indexed.html');
    const areas = { knowledge: { reader: 'knowledge source index', completeness: 'complete', findings: [], sources, memory: [{ title: 'agents/memory/', sub: '86 Einträge', kind: 'yaml' }] } } as unknown as MapAreas;
    fs.writeFileSync(indexed, renderHtml(doc.model, doc.meta, areas));
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

describe('Wissen', () => {
    it('without an index: five lenses, the Filter aside with both groups and the ownership legend, the Markdown figure, and every lens empty with its reason', async () => {
        const { page, errors } = await open(bare);
        expect(await page.locator('#av-bar [role="tab"]').allTextContents()).toEqual(['Quellen', 'Memory', 'Entscheidungen', 'Sessions', 'Arbeitsweise']);
        expect(await page.locator('#av-left').getAttribute('aria-label')).toBe('Filter');
        expect(await page.locator('#av-side').getAttribute('aria-label')).toBe('Detail');
        expect(await page.locator('#av-left-body input').getAttribute('aria-label')).toBe('Wissen durchsuchen');
        expect(await page.locator('[data-group="own"] [role="checkbox"]').allTextContents()).toEqual(['✓Nutzer–', '✓Projekt–', '✓Team–', '✓Maschine–']);
        expect(await page.locator('[data-group="read"] [role="checkbox"]').count()).toBe(6);
        expect(await page.locator('#k-who').textContent()).toContain('Wem gehört was · K.1');
        expect(await page.locator('#k-kpis .k-kpi').count()).toBe(1);
        expect(await page.locator('#k-kpis .k-kv').textContent()).toBe(String(docs));
        expect(await page.locator('#nodata-knowledge-src .ep-head').textContent()).toBe('Kein Wissensquellen-Index in dieser Map');
        for (const l of ['mem', 'dec', 'ses', 'work']) {
            await page.click(`[data-lens="${l}"]`);
            expect(await page.locator(`#nodata-knowledge-${l}`).isVisible(), l).toBe(true);
        }
        // Live, not dim, in the nav: the page holds the Markdown figure.
        expect((await page.locator('#areanav a[data-route="knowledge"]').getAttribute('class')) ?? '').not.toContain('empty');
        expect(errors).toEqual([]);
        await page.close();
    });

    it('with an index: counts per owner and reader from the payload, a filter narrows the registry, the Detail aside names owner, path and delete path', async () => {
        const { page, errors } = await open(indexed);
        expect(await page.locator('#k-count').textContent()).toBe('3 von 3');
        expect(await page.locator('[data-group="own"] [data-v="project"] .sy-n').textContent()).toBe('2');
        expect(await page.locator('[data-group="read"] [data-v="no"] .sy-n').textContent()).toBe('2');
        await page.click('[data-group="own"] [data-v="project"]');
        expect(await page.locator('#k-count').textContent()).toBe('1 von 3');
        expect(await page.locator('#k-sources .k-src').evaluateAll((xs) => xs.map((x) => x.getAttribute('data-name')))).toEqual(['Host-Memory']);
        expect(await page.locator('#k-bar .sy-active').allTextContents()).toEqual(['ohne Projekt ×']);
        await page.click('#k-sources .k-src');
        expect(await page.locator('#k-detail').textContent()).toContain('/agents user delete');
        await page.click('[data-lens="mem"]');
        expect(await page.locator('.k-row').count()).toBe(1);
        await page.click('[data-lens="dec"]');
        expect(await page.locator('#nodata-knowledge-dec').isVisible()).toBe(true);
        expect(errors).toEqual([]);
        await page.close();
    });
});
