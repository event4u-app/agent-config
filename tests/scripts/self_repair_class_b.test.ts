/**
 * The Class-B path (road-to-org-telemetry Phase 5, step 5.2).
 *
 * The claims under test are the two the risk register ranks 1 and 2: nothing
 * leaves without a human having read the exact bytes, and the text is data
 * rather than instruction.
 */
import { describe, expect, it } from 'vitest';

import {
    approve,
    assertNeverInterpolated,
    caseDigest,
    renderCase,
    serialiseCase,
} from '../../src/scripts/_lib/self_repair_class_b.js';
import type { DefectRecord } from '../../src/scripts/_lib/self_repair.js';

function defect(over: Partial<DefectRecord> = {}): DefectRecord {
    return {
        defect_class: 'language-mirror',
        source: 'detector',
        evidence: 'replied in English after a German prompt',
        suggested_surface: 'the language-mirror pre-send gate',
        fingerprint: 'abc123',
        first_seen: '2026-08-20T10:00:00Z',
        last_seen: '2026-08-20T11:00:00Z',
        occurrences: 2,
        status: 'open',
        ...over,
    } as DefectRecord;
}

describe('renderCase', () => {
    it('renders the existing symptom format and a digest of exactly those bytes', () => {
        const out = renderCase(defect());
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.text).toContain('Self-repair report');
        expect(out.text).toContain('language-mirror');
        expect(out.digest).toBe(caseDigest(out.text));
    });

    it('REFUSES rather than scrubbing when the privacy floor trips', () => {
        // An absolute user path is one of the audited forbidden classes.
        const out = renderCase(
            defect({ evidence: 'broke /Users/someone/clientwork/app.ts on line 4' }),
            '/repo',
        );
        expect(out.ok).toBe(false);
        if (out.ok) return;
        expect(out.kind).toBe('privacy-floor');
        expect(out.reason).toContain('privacy floor refused');
        // The point of a refusal is that no text is produced to approve.
        expect(Object.keys(out)).not.toContain('text');
    });
});

describe('approve', () => {
    it('produces a record only when the digest names the text being sent', () => {
        const rendered = renderCase(defect());
        expect(rendered.ok).toBe(true);
        if (!rendered.ok) return;

        const ok = approve(defect(), rendered.text, rendered.digest);
        expect(ok.ok).toBe(true);
        if (!ok.ok) return;
        expect(ok.record.record_class).toBe('case');
        expect(ok.record.case_text).toBe(rendered.text);
        expect(ok.record.case_digest).toBe(rendered.digest);
        expect(ok.record.defect_class).toBe('language-mirror');
    });

    it('refuses when the text changed after the human read it', () => {
        const rendered = renderCase(defect());
        if (!rendered.ok) throw new Error('unreachable');

        // A third occurrence folds in and the render changes. The old approval
        // must not carry over: that would be approving a category, not a case.
        const later = renderCase(defect({ occurrences: 3 }));
        if (!later.ok) throw new Error('unreachable');
        expect(later.text).not.toBe(rendered.text);

        const out = approve(defect({ occurrences: 3 }), later.text, rendered.digest);
        expect(out.ok).toBe(false);
        if (out.ok) return;
        expect(out.kind).toBe('digest-mismatch');
    });

    it('has no path that approves by default', () => {
        const rendered = renderCase(defect());
        if (!rendered.ok) throw new Error('unreachable');
        for (const bogus of ['', 'x', caseDigest('something else')]) {
            expect(approve(defect(), rendered.text, bogus).ok).toBe(false);
        }
    });
});

describe('the approved case is data, not instruction', () => {
    it('serialises the text as a JSON string value in a named field', () => {
        const rendered = renderCase(defect());
        if (!rendered.ok) throw new Error('unreachable');
        const approved = approve(defect(), rendered.text, rendered.digest);
        if (!approved.ok) throw new Error('unreachable');

        const line = serialiseCase(approved.record);
        const parsed = JSON.parse(line) as Record<string, unknown>;
        expect(parsed['case_text']).toBe(rendered.text);
        expect(parsed['record_class']).toBe('case');
        // Newlines survive as escapes rather than as line breaks that would
        // let one case look like several records.
        expect(line.split('\n')).toHaveLength(1);
    });

    it('throws when case text is concatenated into a model-bound string', () => {
        const rendered = renderCase(defect());
        if (!rendered.ok) throw new Error('unreachable');
        const approved = approve(defect(), rendered.text, rendered.digest);
        if (!approved.ok) throw new Error('unreachable');

        expect(() =>
            assertNeverInterpolated(
                `Fix this problem: ${approved.record.case_text}`,
                approved.record,
            ),
        ).toThrow(/quoted data, never as part of an instruction/u);

        // A prompt that carries the taxonomy fields only is fine — that is
        // what Phase 6 generation is allowed to read.
        expect(() =>
            assertNeverInterpolated(
                `Defect class ${approved.record.defect_class}, fingerprint ${approved.record.fingerprint}`,
                approved.record,
            ),
        ).not.toThrow();
    });
});
