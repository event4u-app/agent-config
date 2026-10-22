import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { _resetAsOfCacheForTests } from '../../src/scripts/_lib/as_of.js';
import { BYPASS_RECORD_DIR, bypassInstant, evaluateBypassRecords } from '../../src/scripts/_lib/platform_anchor.js';
import {
    bypassReviewCloses,
    committedEvidence,
    main,
    readRecordOnce,
    reviewCommitted,
    reviewReader,
    type AnchorSource,
} from '../../src/scripts/check_platform_anchor.js';

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

/** A structured council review of a bypassed change, as the record's `council_review` must name. */
function review(subject: string, seats: Record<string, string> = { anthropic: 'endorsed', openai: 'not-endorsed' }, outcome?: string): string {
    const derived = Object.values(seats).every((v) => v === 'endorsed') ? 'endorsed' : 'not-endorsed';
    return [
        '<!-- evidence-type: analysis -->',
        '',
        '# Council review of a bypassed change',
        '',
        '## Bypass review',
        '',
        `bypass_subject: ${subject}`,
        ...Object.entries(seats).map(([p, v]) => `seat: ${p} ${v}`),
        `outcome: ${outcome ?? derived}`,
        '',
    ].join('\n');
}

/** `body` padded with `fill` to exactly `bytes` UTF-8 bytes. */
function padTo(body: string, bytes: number, fill: string): string {
    let out = body;
    while (Buffer.byteLength(out) + Buffer.byteLength(fill) <= bytes) out += fill;
    while (Buffer.byteLength(out) < bytes) out += 'x';
    return out;
}

const one = (text: string | null, now = NOW) =>
    evaluateBypassRecords([{ path: 'agents/evidence/bypass-records/x.md', text }], now, (rel, subject) => rel === REVIEW && subject === 'a'.repeat(64));
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

    it('a review named before the restore is malformed', () => {
        expect(codes(record({ restored_at: 'pending', restore_by: '2026-10-16T00:00:00Z' }))).toEqual(['bypass-record-malformed']);
    });

    it('a bypass dated in the future cannot defer its closing', () => {
        expect(
            codes(record({ time: '2099-01-01T00:00:00Z', restore_by: '2099-01-07T00:00:00Z', restored_at: 'pending', council_review: 'pending' })),
        ).toEqual(['bypass-record-malformed']);
    });

    it('impossible chronology: restore_by or restored_at before the bypass, restored_at in the future', () => {
        expect(codes(record({ restore_by: '2026-10-09T00:00:00Z' }))).toEqual(['bypass-record-malformed']);
        expect(codes(record({ restored_at: '2026-10-09T00:00:00Z' }))).toEqual(['bypass-record-malformed']);
        expect(codes(record({ restored_at: '2026-12-01T00:00:00Z', council_review: 'pending' }))).toEqual(['bypass-record-malformed']);
    });

    it('a council review that names no committed file does not close the record', () => {
        expect(codes(record({ council_review: 'x' }))).toEqual(['bypass-record-malformed']);
    });

    it('`pending` is accepted only for restored_at and council_review', () => {
        expect(codes(record({ reason: 'pending' }))).toEqual(['bypass-record-malformed']);
        expect(codes(record({ ruleset_version_after: 'pending' }))).toEqual(['bypass-record-malformed']);
    });

    it('restore_by more than seven days after the bypass', () => {
        expect(codes(record({ restore_by: '2026-10-17T09:00:01Z', restored_at: 'pending', council_review: 'pending' }))).toEqual([
            'bypass-record-malformed',
        ]);
        expect(one(record({ restore_by: '2026-10-17T09:00:00Z', restored_at: 'pending', council_review: 'pending' }))).toEqual([]);
    });

    it('a control character in a value does not reach the finding', () => {
        const f = one(record({ council_review: 'x\u001b[2Jy' }));
        expect(f[0]?.message).not.toMatch(/\p{Cc}/u);
    });

    it('a record name cannot forge a second line of output, nor can a separator in a value', () => {
        const f = evaluateBypassRecords(
            [{ path: `${BYPASS_RECORD_DIR}/x\n✅ fake.md`, text: record({ council_review: 'a\u2028b\u2029c' }) }],
            NOW,
            () => false,
        );
        expect(f[0]?.message).not.toMatch(new RegExp('[\\n\\u2028\\u2029]', 'u'));
        expect(f[0]?.path).not.toMatch(/\n/u);
    });

    it('a record that could not be read', () => {
        expect(codes(null)).toEqual(['bypass-record-unreadable']);
    });
});

