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
