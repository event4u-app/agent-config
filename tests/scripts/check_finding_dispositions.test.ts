/**
 * Finding-disposition gate (release-truth Phase 3).
 *
 * Pre-registered verify: fixture PR with an undispositioned high finding →
 * release validation red. Plus: the ledger is the record (complete
 * dispositions green), the comment machine-block is only a trigger
 * (reported-but-unrecorded blocking finding red), and finding ids are stable.
 */
import { describe, expect, it } from 'vitest';

import {
    isBlocking,
    localTagHit,
    releaseStatus,
    tags_complete,
    missing_dispositions,
    parse_comment_findings,
    parse_ledger,
    unrecorded_findings,
    type LedgerFinding,
} from '../../src/scripts/check_finding_dispositions.js';
import { classifyBlocking, findingId, renderReview, type Finding } from '../../src/scripts/self_review_gate.js';

function finding(overrides: Partial<LedgerFinding>): LedgerFinding {
    return {
        finding_id: 'abc123def456',
        severity: 'high',
        kind: 'security',
        title: 'a blocking finding',
        file: 'src/x.ts',
        ...overrides,
    };
}

const COMPLETE = {
    status: 'fixed',
    commit: '514189a18f44d55cd45cb6a2b5a7236365e4d0a3',
    rationale: 'adjudicated with evidence',
    verified_by: 'tests/scripts/x.test.ts',
    date: '2026-08-03',
};

describe('missing_dispositions — the release-validation red condition', () => {
    it('red: an undispositioned high finding', () => {
        const problems = missing_dispositions([finding({})]);
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain('no disposition status');
    });

    it('green: complete disposition on a blocking finding', () => {
        expect(missing_dispositions([finding(COMPLETE)])).toEqual([]);
    });

    it('red: fixed without a commit / empty rationale / empty verified_by', () => {
        expect(missing_dispositions([finding({ ...COMPLETE, commit: ' ' })])[0]).toContain(
            'without a commit',
        );
        expect(missing_dispositions([finding({ ...COMPLETE, rationale: '' })])[0]).toContain(
            'empty rationale',
        );
        expect(missing_dispositions([finding({ ...COMPLETE, verified_by: '' })])[0]).toContain(
            'empty verified_by',
        );
    });

    it('red: unknown status', () => {
        expect(missing_dispositions([finding({ ...COMPLETE, status: 'wontfix' })])[0]).toContain(
            'unknown status',
        );
    });

    it('green: non-blocking findings need no disposition (advisory record)', () => {
        expect(missing_dispositions([finding({ severity: 'medium' })])).toEqual([]);
        expect(missing_dispositions([finding({ kind: 'style', severity: 'critical' })])).toEqual([]);
    });
});

describe('blocking classification parity with self_review_gate', () => {
    it('isBlocking mirrors classifyBlocking across the full matrix', () => {
        const severities = ['critical', 'high', 'medium', 'low'] as const;
        const kinds = ['security', 'claim', 'correctness', 'style'] as const;
        for (const severity of severities) {
            for (const kind of kinds) {
                const f: Finding = { severity, kind, title: 't', detail: 'd' };
                expect(isBlocking({ severity, kind })).toBe(classifyBlocking(f));
            }
        }
    });
});

describe('comment machine-block as trigger', () => {
    it('round-trips findings through renderReview and flags unrecorded ones', () => {
        const f: Finding = {
            severity: 'high',
            kind: 'security',
            title: 'planted symlink escapes the walk root',
            detail: 'detail',
            file: 'src/scripts/x.ts',
        };
        const body = renderReview([f], false);
        const reported = parse_comment_findings([body]);
        expect(reported).toHaveLength(1);
        expect(reported[0]!.finding_id).toBe(findingId(f));

        expect(unrecorded_findings(reported, [])).toHaveLength(1);
        expect(
            unrecorded_findings(reported, [finding({ finding_id: findingId(f), ...COMPLETE })]),
        ).toEqual([]);
    });

    it('ignores comments without a machine block (pre-Phase-3 comments)', () => {
        expect(parse_comment_findings(['no block here', '| table | only |'])).toEqual([]);
    });
});

describe('parse_ledger', () => {
    it('accepts the committed 9.14.0 ledger shape and rejects malformed ones', () => {
        const ok = parse_ledger(
            JSON.stringify({ schema_version: 1, release: '9.14.0', findings: [finding(COMPLETE)] }),
            'fixture',
        );
        expect(ok.findings).toHaveLength(1);
        expect(() => parse_ledger('{', 'fixture')).toThrow(/invalid JSON/u);
        expect(() =>
            parse_ledger(JSON.stringify({ schema_version: 2, release: 'x', findings: [] }), 'fixture'),
        ).toThrow(/schema_version/u);
        expect(() =>
            parse_ledger(
                JSON.stringify({ schema_version: 1, release: 'x', findings: [{ severity: 'high' }] }),
                'fixture',
            ),
        ).toThrow(/finding_id/u);
    });
});

