// Tests for src/scripts/lint_provenance_vocabulary.ts
// (road-to-provenance-and-license-governance Phase 3, S3.2/S3.3).
//
// Differential over the exported pure helpers: a banned phrase must fail, an
// approved-vocabulary use without a co-located scope box must fail, a valid
// box must pass, a box figure absent from docs/CLAIMS.md must fail, a clean
// file must pass, and the real repo tree — README.md + docs/** — must be
// clean (the linter enforces its own README section).
import { describe, expect, it } from 'vitest';

import {
    bannedPhraseViolations,
    coLocationViolations,
    scopeBoxNumberMismatches,
    lintFile,
    lintProvenanceVocabulary,
    SCOPE_BOX_ANCHOR,
    APPROVED_TERMS,
} from '../../src/scripts/lint_provenance_vocabulary.js';

const VALID_BOX = [
    'Our borrow discipline is **provenance-governed**.',
    '',
    SCOPE_BOX_ANCHOR,
    '#### Scope & limits',
    '',
    '- Unconscious training-data reproduction is not detectable at this layer.',
    '- Detection covers a knowledge base of known OSS only.',
    '- No CI-facing detection gate exists.',
    '- Rename-only laundering is not detected by anything we ship.',
    '- Measured recall 12/16, false positives 2/12.',
].join('\n');

const CLAIMS_WITH_NUMBERS = 'the ledger records recall 12/16 and false positives 2/12 on the frozen corpus';
const CLAIMS_WITHOUT_NUMBERS = 'the ledger records no comparable figures in this fixture';

describe('lint_provenance_vocabulary — banned phrases', () => {
    it('flags "copyright-safe" as a live claim', () => {
        const v = bannedPhraseViolations('Our tool makes your code copyright-safe.', 'x.md');
        expect(v.some((x) => x.rule === 'banned-phrase')).toBe(true);
    });

    it('flags near-variants (copyright-proof, IP-safe, legally safe)', () => {
        expect(bannedPhraseViolations('This output is copyright-proof.', 'x.md').length).toBeGreaterThan(0);
        expect(bannedPhraseViolations('Every borrow is IP-safe by design.', 'x.md').length).toBeGreaterThan(0);
        expect(bannedPhraseViolations('Reusing this snippet is legally safe.', 'x.md').length).toBeGreaterThan(0);
    });

    it('does NOT flag the phrase when the line names the ban (negation carve-out)', () => {
        const v = bannedPhraseViolations('We never claim any output is "copyright-safe".', 'x.md');
        expect(v).toEqual([]);
    });

    it('ignores a banned phrase inside a fenced code block', () => {
        const text = ['```', 'copyright-safe', '```'].join('\n');
        expect(bannedPhraseViolations(text, 'x.md')).toEqual([]);
    });
});

describe('lint_provenance_vocabulary — co-location', () => {
    it('flags approved vocabulary used without a co-located scope box', () => {
        const v = coLocationViolations('This is a provenance-governed workflow.', 'x.md');
        expect(v.some((x) => x.rule === 'co-location')).toBe(true);
    });

    it('passes approved vocabulary WITH a complete, co-located scope box', () => {
        expect(coLocationViolations(VALID_BOX, 'x.md')).toEqual([]);
    });

    it('does NOT require a box when the term is only CITED in quotes (naming the rule, not using it)', () => {
        const text = 'Approved vocabulary ("provenance-governed", "license-policy-enforced", "audited borrow trail") requires a co-located scope box.';
        expect(coLocationViolations(text, 'x.md')).toEqual([]);
    });

    it('flags a scope-box anchor with no following heading', () => {
        const text = [`${SCOPE_BOX_ANCHOR}`, '', '', '', '', '', 'no heading in the window'].join('\n');
        const v = coLocationViolations(text, 'x.md');
        expect(v.some((x) => x.rule === 'co-location')).toBe(true);
    });

    it('flags a box missing a required element (e.g. the rename-only statement)', () => {
        const incomplete = VALID_BOX.replace(
            '- Rename-only laundering is not detected by anything we ship.\n',
            '',
        );
        const v = coLocationViolations(incomplete, 'x.md');
        expect(v.some((x) => x.rule === 'scope-box-content' && x.msg.includes('rename-only'))).toBe(true);
    });

    it('flags a box with no measured N/D figure', () => {
        const noNumbers = VALID_BOX.replace('- Measured recall 12/16, false positives 2/12.', '- No figures here.');
        const v = coLocationViolations(noNumbers, 'x.md');
        expect(v.some((x) => x.rule === 'scope-box-content' && x.msg.includes('N/D figure'))).toBe(true);
    });

    it('exposes the approved-vocabulary list non-empty', () => {
        expect(APPROVED_TERMS.length).toBeGreaterThan(0);
    });
});

describe('lint_provenance_vocabulary — number cross-check', () => {
    it('fails when a box figure is absent from docs/CLAIMS.md', () => {
        const v = scopeBoxNumberMismatches(VALID_BOX, 'x.md', CLAIMS_WITHOUT_NUMBERS);
        expect(v.some((x) => x.rule === 'number-drift')).toBe(true);
    });

    it('passes when every box figure appears in docs/CLAIMS.md', () => {
        expect(scopeBoxNumberMismatches(VALID_BOX, 'x.md', CLAIMS_WITH_NUMBERS)).toEqual([]);
    });
});

describe('lint_provenance_vocabulary — clean file', () => {
    it('passes a file with no banned phrases and no approved vocabulary', () => {
        const text = 'This package ships rules, skills, and commands for coding agents.';
        expect(lintFile(text, 'x.md', CLAIMS_WITH_NUMBERS)).toEqual([]);
    });
});

describe('lint_provenance_vocabulary — real repo', () => {
    it('the shipped README + docs tree is clean (0 violations)', () => {
        expect(lintProvenanceVocabulary()).toEqual([]);
    });
});
