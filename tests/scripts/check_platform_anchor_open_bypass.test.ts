import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BYPASS_RECORD_DIR, bypassInstant, evaluateBypassRecords } from '../../src/scripts/_lib/platform_anchor.js';
import { main, type AnchorSource } from '../../src/scripts/check_platform_anchor.js';

/**
 * A bypass of the ratification gate is the owner's route, and its record is
 * the only trace it leaves. The check reds while one stays open at or past its
 * `restore_by`, goes unreviewed seven days after it was restored, cannot be
 * read, or is deleted — the ways the route can end without a closing.
 */

const NOW = new Date('2026-10-15T12:00:00Z');
const REVIEW = 'agents/evidence/council/bypass-review.md';

function record(fields: Partial<Record<string, string | null>> = {}, extra = ''): string {
    const f: Record<string, string | null> = {
        reason: 'recorded non-convergence of the modification review, owner asked in-session',
        subject: 'a'.repeat(64),
        time: '2026-10-10T09:00:00Z',
        commit: 'b'.repeat(40),
        ruleset_version_before: '49393554',
        ruleset_version_after: '49500777',
        restore_by: '2026-10-11T09:00:00Z',
        restored_at: '2026-10-10T18:00:00Z',
        council_review: REVIEW,
        ...fields,
    };
    const lines = Object.entries(f)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => `${k}: ${String(v)}`);
    return ['---', ...lines, ...(extra === '' ? [] : [extra]), '---', '<!-- evidence-type: bypass-record -->', '', '# Bypass', ''].join('\n');
}

const one = (text: string | null, now = NOW) =>
    evaluateBypassRecords([{ path: 'agents/evidence/bypass-records/x.md', text }], now, (rel) => rel === REVIEW);
const codes = (text: string | null, now = NOW) => one(text, now).map((f) => f.code);

describe('evaluateBypassRecords — an open bypass reds', () => {
    it('a closed, reviewed bypass is quiet', () => {
        expect(one(record())).toEqual([]);
    });

    it('at or past restore_by with no restored_at', () => {
        expect(codes(record({ restored_at: 'pending', council_review: 'pending' }))).toEqual(['bypass-not-restored']);
        expect(codes(record({ restored_at: 'pending', council_review: 'pending', restore_by: NOW.toISOString() }))).toEqual([
            'bypass-not-restored',
        ]);
    });

    it('not yet restored and still before restore_by is quiet', () => {
        expect(one(record({ restored_at: 'pending', council_review: 'pending', restore_by: '2026-10-16T00:00:00Z' }))).toEqual([]);
    });

    it('restored, unreviewed, seven days on — the boundary included', () => {
        expect(codes(record({ council_review: 'pending', restored_at: '2026-10-08T11:59:59Z', time: '2026-10-08T09:00:00Z' }))).toEqual([
            'bypass-unreviewed',
        ]);
        expect(codes(record({ council_review: 'pending', restored_at: '2026-10-08T12:00:00Z', time: '2026-10-08T09:00:00Z' }))).toEqual([
            'bypass-unreviewed',
        ]);
    });

    it('restored, unreviewed, inside the seven days is quiet', () => {
        expect(one(record({ council_review: 'pending', restored_at: '2026-10-10T12:00:01Z' }))).toEqual([]);
    });
});

describe('evaluateBypassRecords — a record that cannot show it closed fails closed', () => {
    it('each of the nine fields is required, the two open ones included', () => {
        for (const key of ['reason', 'subject', 'time', 'commit', 'ruleset_version_before', 'ruleset_version_after', 'restore_by', 'restored_at', 'council_review']) {
            expect(codes(record({ [key]: null })), key).toEqual(['bypass-record-malformed']);
        }
    });

    it('a repeated key, an unknown key or a missing marker', () => {
        expect(codes(record({}, 'restored_at: pending'))).toEqual(['bypass-record-malformed']);
        expect(codes(record({}, 'note: anything'))).toEqual(['bypass-record-malformed']);
        expect(codes(record().replace('<!-- evidence-type: bypass-record -->', ''))).toEqual(['bypass-record-malformed']);
    });

    it('an instant that is not ISO-8601 with a timezone, or not a real calendar date', () => {
        expect(codes(record({ restore_by: 'tomorrow' }))).toEqual(['bypass-record-malformed']);
        expect(codes(record({ restore_by: '2026-10-11T09:00:00' }))).toEqual(['bypass-record-malformed']);
        expect(codes(record({ restore_by: '2026-02-30T09:00:00Z' }))).toEqual(['bypass-record-malformed']);
        expect(bypassInstant('2026-02-28T23:30:00-02:00')).toBe(Date.parse('2026-03-01T01:30:00Z'));
    });

    it('impossible chronology: restore_by or restored_at before the bypass, restored_at in the future', () => {
        expect(codes(record({ restore_by: '2026-10-09T00:00:00Z' }))).toEqual(['bypass-record-malformed']);
        expect(codes(record({ restored_at: '2026-10-09T00:00:00Z' }))).toEqual(['bypass-record-malformed']);
        expect(codes(record({ restored_at: '2026-12-01T00:00:00Z', council_review: 'pending' }))).toEqual(['bypass-record-malformed']);
    });

    it('a council review that names no committed file does not close the record', () => {
        expect(codes(record({ council_review: 'x' }))).toEqual(['bypass-record-malformed']);
    });

    it('a record that could not be read', () => {
        expect(codes(null)).toEqual(['bypass-record-unreadable']);
    });
});

describe('check_platform_anchor reds on an open bypass, even on a diff it does not gate', () => {
    let root: string;
    const source: AnchorSource = { rulesets: () => null, defaultBranch: () => null };

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'open-bypass-'));
        vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        process.env['AC_AS_OF'] = NOW.toISOString();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete process.env['AC_AS_OF'];
        fs.rmSync(root, { recursive: true, force: true });
    });

    const run = (...files: string[]): number => main(['--files', ...files, '--root', root, '--repo', 'o/r'], source);
    const put = (rel: string, text: string): void => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), text);
    };

    it('passes with no bypass record', () => {
        expect(run()).toBe(0);
    });

    it('fails while a committed bypass record is open', () => {
        put(`${BYPASS_RECORD_DIR}/open.md`, record({ restored_at: 'pending', council_review: 'pending' }));
        expect(run()).toBe(1);
    });

    it('passes once that record is closed and its review exists', () => {
        put(`${BYPASS_RECORD_DIR}/closed.md`, record());
        put(REVIEW, '# review\n');
        expect(run()).toBe(0);
    });

    it('fails when the closed record names a review that is not there', () => {
        put(`${BYPASS_RECORD_DIR}/closed.md`, record());
        expect(run()).toBe(1);
    });

    it('fails when the record directory exists and cannot be listed', () => {
        put(BYPASS_RECORD_DIR, 'not a directory');
        expect(run()).toBe(1);
    });

    it('fails when the diff deletes a bypass record', () => {
        expect(run(`${BYPASS_RECORD_DIR}/gone.md`)).toBe(1);
    });
});
