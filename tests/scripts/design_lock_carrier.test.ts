// road-to-a-canvas-the-code-owns 0.5 + 8.2 — a declared Consistency Lock gets a carrier.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { checkFile, newDrift, parseLocks } from '../../src/scripts/_lib/design_lock.js';
import { loadDesignContext, scanFile } from '../../src/scripts/lint_design_slop.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const DESIGN_MD = '# Design\n\n## Consistency Locks\n- Colour Lock: teal\n- Shape Lock: one corner-radius scale — 6/12/16px\n';
const CSS = '.cta {\n  background: #e11d48;\n  border-radius: 10px;\n  color: #14b8a6;\n  border: 1px solid #e5e7eb;\n}\n';

describe('design lock carrier', () => {
    it('control: the D6 fixture yields a rebuttable finding for #e11d48, which lint_design_slop never produced', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-lock-'));
        fs.writeFileSync(path.join(dir, 'DESIGN.md'), DESIGN_MD);
        const slop = scanFile(CSS, 'cta.css', loadDesignContext(dir));
        expect(slop.some((f) => f.snippet?.includes('#e11d48'))).toBe(false);
        const findings = checkFile('cta.css', CSS, parseLocks(DESIGN_MD));
        expect(findings.filter((f) => f.lock === 'colour').map((f) => f.value)).toEqual(['#e11d48']);
    });

    it('a radius outside the Shape Lock set is flagged; neutrals and in-family accents are not', () => {
        const findings = checkFile('cta.css', CSS, parseLocks(DESIGN_MD));
        expect(findings.map((f) => [f.line, f.lock, f.value])).toEqual([
            [2, 'colour', '#e11d48'],
            [3, 'shape', '10px'],
        ]);
    });

    it('a template placeholder declares no Lock', () => {
        const locks = parseLocks('- Colour Lock: [one accent family] — [the accent hue]\n- Shape Lock: [one corner-radius scale]\n');
        expect(locks).toEqual({ hues: [], radius: null, spacing: null });
        expect(checkFile('cta.css', CSS, locks)).toEqual([]);
    });

    it('a brownfield baseline counts only new drift', () => {
        const all = checkFile('cta.css', CSS, parseLocks(DESIGN_MD));
        expect(newDrift(all, [{ file: 'cta.css', value: '#E11D48' }]).map((f) => f.value)).toEqual(['10px']);
    });

    it('the CLI flags and never fails the run', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-lock-cli-'));
        fs.writeFileSync(path.join(dir, 'DESIGN.md'), DESIGN_MD);
        fs.writeFileSync(path.join(dir, 'cta.css'), CSS);
        const r = spawnSync(path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx'), [path.join(REPO_ROOT, 'src/scripts/design_lock.ts'), '--design-md', 'DESIGN.md', 'cta.css'], {
            cwd: dir,
            encoding: 'utf-8',
            timeout: 60_000,
        });
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('2 value(s) outside a declared Lock');
    });

    it('an unreadable or non-array baseline is an argument error (2), never a crash', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-lock-base-'));
        fs.writeFileSync(path.join(dir, 'DESIGN.md'), DESIGN_MD);
        fs.writeFileSync(path.join(dir, 'cta.css'), CSS);
        fs.writeFileSync(path.join(dir, 'bad.json'), '{ not json');
        fs.writeFileSync(path.join(dir, 'obj.json'), '{"file":"x"}');
        for (const base of ['bad.json', 'obj.json', 'absent.json']) {
            const r = spawnSync(path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx'), [path.join(REPO_ROOT, 'src/scripts/design_lock.ts'), '--baseline', base, 'cta.css'], {
                cwd: dir,
                encoding: 'utf-8',
                timeout: 60_000,
            });
            expect(r.status, `${base}: ${r.stderr}`).toBe(2);
            expect(r.stderr).toContain(`--baseline ${base}`);
        }
    }, 120_000);
});