describe('finding_id stability', () => {
    it('matches the retro-computed 9.14.0 symlink finding id', () => {
        expect(
            findingId({
                kind: 'security',
                title:
                    'Skill-catalog walk (`iter_skills`) dereferences symlinks without escapes-package-root check, enabling traversal outside repo boundaries',
                file: 'src/scripts/update_counts.ts',
            }),
        ).toBe('3ddcca7957b4');
    });
});

/**
 * Absence is not evidence of zero.
 *
 * Before this split, `check_finding_dispositions --release 14.16.0` exited 0 on
 * an absent ledger for a version that had already shipped — a released version
 * with no record read as "no findings". Both directions are pinned here on
 * purpose: a test that only asserts the RED half cannot catch the day the
 * predicate inverts and answers "unreleased" for everything, which restores the
 * old green with no visible change.
 */
describe('releaseStatus — the released-vs-unreleased discriminator', () => {
    const REMOTE_UNAVAILABLE = { remote: 'unavailable' } as const;

    it('released: a local tag hit is authoritative, with no remote needed', () => {
        expect(
            releaseStatus({ localTagHit: true, tagsComplete: false, ...REMOTE_UNAVAILABLE }),
        ).toBe('released');
    });

    it('unreleased: a miss against a COMPLETE tag list is authoritative', () => {
        expect(
            releaseStatus({ localTagHit: false, tagsComplete: true, ...REMOTE_UNAVAILABLE }),
        ).toBe('unreleased');
    });

    it('released: a miss against an INCOMPLETE list defers to the remote', () => {
        expect(
            releaseStatus({ localTagHit: false, tagsComplete: false, remote: 'released' }),
        ).toBe('released');
    });

    it('unreleased: the remote may also settle it the other way', () => {
        expect(
            releaseStatus({ localTagHit: false, tagsComplete: false, remote: 'unreleased' }),
        ).toBe('unreleased');
    });

    it('undeterminable: an incomplete list and no remote answer never passes silently', () => {
        expect(
            releaseStatus({ localTagHit: false, tagsComplete: false, ...REMOTE_UNAVAILABLE }),
        ).toBe('undeterminable');
    });

    it('is sensitive — a miss on an incomplete list is NOT read as unreleased', () => {
        // The inversion the risk register names: if this ever returns
        // 'unreleased' the gate goes green on every absent ledger in CI, where
        // actions/checkout leaves the tag list empty.
        expect(
            releaseStatus({ localTagHit: false, tagsComplete: false, ...REMOTE_UNAVAILABLE }),
        ).not.toBe('unreleased');
    });
});

describe('localTagHit — tag matching, and what must NOT match', () => {
    const TAGS = ['14.15.0', '14.16.0', 'v9.14.0', 'backup/pre-rebase'];

    it('matches this repo bare tags', () => {
        expect(localTagHit('14.16.0', TAGS)).toBe(true);
    });

    it('matches a v-prefixed tag too', () => {
        expect(localTagHit('9.14.0', TAGS)).toBe(true);
    });

    it('does not match an unreleased version', () => {
        expect(localTagHit('99.99.0', TAGS)).toBe(false);
    });

    it('does not prefix-match — 14.1 is not 14.16.0, 14.16.01 is not either', () => {
        expect(localTagHit('14.1', TAGS)).toBe(false);
        expect(localTagHit('14.16.01', TAGS)).toBe(false);
    });

    it('an empty version string matches nothing', () => {
        expect(localTagHit('   ', TAGS)).toBe(false);
    });
});

describe('tags_complete — an empty tag list is never complete', () => {
    it('no tags means the local miss cannot be trusted', () => {
        // The CI case: actions/checkout fetches depth 1 and no tags, so this is
        // the state the gate is actually in when release-validation runs it.
        expect(tags_complete([])).toBe(false);
    });
});

/**
 * A 12-hex finding id looks exactly like a short commit SHA. Three reviewers in
 * the 2026-09 round searched the commit log for one, found nothing, and reported
 * "no fix found". The rendered comment must say what the id is and where its
 * disposition lives — and the assertion below checks the SENTENCE is present,
 * not merely that the comment rendered.
 */
describe('renderReview — a finding id is legible as a finding id', () => {
    const F: Finding = {
        severity: 'high',
        kind: 'security',
        title: 'a blocking finding',
        file: 'src/x.ts',
    } as Finding;

    it('names the id as a finding id, denies it is a commit SHA, and points at the ledger', () => {
        const body = renderReview([F], false);
        expect(body).toContain('is a FINDING id');
        expect(body).toContain('not a commit SHA');
        expect(body).toContain('agents/evidence/release-findings/<version>.json');
    });

    it('places the sentence with the table, not inside the machine block', () => {
        const body = renderReview([F], false);
        const note = body.indexOf('is a FINDING id');
        const machine = body.indexOf('<!-- release-findings-json:');
        expect(note).toBeGreaterThan(-1);
        expect(machine).toBeGreaterThan(-1);
        // A reader of the RENDERED comment must see it; an HTML comment is invisible.
        expect(note).toBeLessThan(machine);
    });

    it('is sensitive — the no-findings comment carries no id note, having no ids', () => {
        expect(renderReview([], false)).not.toContain('is a FINDING id');
    });
});
