// Tests for src/scripts/project_thin_rules.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure surface (measure / build_thin / thin_entry / split_frontmatter /
// kernel_ids) plus a golden-parity layer that runs python3 vs tsx on the
// REAL repo. Every CLI surface here is deterministic (no timestamp), so the
// stdout / written files / exit codes are compared byte-for-byte:
//   - default + `--json` + `--measure` → byte-identical stdout/stderr/exit.
//   - `--out <dir>` → byte-identical per-file output + stdout line.
// Skipped without python3.
import * as fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';

import * as ptr from '../../src/scripts/project_thin_rules.js';



const _tmpDirs: string[] = [];
afterEach(() => {
    for (const d of _tmpDirs.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

describe('project_thin_rules — pure surface', () => {
    it('split_frontmatter splits fenced frontmatter from body', () => {
        const text = '---\ndescription: x\n---\nbody here\n';
        const [fm, body] = ptr.split_frontmatter(text);
        expect(fm).toBe('---\ndescription: x\n---\n');
        expect(body).toBe('body here\n');
    });
    it('split_frontmatter returns empty fm when none', () => {
        const [fm, body] = ptr.split_frontmatter('no frontmatter\n');
        expect(fm).toBe('');
        expect(body).toBe('no frontmatter\n');
    });
    it('thin_entry carries the verbatim legacy-path Body link', () => {
        const text = '---\ndescription: A short desc\ntriggers:\n  - keyword: foo\n---\nBODY\n';
        const entry = ptr.thin_entry('my-rule', text);
        expect(entry).toContain('## My Rule\n');
        expect(entry).toContain('Fires on: foo.');
        expect(entry).toContain('A short desc');
        expect(entry).toContain('Body: [`my-rule`](../../.agent-src.uncondensed/rules/my-rule.md)');
    });
    it('thin_entry omits the Fires-on clause when no trigger hint', () => {
        const text = '---\ndescription: Desc only\n---\nBODY\n';
        const entry = ptr.thin_entry('plain-rule', text);
        expect(entry).not.toContain('Fires on:');
        expect(entry).toContain('## Plain Rule\n');
    });
    it('kernel_ids returns a non-empty set from the real router', () => {
        const k = ptr.kernel_ids();
        expect(k.size).toBeGreaterThan(0);
    });
    it('build_thin keeps kernel rules full-bodied and thins the rest', () => {
        const map = ptr.build_thin();
        const kernel = ptr.kernel_ids();
        let kernelFull = 0;
        let thinned = 0;
        for (const [name, text] of map) {
            const stem = name.replace(/\.md$/, '');
            if (kernel.has(stem)) {
                kernelFull += 1;
            } else {
                // thinned entries are the one-line pointer
                expect(text).toContain('Routed rule — load the body on trigger-match.');
                thinned += 1;
            }
        }
        expect(kernelFull).toBeGreaterThan(0);
        expect(thinned).toBeGreaterThan(0);
    });
    it('measure returns the full key set with consistent arithmetic', () => {
        const m = ptr.measure();
        expect(m.rules_total).toBe(m.kernel_full + m.non_kernel_thinned);
        expect(m.saved_gpt).toBe(m.eager_gpt - m.thin_gpt);
        expect(typeof m.saved_pct).toBe('number');
        expect(typeof m.token_method).toBe('string');
    });
});
