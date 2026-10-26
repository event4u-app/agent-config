// road-to-a-control-that-matches-its-neighbours 3.7: region regression against
// an approved baseline, by computed style rather than pixels.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { compareRegion, regionReading, type RegionNode } from '../../src/cli/commands/uiRenderRegion.js';
import { chromiumAvailable } from '../../src/scripts/ui_conformance_probe.js';

const NODE: RegionNode = {
    tag: 'select',
    role: '',
    width: 200,
    height: 36,
    padding: '0px 12px 0px 12px',
    radius: '6px',
    color: 'rgb(0, 0, 0)',
    background: 'rgb(255, 255, 255)',
    border: '1px solid rgb(153, 153, 153)',
    font_size: '14px',
    font_family: 'Inter',
};

describe('compareRegion', () => {
    it('a padding change is a fail with the property named', () => {
        const r = compareRegion([NODE], [{ ...NODE, padding: '0px 4px 0px 4px' }]);
        expect(r.status).toBe('fail');
        expect(r.deltas[0]).toMatchObject({ property: 'padding', baseline: '0px 12px 0px 12px' });
    });

    it('a changed node sequence is one structure delta, not index-paired noise', () => {
        const r = compareRegion([NODE], [NODE, { ...NODE, tag: 'ul', role: 'listbox' }]);
        expect(r).toEqual({ status: 'fail', deltas: [expect.objectContaining({ property: 'structure' })] });
    });

    it('only the resolved family (and the width it moves) differs → degraded, not fail', () => {
        const r = compareRegion([NODE], [{ ...NODE, font_family: 'Arial', width: 204 }]);
        expect(r.status).toBe('degraded');
    });

    it('sub-pixel size noise inside the tolerance is a pass', () => {
        expect(compareRegion([NODE], [{ ...NODE, height: 36.5 }]).status).toBe('pass');
    });
});

describe('regionReading — live', () => {
    const live = chromiumAvailable();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'region-'));
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    async function run(html: string, approve: boolean) {
        const { chromium } = await import('@playwright/test');
        const browser = await chromium.launch();
        try {
            const page = await browser.newPage();
            const file = path.join(dir, 'index.html');
            fs.writeFileSync(file, html);
            await page.goto(`file://${file}`);
            return await regionReading(page, '#filters', path.join(dir, 'baseline.json'), approve);
        } finally {
            await browser.close();
        }
    }

    const page = (pad: number) =>
        `<!doctype html><div id="filters"><input style="height:36px;padding:0 12px"><select style="height:36px;padding:0 ${pad}px"></select></div>`;

    it.skipIf(!live)('no baseline is no-baseline; approve, then a padding regression fails', async () => {
        expect((await run(page(12), false)).status).toBe('no-baseline');
        expect((await run(page(12), true)).status).toBe('pass');
        expect((await run(page(12), false)).status).toBe('pass');
        const regressed = await run(page(4), false);
        expect(regressed.status).toBe('fail');
        expect(regressed.deltas.some((d) => d.property === 'padding')).toBe(true);
    }, 90_000);
});
