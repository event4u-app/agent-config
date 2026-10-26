// road-to-tells-a-near-miss-can-refute 7.5: the export kit from one confirmed
// mark, byte-identical across two runs.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { exportKit, intrinsic, lockup, manifest } from '../../src/scripts/logo_export_kit.js';

const MARK =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="currentColor"/><path d="M20 34h24" stroke="#fff" stroke-width="6"/></svg>\n';

describe('the SVG half', () => {
    it('reads the intrinsic size from the viewBox', () => {
        expect(intrinsic(MARK)).toEqual({ w: 64, h: 64 });
    });

    it('a lockup nests the mark as vector and sets the scheme colour', () => {
        const l = lockup(MARK, 'Fernweh', '#111111');
        expect(l).toContain('color="#111111"');
        expect(l).toContain('<circle');
        expect(l).not.toContain('<image');
        expect(l).toContain('>Fernweh</text>');
    });

    it('the manifest names both icons', () => {
        expect(JSON.parse(manifest('Fernweh', '#ffffff')).icons.map((i: { src: string }) => i.src)).toEqual(['icon-192.png', 'icon-512.png']);
    });
});

describe('the whole kit', () => {
    it('is byte-identical across two runs from one fixture', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'logo-kit-'));
        const mark = path.join(root, 'mark.svg');
        fs.writeFileSync(mark, MARK);
        const a = await exportKit({ mark, name: 'Fernweh', out: path.join(root, 'a'), light: '#ffffff', dark: '#111111' });
        const b = await exportKit({ mark, name: 'Fernweh', out: path.join(root, 'b'), light: '#ffffff', dark: '#111111' });
        expect(a.written).toEqual(b.written);
        expect(a.written).toEqual(expect.arrayContaining(['mark.svg', 'favicon.svg', 'site.webmanifest', 'lockup-light.svg', 'lockup-dark.svg']));
        if (a.missing.length) {
            // No Chromium on this machine: the SVG half is still checked, and the
            // missing PNG half is reported rather than passed.
            expect(a.missing).toContain('favicon-16.png');
        } else {
            expect(a.written).toEqual(expect.arrayContaining(['mark@1x.png', 'mark@2x.png', 'favicon-16.png', 'favicon-32.png', 'icon-512.png']));
        }
        for (const f of a.written) {
            expect(fs.readFileSync(path.join(root, 'a', f)).equals(fs.readFileSync(path.join(root, 'b', f))), f).toBe(true);
        }
    }, 120_000);
});
