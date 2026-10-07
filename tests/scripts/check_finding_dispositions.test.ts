/**
 * Finding-disposition gate (release-truth Phase 3).
 *
 * Pre-registered verify: fixture PR with an undispositioned high finding →
 * release validation red. Plus: the ledger is the record (complete
 * dispositions green), the comment machine-block is only a trigger
 * (reported-but-unrecorded blocking finding red), and finding ids are stable.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    INTEGRITY_FIELDS,
    disposition_summary,
    disposition_tally,
    empty_ledger_problem,
    isBlocking,
    localTagHit,
    merge_ingest,
    releaseStatus,
    tags_complete,
    missing_dispositions,
    parse_comment_findings,
    parse_ledger,
    unrecorded_findings,
    type Ledger,
    type LedgerFinding,
} from '../../src/scripts/check_finding_dispositions.js';
import { coverageLabel } from '../../src/scripts/_lib/review_coverage.js';
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
        expect(missing_dispositions([finding({ kind: 'claim', severity: 'medium' })])).toEqual([]);
        expect(missing_dispositions([finding({ severity: 'low' })])).toEqual([]);
        expect(missing_dispositions([finding({ kind: 'style', severity: 'critical' })])).toEqual([]);
    });
});

describe('blocking classification against self_review_gate', () => {
    // The release gate is deliberately stricter than the merge gate by exactly
    // one cell, security × medium (council 2026-10-07). Every other cell must
    // still agree, so a drift in either direction elsewhere reds this.
    it('isBlocking equals classifyBlocking on every cell except security × medium', () => {
        const severities = ['critical', 'high', 'medium', 'low'] as const;
        const kinds = ['security', 'claim', 'correctness', 'style'] as const;
        for (const severity of severities) {
            for (const kind of kinds) {
                const f: Finding = { severity, kind, title: 't', detail: 'd' };
                const wider = kind === 'security' && severity === 'medium';
                expect(isBlocking({ severity, kind })).toBe(wider ? true : classifyBlocking(f));
            }
        }
    });

    it('a medium security finding blocks the release but not the merge', () => {
        const f: Finding = { severity: 'medium', kind: 'security', title: 't', detail: 'd' };
        expect(isBlocking(f)).toBe(true);
        expect(classifyBlocking(f)).toBe(false);
    });

    it('a medium claim finding blocks neither', () => {
        const f: Finding = { severity: 'medium', kind: 'claim', title: 't', detail: 'd' };
        expect(isBlocking(f)).toBe(false);
        expect(classifyBlocking(f)).toBe(false);
    });

    it('a medium security finding is red undispositioned and on still_open, green on accepted_risk', () => {
        const medium = { severity: 'medium' as const, kind: 'security' as const };
        expect(missing_dispositions([finding(medium)])[0]).toContain('no disposition status');
        expect(
            missing_dispositions([finding({ ...medium, ...COMPLETE, status: 'still_open', commit: undefined })]),
        ).toHaveLength(1);
        expect(
            missing_dispositions([finding({ ...medium, ...COMPLETE, status: 'accepted_risk', commit: undefined })]),
        ).toEqual([]);
    });

    it('a tree-disproved medium security finding does not block', () => {
        expect(isBlocking({ severity: 'medium', kind: 'security', contradicted: 'present at HEAD' })).toBe(false);
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


const _REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The CLI, over a throwaway ledger directory.
 *
 * `--dir` is what makes these cases network-free: every one of them writes the
 * ledger FILE, and the released-vs-unreleased probe (git tags, then the remote)
 * only runs when the file is absent. A present ledger is decided entirely from
 * its own contents.
 */
function runGate(dir: string, release: string): { code: number; out: string } {
    const tsx = path.join(
        _REPO_ROOT,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
    );
    const res = spawnSync(
        tsx,
        [
            path.join(_REPO_ROOT, 'src/scripts/check_finding_dispositions.ts'),
            '--release',
            release,
            '--dir',
            dir,
        ],
        { cwd: _REPO_ROOT, encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 },
    );
    return { code: res.status ?? 1, out: `${res.stdout ?? ''}${res.stderr ?? ''}` };
}

function ledgerDir(body: unknown): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfd-empty-'));
    fs.writeFileSync(path.join(dir, '1.0.0.json'), JSON.stringify(body, null, 2) + '\n', 'utf-8');
    return dir;
}

/**
 * An empty ledger must say why it is empty.
 *
 * The released/unreleased split closed the missing-FILE half. This is the other
 * half, and it was green before: `findings: []` passed while asserting nothing,
 * so the cheapest way to satisfy the gate was to create an empty file — the same
 * silence wearing the shape of a record. Both directions are pinned, because a
 * test that only asserts the red half cannot catch the day the predicate inverts
 * and every empty ledger passes again.
 */
