// Tests for src/scripts/lint_evidence_artifacts.ts
// (road-to-release-review-p0 Phase 2).
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    checkFiles,
    EVIDENCE_TYPES,
    resolveEvidenceType,
} from '../../src/scripts/lint_evidence_artifacts.js';

const SCOPE = 'a'.repeat(64);

describe('resolveEvidenceType — the pre-existing grammars are read, never re-declared', () => {
    it('a completion-review marker resolves current-binding', () => {
        const body = `<!-- completion-review: v1 | reviewed: 2026-08-17 | scope: ${SCOPE} | diff: abc1234 | reviewer: claude -->\n\n# Findings\n`;
        expect(resolveEvidenceType('agents/evidence/reviews/x.findings.md', body)).toEqual({
            type: 'current-binding',
            via: 'completion-review',
            invalidMarker: null,
        });
    });

    it('an honest-null line resolves honest-null', () => {
        const body = `# X\n\n**Honest-null:** 0 findings, scope ${SCOPE}, reviewed 2026-08-17\n`;
        expect(resolveEvidenceType('agents/evidence/reviews/x.findings.md', body).type).toBe('honest-null');
    });

    it('a skip declaration resolves declared-skip', () => {
        const body = `# X\n\n**Skipped:** no code surface for this completion — docs only, scope none, declared 2026-08-17\n`;
        expect(resolveEvidenceType('agents/evidence/reviews/x.findings.md', body).type).toBe('declared-skip');
    });

    // The contract's point: an artifact already carrying one of those grammars
    // must NOT be asked for a second marker, or the check reintroduces the
    // ambiguity it exists to remove.
    it('an artifact with a grammar needs no evidence-type marker', () => {
        const body = `<!-- completion-review: v1 | reviewed: 2026-08-17 | scope: ${SCOPE} | diff: abc1234 | reviewer: claude -->\n`;
        expect(checkFiles('/nonexistent', [])).toEqual([]);
        expect(resolveEvidenceType('x.md', body).via).toBe('completion-review');
    });
});

describe('resolveEvidenceType — the explicit marker', () => {
    it('resolves analysis', () => {
        expect(resolveEvidenceType('agents/evidence/analysis/x.md', '<!-- evidence-type: analysis -->\n# X\n')).toEqual(
            { type: 'analysis', via: 'marker', invalidMarker: null },
        );
    });

    it('accepts every type in the published set', () => {
        for (const t of EVIDENCE_TYPES) {
            expect(resolveEvidenceType('x.md', `<!-- evidence-type: ${t} -->`).type).toBe(t);
        }
    });

    it('tolerates surrounding whitespace', () => {
        expect(resolveEvidenceType('x.md', '   <!--   evidence-type:   analysis   -->   ').type).toBe('analysis');
    });

    // Louder than absence, not quieter: a misspelled type reads as untyped to
    // every consumer, which is exactly the state being ended.
    it('a misspelled type is reported as an invalid marker, not as missing', () => {
        const r = resolveEvidenceType('x.md', '<!-- evidence-type: analisys -->');
        expect(r.type).toBeNull();
        expect(r.invalidMarker).toBe('analisys');
    });

    it('a marker below the scan window does not count — a type belongs at the top', () => {
        const body = `${'filler\n'.repeat(60)}<!-- evidence-type: analysis -->\n`;
        expect(resolveEvidenceType('x.md', body).type).toBeNull();
    });
});

describe('resolveEvidenceType — the one path-derived case', () => {
    it('a file inside a *.review-input directory resolves original-review', () => {
        const rel = path.join('agents', 'evidence', 'reviews', 'slug.review-input', 'prompt.md');
        expect(resolveEvidenceType(rel, '# prompt\n')).toEqual({
            type: 'original-review',
            via: 'review-input-path',
            invalidMarker: null,
        });
    });

    // The exception is narrow on purpose. A directory that merely CONTAINS the
    // word must not qualify, or the contract's "a directory name is not a
    // declaration" line stops being true.
    it('a lookalike directory does not qualify', () => {
        const rel = path.join('agents', 'evidence', 'reviews', 'review-inputs', 'prompt.md');
        expect(resolveEvidenceType(rel, '# prompt\n').type).toBeNull();
    });

    it('plain prose with no marker anywhere is untyped', () => {
        expect(resolveEvidenceType('agents/evidence/analysis/x.md', '# A census\n\nSome prose.\n').type).toBeNull();
    });
});

describe('checkFiles', () => {
    it('an empty file list yields no findings', () => {
        expect(checkFiles(process.cwd(), [])).toEqual([]);
    });

    it('a path that does not exist on disk is skipped, not reported', () => {
        expect(checkFiles(process.cwd(), ['agents/evidence/analysis/definitely-not-here.md'])).toEqual([]);
    });
});
