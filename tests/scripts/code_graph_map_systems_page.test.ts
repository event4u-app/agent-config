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

// The Systeme page of the 2026-10-bf handover (road-to-map-views-from-the-handover,
// Phase 3), drawn from a real build of the systems fixture plus one test-fixture
// workspace: every count on the page is checked against the payload.

let browser: Browser;
let root: string;
let html: string;
let systems: SystemsPayload;

async function open(hash = '#/systems', width = 1440): Promise<{ page: Page; errors: string[] }> {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: 'dark', locale: 'de-DE' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(pathToFileURL(html).href + hash);
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    return { page, errors };
}
const lens = (page: Page, id: string) => page.click(`[data-lens="${id}"]`);
const count = async (page: Page): Promise<[number, number]> => {
    const m = /^([\d.]+) von ([\d.]+) Paketen/.exec((await page.locator('#sy-count').textContent()) ?? '');
    return [Number(m![1]!.replace(/\./g, '')), Number(m![2]!.replace(/\./g, ''))];
};

beforeAll(async () => {
    root = writeSystemsFixture();
    fs.mkdirSync(path.join(root, 'agents'));
    // A sample repository under tests/fixtures: its workspace is off by default.
    const fx = path.join(root, 'tests', 'fixtures', 'demo');
    fs.mkdirSync(fx, { recursive: true });
    fs.writeFileSync(path.join(fx, 'package.json'), JSON.stringify({ name: 'demo', dependencies: { 'left-pad': '^1.3.0' } }));
    fs.writeFileSync(path.join(fx, 'package-lock.json'), JSON.stringify({ name: 'demo', lockfileVersion: 3, packages: { '': { name: 'demo', dependencies: { 'left-pad': '^1.3.0' } }, 'node_modules/left-pad': { version: '1.3.0', resolved: 'https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz' } } }));
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

const fxIds = (): Set<string> => new Set(systems.packages.filter((k) => !k.direct ? false : k.declared.some((d) => d.startsWith('tests/fixtures/'))).map((k) => `${k.name}@${k.version}`));

describe('the Systeme page', () => {
    it('filters: six lenses, the Filter aside with every group, counts equal to the payload, fixtures off by default', async () => {
        const { page, errors } = await open();
        expect(await page.locator('#av-bar [role="tab"]').evaluateAll((ts) => ts.map((t) => t.getAttribute('data-lens')))).toEqual(['overview', 'pk', 'deps', 'rt', 'find', 'br']);
        expect((await page.locator('#av-bar [role="tab"]').allTextContents()).slice(0, 4)).toEqual(['Übersicht', 'Pakete', 'Abhängigkeiten', 'Runtimes']);
        expect(await page.locator('#av-left').getAttribute('aria-label')).toBe('Filter');
        expect(await page.locator('#av-side').getAttribute('aria-label')).toBe('Detail');
        const left = page.locator('#av-left-body');
        expect(await left.locator('input[type="search"]').getAttribute('aria-label')).toBe('Paket suchen');
        // Package managers: one checkbox row each, its count the payload's.
        for (const eco of ['npm', 'composer']) {
            const row = left.locator(`[role="checkbox"][data-eco="${eco}"]`);
            expect(await row.getAttribute('aria-checked')).toBe('true');
            expect(await row.locator('.sy-n').textContent()).toBe(String(systems.packages.filter((k) => k.ecosystem === eco).length));
        }
        // Decision D5: ecosystems with no file are named, never claimed read.
        const none = await left.locator('#sy-nolock .st').allTextContents();
        expect(none).toEqual((systems.ecosystems ?? []).filter((e) => e.name !== 'npm' && e.name !== 'Composer' && !e.files.length).map((e) => e.name));
        expect(await left.locator('[role="checkbox"][data-ws="tests/fixtures/*"]').getAttribute('aria-checked')).toBe('false');
        const st = left.locator('[role="radiogroup"][aria-label="Status"] [role="radio"]');
        expect(await st.count()).toBe(7);
        for (const label of ['Scope', 'Herkunft', 'Lock', 'Tiefe (1 = direkt)', 'Benötigt von … Paketen']) expect(await left.locator(`[role="radiogroup"][aria-label="${label}"]`).count(), label).toBe(1);
        expect(await left.locator('[role="switch"]').allTextContents()).toEqual(['Frameworks', 'Mit Befund', 'Mehrere Versionen']);
        // Every status row counts within the shown set; together they are the "Alle" row.
        const ns = (await st.locator('.sy-n').allTextContents()).map(Number);
        expect(ns.slice(1).reduce((a, b) => a + b, 0)).toBe(ns[0]);
        const fixtures = systems.packages.length - ns[0]!;
        expect(fixtures).toBeGreaterThan(0);
        expect(await count(page)).toEqual([systems.packages.length - fixtures, systems.packages.length]);
        // Sensitivity: npm off takes exactly the shown npm packages out of the count.
        const npmShown = ns[0]! - systems.packages.filter((k) => k.ecosystem === 'composer').length;
        await left.locator('[role="checkbox"][data-eco="npm"]').click();
        expect((await count(page))[0]).toBe(ns[0]! - npmShown);
        // The handover shows the fixtures workspace that is off by default as an active chip too.
        expect(await page.locator('#sy-bar .sy-active').allTextContents()).toEqual(['ohne npm ×', 'ohne tests/fixtures/* ×']);
        await page.locator('.sy-reset').click();
        expect((await count(page))[0]).toBe(ns[0]);
        expect(errors).toEqual([]);
        await page.close();
    });

    it('overview: seven KPI tiles that apply a filter, PM cards, the workspace grid, frameworks and findings by kind', async () => {
        const { page, errors } = await open();
        const tiles = page.locator('#sy-kpis .sy-kpi');
        expect(await tiles.count()).toBe(7);
        expect(await tiles.nth(6).locator('.sy-kl').textContent()).toBe(`Runtimes · ${systems.runtimes.map((r) => r.name).join(', ')}`);
        expect(await page.locator('.sy-pmcard').count()).toBe(2);
        expect(await page.locator('.sy-wsr').count()).toBeGreaterThanOrEqual(2);
        expect(await page.locator('.sy-fkind .mono.sy-b').allTextContents()).toEqual([...new Set(systems.findings.filter((f) => !fxIds().has(f.subject.replace(/^package:\w+:/, ''))).map((f) => f.id))].sort());
        const direct = Number(await tiles.nth(1).locator('.sy-kv').textContent());
        await tiles.nth(1).click();
        expect(await page.locator('[data-lens="pk"]').getAttribute('aria-selected')).toBe('true');
        expect(await page.locator('[role="radiogroup"][aria-label="Herkunft"] [aria-checked="true"]').textContent()).toBe('direkt');
        expect((await count(page))[0]).toBe(direct);
        expect(errors).toEqual([]);
        await page.close();
    });

    it('every row reachable: the shared table lists every payload row once fixtures are on, sorts, groups, and hides columns 4–8 at 700', async () => {
        const { page, errors } = await open();
        await lens(page, 'pk');
        await page.click('#sy-fx');
        expect(await count(page)).toEqual([systems.packages.length, systems.packages.length]);
        while (await page.locator('.gt-more').count()) await page.click('.gt-more');
        const ids = await page.locator('#sy-list .gt-row').evaluateAll((rs) => rs.map((r) => r.getAttribute('data-id')));
        expect(new Set(ids)).toEqual(new Set(systems.packages.map((k) => `${k.name}@${k.version}`)));
        expect(await page.locator('#sy-list .gt-head > span').allTextContents()).toEqual(['', 'Paket', 'Version', 'Scope', 'Tiefe', 'Workspace', 'benötigt', 'genutzt', 'Befund']);
        // Sort by name, then the first row is the alphabetically first package.
        await page.click('[data-sort="name"]');
        expect(await page.locator('#sy-list .gt-row').first().getAttribute('data-id')).toBe([...systems.packages].sort((a, b) => (a.name < b.name ? -1 : 1))[0]!.name + '@' + [...systems.packages].sort((a, b) => (a.name < b.name ? -1 : 1))[0]!.version);
        await page.click('#sy-group');
        expect(await page.locator('#sy-count').textContent()).toMatch(/· \d+ Namen$/);
        await page.close();
        const phone = await open('#/systems', 375);
        await lens(phone.page, 'pk');
        expect(await phone.page.locator('#sy-list .gt-head > span').nth(4).evaluate((e) => getComputedStyle(e).display)).toBe('none');
        expect(await phone.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        expect([...errors, ...phone.errors]).toEqual([]);
        await phone.page.close();
    });

    it('dependencies: a transitive package with its verdict, neighbourhood, the way it came in, who needs it, its use per file and folder, and what the map does not know', async () => {
        const { page, errors } = await open(`#/systems/${encodeURIComponent('package/js-tokens@4.0.0')}`);
        await lens(page, 'deps');
        const k = systems.packages.find((x) => x.name === 'js-tokens')!;
        expect(await page.locator('.sy-dname').textContent()).toBe('js-tokens@4.0.0');
        expect(await page.locator('.sy-verdict').textContent()).toContain(`Nicht direkt eingebunden. Es kommt über ${k.path[0]} ins Projekt.`);
        expect(await page.locator('#sy-why .sy-hop .mono').allTextContents()).toEqual(['package.json', ...k.path]);
        expect(await page.locator('#sy-why b').first().textContent()).toBe('Warum installiert? · 1 Weg');
        expect(await page.locator('#sy-nb .sy-nbnode[data-side="left"]').allTextContents()).toEqual(k.requiredBy);
        expect(await page.locator('#sy-reqby .sy-ln').allTextContents()).toEqual(k.requiredBy);
        expect(await page.locator('#sy-use b').first().textContent()).toBe(`Nutzung im Code · ${k.usedByTotal} Dateien`);
        expect(await page.locator('#sy-use .sy-uf').first().getAttribute('title')).toBe('src/app.ts');
        expect(await page.locator('#sy-byarea .st').allTextContents()).toEqual(['src · 1']);
        expect(await page.locator('#sy-unknown').textContent()).toContain('code-graph why js-tokens');
        // A hop jumps to that package.
        await page.locator('#sy-why .sy-hop', { hasText: 'loose-envify@1.4.0' }).click();
        expect(await page.locator('.sy-dname').textContent()).toBe('loose-envify@1.4.0');
        expect(errors).toEqual([]);
        await page.close();
    });

    it('lenses and detail: runtimes per card with disagreement, findings grouped by rule with the proposal, the committed Branches card, the Detail aside', async () => {
        const { page, errors } = await open();
        await lens(page, 'rt');
        const php = page.locator('.sy-rt[data-rt="php"]');
        expect(await php.locator('.st').first().textContent()).toBe('Zeugen widersprechen sich · SY-4');
        await lens(page, 'find');
        const rules = await page.locator('.sy-fgrp').evaluateAll((gs) => gs.map((g) => g.getAttribute('data-rule')));
        expect(rules).toEqual([...rules].sort());
        await page.locator('.sy-fgrp[data-rule="SY-1"] .sy-fgh').click();
        expect(await page.locator('.sy-fgrp[data-rule="SY-1"] .sy-fix').first().textContent()).toMatch(/^Vorschlag: /);
        await lens(page, 'br');
        expect(await page.locator('[role="radiogroup"][aria-label="Map-Art"] [aria-checked="true"]').textContent()).toBe('Committete Map');
        expect(await page.locator('#sy-snap').textContent()).toContain('Branch-Zustand nicht enthalten');
        const iseven = systems.packages.find((x) => x.name === 'is-even')!;
        await lens(page, 'pk');
        await page.locator(`#sy-list .gt-row[data-id="is-even@${iseven.version}"]`).click();
        const d = page.locator('#sy-detail');
        expect(await d.locator('.sy-dn').textContent()).toBe('is-even');
        expect(await d.locator('.sy-fcard').first().textContent()).toContain('Vorschlag, nie angewendet:');
        expect(await d.locator('.sy-wit').textContent()).toContain(`${iseven.witness.file}:${iseven.witness.line}`);
        await d.locator('#sy-open').click();
        expect(await page.locator('[data-lens="deps"]').getAttribute('aria-selected')).toBe('true');
        expect(errors).toEqual([]);
        await page.close();
    });

    it('crumbs: every filter, sort and pick is a history step; ← restores the previous state exactly; without the push the way back is gone', async () => {
        const { page, errors } = await open();
        expect(await page.locator('#sy-bar .hist-back').count()).toBe(0);
        await lens(page, 'pk');
        await page.click('[data-sort="name"]');
        await page.locator('#av-left-body [role="radiogroup"][aria-label="Scope"] [data-v="dev"]').click();
        const before = await count(page);
        await page.locator('#sy-list .gt-row:not(.on)').first().click();
        await lens(page, 'deps');
        expect(await page.locator('#sy-bar .hist-step').allTextContents()).toContain('Pakete');
        await page.click('#sy-bar .hist-back');
        expect(await page.locator('[data-lens="pk"]').getAttribute('aria-selected')).toBe('true');
        await page.click('#sy-bar .hist-back');
        expect(await count(page)).toEqual(before);
        expect(await page.locator('#av-left-body [role="radiogroup"][aria-label="Scope"] [aria-checked="true"]').textContent()).toBe('dev');
        await page.click('#sy-bar .hist-back');
        expect(await page.locator('#av-left-body [role="radiogroup"][aria-label="Scope"] [aria-checked="true"]').textContent()).toBe('Alle');
        expect(await page.locator('[data-sort="name"]').getAttribute('aria-checked')).toBe('true');
        await page.click('#sy-bar .hist-back');
        expect(await page.locator('[data-sort="find"]').getAttribute('aria-checked')).toBe('true');
        await page.close();
        // Sensitivity probe: with the push neutralised, a filter change leaves no way back.
        const probe = await open();
        await probe.page.evaluate(() => { (window as unknown as { __mapSystemsHistory: { push: () => void } }).__mapSystemsHistory.push = () => undefined; });
        await probe.page.locator('#av-left-body [role="radiogroup"][aria-label="Scope"] [data-v="dev"]').click();
        expect(await probe.page.locator('#sy-bar .hist-back').count()).toBe(0);
        expect([...errors, ...probe.errors]).toEqual([]);
        await probe.page.close();
    });
});
