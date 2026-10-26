// road-to-tells-a-near-miss-can-refute 2.2: geometry and a dark pass on the page profile.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { runUiRender } from '../../src/cli/commands/uiRender.js';
import { chromiumAvailable } from '../../src/scripts/ui_conformance_probe.js';

const PAGE = `<!doctype html><html><head><style>
  .card { border: 1px solid #ccc; border-radius: 8px; padding: 16px; box-shadow: 0 2px 6px #0002; }
  .hidden { display: none; }
  @media (prefers-color-scheme: dark) { body { background: #111; color: #eee; } }
</style></head><body><main><section class="card"><div class="card"><p>Nested</p></div></section><p class="hidden">x</p></main></body></html>`;

describe('ui:render page geometry — live', () => {
    const live = chromiumAvailable();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-geom-'));
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it.skipIf(!live)('captures box, visibility and the ancestor chain, and a dark pass for a dark-declaring page', async () => {
        fs.writeFileSync(path.join(dir, 'index.html'), PAGE);
        const code = await runUiRender({ target: 'index.html', projectRoot: dir, slug: 'geom' });
        expect(code).toBe(0);
        const manifest = JSON.parse(
            fs.readFileSync(path.join(dir, 'agents', 'runtime', 'state', 'render', 'geom', 'manifest.json'), 'utf8'),
        );
        expect(manifest.captures.map((c: { viewport: string }) => c.viewport)).toContain('desktop-dark');
        const desktop = manifest.captures.find((c: { viewport: string }) => c.viewport === 'desktop');
        const rows: Array<Record<string, string>> = JSON.parse(fs.readFileSync(path.join(dir, desktop.styles), 'utf8'));
        const inner = rows.filter((r) => r['class'] === 'card')[1]!;
        expect(inner['rect']!.split(',')).toHaveLength(4);
        expect(inner['visible']).toBe('1');
        expect(inner['border-radius']).toBe('8px');
        const outerIndex = rows.findIndex((r) => r['class'] === 'card');
        expect(inner['parents']!.split(',')).toContain(String(outerIndex));
        expect(rows.find((r) => r['class'] === 'hidden')!['visible']).toBe('0');
    }, 120_000);
});
