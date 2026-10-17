/**
 * The page profile keeps the declared family and adds the painted one — step
 * 1.3 of `road-to-type-with-a-witness`.
 *
 * Reproduced before this step: for `"Not Installed X", Georgia, serif` the
 * witness reported `not installed x`, a family that painted nothing. The
 * fixture here uses faces built in memory (decision A7) so the painted family
 * is the same on every host: the first family is not installed, the second is
 * a webfont whose file is missing, the third is a webfont that loads.
 *
 * A real Chromium is launched, so this is a browser suite: it is excluded from
 * the sharded matrix in `vitest.config.ts` (run it locally with
 * `AGENT_CONFIG_BROWSER_SUITES=1`) and runs in the `svg-witness-tests` job
 * through the import at the foot of `ui_render_asset_profile.test.ts`.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { collectPaintedFamilies, collectTypeFamilies, runUiRender } from '../../src/cli/commands/uiRender.js';
import type { RenderManifest } from '../../src/cli/commands/uiRender.js';
import { buildTestFace } from '../_lib/test_truetype_face.js';

let tmpRoot: string;

beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-render-painted-'));
    fs.writeFileSync(path.join(tmpRoot, 'backup.ttf'), buildTestFace({ family: 'Backup Face' }));
});

afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});

const PAGE =
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
    '@font-face{font-family:"Gone Face";src:url(gone-404.ttf) format("truetype")}' +
    '@font-face{font-family:"Backup Face";src:url(backup.ttf) format("truetype")}' +
    'h1{font-family:"Not Installed X","Gone Face","Backup Face",serif}' +
    'p{font-family:monospace}' +
    '</style></head><body><h1>Hamburgefonstiv</h1><p>Body copy</p></body></html>';

describe('ui:render page profile — declared and painted', () => {
    it('the collector reads painted families only from nodes that carry text', () => {
        expect(
            collectPaintedFamilies([
                { 'font-family': '"Not Installed X", serif', 'painted-family': 'serif' },
                { 'font-family': 'Inter' },
                { 'font-family': 'monospace', 'painted-family': 'monospace' },
                { 'font-family': 'serif', 'painted-family': 'serif' },
            ]),
        ).toEqual(['monospace', 'serif']);
        expect(collectPaintedFamilies([{ 'font-family': 'Inter' }])).toEqual([]);
    });

    it(
        'the first declared family is kept and the family that painted is added',
        async () => {
            const file = path.join(tmpRoot, 'page.html');
            fs.writeFileSync(file, PAGE);
            const code = await runUiRender({ target: file, projectRoot: tmpRoot, slug: 'painted' });
            expect(code).toBe(0);
            const manifest = JSON.parse(
                fs.readFileSync(path.join(tmpRoot, 'agents', 'runtime', 'state', 'render', 'painted', 'manifest.json'), 'utf8'),
            ) as RenderManifest;
            // Declared, unchanged: the A1.5 threshold and the preserve check read this.
            expect(manifest.type_families).toContain('not installed x');
            // Painted, per sampled node in the styles the manifest points at:
            // the missing webfont is skipped and the loaded one painted. The
            // manifest itself gains no key (its page key set is pinned, E8).
            expect(Object.keys(manifest)).not.toContain('painted_families');
            const records: Array<Record<string, string>> = [];
            for (const capture of manifest.captures) {
                records.push(...(JSON.parse(fs.readFileSync(path.join(tmpRoot, capture.styles), 'utf8')) as typeof records));
            }
            const h1 = records.find((r) => r['selector'] === 'h1');
            expect(h1?.['font-family']).toMatch(/^"Not Installed X"/);
            expect(h1?.['painted-family']).toBe('backup face');
            const painted = collectPaintedFamilies(records);
            expect(painted).toEqual(['backup face', 'monospace']);
            expect(painted).not.toContain('not installed x');
            expect(painted).not.toContain('gone face');
            // The declared collector is untouched by the new key.
            expect(collectTypeFamilies([{ 'font-family': 'A, B', 'painted-family': 'b' }])).toEqual(['a']);
        },
        90_000,
    );
});
