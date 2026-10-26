// road-to-a-control-that-matches-its-neighbours 3.4: sibling-reference mode.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import {
    captureSiblingPair,
    chromiumAvailable,
    compareSiblingBoxes,
    type BoxReading,
} from '../../src/scripts/ui_conformance_probe.js';

const BASE: BoxReading = { height_px: 36, padding_x_px: 12, padding_y_px: 0, radius_px: 6, font_size_px: 14, border_px: 1 };

describe('compareSiblingBoxes', () => {
    it('reports each metric off its sibling, with the delta', () => {
        const f = compareSiblingBoxes({ ...BASE, padding_x_px: 20, radius_px: 6 }, BASE);
        expect(f).toEqual([{ metric: 'padding_x_px', subject: 20, sibling: 12, delta_px: 8 }]);
    });

    it('a deviation inside the tolerance is not a finding', () => {
        expect(compareSiblingBoxes({ ...BASE, height_px: 38 }, BASE, 2)).toEqual([]);
        expect(compareSiblingBoxes({ ...BASE, height_px: 38 }, BASE, 1)).toHaveLength(1);
    });
});

describe('captureSiblingPair — live', () => {
    const live = chromiumAvailable();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sibling-probe-'));
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it.skipIf(!live)('measures the padding of a new select against the input beside it', async () => {
        const html = path.join(dir, 'index.html');
        fs.writeFileSync(
            html,
            `<!doctype html><style>
               .field { height: 36px; padding: 0 12px; border: 1px solid #999; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
               #status { height: 30px; padding: 0 4px; border: 1px solid #999; font-size: 13px; }
             </style>
             <input id="customer" class="field"><select id="status"><option>Open</option></select>`,
        );
        const { subject, sibling } = await captureSiblingPair(html, '#status', '#customer');
        const f = compareSiblingBoxes(subject, sibling);
        expect(f.map((x) => x.metric).sort()).toEqual(['font_size_px', 'height_px', 'padding_x_px', 'radius_px']);
        expect(f.find((x) => x.metric === 'padding_x_px')).toMatchObject({ subject: 4, sibling: 12 });
    }, 60_000);
});
