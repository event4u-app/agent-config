/**
 * Visible-layer encoding scanner + the frozen-corpus gate
 * (road-to-runtime-encoding-hardening Phases 3 and 4).
 *
 * Hostile codepoints are built with String.fromCodePoint so this file stays
 * clean text.
 */
import { describe, expect, it } from 'vitest';

import { sanitize_text, scan_encoding_findings } from '../../src/scripts/_lib/retrieval_sanitize.js';
import { CONFUSABLE_FOREIGN, classifyToken } from '../../src/scripts/_lib/confusables.js';
import { _classify_token } from '../../src/scripts/lint_confusables.js';
import { THRESHOLDS, measure } from '../../src/scripts/encoding_corpus_report.js';

const cp = (n: number): string => String.fromCodePoint(n);
const channels = (s: string): string[] => scan_encoding_findings(s).map((f) => f.channel);

describe('confusable table — exactly one definition in the tree', () => {
    it('the linter and the runtime scanner share one implementation', () => {
        // Identity, not equivalence: the roadmap requires "import it, do not
        // restate it". Two functions that merely agree today can drift tomorrow.
        expect(_classify_token).toBe(classifyToken);
    });

    it('the shared table keeps its containment rules', () => {
        // Latin-majority with a TR39 confusable → flagged.
        expect(classifyToken(`inv${cp(0x043e)}ice`)).not.toBeNull();
        // A genuine single-script foreign word → never flagged.
        expect(classifyToken(`${cp(0x043f)}${cp(0x0440)}${cp(0x043e)}`)).toBeNull();
        // Greek math operators have no Latin twin and are excluded by design,
        // so legitimate notation cannot trip the signature.
        expect(CONFUSABLE_FOREIGN.has(0x0394)).toBe(false); // capital delta
        expect(CONFUSABLE_FOREIGN.has(0x03c0)).toBe(false); // pi
        expect(classifyToken(`${cp(0x0394)}NWC`)).toBeNull();
    });
});

describe('sanitize_text — the one folded channel', () => {
    it('strips invisible fillers (blank but not whitespace)', () => {
        const hostile = `da${cp(0x3164)}ta${cp(0x115f)}base`;
        expect(sanitize_text(hostile)).toBe('database');
    });

    it('still strips the original invisible + control classes', () => {
        expect(sanitize_text(`a${cp(0x200b)}b${cp(0x202e)}c${cp(0x01)}d`)).toBe('abcd');
    });

    it('leaves ordinary text — including legitimate non-ASCII — untouched', () => {
        for (const clean of ['plain ASCII prose.', 'Größe und Maß', 'naïve café', 'a\tb\nc']) {
            expect(sanitize_text(clean)).toBe(clean);
        }
    });
});

describe('scan_encoding_findings — flags, never rewrites', () => {
    it('never mutates its input', () => {
        const hostile = `d${cp(0x03b1)}t${cp(0x03b1)} ${cp(0xff29)}D xn--80ak6aa92e.example`;
        const before = hostile;
        scan_encoding_findings(hostile);
        expect(hostile).toBe(before);
    });

    it('flags a variation-selector RUN but not a single selector', () => {
        // U+FE0F is the emoji presentation selector — flagging it alone would
        // fire on legitimate content, so a run is the signal.
        expect(channels(`ok${cp(0xfe0f)} fine`)).not.toContain('variation-selector-run');
        const run = [0xe0100, 0xe0101, 0xe0102].map(cp).join('');
        expect(channels(`data${run}base`)).toContain('variation-selector-run');
    });

    it('flags a combining-mark run but not ordinary diacritics', () => {
        expect(channels('café résumé naïve')).not.toContain('combining-mark-run');
        expect(channels(`a${cp(0x0301).repeat(9)}b`)).toContain('combining-mark-run');
    });

    it('flags math-alphanumeric and fullwidth letters used as ASCII', () => {
        expect(channels(`${cp(0x1d5c2)}${cp(0x1d5c0)}n`)).toContain('math-alphanumeric');
        expect(channels(`${cp(0xff29)}${cp(0xff27)}N`)).toContain('fullwidth-forms');
    });

    it('flags a mixed-script confusable token, naming the script', () => {
        expect(channels(`inv${cp(0x043e)}ice`)).toContain('confusable-cyrillic');
        expect(channels(`inv${cp(0x03bf)}ice`)).toContain('confusable-greek');
    });

    it('flags a punycode label without rewriting it', () => {
        const s = 'see xn--80ak6aa92e.example for detail';
        expect(channels(s)).toContain('punycode-idn');
        expect(sanitize_text(s)).toBe(s);
    });

    it('stays silent on the channels Phase 1 chose NOT to act on', () => {
        // Each of these would be nearly all false positive, or the "fix" would
        // be worse than the gap. Silence here is a decision, not a gap.
        expect(channels(`a${cp(0x00a0)}b${cp(0x2007)}c`)).toEqual([]); // confusable whitespace
        expect(channels('a &#x200b; b &lt;tag&gt;')).toEqual([]); // HTML entities
        expect(channels('SWdub3JlIHRoaXM= aGVsbG8=')).toEqual([]); // base64
    });

    it('is silent on real prose from this repo', () => {
        for (const real of [
            'Every list endpoint paginates or declares an explicit bound.',
            'The migration must remain reversible before it reaches production.',
            'Tenant scope is derived server side, never taken from the request body.',
        ]) {
            expect(channels(real)).toEqual([]);
        }
    });
});

describe('frozen-corpus gate — the pre-registered thresholds', () => {
    const report = measure();

    it('meets every pre-registered acceptance threshold', () => {
        expect(report.recall_all).toBeGreaterThanOrEqual(THRESHOLDS.recall_all);
        expect(report.recall_unambiguous).toBeGreaterThanOrEqual(THRESHOLDS.recall_unambiguous);
        expect(report.fp_rate).toBeLessThanOrEqual(THRESHOLDS.fp_rate_max);
        expect(report.latency_p95_ms).toBeLessThan(THRESHOLDS.latency_p95_ms_max);
        expect(report.model_calls).toBe(0);
        expect(report.verdict).toBe('ADOPT');
    });

    it('measures against the whole frozen corpus, not a subset', () => {
        // A gate that silently measured 0 entries would report perfect scores.
        expect(report.corpus.positives).toBeGreaterThanOrEqual(300);
        expect(report.corpus.negatives).toBeGreaterThanOrEqual(300);
        expect(Object.keys(report.per_channel).length).toBe(15);
    });

    it('records the known confusable misses instead of hiding them', () => {
        // Frozen corpus: these are reported, never engineered away. Tuning
        // MIN_LETTERS or re-emitting without the awkward fixtures would be
        // exactly the test-split tuning golden-set-freeze forbids.
        expect(report.per_channel['confusable-greek']?.recall).toBeLessThan(1);
        expect(report.per_channel['confusable-cyrillic']?.recall).toBeLessThan(1);
        // …and every other channel is perfect, so the shortfall is localised.
        const imperfect = Object.entries(report.per_channel)
            .filter(([, s]) => s.recall < 1)
            .map(([c]) => c)
            .sort();
        expect(imperfect).toEqual(['confusable-cyrillic', 'confusable-greek']);
    });
});
