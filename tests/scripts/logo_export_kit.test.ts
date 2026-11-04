// road-to-tells-a-near-miss-can-refute 7.5: the export kit from one confirmed
// mark, byte-identical across two runs. road-to-a-mark-that-survives-16px 2.3:
// the kit carries an origin sidecar in the shape of the media transparency
// policy (agents/settings/policies/media/transparency.md).
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { exportKit, intrinsic, lockup, main, manifest } from '../../src/scripts/logo_export_kit.js';

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
        const opts = { mark, name: 'Fernweh', light: '#ffffff', dark: '#111111', created: '2026-11-03' };
        const a = await exportKit({ ...opts, out: path.join(root, 'a') });
        const b = await exportKit({ ...opts, out: path.join(root, 'b') });
        expect(a.written).toEqual(b.written);
        expect(a.written).toEqual(expect.arrayContaining(['mark.svg', 'favicon.svg', 'site.webmanifest', 'lockup-light.svg', 'lockup-dark.svg', 'mark.svg.provenance.json']));
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

describe('the origin sidecar', () => {
    const sha = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex');

    it('is written last, parses, and is bound to the bytes it describes', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'logo-kit-prov-'));
        const mark = path.join(root, 'mark.svg');
        fs.writeFileSync(mark, MARK);
        const out = path.join(root, 'kit');
        const r = await exportKit({ mark, name: 'Fernweh', out, light: '#ffffff', dark: '#111111', created: '2026-11-03' });
        expect(r.written[r.written.length - 1]).toBe('mark.svg.provenance.json');

        const prov = JSON.parse(fs.readFileSync(path.join(out, 'mark.svg.provenance.json'), 'utf8'));
        // The policy's required fields, in the shape embed-provenance.sh writes.
        expect(prov).toMatchObject({
            schema: 2,
            assertion: 'c2pa.ai_generated',
            label: 'generated',
            c2pa_action: 'c2pa.created',
            digital_source_type: 'trainedAlgorithmicMedia',
            provider: 'none',
            model: 'none',
            created: '2026-11-03',
            licence: 'unspecified',
            commercial: 'verify',
        });
        expect(prov.generator).toMatch(/logo_export_kit/);
        expect(prov.artifact_sha256).toBe(sha(fs.readFileSync(path.join(out, 'mark.svg'))));
        // Every other file of the kit is listed with the hash of its final bytes.
        const listed = (prov.kit as Array<{ file: string; sha256: string }>).map((k) => k.file);
        expect(listed).toEqual(r.written.filter((f) => f !== 'mark.svg.provenance.json'));
        for (const k of prov.kit as Array<{ file: string; sha256: string }>) {
            expect(k.sha256, k.file).toBe(sha(fs.readFileSync(path.join(out, k.file))));
        }
        expect(prov).not.toHaveProperty('prompt_sha256');
    }, 120_000);

    it('records a backend, a licence, a commercial status and an edit assertion when given', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'logo-kit-prov-'));
        const mark = path.join(root, 'mark.svg');
        fs.writeFileSync(mark, MARK);
        const out = path.join(root, 'kit');
        await exportKit({
            mark,
            name: 'Fernweh',
            out,
            light: '#ffffff',
            dark: '#111111',
            created: '2026-11-03',
            provenance: {
                backend: 'recraft',
                model: 'v3',
                licence: 'provider-tos',
                commercial: 'yes',
                assertion: 'ai_edited',
                promptSha256: 'a'.repeat(64),
            },
        });
        const prov = JSON.parse(fs.readFileSync(path.join(out, 'mark.svg.provenance.json'), 'utf8'));
        expect(prov).toMatchObject({
            provider: 'recraft',
            model: 'v3',
            licence: 'provider-tos',
            commercial: 'yes',
            assertion: 'c2pa.ai_edited',
            label: 'modified',
            c2pa_action: 'c2pa.edited',
            digital_source_type: 'compositeWithTrainedAlgorithmicMedia',
            prompt_sha256: 'a'.repeat(64),
        });
    }, 120_000);

    it('refuses a commercial status outside yes|no|verify', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'logo-kit-prov-'));
        const mark = path.join(root, 'mark.svg');
        fs.writeFileSync(mark, MARK);
        const err = process.stderr.write.bind(process.stderr);
        process.stderr.write = (() => true) as typeof process.stderr.write;
        try {
            const code = await main([mark, '--name', 'X', '--out', path.join(root, 'k'), '--commercial', 'maybe']);
            expect(code).toBe(2);
        } finally {
            process.stderr.write = err;
        }
        expect(fs.existsSync(path.join(root, 'k'))).toBe(false);
    });
});
