/**
 * The conversion work-list generator.
 *
 * One property carries this script: a **findings** count is not a **corpus**
 * count. The first draft classified `errors.length` in `main()` as "the count
 * already exists at the exit path" and nominated 146 of 189 gates for a
 * mechanical `scanned:` line — i.e. it would have made 146 gates publish their
 * verdict as their coverage, which is risk #1 of the roadmap it serves
 * (manufactured green via invented counts) committed by the tool built to
 * prevent it. Every test below exists to keep that regression out.
 */
import { describe, expect, it } from 'vitest';

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { classifyGate } from '../../src/scripts/gate_scope_classify.js';

function withGate(source: string, name = 'check_probe'): ReturnType<typeof classifyGate> {
    const dir = mkdtempSync(join(tmpdir(), 'gate-classify-'));
    try {
        writeFileSync(join(dir, `${name}.ts`), source);
        return classifyGate(name, dir);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

describe('corpus vs findings', () => {
    it('does not count an accumulator of violations as a corpus', () => {
        const r = withGate(`
            export function main(): number {
                const violations: string[] = [];
                for (const f of somewhere()) { if (bad(f)) violations.push(f); }
                return violations.length > 0 ? 1 : 0;
            }
        `);
        expect(r.cls).toBe('no_corpus_count');
        expect(r.sites.every((s) => s.kind === 'findings')).toBe(true);
    });

    it('counts a walked corpus that is read at the exit path', () => {
        const r = withGate(`
            export function main(): number {
                const files = readdirSync(root);
                const errors: string[] = [];
                for (const f of files) { if (bad(f)) errors.push(f); }
                process.stdout.write(\`\${String(files.length)} file(s)\\n\`);
                return errors.length > 0 ? 1 : 0;
            }
        `);
        expect(r.cls).toBe('count_at_exit');
        expect(r.entry).toBe('main');
        expect(r.sites[0]?.kind).toBe('corpus');
        expect(r.sites[0]?.expr).toBe('files.length');
    });

    it('a name that reads as findings can never be a corpus, however it was built', () => {
        // `errors` derived from a real corpus is still the count of things wrong.
        const r = withGate(`
            export function main(): number {
                const files = readdirSync(root);
                const errors = files.filter(bad);
                return errors.length;
            }
        `);
        const errorSite = r.sites.find((s) => s.expr === 'errors.length');
        expect(errorSite?.kind).toBe('findings');
    });

    it('a loop index is bookkeeping, never a scanned count', () => {
        // `for (let i = 0; …) i += 1` matches the incremented-counter test that
        // finds a genuine tally. Publishing an index as `scanned:` would be the
        // invented count in its purest form.
        const r = withGate(`
            export function main(): number {
                let i = 0;
                for (i = 0; i < 10; i += 1) { touch(i); }
                return i;
            }
        `);
        expect(r.cls).toBe('no_corpus_count');
    });
});

describe('where the count lives', () => {
    it('separates a helper-only count from one the exit path can see', () => {
        const r = withGate(`
            function collectFiles(): number { const files = readdirSync(root); return files.length; }
            export function main(): number { return collectFiles() > 0 ? 0 : 1; }
        `);
        // The corpus exists, but main() never holds the number — hoisting it is a
        // real code decision, which is exactly why this is Phase 2, not Phase 1.
        expect(r.cls).toBe('count_in_helper');
    });

    it('reports a file:line for every site, so the work-list is checkable', () => {
        const r = withGate(`
            export function main(): number {
                const files = readdirSync(root);
                return files.length;
            }
        `);
        expect(r.sites[0]?.at).toMatch(/check_probe\.ts:\d+$/);
    });

    it('a gate with no entry function cannot be count_at_exit', () => {
        const r = withGate(`
            const files = readdirSync(root);
            export const total = files.length;
        `);
        expect(r.entry).toBeNull();
        expect(r.cls).toBe('count_in_helper');
    });
});
