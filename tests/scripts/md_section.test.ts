// Tests for src/scripts/_lib/md_section.ts.
//
// The document below reproduces the exact 2026-08-20 failure: a step's prose
// QUOTES the heading that a later section actually uses. A substring anchor
// matches the quotation first and slices mid-step.
import { describe, expect, it } from 'vitest';

import {
    SectionError,
    assertShapePreserved,
    extractSection,
    headings,
    replaceSection,
    sectionRange,
} from '../../src/scripts/_lib/md_section.js';

const DOC = [
    '# Road to something',
    '',
    '## Phase 1 — work',
    '',
    '- [ ] **1.1 Fix the extractor.** It matches only `## Acceptance Criteria`',
    '      with nothing after it, so a roadmap writing `## Acceptance criteria (AC-1)`',
    '      is read as having none.',
    '',
    '## Risk Register',
    '',
    '| Rank | Item |',
    '|---|---|',
    '| 1 | something |',
    '',
    '## Acceptance Criteria',
    '',
    '- [ ] AC-1 — the real one',
    '',
].join('\n');

describe('sectionRange', () => {
    it('anchors on the heading line, not on the quotation in prose', () => {
        const [s] = sectionRange(DOC, '## Acceptance Criteria');
        const line = DOC.split('\n')[s] as string;
        expect(line.trim()).toBe('## Acceptance Criteria');
        // The naive anchor would have matched inside step 1.1, six lines earlier.
        expect(DOC.indexOf('## Acceptance Criteria')).toBeLessThan(
            DOC.split('\n').slice(0, s).join('\n').length,
        );
    });

    it('ends the section at the next heading of the same level', () => {
        const rr = extractSection(DOC, '## Risk Register');
        expect(rr).toContain('| 1 | something |');
        expect(rr).not.toContain('AC-1');
    });

    it('refuses a heading that is not there', () => {
        expect(() => sectionRange(DOC, '## Nope')).toThrow(SectionError);
    });

    it('refuses an ambiguous heading rather than taking the first', () => {
        const dup = DOC + '\n## Risk Register\n\nsecond one\n';
        expect(() => sectionRange(dup, '## Risk Register')).toThrow(/ambiguous — 2 occurrences/);
    });
});

describe('replaceSection', () => {
    it('replaces the real section and keeps every other heading', () => {
        const out = replaceSection(DOC, '## Acceptance Criteria', '## Acceptance Criteria\n\n- [ ] AC-1 — rewritten\n');
        expect(out).toContain('AC-1 — rewritten');
        expect(out).toContain('## Risk Register');
        expect(headings(out)).toEqual(headings(DOC));
    });
});

describe('assertShapePreserved', () => {
    it('throws when an untouched section disappears', () => {
        // This is the measured failure, reproduced: the slice took everything
        // from the quotation onward, so Risk Register vanished with it.
        const naive = DOC.slice(0, DOC.indexOf('## Acceptance Criteria')) + '## Acceptance Criteria\n\n- [ ] AC-1\n';
        expect(() => assertShapePreserved(DOC, naive)).toThrow(/lost .*Risk Register/);
    });

    it('permits a change the caller declared', () => {
        const out = replaceSection(DOC, '## Risk Register', '## Risks\n\nnothing\n');
        expect(() =>
            assertShapePreserved(DOC, out, { allowedRemoved: ['## Risk Register'], allowedAdded: ['## Risks'] }),
        ).not.toThrow();
    });

    it('passes an edit that changes only content', () => {
        const out = replaceSection(DOC, '## Acceptance Criteria', '## Acceptance Criteria\n\n- [ ] AC-1 — other\n');
        expect(() => assertShapePreserved(DOC, out)).not.toThrow();
    });
});