describe('bypassReviewCloses — a review records a verdict, not a mention', () => {
    const S = 'a'.repeat(64);

    it('a structured review with two distinct seats and the derived outcome closes', () => {
        expect(bypassReviewCloses(review(S), S)).toBe(true);
        expect(bypassReviewCloses(review(S, { anthropic: 'endorsed', openai: 'endorsed' }), S)).toBe(true);
    });

    it('a bare mention, a missing marker or another subject does not', () => {
        expect(bypassReviewCloses(`# review of subject ${S}\n`, S)).toBe(false);
        expect(bypassReviewCloses(review(S).replace('## Bypass review', ''), S)).toBe(false);
        expect(bypassReviewCloses(review('c'.repeat(64)), S)).toBe(false);
        expect(bypassReviewCloses(`${review(S)}bypass_subject: ${'c'.repeat(64)}\n`, S)).toBe(false);
    });

    it('one seat, a repeated provider, an unknown verdict or an outcome the seats do not derive does not', () => {
        expect(bypassReviewCloses(review(S, { anthropic: 'endorsed' }), S)).toBe(false);
        expect(bypassReviewCloses(`${review(S)}seat: openai endorsed\n`, S)).toBe(false);
        expect(bypassReviewCloses(review(S, { anthropic: 'endorsed', openai: 'fine' }), S)).toBe(false);
        expect(bypassReviewCloses(review(S, { anthropic: 'endorsed', openai: 'not-endorsed' }, 'endorsed'), S)).toBe(false);
        expect(bypassReviewCloses(`${review(S)}outcome: not-endorsed\n`, S)).toBe(false);
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

    const git = (...args: string[]): void => {
        const r = spawnSync('git', ['-C', root, ...args], {
            encoding: 'utf8',
            env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' },
        });
        if (r.status !== 0) throw new Error(r.stderr);
    };
    const commitAll = (): void => {
        git('add', '-A');
        git('-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', 'x');
    };

    it('passes once that record is closed and its review is committed and cites it', () => {
        git('init', '-q');
        put(`${BYPASS_RECORD_DIR}/closed.md`, record());
        put(REVIEW, review('a'.repeat(64)));
        commitAll();
        expect(run()).toBe(0);
    });

    it('a record cannot certify itself, and evidence outside the council records does not count', () => {
        git('init', '-q');
        const self = `${BYPASS_RECORD_DIR}/self.md`;
        put(self, record({ council_review: self }));
        commitAll();
        expect(run()).toBe(1);
        fs.rmSync(path.join(root, self));
        put(`${BYPASS_RECORD_DIR}/other.md`, record({ council_review: 'agents/evidence/analysis/note.md' }));
        put('agents/evidence/analysis/note.md', `mentions ${'a'.repeat(64)}\n`);
        commitAll();
        expect(run()).toBe(1);
    });

    it('a directory with more entries than the ceiling, of any kind, is unreadable', () => {
        fs.mkdirSync(path.join(root, BYPASS_RECORD_DIR), { recursive: true });
        for (let i = 0; i < 201; i += 1) fs.writeFileSync(path.join(root, BYPASS_RECORD_DIR, `n${String(i)}.txt`), '');
        expect(run()).toBe(1);
    });

    it('a review committed before the restore does not close the record', () => {
        git('init', '-q');
        put(REVIEW, review('a'.repeat(64)));
        git('add', '-A');
        const early = { GIT_COMMITTER_DATE: '2026-10-10T12:00:00Z', GIT_AUTHOR_DATE: '2026-10-10T12:00:00Z' };
        const r = spawnSync('git', ['-C', root, '-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', 'early'], {
            encoding: 'utf8',
            env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', ...early },
        });
        expect(r.status).toBe(0);
        put(`${BYPASS_RECORD_DIR}/closed.md`, record());
        commitAll();
        expect(run()).toBe(1);
    });

    it('the review budget is checked before each read and counted in bytes', () => {
        git('init', '-q');
        const s = 'a'.repeat(64);
        put('agents/evidence/council/r1.md', padTo(review(s), 600, 'x'));
        put('agents/evidence/council/r2.md', padTo(review(s), 600, 'x'));
        put('agents/evidence/council/r3.md', padTo(review(s), 665, 'ä'));
        commitAll();
        const index = committedEvidence(root);
        const reader = reviewReader(root, index, { perReview: 1000, total: 1100, reads: 20 });
        expect(reader('agents/evidence/council/r1.md', s, 0)).toBe(true);
        expect(reader('agents/evidence/council/r2.md', s, 0)).toBe(false);
        expect(reviewReader(root, index, { perReview: 1000, total: 1200, reads: 20 })('agents/evidence/council/r1.md', s, 0)).toBe(true);
        expect(reviewReader(root, index, { perReview: 600, total: 600, reads: 20 })('agents/evidence/council/r1.md', s, 0)).toBe(true);
        expect(reviewReader(root, index, { perReview: 599, total: 1200, reads: 20 })('agents/evidence/council/r1.md', s, 0)).toBe(false);
        expect(reviewReader(root, index, { perReview: 664, total: 1200, reads: 20 })('agents/evidence/council/r3.md', s, 0)).toBe(false);
        expect(reviewReader(root, index, { perReview: 665, total: 1200, reads: 20 })('agents/evidence/council/r3.md', s, 0)).toBe(true);
    });

    it('fails when the committed review cites a different subject', () => {
        git('init', '-q');
        put(`${BYPASS_RECORD_DIR}/closed.md`, record());
        put(REVIEW, review('c'.repeat(64)));
        commitAll();
        expect(run()).toBe(1);
    });

    it('fails when the closed record names a review that is not there', () => {
        put(`${BYPASS_RECORD_DIR}/closed.md`, record());
        expect(run()).toBe(1);
    });

    it('a review that is untracked, a directory or a symbolic link does not count', () => {
        git('init', '-q');
        put('agents/evidence/seed.md', 'x\n');
        commitAll();
        put(REVIEW, '# review\n');
        expect(reviewCommitted(root, REVIEW)).toBe(false);
        expect(reviewCommitted(root, 'agents/evidence/council/')).toBe(false);
        expect(reviewCommitted(root, 'agents/evidence/council')).toBe(false);
        fs.rmSync(path.join(root, REVIEW));
        fs.symlinkSync('/etc/hosts', path.join(root, REVIEW));
        commitAll();
        expect(reviewCommitted(root, REVIEW)).toBe(false);
        expect(reviewCommitted(root, 'agents/evidence/seed.md')).toBe(true);
        expect(reviewCommitted(root, 'agents/evidence/../evidence/seed.md')).toBe(false);
    });

    it('without O_NOFOLLOW no record is trusted, and a link is never followed with it', () => {
        put('plain.md', 'x\n');
        expect(readRecordOnce(path.join(root, 'plain.md'))).toBe('x\n');
        expect(readRecordOnce(path.join(root, 'plain.md'), false)).toBeNull();
        fs.symlinkSync(path.join(root, 'plain.md'), path.join(root, 'link.md'));
        expect(readRecordOnce(path.join(root, 'link.md'))).toBeNull();
    });

    it('a tree that cannot be listed gives no committed review', () => {
        put('agents/evidence/seed.md', 'x\n');
        expect(committedEvidence(root).size).toBe(0);
        expect(reviewCommitted(root, 'agents/evidence/seed.md')).toBe(false);
    });

    it('a record that is a symbolic link, or oversized, is read as unreadable', () => {
        put('elsewhere.md', record({ restored_at: 'pending', council_review: 'pending', restore_by: '2026-10-16T00:00:00Z' }));
        fs.mkdirSync(path.join(root, BYPASS_RECORD_DIR), { recursive: true });
        fs.symlinkSync(path.join(root, 'elsewhere.md'), path.join(root, BYPASS_RECORD_DIR, 'link.md'));
        expect(run()).toBe(1);
        fs.rmSync(path.join(root, BYPASS_RECORD_DIR, 'link.md'));
        put(`${BYPASS_RECORD_DIR}/big.md`, record({ restored_at: 'pending', council_review: 'pending', restore_by: '2026-10-16T00:00:00Z' }) + 'x'.repeat(70_000));
        expect(run()).toBe(1);
    });

    it('fails when the record directory exists and cannot be listed', () => {
        put(BYPASS_RECORD_DIR, 'not a directory');
        expect(run()).toBe(1);
    });

    it('a review that only mentions the subject digest does not close the record', () => {
        git('init', '-q');
        put(`${BYPASS_RECORD_DIR}/closed.md`, record());
        put(REVIEW, `# review of subject ${'a'.repeat(64)}\n`);
        commitAll();
        expect(run()).toBe(1);
    });

    it('an AC_AS_OF before restore_by does not make an overdue bypass read as not yet due', () => {
        // The bypass clock is the later of the pin and the wall clock: a caller
        // can pin "now" forward, never back (finding 882f1cbd89de).
        put(`${BYPASS_RECORD_DIR}/open.md`, record({ restored_at: 'pending', council_review: 'pending' }));
        process.env['AC_AS_OF'] = '2026-10-10T10:00:00Z';
        _resetAsOfCacheForTests();
        try {
            expect(run()).toBe(1);
        } finally {
            process.env['AC_AS_OF'] = NOW.toISOString();
            _resetAsOfCacheForTests();
        }
    });

    describe('a record the base carries and the checkout does not — with no file list at all', () => {
        const base = (): string => {
            git('init', '-q');
            put(`${BYPASS_RECORD_DIR}/closed.md`, record());
            put(REVIEW, review('a'.repeat(64)));
            commitAll();
            const r = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
            return r.stdout.trim();
        };
        const runAgainst = (sha: string): number => main(['--files', '--base-ref', sha, '--root', root, '--repo', 'o/r'], source);

        it('the base itself passes', () => {
            expect(runAgainst(base())).toBe(0);
        });

        it('one record deleted', () => {
            const sha = base();
            fs.rmSync(path.join(root, BYPASS_RECORD_DIR, 'closed.md'));
            commitAll();
            expect(runAgainst(sha)).toBe(1);
        });

        it('the whole directory deleted, uncommitted', () => {
            const sha = base();
            fs.rmSync(path.join(root, BYPASS_RECORD_DIR), { recursive: true });
            expect(runAgainst(sha)).toBe(1);
        });

        it('a base ref that reads as an option is refused before git sees it', () => {
            base();
            const written = path.join(root, 'written-by-git');
            expect(main(['--base-ref', `--output=${written}`, '--root', root, '--repo', 'o/r'], source)).toBe(1);
            expect(fs.readdirSync(root).filter((f) => f.startsWith('written-by-git'))).toEqual([]);
        });

        it('a base that cannot be listed fails closed', () => {
            base();
            expect(runAgainst('no-such-ref')).toBe(1);
        });
    });
});
