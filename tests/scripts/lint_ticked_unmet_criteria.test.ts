import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main, maskHtmlComments, scanText, scanTree } from '../../src/scripts/lint_ticked_unmet_criteria.js';
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

    it('a dated closure marker exempts the block, and the exemption is reported not dropped', () => {
        const historical: { file: string; line: number; criterion: string }[] = [];
        const text = [
            '- [x] AC-5 — Promotion is decided per metric.',
            '      **CLOSED 2026-08-31 — the conjunct now has the caller it lacked.**',
            '      The audit below is preserved.',
            '      First conjunct — NOT met. It has no caller.',
        ].join('\n');
        expect(scanText(text, 'f.md', historical)).toEqual([]);
        expect(historical).toEqual([{ file: 'f.md', line: 1, criterion: 'AC-5' }]);
    });

    it('an UNDATED closure word does not exempt — the date is the whole discriminator', () => {
        const text = [
            '- [x] AC-5 — Promotion is decided per metric.',
            '      **CLOSED — the conjunct now has the caller it lacked.**',
            '      First conjunct — NOT met. It has no caller.',
        ].join('\n');
        expect(scanText(text, 'f.md')).toEqual([{ file: 'f.md', line: 1, criterion: 'AC-5' }]);
    });

    it('records what the three masks cost: a dishonest dated closure escapes this lint', () => {
        // Not a gap to fix in the scanner. A block stamped `MET <date>` whose
        // other half genuinely is unmet reads, to a text matcher, exactly like
        // the two archived criteria this exemption exists for. Telling them
        // apart is a review question. The exemption is printed per criterion so
        // a reviewer can enumerate every block that took it.
        const historical: { file: string; line: number; criterion: string }[] = [];
        const text = [
            '- [x] AC-9 — Both halves land.',
            '      **MET 2026-01-01.** The second half is NOT met and never was.',
        ].join('\n');
        expect(scanText(text, 'f.md', historical)).toEqual([]);
        expect(historical).toHaveLength(1);
    });

    it('the real tree is green, and every exemption it grants is a dated closure', () => {
        const { hits, historical } = scanTree(REPO_ROOT);
        expect(hits).toEqual([]);
        // The two archived criteria the detector refinement was decided on.
        // A third would mean a block took the exemption without anyone looking.
        expect(historical.map((h) => `${h.file}:${String(h.criterion)}`).sort()).toEqual([
            'agents/roadmaps/archive/road-to-governed-harness-evolution.md:AC-1',
            'agents/roadmaps/archive/road-to-governed-harness-evolution.md:AC-5',
        ]);
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