describe('empty_ledger_problem — an unexplained empty ledger is not a record', () => {
    it('an empty finding set with no reason is a problem', () => {
        expect(empty_ledger_problem({ findings: [] })).not.toBeNull();
    });

    it('an empty finding set WITH a reason is fine', () => {
        expect(
            empty_ledger_problem({ findings: [], no_findings_reason: 'the review did not run' }),
        ).toBeNull();
    });

    it('a whitespace-only reason is not a reason', () => {
        expect(empty_ledger_problem({ findings: [], no_findings_reason: '   ' })).not.toBeNull();
    });

    it('a populated finding set never needs one', () => {
        expect(
            empty_ledger_problem({ findings: [finding({ ...COMPLETE })], no_findings_reason: '' }),
        ).toBeNull();
    });
});

describe('exit codes — a present-but-empty ledger is not the same state as an absent one', () => {
    it('present + empty + reason exits 0', () => {
        const dir = ledgerDir({
            schema_version: 1,
            release: '1.0.0',
            findings: [],
            no_findings_reason: 'the self-review call did not complete; nothing was reviewed',
        });
        expect(runGate(dir, '1.0.0').code).toBe(0);
    });

    it('present + empty + NO reason exits 1 — red before this change, green after it regresses', () => {
        const dir = ledgerDir({ schema_version: 1, release: '1.0.0', findings: [] });
        const r = runGate(dir, '1.0.0');
        expect(r.code).toBe(1);
        expect(r.out).toContain('no_findings_reason');
    });

    it('present + dispositioned findings exits 0 and needs no reason', () => {
        const dir = ledgerDir({
            schema_version: 1,
            release: '1.0.0',
            findings: [finding({ ...COMPLETE })],
        });
        expect(runGate(dir, '1.0.0').code).toBe(0);
    });
});

/**
 * The success line reports what it CHECKED, never "all" over a set it did not
 * require.
 *
 * The recorded failure: `--release 16.2.0` printed "all 20 recorded finding(s)
 * for 16.2.0 dispositioned (blocking ones completely)" while the ledger carried
 * a `status` on 2 of 20 rows. The parenthetical was true and nobody reads a
 * parenthetical as a retraction of the word in front of it — eighteen rows had
 * never been adjudicated and the gate's own output said they had.
 *
 * Exit semantics are deliberately unchanged: only a blocking row can fail the
 * gate. What changes is that the line stops claiming the other eighteen.
 */
describe('disposition_tally — blocking and non-blocking counted apart', () => {
    const DISPOSITIONED_BLOCKING = finding({ finding_id: 'aaaaaaaaaaaa', ...COMPLETE });
    const STATUSLESS_NON_BLOCKING = finding({
        finding_id: 'bbbbbbbbbbbb',
        severity: 'medium',
        kind: 'correctness',
        title: 'an advisory finding nobody adjudicated',
    });

    it('counts the two populations separately', () => {
        const t = disposition_tally([DISPOSITIONED_BLOCKING, STATUSLESS_NON_BLOCKING]);
        expect(t).toEqual({
            blockingTotal: 1,
            blockingDispositioned: 1,
            nonBlockingTotal: 1,
            nonBlockingTerminal: 0,
        });
    });

    it('a non-blocking row carrying a terminal status is counted as one', () => {
        const t = disposition_tally([
            finding({ severity: 'low', kind: 'style', status: 'still_open' }),
        ]);
        expect(t.nonBlockingTerminal).toBe(1);
    });

    it('`open` is the initial state, not a terminal one — it does not count', () => {
        // The schema documents `open` as the state a finding starts in. Counting
        // it would make "every row has a status" reachable without anyone having
        // re-read a single finding, which is the claim this split exists to stop.
        const t = disposition_tally([finding({ severity: 'low', kind: 'style', status: 'open' })]);
        expect(t.nonBlockingTerminal).toBe(0);
    });

    it('an unrecognised status does not count as terminal either', () => {
        const t = disposition_tally([finding({ severity: 'low', kind: 'style', status: 'wontfix' })]);
        expect(t.nonBlockingTerminal).toBe(0);
    });

    it('a blocking row short of a complete disposition is not counted as dispositioned', () => {
        const t = disposition_tally([finding({ ...COMPLETE, rationale: '' })]);
        expect(t.blockingTotal).toBe(1);
        expect(t.blockingDispositioned).toBe(0);
    });

    it('renders both counts and never the word "all"', () => {
        const line = disposition_summary(
            disposition_tally([DISPOSITIONED_BLOCKING, STATUSLESS_NON_BLOCKING]),
        );
        expect(line).toBe('blocking 1/1 dispositioned · non-blocking 0/1 carry a terminal status');
        expect(line).not.toContain('all');
    });
});

