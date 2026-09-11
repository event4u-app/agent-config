/**
 * `review-baseline` — the session-start baseline `end-review-nudge` subtracts.
 *
 * The case that motivated it is the last describe block: a branch carrying 1,771
 * lines of another session's uncommitted work, and a turn that changed five
 * lines. Before the baseline the nudge fired on 1,771 every turn and became
 * noise; after it, that turn measures five and stays silent.
 *
 * The three fallbacks get their own tests, because all three resolve to the
 * UNSUBTRACTED count and that is by construction an invisible failure — a line
 * reading 1,771 is indistinguishable from a session that really mutated 1,771
 * unless the telemetry says which path produced it.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
    applyBaseline,
    baselineStateFile,
    currentHeadSha,
    parseBaseline,
    readBaseline,
    type ReviewBaseline,
} from '../../src/scripts/_lib/review_baseline.js';
import { buildReviewSkippedLine } from '../../src/scripts/_lib/review_skipped_record.js';

const tmp_dirs: string[] = [];
afterAll(() => {
    for (const d of tmp_dirs) {
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            /* a temp dir that will not delete is not a test failure */
        }
    }
});

function makeRoot(): string {
    const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'review-baseline-')));
    tmp_dirs.push(d);
    return d;
}

function writeBaselineFile(root: string, key: string, body: unknown): void {
    const file = baselineStateFile(root, key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body));
}

const BASE: ReviewBaseline = {
    head_sha: 'abc123',
    baseline_lines: 1771,
    written_at: '2026-09-11T10:00:00.000Z',
};

describe('parseBaseline', () => {
    it('reads a well-formed record', () => {
        expect(parseBaseline(JSON.stringify(BASE))).toEqual(BASE);
    });

    it('treats a missing HEAD as null rather than as a parse failure', () => {
        // A workspace with no git repo, or no commit yet, is a real state and
        // not a corrupt record — applyBaseline compares null to null happily.
        const rec = parseBaseline(
            JSON.stringify({ head_sha: null, baseline_lines: 0, written_at: BASE.written_at }),
        );
        expect(rec).not.toBeNull();
        expect(rec!.head_sha).toBeNull();
    });

    it('refuses anything whose line count is not a non-negative number', () => {
        for (const bad of [
            '{ not json',
            JSON.stringify({ baseline_lines: -1, written_at: 'x' }),
            JSON.stringify({ baseline_lines: 'many', written_at: 'x' }),
            JSON.stringify({ baseline_lines: 5 }),
            JSON.stringify([1, 2, 3]),
        ]) {
            expect(parseBaseline(bad)).toBeNull();
        }
    });
});

describe('readBaseline keeps absent and unreadable apart', () => {
    it('reports absent when no file was ever written', () => {
        expect(readBaseline(makeRoot(), 'no-such-session')).toBe('absent');
    });

    it('reports unreadable when the file is there and malformed', () => {
        // Collapsing this into `absent` would hide a corrupt write inside the
        // population it is smallest against — every session on a host with no
        // session_start slot reads `absent` legitimately.
        const root = makeRoot();
        writeBaselineFile(root, 'sess', '{ truncated');
        expect(readBaseline(root, 'sess')).toBe('unreadable');
    });

    it('reads back what was written', () => {
        const root = makeRoot();
        writeBaselineFile(root, 'sess', BASE);
        expect(readBaseline(root, 'sess')).toEqual(BASE);
    });
});

