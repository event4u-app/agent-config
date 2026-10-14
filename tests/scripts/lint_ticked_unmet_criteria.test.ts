import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HISTORICAL, main, maskHtmlComments, scanText, scanTree } from '../../src/scripts/lint_ticked_unmet_criteria.js';
import { runInProc } from '../_lib/run_in_process.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const FIXTURE = [
    '## Acceptance Criteria',
    '',
    '- [x] AC-1 — Fully met.',
    '- [x] AC-2 — One half lands. **The other half',
    '      is NOT met and was refused.**',
    '- [~] AC-3 — Deferred, and NOT met, honestly.',
    '- [ ] AC-4 — Open, NOT met yet.',
    '- [x] AC-5 — Met.',
    '',
    'NOT met — a later paragraph is not part of AC-5.',
    '',
    '```',
    '- [x] AC-6 — inside a fence, NOT met',
    '```',
    '- [x] AC-7 — prose saying it is not met in lower case.',
    '- [x] AC-8 — the lint reports a criterion whose text contains `NOT met`.',
    '- [x] AC-9 — two spans: ``a `NOT met` nested`` and more prose.',
    '',
].join('\n');

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ticked-unmet-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('lint_ticked_unmet_criteria', () => {
    it('reports only a ticked criterion whose own text says NOT met', () => {
        const hits = scanText(FIXTURE, 'f.md');
        expect(hits).toEqual([{ file: 'f.md', line: 4, criterion: 'AC-2' }]);
    });

    it('inline-code-not-met-is-quoted — a backticked NOT met is a quotation, a bare one is not', () => {
        const hits = scanText(FIXTURE, 'f.md');
        // AC-8 and AC-9 quote the phrase inside backticks; neither is a finding.
        expect(hits.map((h) => h.criterion)).not.toContain('AC-8');
        expect(hits.map((h) => h.criterion)).not.toContain('AC-9');
        // The trade this masking buys: the bare phrase of AC-2 still fails.
        expect(hits.map((h) => h.criterion)).toContain('AC-2');
    });

    it('an unterminated backtick masks nothing, so a bare NOT met after it still fails', () => {
        const text = ['- [x] AC-1 — an opening ` and then NOT met in the clear.'].join('\n');
        expect(scanText(text, 'f.md')).toEqual([{ file: 'f.md', line: 1, criterion: 'AC-1' }]);
    });

    it('exits 1 on a planted tick over NOT met, 0 when the glyph is honest', () => {
        const dir = path.join(tmp, 'agents', 'roadmaps', 'archive');
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, 'road-to-x.md');
        fs.writeFileSync(file, FIXTURE);
        expect(runInProc(main, ['--root', tmp]).status).toBe(1);
        fs.writeFileSync(file, FIXTURE.replace('- [x] AC-2', '- [~] AC-2'));
        expect(runInProc(main, ['--root', tmp]).status).toBe(0);
    });

    it('exits 2 on a usage error', () => {
        expect(runInProc(main, ['--bogus']).status).toBe(2);
    });

    it('an HTML comment is not the criterion a checkbox reader sees', () => {
        const text = [
            '- [x] AC-1 — The gate ships.',
            '      <!-- One clause of the Goal is NOT met and is reported rather than',
            '      quietly satisfied. -->',
        ].join('\n');
        expect(scanText(text, 'f.md')).toEqual([]);
    });

    it('the comment mask keeps line structure, so a bare phrase after it still fails', () => {
        const text = [
            '- [x] AC-1 — The gate ships.',
            '      <!-- a comment -->',
            '      The second half is NOT met.',
        ].join('\n');
        expect(scanText(text, 'f.md')).toEqual([{ file: 'f.md', line: 1, criterion: 'AC-1' }]);
        expect(maskHtmlComments('a<!--b-->c\nd')).toBe('a        c\nd');
    });

    it('a dated closure marker is NOT a pass token — a self-typed CLOSED <date> still fails', () => {
        // The shape the ratification review refused: an author-controlled
        // suppression on a lint that had just become an enforced CI gate.
        const historical: { file: string; line: number; criterion: string }[] = [];
        const text = [
            '- [x] AC-5 — Promotion is decided per metric.',
            '      **CLOSED 2026-08-31 — the conjunct now has the caller it lacked.**',
            '      First conjunct — NOT met. It has no caller.',
        ].join('\n');
        expect(scanText(text, 'f.md', historical)).toEqual([{ file: 'f.md', line: 1, criterion: 'AC-5' }]);
        expect(historical).toEqual([]);
    });

    it('an impossible date is not special either — nothing about the text exempts', () => {
        const text = ['- [x] AC-5 — Both halves land.', '      **CLOSED 2026-99-99.** Second half is NOT met.'].join(
            '\n',
        );
        expect(scanText(text, 'f.md')).toEqual([{ file: 'f.md', line: 1, criterion: 'AC-5' }]);
    });

    it('the grandfathered list is keyed by content, so an edited block loses its exemption', () => {
        const entry = HISTORICAL[0];
        expect(entry).toBeDefined();
        const rel = entry?.file ?? '';
        const body = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
        const historical: { file: string; line: number; criterion: string }[] = [];

        // As committed: exempt.
        expect(scanText(body, rel, historical).filter((h) => h.criterion === entry?.criterion)).toEqual([]);
        expect(historical.some((h) => h.criterion === entry?.criterion)).toBe(true);

        // One word changed inside the block: the digest moves and it is reported.
        const edited = body.replace('the point of the criterion', 'THE POINT of the criterion');
        expect(edited).not.toBe(body);
        const after: { file: string; line: number; criterion: string }[] = [];
        expect(scanText(edited, rel, after).some((h) => h.criterion === entry?.criterion)).toBe(true);
    });

    it('records what the masks cost: a backticked or commented unmet half escapes this lint', () => {
        // Not a gap the scanner can close. Both are constructs the lint reads as
        // quotation by design, and an author who uses one deliberately is a
        // review question rather than something a text matcher can decide.
        expect(scanText('- [x] AC-9 — Both halves land, `the second is NOT met`.', 'f.md')).toEqual([]);
        expect(scanText('- [x] AC-9 — Both halves land.\n      <!-- second is NOT met -->', 'f.md')).toEqual([]);
    });

    it('the real tree is green, and every exemption it grants is on the frozen list', () => {
        const { hits, historical } = scanTree(REPO_ROOT);
        expect(hits).toEqual([]);
        // The exemption set is the frozen list and nothing else: a third entry
        // would mean a block took a pass without anyone reading it.
        expect(historical.map((h) => `${h.file}:${String(h.criterion)}`).sort()).toEqual(
            HISTORICAL.map((h) => `${h.file}:${h.criterion}`).sort(),
        );
        expect(HISTORICAL).toHaveLength(2);
    });

    it('reads the real tree, and reports the archived plumbing AC-3 while it is still ticked', () => {
        const rel = 'agents/roadmaps/archive/road-to-a-kernel-that-guards-its-plumbing.md';
        const ticked = /^- \[x\] AC-3/m.test(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
        const { hits, historical, scanned } = scanTree(REPO_ROOT);
        expect(scanned).toBeGreaterThan(100);
        const seen = [...hits, ...historical].filter((h) => h.file === rel && h.criterion === 'AC-3');
        expect(seen).toHaveLength(ticked ? 1 : 0);
    });
});
