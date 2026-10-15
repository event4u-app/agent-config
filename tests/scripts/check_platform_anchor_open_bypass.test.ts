import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BYPASS_RECORD_DIR, evaluateBypassRecords } from '../../src/scripts/_lib/platform_anchor.js';
import { main, type AnchorSource } from '../../src/scripts/check_platform_anchor.js';

/**
 * A bypass of the ratification gate is the owner's route, and its record is
 * the only trace it leaves. The check reds while one stays open past its
 * `restore_by`, or goes unreviewed seven days after it was restored — the
 * two ways the route has no closing.
 */

const NOW = new Date('2026-10-15T12:00:00Z');

function record(fields: Partial<Record<string, string>> = {}): string {
    const f: Record<string, string> = {
        reason: 'recorded non-convergence of the modification review, owner asked in-session',
        subject: 'a'.repeat(64),
        time: '2026-10-10T09:00:00Z',
        commit: 'b'.repeat(40),
        ruleset_version_before: '49393554',
        ruleset_version_after: '49500777',
        restore_by: '2026-10-11T09:00:00Z',
        restored_at: '2026-10-10T18:00:00Z',
        council_review: 'agents/evidence/council/bypass-review.md',
        ...fields,
    };
    const lines = Object.entries(f)
        .filter(([, v]) => v !== '')
        .map(([k, v]) => `${k}: ${v}`);
    return ['---', ...lines, '---', '<!-- evidence-type: bypass-record -->', '', '# Bypass', ''].join('\n');
}

const one = (text: string, now = NOW) => evaluateBypassRecords([{ path: 'agents/evidence/bypass-records/x.md', text }], now);

describe('evaluateBypassRecords — an open bypass reds', () => {
    it('a closed, reviewed bypass is quiet', () => {
        expect(one(record())).toEqual([]);
    });

    it('past restore_by with no restored_at', () => {
        const f = one(record({ restored_at: 'pending', council_review: 'pending' }));
        expect(f).toHaveLength(1);
        expect(f[0]?.code).toBe('bypass-not-restored');
    });

    it('a missing restored_at is the same as pending', () => {
        expect(one(record({ restored_at: '', council_review: 'pending' }))[0]?.code).toBe('bypass-not-restored');
    });

    it('not yet restored but still before restore_by is quiet', () => {
        expect(one(record({ restored_at: 'pending', council_review: 'pending', restore_by: '2026-10-16T00:00:00Z' }))).toEqual([]);
    });

    it('restored, unreviewed, seven days on', () => {
        const f = one(record({ council_review: 'pending', restored_at: '2026-10-08T11:59:59Z' }));
        expect(f).toHaveLength(1);
        expect(f[0]?.code).toBe('bypass-unreviewed');
    });

    it('restored, unreviewed, inside the seven days is quiet', () => {
        expect(one(record({ council_review: 'pending', restored_at: '2026-10-09T12:00:01Z' }))).toEqual([]);
    });

    it('a record missing one of the owner’s fields fails closed', () => {
        for (const key of ['reason', 'subject', 'time', 'commit', 'ruleset_version_before', 'ruleset_version_after', 'restore_by']) {
            const f = one(record({ [key]: '' }));
            expect(f.map((x) => x.code), key).toEqual(['bypass-record-malformed']);
        }
    });

    it('an unparseable instant fails closed', () => {
        expect(one(record({ restore_by: 'tomorrow' }))[0]?.code).toBe('bypass-record-malformed');
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

    const run = (): number => main(['--files', '--root', root, '--repo', 'o/r'], source);

    it('passes with no bypass record', () => {
        expect(run()).toBe(0);
    });

    it('fails while a committed bypass record is open', () => {
        fs.mkdirSync(path.join(root, BYPASS_RECORD_DIR), { recursive: true });
        fs.writeFileSync(path.join(root, BYPASS_RECORD_DIR, 'open.md'), record({ restored_at: 'pending', council_review: 'pending' }));
        expect(run()).toBe(1);
    });

    it('passes once that record is closed and reviewed', () => {
        fs.mkdirSync(path.join(root, BYPASS_RECORD_DIR), { recursive: true });
        fs.writeFileSync(path.join(root, BYPASS_RECORD_DIR, 'closed.md'), record());
        expect(run()).toBe(0);
    });
});