describe('applyBaseline', () => {
    it('subtracts when HEAD still matches', () => {
        const out = applyBaseline(1776, BASE, 'abc123');
        expect(out.applied).toBe(true);
        expect(out.lines).toBe(5);
    });

    it('clamps at zero when the session reverted part of the dirty tree', () => {
        // Without the clamp a negative count compares below the threshold as if
        // nothing happened — for a session that deleted a thousand lines.
        const out = applyBaseline(700, BASE, 'abc123');
        expect(out.applied).toBe(true);
        expect(out.lines).toBe(0);
    });

    it('falls back to the UNSUBTRACTED count when HEAD moved', () => {
        // A session that committed mid-run moved `git diff HEAD`'s base, so the
        // subtraction would be arithmetic over two different quantities. Falling
        // back over-reports, which is the safe direction; absorbing it would
        // under-report on exactly the sessions that did the most work.
        const out = applyBaseline(1776, BASE, 'def456');
        expect(out.applied).toBe(false);
        expect(out.lines).toBe(1776);
        expect(out.applied === false && out.fallback).toBe('head-moved');
    });

    it('falls back on absent and on unreadable, carrying each reason through', () => {
        for (const state of ['absent', 'unreadable'] as const) {
            const out = applyBaseline(1776, state, 'abc123');
            expect(out.applied).toBe(false);
            expect(out.lines).toBe(1776);
            expect(out.applied === false && out.fallback).toBe(state);
        }
    });

    it('matches a null HEAD against a null HEAD', () => {
        const noRepo: ReviewBaseline = { ...BASE, head_sha: null, baseline_lines: 10 };
        const out = applyBaseline(60, noRepo, null);
        expect(out.applied).toBe(true);
        expect(out.lines).toBe(50);
    });
});

describe('currentHeadSha', () => {
    it('returns null for a directory that is not a repository, without throwing', () => {
        expect(currentHeadSha(makeRoot())).toBeNull();
    });
});

describe('the telemetry row carries which path produced the count', () => {
    it('records the baseline application when one is supplied', () => {
        const { line, errors } = buildReviewSkippedLine({
            diff_lines: 60,
            mutation_measure: 'exact',
            ts: '2026-09-11T10:00:00.000Z',
            id: 'id-1',
            baseline: 'applied',
        });
        expect(errors).toEqual([]);
        expect((line!['review_skipped'] as Record<string, unknown>)['baseline']).toBe('applied');
    });

    it('OMITS the field when the producer recorded nothing', () => {
        // Absent means "not recorded", the same split audit-log-v1 uses for
        // `skills_applied`. Defaulting it to `absent` would assert a measurement
        // a pre-baseline producer never made.
        const { line } = buildReviewSkippedLine({
            diff_lines: 60,
            mutation_measure: 'exact',
            ts: '2026-09-11T10:00:00.000Z',
            id: 'id-2',
        });
        expect(Object.keys(line!['review_skipped'] as object)).toEqual([
            'diff_lines',
            'mutation_measure',
        ]);
    });

    it('refuses a value outside the closed enum rather than writing it', () => {
        const { line, errors } = buildReviewSkippedLine({
            diff_lines: 60,
            mutation_measure: 'exact',
            ts: '2026-09-11T10:00:00.000Z',
            id: 'id-3',
            baseline: 'probably fine' as never,
        });
        expect(line).toBeNull();
        expect(errors.join(' ')).toContain('baseline must be one of');
    });
});

describe('the 1,771-line accumulator branch', () => {
    it('a five-line turn no longer clears the fire threshold', () => {
        // MUTATION_LINE_THRESHOLD is 50. Unsubtracted, 1,776 clears it on every
        // turn of the session — which is the measured failure. Subtracted, the
        // same turn measures 5.
        const root = makeRoot();
        writeBaselineFile(root, 'accumulator', BASE);
        const out = applyBaseline(1776, readBaseline(root, 'accumulator'), 'abc123');
        expect(out.lines).toBe(5);
        expect(out.lines).toBeLessThanOrEqual(50);
    });

    it('and a genuinely large turn on the same branch still does', () => {
        // The half that proves the fix did not simply disarm the nudge.
        const root = makeRoot();
        writeBaselineFile(root, 'accumulator', BASE);
        const out = applyBaseline(1771 + 300, readBaseline(root, 'accumulator'), 'abc123');
        expect(out.lines).toBe(300);
        expect(out.lines).toBeGreaterThan(50);
    });
});
