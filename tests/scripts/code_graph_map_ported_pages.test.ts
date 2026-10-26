import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';
import type { AgentPayload, ImpactPayload, InterfacesPayload, MapAreas } from '../../src/scripts/code_graph/map_areas.js';
import { sampleAreas, wit } from './code_graph_map_areas_fixture.js';

// The Interfaces, Impact and Agent pages as ported from their handovers: each
// element the handover draws is there, filled from the payload — counts,
// rows and states follow the payload, never a sample value — and what the map
// has no data for carries the no-data tag with its reason.

let browser: Browser;
let html: string;
let bare: string;
const roots: string[] = [];

const interfaces: InterfacesPayload = {
    reader: 'interfaces lane',
    completeness: 'complete',
    findings: [
        { id: 'IF-3', severity: 'medium', subject: 'app/Clients/Shop.php#Shop::order -> operation:shop:POST /orders', message: 'call parameters differ from the contract', completeness: 'complete', witnesses: [wit('app/Clients/Shop.php', 30), wit('contracts/shop.yaml', 12)] },
        { id: 'IF-9', severity: 'high', subject: 'operation:partner:GetStock', message: 'required parameter not passed', completeness: 'complete', witnesses: [wit('app/Clients/Partner.php', 22)] },
    ],
    services: [
        {
            name: 'partner', protocol: 'soap', direction: 'outbound', configNames: ['PARTNER_URL'], contracts: ['resources/wsdl/partner.wsdl'], witness: wit('app/Clients/Partner.php', 8),
            operations: [{ name: 'GetStock', method: 'GetStock', params: [{ name: 'sku', type: 'string', required: true }], callers: [wit('app/Http/StockController.php', 31, 'confirmed')], contract: wit('resources/wsdl/partner.wsdl', 40), witness: wit('resources/wsdl/partner.wsdl', 40) }],
        },
        {
            name: 'shop', protocol: 'rest', direction: 'outbound', configNames: [], contracts: ['contracts/shop.yaml'], witness: wit('app/Clients/Shop.php', 5),
            operations: [
                { name: 'GET /items', method: 'GET', path: '/items', params: [], callers: [], contract: wit('contracts/shop.yaml', 4), witness: wit('contracts/shop.yaml', 4) },
                { name: 'POST /orders', method: 'POST', path: '/orders', params: [{ name: 'qty', required: false }], callers: [wit('app/Clients/Shop.php', 30)], contract: wit('contracts/shop.yaml', 12), witness: wit('contracts/shop.yaml', 12) },
            ],
        },
    ],
};
const impact: ImpactPayload = {
    reader: 'review-risk over the working diff',
    completeness: 'complete',
    findings: [],
    rev: 'HEAD',
    changed: ['app/Clients/Shop.php', 'database/migrations/x.php'],
    affected: [
        { layer: 'code', name: 'app/Clients/Shop.php', why: 'changed by the diff', witness: wit('app/Clients/Shop.php', 1, 'confirmed') },
        { layer: 'code', name: 'Shop::order', why: 'calls a changed symbol', witness: wit('app/Clients/Shop.php', 30, 'changed') },
        { layer: 'data', name: 'orders.qty', why: 'redefined by the diff', witness: wit('database/migrations/x.php', 9) },
        { layer: 'tests', name: 'tests/ShopTest.php', why: 'tests a changed symbol', witness: wit('tests/ShopTest.php', 3, 'added') },
        { layer: 'delivery', name: 'deploy', why: 'redefined by the diff', witness: wit('.github/workflows/ci.yml', 30) },
    ],
    risk: {
        total: 6,
        terms: [
            { term: 'callers', fact: '1 × weight 1 (first: Shop::order)', contribution: 1, count: 1, weight: 1, witness: wit('app/Clients/Shop.php', 30) },
            { term: 'columns', fact: '1 × weight 2 (first: orders.qty)', contribution: 2, count: 1, weight: 2 },
            { term: 'operations', fact: '0 × weight 3', contribution: 0, count: 0, weight: 3 },
            { term: 'pipelines', fact: '1 × weight 3 (first: deploy)', contribution: 3, count: 1, weight: 3 },
            { term: 'flows', fact: '0 × weight 2', contribution: 0, count: 0, weight: 2 },
            { term: 'area crossings', fact: '0 × weight 2', contribution: 0, count: 0, weight: 2 },
        ],
    },
};
const agent: AgentPayload = {
    reader: 'code-graph CLI and MCP surface',
    completeness: 'complete',
    findings: [],
    verbs: [
        { name: 'explain', answers: 'two hops around a symbol', cli: 'agent-config code-graph explain <symbol>', mcp: 'graph_node', input: 'one symbol', output: 'callers and callees', guarantee: 'no generated prose' },
        { name: 'review-risk', answers: 'a diff as a sum', cli: 'agent-config code-graph review-risk', mcp: 'graph_impact (review_risk)', input: '--diff <rev>', output: 'terms', guarantee: 'every term a fact' },
        { name: 'pack', answers: 'a verified pack', cli: 'agent-config code-graph pack "<task>"', input: 'a task', output: 'items', guarantee: 're-read' },
    ],
    contextPack: {
        returned: 3,
        total: 5,
        hasMore: true,
        budgetTokens: 400,
        usedTokens: 100,
        items: [
            { kind: 'file', name: 'app/Clients/Shop.php', why: 'changed by the diff', tokens: 30, witness: wit('app/Clients/Shop.php', 1, 'confirmed') },
            { kind: 'method', name: 'order', why: 'calls ← Shop', tokens: 40, witness: wit('app/Clients/Shop.php', 30, 'changed') },
            { kind: 'file', name: 'app/Old.php', why: 'imports → Shop', tokens: 30, witness: wit('app/Old.php', 2, 'gone') },
        ],
    },
};