describe('the --release success line reports the split', () => {
    it('green, and says 0/1 non-blocking rather than "all"', () => {
        const dir = ledgerDir({
            schema_version: 1,
            release: '1.0.0',
            findings: [
                finding({ finding_id: 'aaaaaaaaaaaa', ...COMPLETE }),
                finding({
                    finding_id: 'bbbbbbbbbbbb',
                    severity: 'medium',
                    kind: 'correctness',
                    title: 'an advisory finding nobody adjudicated',
                }),
            ],
        });
        const r = runGate(dir, '1.0.0');
        expect(r.code).toBe(0);
        expect(r.out).toContain('blocking 1/1 dispositioned');
        expect(r.out).toContain('non-blocking 0/1 carry a terminal status');
        // The sensitivity half: the old line is gone, not merely joined.
        expect(r.out).not.toContain('all 2 recorded');
    });
});

/**
 * `fact_claims` survives ingest.
 *
 * `self_review_gate` writes it into the `--findings-out` artifact — the per-run
 * count of findings that quote a supplied fact — and `merge_ingest` carried only
 * the six fields named before it existed, so every ingested ledger dropped it on
 * the floor. The falsifier for the supplied-facts change is a count over the
 * next cut; a count that never reaches the record cannot be read.
 */
describe('fact_claims survives ingest', () => {
    it('an ingested artifact carrying fact_claims lands it in the ledger', () => {
        const ledger: Ledger = { schema_version: 1, release: '1.0.0', findings: [] };
        const { ledger: merged } = merge_ingest(ledger, {
            findings: [],
            coverage: { chunks: 1, filesReviewed: 3, filesTotal: 3, unreviewed: [] },
            fact_claims: { supplied: 2, total: 5 },
        });
        expect((merged as unknown as Record<string, unknown>)['fact_claims']).toEqual({
            supplied: 2,
            total: 5,
        });
    });

    it('is listed among the fields ingest is required to carry', () => {
        expect(INTEGRITY_FIELDS as readonly string[]).toContain('fact_claims');
    });

    it('a second ingest does not overwrite the first run\'s count', () => {
        const ledger = { schema_version: 1, release: '1.0.0', findings: [] } as Ledger;
        merge_ingest(ledger, { findings: [], fact_claims: { supplied: 2 } });
        merge_ingest(ledger, { findings: [], fact_claims: { supplied: 99 } });
        expect((ledger as unknown as Record<string, unknown>)['fact_claims']).toEqual({
            supplied: 2,
        });
    });
});

/**
 * Partial coverage is a stated property of the record.
 *
 * The 16.2.0 ledger's own `coverage` block reads `filesReviewed: 65,
 * filesTotal: 678` — the self-review read under a tenth of the change — and
 * only the WRITER ever read that number back. Every consumer of the record saw
 * a success line that said nothing about how much of the release it covered.
 *
 * A label, never a floor. Raising what the review reads is a spend decision and
 * it stays one; refusing a cut on coverage would force that decision through
 * the back door, which is what decision D1 of the roadmap records.
 */
describe('coverage label — partial coverage is printed, never enforced', () => {
    it('partial: names both numbers and the word partial', () => {
        expect(coverageLabel({ chunks: 6, filesReviewed: 65, filesTotal: 678, unreviewed: [] })).toBe(
            'self-review read 65 of 678 changed files (partial)',
        );
    });

    it('full coverage produces no label — there is nothing to warn about', () => {
        expect(coverageLabel({ filesReviewed: 678, filesTotal: 678 })).toBeNull();
    });

    it('an absent or malformed coverage block produces no label rather than a guess', () => {
        expect(coverageLabel(undefined)).toBeNull();
        expect(coverageLabel({})).toBeNull();
        expect(coverageLabel({ filesReviewed: '65', filesTotal: 678 })).toBeNull();
        expect(coverageLabel({ filesReviewed: 65, filesTotal: 0 })).toBeNull();
    });

    it('the --release success line carries the partial label', () => {
        const dir = ledgerDir({
            schema_version: 1,
            release: '1.0.0',
            findings: [finding({ ...COMPLETE })],
            coverage: { chunks: 6, filesReviewed: 65, filesTotal: 678, unreviewed: [] },
        });
        const r = runGate(dir, '1.0.0');
        expect(r.code).toBe(0);
        expect(r.out).toContain('self-review read 65 of 678 changed files (partial)');
    });

    it('is a label and not a floor — partial coverage still exits 0', () => {
        const dir = ledgerDir({
            schema_version: 1,
            release: '1.0.0',
            findings: [finding({ ...COMPLETE })],
            coverage: { chunks: 6, filesReviewed: 1, filesTotal: 678, unreviewed: [] },
        });
        expect(runGate(dir, '1.0.0').code).toBe(0);
    });

    it('is sensitive — a fully covered ledger prints no partial label', () => {
        const dir = ledgerDir({
            schema_version: 1,
            release: '1.0.0',
            findings: [finding({ ...COMPLETE })],
            coverage: { chunks: 1, filesReviewed: 678, filesTotal: 678, unreviewed: [] },
        });
        expect(runGate(dir, '1.0.0').out).not.toContain('(partial)');
    });
});
