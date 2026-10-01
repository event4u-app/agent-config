/**
 * The coverage label two release gates print, and the one thing it must not be.
 *
 * `self_review_gate` records how many of the changed files it actually read;
 * the number reached the committed ledger and stopped there. The 16.2.0 record
 * says 65 of 678 and every consumer of it printed a success line that made no
 * coverage claim at all.
 *
 * The sensitivity half of this suite is the part worth reading: a label that
 * fires on everything is as uninformative as one that never fires, so full
 * coverage, an absent block and a malformed block are each pinned to `null`
 * rather than left to the one happy-path assertion.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    LEDGER_DIR,
    coverageLabel,
    coverageLimitationNote,
    ledgerCoverageLabel,
    readLedgerCoverage,
} from '../../src/scripts/_lib/review_coverage.js';

/** A throwaway repo root carrying one ledger. */
function rootWith(release: string, body: unknown): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'revcov-'));
    fs.mkdirSync(path.join(root, LEDGER_DIR), { recursive: true });
    fs.writeFileSync(
        path.join(root, LEDGER_DIR, `${release}.json`),
        `${JSON.stringify(body, null, 2)}\n`,
        'utf-8',
    );
    return root;
}

describe('coverageLabel', () => {
    it('names both numbers when the review read less than the change', () => {
        expect(coverageLabel({ filesReviewed: 65, filesTotal: 678 })).toBe(
            'self-review read 65 of 678 changed files (partial)',
        );
    });

    it('is silent on full coverage', () => {
        expect(coverageLabel({ filesReviewed: 678, filesTotal: 678 })).toBeNull();
    });

    it('is silent when the writer over-counted rather than claiming a negative gap', () => {
        expect(coverageLabel({ filesReviewed: 700, filesTotal: 678 })).toBeNull();
    });

    it('is silent on an absent, non-object or malformed block instead of guessing', () => {
        expect(coverageLabel(undefined)).toBeNull();
        expect(coverageLabel(null)).toBeNull();
        expect(coverageLabel('65 of 678')).toBeNull();
        expect(coverageLabel({})).toBeNull();
        expect(coverageLabel({ filesReviewed: '65', filesTotal: 678 })).toBeNull();
        expect(coverageLabel({ filesReviewed: 65, filesTotal: Number.NaN })).toBeNull();
    });

    it('treats a zero total as nothing to say, never as 0 of 0 partial', () => {
        expect(coverageLabel({ filesReviewed: 0, filesTotal: 0 })).toBeNull();
    });
});

describe('readLedgerCoverage / ledgerCoverageLabel', () => {
    it('reads the committed block and labels it', () => {
        const root = rootWith('1.0.0', {
            schema_version: 1,
            release: '1.0.0',
            findings: [],
            coverage: { chunks: 6, filesReviewed: 65, filesTotal: 678, unreviewed: [] },
        });
        expect(readLedgerCoverage(root, '1.0.0')).toMatchObject({ filesReviewed: 65 });
        expect(ledgerCoverageLabel(root, '1.0.0')).toBe(
            'self-review read 65 of 678 changed files (partial)',
        );
    });

    it('an absent ledger is undefined, not a throw — the in-flight release state', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'revcov-empty-'));
        expect(readLedgerCoverage(root, '9.9.9')).toBeUndefined();
        expect(ledgerCoverageLabel(root, '9.9.9')).toBeNull();
    });

    it('a corrupt ledger is undefined, not a throw — a label never crashes a release', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'revcov-bad-'));
        fs.mkdirSync(path.join(root, LEDGER_DIR), { recursive: true });
        fs.writeFileSync(path.join(root, LEDGER_DIR, '1.0.0.json'), '{ not json', 'utf-8');
        expect(readLedgerCoverage(root, '1.0.0')).toBeUndefined();
    });

    it('the real 16.2.0 ledger is partial — the record this label exists for', () => {
        // Reads the committed artefact, not a lookalike: the whole point is that
        // a shipped release carries this number and nothing printed it.
        const repoRoot = path.resolve(__dirname, '..', '..');
        const label = ledgerCoverageLabel(repoRoot, '16.2.0');
        expect(label).not.toBeNull();
        expect(label).toContain('(partial)');
    });
});

describe('coverageLimitationNote — a label, and it says so', () => {
    it('carries the label and denies being a verdict', () => {
        const note = coverageLimitationNote('self-review read 65 of 678 changed files (partial)');
        expect(note).toContain('self-review read 65 of 678 changed files (partial)');
        expect(note).toContain('a limitation of the RECORD');
        expect(note).toContain('never enforced');
    });

    it('says nothing when there is no label to carry', () => {
        expect(coverageLimitationNote(null)).toBeNull();
    });
});