async function drawn(areas: MapAreas): Promise<string> {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-ported-')));
    roots.push(root);
    fs.mkdirSync(path.join(root, 'agents'));
    fs.writeFileSync(path.join(root, 'a.ts'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(root, 'b.ts'), "import { a } from './a';\nexport const b = a;\n");
    const res = await buildMap(root, { areas });
    return path.join(res.outDir, 'index.html');
}
async function open(file: string, hash: string, width = 1440): Promise<{ page: Page; errors: string[] }> {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: 'dark', locale: 'en-US' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(pathToFileURL(file).href + hash);
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    return { page, errors };
}

beforeAll(async () => {
    html = await drawn({ ...sampleAreas(), interfaces, impact, agent });
    const { contextPack: _drop, ...noPack } = agent;
    const { risk: _risk, ...noRisk } = impact;
    bare = await drawn({ ...sampleAreas(), interfaces, impact: noRisk, agent: noPack });
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

describe('Interfaces', () => {
    it('lists every service in the left rail and every shown operation in the table; hiding a service hides its operations', async () => {
        const { page, errors } = await open(html, '#/interfaces');
        const ops = interfaces.services.reduce((n, s) => n + s.operations.length, 0);
        expect(await page.locator('#av-left-body .if-svc').count()).toBe(interfaces.services.length);
        expect(await page.locator('#av-main .if-orow:not(.if-ohead)').count()).toBe(ops);
        const shop = interfaces.services.find((s) => s.name === 'shop')!;
        await page.locator('#av-left-body .if-svc', { hasText: 'shop' }).click();
        expect(await page.locator('#av-main .if-orow:not(.if-ohead)').count()).toBe(ops - shop.operations.length);
        expect(await page.locator('#av-left-body .if-svc[aria-checked="false"]').count()).toBe(1);
        await page.locator('#av-left-body .rl-mini').first().click();
        expect(await page.locator('#av-main .if-orow:not(.if-ohead)').count()).toBe(ops);
        expect(errors).toEqual([]);
        await page.close();
    });

    it('the state of an operation is its worst finding, then whether anything calls it', async () => {
        const { page } = await open(html, '#/interfaces');
        const row = (name: string) => page.locator('#av-main .if-orow', { hasText: name }).locator('.st');
        expect(await row('GetStock').textContent()).toBe('breaking-risk');
        expect(await row('POST /orders').textContent()).toBe('needs-review');
        expect(await row('GET /items').textContent()).toBe('not called');
        await page.close();
    });

    it('a picked operation fills the right rail: its parameters, callers and findings; auth and retry say they have no data', async () => {
        const { page } = await open(html, '#/interfaces/' + encodeURIComponent('operation/partner/GetStock'));
        const rail = page.locator('#av-right-body');
        expect(await rail.locator('.if-opname').textContent()).toBe('GetStock');
        expect(await rail.locator('.if-param').count()).toBe(1);
        expect(await rail.locator('.if-caller').count()).toBe(1);
        expect(await rail.locator('.if-find').allTextContents()).toEqual([expect.stringContaining('IF-9')]);
        expect(await rail.locator('.if-kv .nodata-tag').count()).toBe(2);
        await page.close();
    });

    it('the flow ends in no-data steps where the reader stops, and the contract view lists the findings with a contract witness', async () => {
        const { page } = await open(html, '#/interfaces/' + encodeURIComponent('operation/shop/POST /orders'));
        await page.locator('[role="tab"]', { hasText: 'Flow' }).click();
        expect(await page.locator('.if-node').count()).toBe(6);
        expect(await page.locator('.if-node.nodata').count()).toBe(3);
        await page.locator('[role="tab"]', { hasText: 'Contract change' }).click();
        const withContract = interfaces.findings.filter((f) => f.witnesses.some((w) => w.file === 'contracts/shop.yaml'));
        expect(await page.locator('.if-drow').count()).toBe(withContract.length);
        await page.close();
    });
});

describe('Impact', () => {
    it('the change bar names every changed file; the layer boxes count every affected item once', async () => {
        const { page, errors } = await open(html, '#/impact');
        const value = await page.locator('#im-chg').inputValue();
        for (const f of impact.changed) expect(value).toContain(f);
        expect(await page.locator('#av-bar .st').first().textContent()).toContain(String(impact.risk!.total));
        const counts = (await page.locator('.im-lcount').allTextContents()).map((s) => Number.parseInt(s, 10)).filter((n) => !Number.isNaN(n));
        expect(counts.reduce((a, b) => a + b, 0)).toBe(impact.affected.length);
        expect(await page.locator('.im-layer').count()).toBe(6);
        expect(await page.locator('.im-layer.unk .nodata-tag').count()).toBe(1);
        expect(errors).toEqual([]);
        await page.close();
    });

    it('a layer with a changed witness asks to check the conflict, one with an added witness is extended', async () => {
        const { page } = await open(html, '#/impact');
        const chip = (name: string) => page.locator('.im-layer', { hasText: name }).locator('.im-lhead .st');
        expect(await chip('Code').textContent()).toBe('check conflict');
        expect(await chip('Tests').textContent()).toBe('extended');
        expect(await chip('Integrations').textContent()).toBe('not affected');
        await page.close();
    });

    it('the protocol steps forward and back; the tally fills as the steps that need it are reached', async () => {
        const { page } = await open(html, '#/impact');
        expect(await page.locator('.im-step').count()).toBe(7);
        const now = () => page.locator('.im-step.run .im-dot').textContent();
        const start = Number(await now());
        await page.locator('.im-next').click();
        expect(Number(await now())).toBe(start + 1);
        await page.locator('.im-reset').click();
        expect(await now()).toBe('1');
        expect(await page.locator('.im-tile').first().locator('.im-tv').textContent()).toBe(String(impact.affected.length));
        expect(await page.locator('.im-tile.b-green .im-tv').textContent()).toBe('–');
        for (let i = 0; i < 7; i += 1) await page.locator('.im-next').click();
        const confirmed = impact.affected.filter((a) => a.witness.confirm === 'confirmed').length;
        expect(await page.locator('.im-tile.b-green .im-tv').textContent()).toBe(String(confirmed));
        expect(await page.locator('.im-next').isDisabled()).toBe(true);
        await page.close();
    });
});

describe('Agent', () => {
    it('the views sit in the bar; the request rail lists every verb; the pack table holds every item with its state', async () => {
        const { page, errors } = await open(html, '#/agent');
        expect(await page.locator('#av-bar [role="tab"]').count()).toBe(3);
        expect(await page.locator('#av-left-body .ag-verb .ag-vname').allTextContents()).toEqual(agent.verbs.map((v) => v.name));
        expect(await page.locator('.ag-prow:not(.ag-phead)').count()).toBe(agent.contextPack!.items.length);
        expect(await page.locator('.ag-pname.gone').count()).toBe(agent.contextPack!.items.filter((i) => i.witness.confirm === 'gone').length);
        expect(await page.locator('.ag-kpi').first().textContent()).toContain(`${agent.contextPack!.returned} / ${agent.contextPack!.total}`);
        expect(await page.locator('.ag-pfoot').textContent()).toContain(String(agent.contextPack!.total - agent.contextPack!.returned));
        // The rail opens on the first item that needs attention.
        expect(await page.locator('#av-right-body .ag-iname').textContent()).toBe('order');
        expect(errors).toEqual([]);
        await page.close();
    });

    it('review risk shows each term as count × weight and the sum; verbs show their contracts', async () => {
        const { page } = await open(html, '#/agent');
        await page.locator('[role="tab"]', { hasText: 'Review risk' }).click();
        expect(await page.locator('.ag-rrow:not(.ag-rh)').count()).toBe(impact.risk!.terms.length);
        expect(await page.locator('.ag-rsum .ag-rv').textContent()).toBe(String(impact.risk!.total));
        await page.locator('[role="tab"]', { hasText: 'Verbs & contracts' }).click();
        expect(await page.locator('.ag-card').count()).toBe(agent.verbs.length);
        await page.close();
    });

    it('the banner says the real state; a preview says it is one and marks every item unknown when unverifiable', async () => {
        const { page } = await open(html, '#/agent');
        const real = await page.locator('.ag-banner .st').textContent();
        await page.locator('.ag-fresh [role="radio"]', { hasText: 'unverifiable' }).click();
        expect(await page.locator('.ag-banner .st').textContent()).toBe('UNVERIFIABLE');
        expect(await page.locator('.ag-bmeta').textContent()).toContain('preview');
        expect(await page.locator('.ag-prow:not(.ag-phead) .ag-pst').allTextContents()).toEqual(agent.contextPack!.items.map(() => 'unknown'));
        await page.locator('.ag-fresh [role="radio"]', { hasText: real!.toLowerCase() }).click();
        expect(await page.locator('.ag-bmeta').textContent()).not.toContain('preview');
        await page.close();
    });

    it('without a pack or a risk the elements stay and say they have no data', async () => {
        const { page } = await open(bare, '#/agent');
        expect(await page.locator('.ag-kpi').count()).toBe(5);
        expect(await page.locator('.ag-kpi .nodata-tag').count()).toBe(5);
        expect(await page.locator('.ag-pempty .nodata-tag').count()).toBe(1);
        await page.locator('[role="tab"]', { hasText: 'Review risk' }).click();
        expect(await page.locator('.ag-pempty .nodata-tag').count()).toBe(1);
        await page.close();
    });
});
