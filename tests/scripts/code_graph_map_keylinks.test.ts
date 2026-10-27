/**
 * Key links in the Data ERD: a declared foreign key, a soft relation the code
 * states (an ORM relation's key, a raw-SQL join) with no constraint in the
 * database, and a same-name key nothing states. The payload carries them at
 * both ends; the page draws them column to column with one icon per line, a
 * popup per icon; the wheel zooms and a drag pans, and only moving a table needs
 * Ctrl / ⌘ held.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { queryLinks } from '../../src/scripts/code_graph/lanes/data/query_links.js';
import { buildMap } from '../../src/scripts/code_graph/map.js';
import type { DataKeyLink, DataPayload, MapAreas } from '../../src/scripts/code_graph/map_areas.js';

const FX = path.resolve(__dirname, '../fixtures/code-graph');
let root: string;
let html: string;
let data: DataPayload;
let browser: Browser;

function migration(table: string, body: string): string {
    return `<?php\n\nuse Illuminate\\Database\\Migrations\\Migration;\nuse Illuminate\\Database\\Schema\\Blueprint;\nuse Illuminate\\Support\\Facades\\Schema;\n\nreturn new class extends Migration\n{\n    public function up(): void\n    {\n        Schema::create('${table}', function (Blueprint $table) {\n            $table->id();\n${body}\n            $table->timestamps();\n        });\n    }\n};\n`;
}

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-keylinks-')));
    fs.cpSync(path.join(FX, 'correctness/p1-blog'), root, { recursive: true });
    const mig = path.join(root, 'database/migrations');
    fs.writeFileSync(path.join(mig, '2024_03_01_000001_create_customers_table.php'), migration('customers', "            $table->string('name');"));
    fs.writeFileSync(path.join(mig, '2024_03_01_000002_create_orders_table.php'), migration('orders', "            $table->unsignedBigInteger('customer_id');"));
    fs.writeFileSync(path.join(mig, '2024_03_01_000003_create_invoices_table.php'), migration('invoices', "            $table->foreignId('customer_id')->constrained()->restrictOnDelete();"));
    fs.writeFileSync(path.join(mig, '2024_03_01_000004_create_payments_table.php'), migration('payments', "            $table->unsignedBigInteger('customer_id');"));
    fs.mkdirSync(path.join(root, 'app/Reports'), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'app/Reports/OrderReport.php'),
        "<?php\n\nnamespace App\\Reports;\n\nuse Illuminate\\Support\\Facades\\DB;\n\nclass OrderReport\n{\n    public function rows(): array\n    {\n        return DB::select('\n            SELECT c.name, count(*) AS n\n            FROM orders o\n            JOIN customers c ON o.customer_id = c.id\n            GROUP BY c.name\n        ');\n    }\n}\n",
    );
    fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
    const git = (...args: string[]): string => execFileSync('git', ['-C', root, '-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf-8' });
    git('init', '-q');
    git('add', '-A');
    git('commit', '-qm', 'base');
    const res = await buildMap(root);
    html = path.join(res.outDir, 'index.html');
    data = (JSON.parse(fs.readFileSync(path.join(res.outDir, 'code', 'map.json'), 'utf-8')) as { areas: MapAreas }).areas.data!;
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    fs.rmSync(root, { recursive: true, force: true });
});

const linksOf = (table: string, column: string): DataKeyLink[] => data.tables.find((t) => t.name === table)!.columns.find((c) => c.name === column)!.links ?? [];
const brief = (l: DataKeyLink): string => `${l.kind} ${l.direction} ${l.to.table}.${l.to.column} ${l.via.join('+')}`;

describe('the query join reader', () => {
    const cols: Record<string, string[]> = { orders: ['id', 'customer_id'], customers: ['id', 'name'] };
    const column = (t: string, c: string): string | undefined => (cols[t]?.includes(c) ? `column:${t}.${c}` : undefined);
    it('reads builder joins and qualified SQL equalities with their aliases, and nothing it cannot resolve', () => {
        const got = queryLinks(
            [
                { path: 'a.php', text: "DB::table('orders')->join('customers', 'orders.customer_id', '=', 'customers.id')->get();" },
                { path: 'b.ts', text: "knex('orders').leftJoin('customers as c', 'orders.customer_id', 'c.id');" },
                { path: 'c.sql', text: 'SELECT *\nFROM orders AS o\nJOIN customers c\n  ON o.customer_id = c.id' },
                { path: 'd.ts', text: 'node.id = other.id;\nWHERE customer_id = id\nFROM orders o JOIN customers c ON o.missing = c.id' },
            ],
            column,
        );
        expect(got.map((l) => `${l.witness.file}:${l.witness.line} ${l.a} ${l.b} ${l.via}`)).toEqual([
            'a.php:1 column:orders.customer_id column:customers.id builder',
            'b.ts:1 column:orders.customer_id column:customers.id builder',
            'c.sql:4 column:orders.customer_id column:customers.id sql',
        ]);
    });
});

describe('the payload carries every key link at both ends', () => {
    it('a declared FK, a soft relation from a query join, and an implied key on customers.id', () => {
        expect(linksOf('customers', 'id').map(brief)).toEqual(['fk in invoices.customer_id schema', 'soft in orders.customer_id query', 'implied in payments.customer_id name']);
        expect(linksOf('customers', 'id')[0]).toMatchObject({ onDelete: 'restrict' });
        expect(linksOf('orders', 'customer_id').map(brief)).toEqual(['soft out customers.id query']);
        expect(linksOf('orders', 'customer_id')[0]!.witnesses.map((w) => `${w.file}:${w.line}`)).toEqual(['app/Reports/OrderReport.php:14']);
        const implied = linksOf('payments', 'customer_id')[0]!;
        expect(data.findings[implied.finding!]).toMatchObject({ id: 'DR-13', subject: 'column:payments.customer_id' });
    });

    it('the ORM relation without a FK is soft and names DR-1; a real FK is fk with its delete rule', () => {
        const soft = linksOf('comments', 'post_id');
        expect(soft.map(brief)).toEqual(['soft out posts.id orm']);
        expect(data.findings[soft[0]!.finding!]).toMatchObject({ id: 'DR-1', subject: 'column:comments.post_id' });
        expect(data.findings[soft[0]!.finding!]!.fix).toContain('FOREIGN KEY');
        expect(linksOf('posts', 'user_id').map(brief)).toEqual(['fk out users.id schema']);
        expect(linksOf('posts', 'user_id')[0]).toMatchObject({ onDelete: 'cascade' });
        // A query join never also counts as a same-name suggestion: DR-13 is silent on orders.customer_id.
        expect(data.findings.some((f) => f.id === 'DR-13' && f.subject === 'column:orders.customer_id')).toBe(false);
    });
});

async function open(hash = '#/data', width = 1440, height = 1000): Promise<Page> {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(pathToFileURL(html).href + hash);
    await page.waitForFunction(() => (window as unknown as { __mapErd?: unknown }).__mapErd !== undefined);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    return page;
}

describe('the ERD draws key links', () => {
    it('Lines start on Focus around a table with a finding; All and Off are one click away', async () => {
        const page = await open();
        expect(await page.locator('.db-seg[aria-label="Lines"] button[aria-checked="true"]').getAttribute('data-v')).toBe('focus');
        const focus = await page.evaluate(() => (window as unknown as { __mapErd: { focus: string } }).__mapErd.focus);
        expect(focus).toBe('comments');
        const focused = await page.locator('.db-edges line').count();
        await page.click('.db-seg[aria-label="Lines"] button[data-v="all"]');
        expect(await page.locator('.db-edges line').count()).toBeGreaterThan(focused);
        await page.click('.db-seg[aria-label="Lines"] button[data-v="off"]');
        expect(await page.locator('.db-edges line').count()).toBe(0);
        await page.click('.db-seg[aria-label="Lines"] button[data-v="focus"]');
        await page.close();
    });

    it('no text label sits on a line: one icon per annotated line, and the legend names each icon', async () => {
        const page = await open();
        await page.click('.db-seg[aria-label="Lines"] button[data-v="all"]');
        expect(await page.locator('.db-elabel').count()).toBe(0);
        const fks = data.foreignKeys.length;
        expect(await page.locator('.db-world button.db-badge[data-icon="cascade"], .db-world button.db-badge[data-icon="restrict"], .db-world button.db-badge[data-icon="fk"], .db-world button.db-badge[data-icon="setnull"]').count()).toBe(fks);
        expect(await page.locator('.db-world button.db-badge[data-icon="soft"]').count()).toBeGreaterThan(0);
        expect(await page.locator('.db-legend .db-leg').evaluateAll((ls) => ls.map((l) => l.getAttribute('data-icon')))).toEqual(['fk', 'cascade', 'setnull', 'restrict', 'soft', 'implied', 'finding']);
        expect(await page.locator('.db-world button.db-badge').first().getAttribute('aria-label')).toMatch(/^Relation .+ — open details$/);
        await page.click('.db-seg[aria-label="Lines"] button[data-v="focus"]');
        await page.close();
    });

    it('picking customers.id highlights its three linked columns, draws one line per kind with its style, and the rail groups them', async () => {
        const page = await open();
        await page.locator('.db-table[data-table="customers"] .db-col[data-col="id"]').click();
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === 'column/customers.id');
        expect(await page.locator('.db-col.linked').evaluateAll((rs) => rs.map((r) => `${r.closest('.db-table')!.getAttribute('data-table')}.${r.getAttribute('data-col')} ${[...r.classList].find((c) => c.startsWith('lk-'))}`).sort())).toEqual([
            'invoices.customer_id lk-fk',
            'orders.customer_id lk-soft',
            'payments.customer_id lk-implied',
        ]);
        expect(await page.locator('.db-table.faded[data-table="users"]').count()).toBe(1);
        const kinds = await page.locator('.db-edges path.db-link').evaluateAll((ps) => ps.map((p) => p.getAttribute('data-kind')).sort());
        expect(kinds).toEqual(['fk', 'implied', 'soft']);
        const dash = (kind: string): Promise<string> => page.locator(`.db-edges path.db-link[data-kind="${kind}"]`).evaluate((p) => getComputedStyle(p).strokeDasharray);
        expect(await dash('fk')).toBe('none');
        expect(await dash('soft')).toMatch(/^7px,? 5px$/);
        expect(await dash('implied')).toMatch(/^1\.5px,? 4\.5px$/);
        expect(await page.locator('.db-world button.db-badge').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-icon')).sort())).toEqual(['implied', 'restrict', 'soft']);
        const rail = page.locator('#av-right-body');
        expect(await rail.locator('.db-links').evaluateAll((ss) => ss.map((s) => s.getAttribute('data-kind')))).toEqual(['fk', 'soft', 'implied']);
        expect(await rail.locator('.db-links[data-kind="soft"]').textContent()).toMatch(/orders\.customer_id[\s\S]*no constraint[\s\S]*app\/Reports\/OrderReport\.php:14/);
        expect(await rail.locator('.db-links[data-kind="implied"]').textContent()).toContain('DR-13');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === '');
        expect(await page.locator('path.db-link').count()).toBe(0);
        await page.close();
    });

    it('an icon opens a popup with both ends, the kind, the witnesses and the finding with its fix; Esc and an outside click close it', async () => {
        const page = await open('#/data/column%2Fcomments.post_id');
        const badge = page.locator('.db-world button.db-badge[data-icon="soft"]');
        expect(await badge.count()).toBe(1);
        await badge.click();
        const pop = page.locator('#db-pop');
        expect(await pop.isVisible()).toBe(true);
        const text = (await pop.textContent()) ?? '';
        expect(text).toContain('comments.post_id → posts.id');
        expect(text).toContain('soft relation (code only)');
        expect(text).toContain('app/Models/Comment.php:11');
        expect(text).toMatch(/DR-1[\s\S]*FOREIGN KEY/);
        await page.keyboard.press('Escape');
        expect(await pop.count()).toBe(0);
        await badge.focus();
        await page.keyboard.press('Enter');
        expect(await page.locator('#db-pop').count()).toBe(1);
        await page.mouse.click(5, 500);
        expect(await page.locator('#db-pop').count()).toBe(0);
        await badge.click();
        await page.locator('#db-pop .db-pop-pick').click();
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === 'column/posts.id');
        await page.close();
    });
});

describe('the wheel zooms and a drag pans; only moving a table needs Ctrl / ⌘', () => {
    it('a plain wheel over the stage zooms and the page stays; the help names the gestures', async () => {
        // A short window, so the page has somewhere to scroll.
        const page = await open('#/data', 1440, 640);
        const z = (): Promise<number> => page.evaluate(() => (window as unknown as { __mapErd: { z: number } }).__mapErd.z);
        const scroll = (): Promise<number> => page.evaluate(() => document.getElementById('av-main')!.scrollTop);
        const z0 = await z();
        const box = (await page.locator('#db-stage').boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, -200);
        await page.waitForTimeout(150);
        expect(await z()).toBeGreaterThan(z0);
        expect(await scroll()).toBe(0);
        // A trackpad pinch arrives as a wheel with Ctrl held; with Ctrl or ⌘ the wheel still zooms.
        for (const key of ['Control', 'Meta']) {
            const before = await z();
            await page.locator('#db-stage').dispatchEvent('wheel', { deltaY: -100, ctrlKey: key === 'Control', metaKey: key === 'Meta' });
            expect(await z(), key).toBeGreaterThan(before);
        }
        expect(await page.locator('.db-help').textContent()).toMatch(/^Drag to pan, wheel to zoom; hold (Ctrl|⌘) and drag to move a table/);
        await page.close();
    });

    it('a plain drag on a card pans and leaves the card where it is; with the modifier held it moves the card', async () => {
        const page = await open('#/data', 1440);
        const card = page.locator('.db-table[data-table="users"] .db-thead');
        const pos = (): Promise<string> => page.locator('.db-table[data-table="users"]').evaluate((c) => `${(c as HTMLElement).style.left},${(c as HTMLElement).style.top}`);
        const world = (): Promise<string> => page.locator('#db-stage .db-world').evaluate((w) => (w as HTMLElement).style.transform);
        const before = await pos();
        const w0 = await world();
        let b = (await card.boundingBox())!;
        await page.mouse.move(b.x + 20, b.y + 8);
        await page.mouse.down();
        await page.mouse.move(b.x + 140, b.y + 90, { steps: 5 });
        await page.mouse.up();
        expect(await pos()).toBe(before);
        expect(await world()).not.toBe(w0);
        await page.keyboard.down('Control');
        expect(await page.locator('#db-stage').getAttribute('class')).toContain('mod');
        b = (await card.boundingBox())!;
        await page.mouse.move(b.x + 20, b.y + 8);
        await page.mouse.down();
        await page.mouse.move(b.x + 140, b.y + 90, { steps: 5 });
        await page.mouse.up();
        await page.keyboard.up('Control');
        expect(await pos()).not.toBe(before);
        await page.close();
    });
});

describe('the ERD in 3D', () => {
    interface Erd3d { rot: number[]; front: string; hood: string[]; proj: Record<string, { x: number; y: number }> }
    const erd3 = (page: Page): Promise<Erd3d> => page.evaluate(() => (window as unknown as { __mapErd3d: Erd3d }).__mapErd3d);
    it('renders from the 2D / 3D toggle, Focus stays the default, and a picked table comes to the front with all its columns', async () => {
        const page = await open();
        expect(await page.locator('#av-main .dimseg button[aria-checked="true"]').getAttribute('data-dim')).toBe('2d');
        await page.click('#av-main .dimseg button[data-dim="3d"]');
        await page.waitForFunction(() => (window as unknown as { __mapErd3d?: unknown }).__mapErd3d !== undefined);
        // The picked table's neighbourhood are cards; every other table is a dot.
        const hood = (await erd3(page)).front;
        expect(hood).toBe('comments');
        expect(await page.locator('.db-3d .db-3card').count() + (await page.locator('.db-3d .db-3dot').count())).toBeGreaterThanOrEqual(data.tables.length - 1);
        expect(await page.locator('.db-seg[aria-label="Lines"] button[aria-checked="true"]').getAttribute('data-v')).toBe('focus');
        await page.locator('.db-3dot[data-table="customers"]').dispatchEvent('click');
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === 'table/customers');
        expect((await erd3(page)).front).toBe('customers');
        const cols = data.tables.find((t) => t.name === 'customers')!.columns.map((c) => c.name);
        expect(await page.locator('.db-3card.front[data-table="customers"] .db-col').evaluateAll((rs) => rs.map((r) => r.getAttribute('data-col')))).toEqual(cols);
        // Its neighbours are named chips without columns.
        expect(await page.locator('.db-3card.chip[data-table="invoices"] .db-col').count()).toBe(0);
        expect(await page.locator('.db-3card.chip[data-table="invoices"] .tn').textContent()).toBe('invoices');
        await page.close();
    });

    it('a plain drag turns it; the arrow keys turn it too', async () => {
        const page = await open();
        await page.click('#av-main .dimseg button[data-dim="3d"]');
        await page.waitForFunction(() => (window as unknown as { __mapErd3d?: unknown }).__mapErd3d !== undefined);
        const before = await erd3(page);
        const box = (await page.locator('#db-stage').boundingBox())!;
        const drag = async (): Promise<void> => {
            await page.mouse.move(box.x + 40, box.y + box.height - 40);
            await page.mouse.down();
            await page.mouse.move(box.x + 200, box.y + box.height - 80, { steps: 6 });
            await page.mouse.up();
        };
        await drag();
        const turned = await erd3(page);
        expect(turned.rot).not.toEqual(before.rot);
        expect(turned.proj['users']).not.toEqual(before.proj['users']);
        await page.locator('#db-stage').focus();
        await page.keyboard.press('ArrowLeft');
        expect((await erd3(page)).rot).not.toEqual(turned.rot);
        await page.close();
    });
});
