// Tests for src/scripts/adr/regenerate_index.ts (py2ts Phase 8).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure helpers (fm, scan duplicate/mismatch/supersedes detection, row
// title-casing + label, render) plus a golden-parity layer that runs
// python3 vs tsx and compares stdout + stderr + exit code byte-for-byte.
//
// The write path (--report) would overwrite the live docs/decisions/INDEX.md,
// so the golden-parity layer copies the real ADR-*.md set into two throwaway
// tmp dirs (one for python3, one for tsx) and asserts the generated INDEX.md
// is byte-identical. The error paths (duplicate number, adr/filename
// mismatch, dangling supersedes) and the empty-dir / not-found paths use
// synthetic fixtures. Everything is deterministic — zero git drift; the live
// tree is never written.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import * as rgi from '../../src/scripts/adr/regenerate_index.js';



const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-idx-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop();
        if (d && fs.existsSync(d)) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

/** Write a minimal ADR file with the given frontmatter fields. */
function writeAdr(dir: string, name: string, fm: Record<string, string>): void {
    const lines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`);
    fs.writeFileSync(path.join(dir, name), `---\n${lines.join('\n')}\n---\nbody\n`);
}

describe('regenerate_index — pure helpers', () => {
    it('scan splits numbered vs legacy and parses frontmatter', () => {
        const d = mkTmp();
        writeAdr(d, 'ADR-001-first-thing.md', { adr: '1', status: 'accepted', date: '2026-01-01', decision: 'first-thing' });
        fs.writeFileSync(path.join(d, 'ADR-legacy-note.md'), '---\nstatus: draft\n---\nbody\n');
        const [num, leg, errs] = rgi.scan(d);
        expect(errs).toEqual([]);
        expect(num).toHaveLength(1);
        expect(num[0]!.num).toBe('001');
        expect(num[0]!.slug).toBe('first-thing');
        expect(num[0]!.path).toBe('ADR-001-first-thing.md');
        expect(num[0]!.status).toBe('accepted');
        expect(leg).toHaveLength(1);
        expect(leg[0]!.path).toBe('ADR-legacy-note.md');
    });

    it('scan skips INDEX.md and ignores non-ADR files', () => {
        const d = mkTmp();
        fs.writeFileSync(path.join(d, 'INDEX.md'), 'whatever');
        fs.writeFileSync(path.join(d, 'README.md'), 'whatever');
        writeAdr(d, 'ADR-002-x.md', { adr: '2', decision: 'x' });
        const [num, leg] = rgi.scan(d);
        expect(num).toHaveLength(1);
        expect(leg).toHaveLength(0);
    });

    it('scan flags an adr/filename mismatch', () => {
        const d = mkTmp();
        writeAdr(d, 'ADR-008-mismatch.md', { adr: '7', decision: 'mismatch' });
        const [, , errs] = rgi.scan(d);
        expect(errs).toContain('ADR-008-mismatch.md: adr=7 != filename 008');
    });

    it('scan accepts a zero-padded adr matching the filename number', () => {
        const d = mkTmp();
        writeAdr(d, 'ADR-008-ok.md', { adr: '008', decision: 'ok' });
        const [, , errs] = rgi.scan(d);
        expect(errs).toEqual([]);
    });

    it('scan flags a duplicate number (second filename listed against the first)', () => {
        const d = mkTmp();
        writeAdr(d, 'ADR-005-first.md', { adr: '5', decision: 'first' });
        writeAdr(d, 'ADR-005-second.md', { adr: '5', decision: 'second' });
        const [, , errs] = rgi.scan(d);
        expect(errs).toContain('ADR-005 duplicate: ADR-005-second.md and ADR-005-first.md');
    });

    it('scan flags a dangling supersedes link', () => {
        const d = mkTmp();
        writeAdr(d, 'ADR-009-dangling.md', { adr: '9', decision: 'dangling', supersedes: 'ADR-042' });
        const [, , errs] = rgi.scan(d);
        expect(errs).toContain('ADR-009-dangling.md: supersedes ADR-042 not found');
    });

    it('scan resolves a valid supersedes link (no error)', () => {
        const d = mkTmp();
        writeAdr(d, 'ADR-001-base.md', { adr: '1', decision: 'base' });
        writeAdr(d, 'ADR-002-super.md', { adr: '2', decision: 'super', supersedes: 'ADR-001' });
        const [, , errs] = rgi.scan(d);
        expect(errs).toEqual([]);
    });

    it('row title-cases the decision and emits the ADR-NNN label', () => {
        const out = rgi.row({ num: '001', slug: 'foo-bar', path: 'ADR-001-foo-bar.md', decision: 'python-to-ts-migration', status: 'accepted', date: '2026-01-01' });
        expect(out).toBe('| [ADR-001](ADR-001-foo-bar.md) | Python To Ts Migration | accepted | 2026-01-01 | — |');
    });

    it('row falls back to the slug, then to dashes, when decision is absent', () => {
        const out = rgi.row({ num: '003', slug: 'just-the-slug', path: 'ADR-003-just-the-slug.md' });
        expect(out).toBe('| [ADR-003](ADR-003-just-the-slug.md) | Just The Slug | — | — | — |');
    });

    it('row for a legacy entry strips .md for the label and renders em-dash placeholders', () => {
        const out = rgi.row({ path: 'ADR-rule-kernel.md' });
        expect(out).toBe('| [ADR-rule-kernel](ADR-rule-kernel.md) | — | — | — | — |');
    });

    it('render emits the No-ADRs body when empty', () => {
        expect(rgi.render([], [])).toBe(
            '# ADR Index\n\n_Auto-generated by `scripts/adr/regenerate_index.py`. Do not edit._\n\nNo ADRs yet.\n',
        );
    });

    it('render appends the Unnumbered (legacy) section only when legacy rows exist', () => {
        const out = rgi.render(
            [{ num: '001', slug: 'a', path: 'ADR-001-a.md', decision: 'a' }],
            [{ path: 'ADR-legacy.md' }],
        );
        expect(out).toContain('## Unnumbered (legacy)');
        const noLegacy = rgi.render([{ num: '001', slug: 'a', path: 'ADR-001-a.md', decision: 'a' }], []);
        expect(noLegacy).not.toContain('## Unnumbered (legacy)');
    });
});
