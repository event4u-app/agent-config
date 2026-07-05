// Tests for src/scripts/consolidate_knowledge_events.ts (road-to-knowledge-system,
// Phase 5). Verifies aggregation-key stability, similarity-scan wiring, and
// that this script NEVER writes a knowledge page (only clears intake on --commit).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { aggregationKey, buildReport, main } from '../../src/scripts/consolidate_knowledge_events.ts';
import { appendEvent, intakeFiles, type MistakeMadeEvent } from '../../src/scripts/_lib/knowledge_events.ts';

const MISTAKE: MistakeMadeEvent = {
    type: 'mistake_made',
    ts: '2026-07-05T00:00:00Z',
    errorCategory: 'null-deref',
    contextSource: null,
    correction: 'guard it',
    recurrenceKey: 'checkout-null-currency',
};

describe('aggregationKey', () => {
    it('is stable for the same recurrenceKey across events', () => {
        const a = aggregationKey(MISTAKE);
        const b = aggregationKey({ ...MISTAKE, ts: '2026-08-01T00:00:00Z', correction: 'different wording' });
        expect(a).toBe(b);
    });

    it('differs across event types even with overlapping text', () => {
        const mistakeKey = aggregationKey(MISTAKE);
        const conventionKey = aggregationKey({
            type: 'convention_detected',
            ts: '2026-07-05T00:00:00Z',
            pattern: 'checkout-null-currency',
            evidence: ['a:1'],
            sampleSize: 2,
            scope: 'project',
        });
        expect(mistakeKey).not.toBe(conventionKey);
    });
});

describe('buildReport', () => {
    it('groups events by aggregation key and reports group size', () => {
        const report = buildReport([MISTAKE, MISTAKE, { ...MISTAKE, recurrenceKey: 'other' }], []);
        expect(report).toHaveLength(2);
        const checkout = report.find((g) => g.key.includes('checkout-null-currency'));
        expect(checkout?.events).toHaveLength(2);
    });

    it('finds no nearest page when candidates are empty', () => {
        const report = buildReport([MISTAKE], []);
        expect(report[0].nearestPage).toBeNull();
    });

    it('finds a nearest page above the warn/merge threshold, none below it', () => {
        const closeMatch = buildReport(
            [{ ...MISTAKE, correction: 'guard it', errorCategory: 'null-deref' }],
            [{ id: 'concepts/x.md', text: 'null-deref guard it exactly' }],
        );
        expect(closeMatch[0].nearestPage).not.toBeNull();

        const farMatch = buildReport(
            [MISTAKE],
            [{ id: 'concepts/unrelated.md', text: 'totally unrelated content about something else entirely' }],
        );
        expect(farMatch[0].nearestPage).toBeNull();
    });

    it('empty event list produces an empty report', () => {
        expect(buildReport([], [])).toEqual([]);
    });
});

describe('consolidate_knowledge_events CLI', () => {
    function mkDirs(): { intake: string; knowledge: string } {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'consolidate-'));
        return { intake: path.join(root, 'intake'), knowledge: path.join(root, 'knowledge') };
    }

    it('default mode (no --commit) leaves the intake untouched', () => {
        const { intake, knowledge } = mkDirs();
        appendEvent(MISTAKE, intake);
        const rc = main(['--intake-dir', intake, '--knowledge-dir', knowledge]);
        expect(rc).toBe(0);
        expect(intakeFiles(intake)).toHaveLength(1);
    });

    it('--commit clears the intake after reporting', () => {
        const { intake, knowledge } = mkDirs();
        appendEvent(MISTAKE, intake);
        const rc = main(['--intake-dir', intake, '--knowledge-dir', knowledge, '--commit']);
        expect(rc).toBe(0);
        expect(intakeFiles(intake)).toEqual([]);
    });

    it('never writes anything under the knowledge dir', () => {
        const { intake, knowledge } = mkDirs();
        appendEvent(MISTAKE, intake);
        main(['--intake-dir', intake, '--knowledge-dir', knowledge, '--commit']);
        expect(fs.existsSync(knowledge)).toBe(false);
    });

    it('--format json exits 0', () => {
        const { intake, knowledge } = mkDirs();
        expect(main(['--intake-dir', intake, '--knowledge-dir', knowledge, '--format', 'json'])).toBe(0);
    });

    it('bad --format exits 1', () => {
        expect(main(['--format', 'yaml'])).toBe(1);
    });

    it('unknown flag exits 1', () => {
        expect(main(['--bogus'])).toBe(1);
    });

    it('--help exits 0', () => {
        expect(main(['--help'])).toBe(0);
    });
});
