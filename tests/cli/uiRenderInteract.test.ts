// road-to-a-control-that-matches-its-neighbours 3.5: the open state is captured,
// a popup clipped by a scrolling dialog is reported, a native select is never
// reported as a captured open state.
import * as fs from 'node:fs';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Page } from '@playwright/test';
import { afterAll, describe, expect, it } from 'vitest';

import { runUiRender } from '../../src/cli/commands/uiRender.js';
import { interactWith } from '../../src/cli/commands/uiRenderInteract.js';
import { chromiumAvailable } from '../../src/scripts/ui_conformance_probe.js';

const PAGE = `<!doctype html><html><body>
<div id="dialog-body" style="position:relative;height:120px;overflow-y:auto;border:1px solid #ccc">
  <div style="height:90px"></div>
  <div style="position:relative">
    <button id="country" aria-haspopup="listbox" style="height:36px;padding:0 12px;border-radius:6px"
      onclick="document.getElementById('list').style.display='block'">Country</button>
    <ul id="list" role="listbox" style="display:none;position:absolute;top:36px;left:0;margin:0;height:160px;width:200px;background:#fff;z-index:10">
      <li role="option">Austria</li><li role="option">Germany</li>
    </ul>
  </div>
</div>
<select id="native"><option>Open</option></select>
<script>
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.getElementById('list').style.display = 'none'; });
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('#country') && !e.target.closest('#list')) document.getElementById('list').style.display = 'none'; });
</script>
</body></html>`;

describe('interactWith — live', () => {
    const live = chromiumAvailable();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'interact-'));
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
        const { chromium } = await import('@playwright/test');
        const browser = await chromium.launch();
        try {
            const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
            const file = path.join(dir, 'index.html');
            fs.writeFileSync(file, PAGE);
            await page.goto(`file://${file}`);
            return await fn(page);
        } finally {
            await browser.close();
        }
    }

    it.skipIf(!live)('captures the open listbox and reports the scroll container that clips it', async () => {
        const r = await withPage((page) => interactWith(page, '#country', dir, 0));
        expect(r.open_state).toBe('captured');
        expect(r.role).toBe('select');
        expect(r.popup.popup).toBe('page');
        expect(r.popup.clipped_by).toBe('#dialog-body');
        expect(r.closes_on_escape).toBe(true);
        expect(r.closes_on_outside_click).toBe(true);
        expect(r.box).toMatchObject({ height_px: 36, padding_x_px: 12, radius_px: 6, source: 'render' });
        expect(fs.existsSync(r.screenshot!)).toBe(true);
    }, 60_000);

    it.skipIf(!live)('a native select is native-os and never a captured open state', async () => {
        const r = await withPage((page) => interactWith(page, '#native', dir, 1));
        expect(r.open_state).toBe('not-captured');
        expect(r.popup.popup).toBe('native-os');
        expect(r.reason).toContain('base-select');
    }, 60_000);

    it.skipIf(!live)('a selector that matches nothing is a reading with a reason, not a throw', async () => {
        const r = await withPage((page) => interactWith(page, '#nope', dir, 2));
        expect(r).toMatchObject({ found: false, open_state: 'not-captured' });
    }, 60_000);
});

// road-to-design-inputs-and-pages-read-as-they-are 4.3 / AC-4: interacting with
// a URL target clicks a real control; a click that submits must never reach
// the server, and nothing may leave the origin.
describe('ui:render --interact on a URL target — live, loopback only', () => {
    const live = chromiumAvailable();

    // skip-reason: tool absent — needs a local Chromium; runs under AGENT_CONFIG_BROWSER_SUITES=1
    it.skipIf(!live)('a submitting click is aborted and recorded; an off-origin request is blocked', async () => {
        const writes: string[] = [];
        const server = http.createServer((req, res) => {
            if (req.method !== 'GET' && req.method !== 'HEAD') writes.push(`${req.method} ${req.url}`);
            res.setHeader('content-type', 'text/html');
            res.end(`<!doctype html><html><body>
<form method="post" action="/cart/delete"><button id="del" type="submit">Delete</button></form>
<img src="http://127.0.0.2:9/pixel.gif" alt="">
</body></html>`);
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        const port = (server.address() as AddressInfo).port;
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'interact-url-'));
        try {
            const code = await runUiRender({ target: `http://127.0.0.1:${port}/`, projectRoot: dir, slug: 'url', interact: ['#del'] });
            expect(code).toBe(0);
            const manifest = JSON.parse(
                fs.readFileSync(path.join(dir, 'agents', 'runtime', 'state', 'render', 'url', 'manifest.json'), 'utf8'),
            );
            expect(writes).toEqual([]);
            expect(manifest.network.aborted.some((r: string) => r.startsWith('POST ') && r.endsWith('/cart/delete'))).toBe(true);
            expect(manifest.network.blocked.some((u: string) => u.startsWith('http://127.0.0.2:9/'))).toBe(true);
        } finally {
            server.close();
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }, 180_000);
});
