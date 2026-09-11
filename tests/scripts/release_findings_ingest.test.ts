import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    INTEGRITY_FIELDS,
    type Ledger,
    empty_ledger_problem,
    merge_ingest,
} from '../../src/scripts/check_finding_dispositions.js';
import {
    FINDINGS_WORKFLOW,
    dispositionStopMessage,
    ledgerAbsentMessage,
    ledgerOnBranchArgv,
    ledgerRelPath,
} from '../../src/scripts/_lib/release_findings_ingest.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function emptyLedger(release = '9.9.9'): Ledger {
    return { schema_version: 1, release, findings: [] };
}

// The workflow this module names is the one that PRODUCES the ledger. Every
// assertion here is about a coupling that, if broken, leaves the release
// stopping on a missing file with a message pointing at a job that no longer
// does the thing — a failure whose cause is one file away and invisible.
describe('the workflow this module points the operator at', () => {
    const workflow = fs.readFileSync(
        path.join(REPO_ROOT, '.github', 'workflows', FINDINGS_WORKFLOW),
        'utf-8',
    );

    it('exists', () => {
        expect(workflow.length).toBeGreaterThan(0);
    });

    it('carries the job that commits the ledger', () => {
        expect(workflow).toContain('ingest-release-ledger:');
    });

    // The whole reason the ingest lives in CI: the ledger has to be committed,
    // and a job without write scope cannot do it.
    it('grants that job the write scope it needs, and nothing broader', () => {
        expect(workflow).toMatch(/ingest-release-ledger:[\s\S]*?permissions:\s*\n\s*contents: write/);
        expect(workflow).toMatch(/^permissions:\n\s*contents: read/m);
    });

    it('restricts it to a release branch', () => {
        expect(workflow).toContain("startsWith(github.head_ref, 'release/')");
    });

    // A fork PR gets a read-only token, so the push would fail rather than
    // skip; and a bot actor would re-trigger the job its own push created.
    it('restricts it to the same repository and a non-bot actor', () => {
        expect(workflow).toContain('github.event.pull_request.head.repo.full_name');
        expect(workflow).toContain("github.actor != 'github-actions[bot]'");
    });

    it('ingests the artifact of ITS OWN run, so no run-picking is possible', () => {
        expect(workflow).toContain('gh run download "${{ github.run_id }}"');
    });

    it('commits path-scoped, so nothing else rides in', () => {
        expect(workflow).toMatch(/git commit -m .+ -- "\$ledger"/);
    });

    it('ignores a missing findings file rather than failing — absence is normal', () => {
        expect(workflow).toContain('if-no-files-found: ignore');
        expect(workflow).toContain('nothing to ingest');
    });
});

describe('ledgerOnBranchArgv', () => {
    // Three refs, three answers, one right. The working tree says "a file
    // exists here". The LOCAL branch ref says "a commit here carries it" — true
    // the moment the ingest commit lands, push or no push, which is why the
    // first fix answered identically to the filesystem check it replaced. Only
    // the remote-tracking ref goes false when the push fails, and the merge
    // reads the remote.
    it('asks about the remote-tracking ref, not the local branch', () => {
        const argv = ledgerOnBranchArgv('origin', 'release/1.2.3', 'a/b.json');
        expect(argv).toEqual(['cat-file', '-e', 'origin/release/1.2.3:a/b.json']);
    });

    it('takes the remote as a parameter, so a fork is not assumed to be origin', () => {
        expect(ledgerOnBranchArgv('upstream', 'release/1.2.3', 'a/b.json')[2]).toBe(
            'upstream/release/1.2.3:a/b.json',
        );
    });
});

describe('merge_ingest — the integrity fields the old ingest dropped', () => {
    const artifact = {
        schema_version: 1,
        review_independence: 'single-member',
        context_relation: 'unknown',
        acceptance_status: 'provisional',
        assurance: 'single-pass',
        reviewers: ['anthropic'],
        coverage: { chunks: 6, filesReviewed: 181, filesTotal: 258 },
        findings: [
            { finding_id: 'a1', severity: 'high', kind: 'security', title: 'x' },
            { finding_id: 'b2', severity: 'low', kind: 'style', title: 'y' },
        ],
    };

    it('carries every integrity field onto a fresh ledger', () => {
        const { ledger, carried } = merge_ingest(emptyLedger(), { ...artifact });
        for (const key of INTEGRITY_FIELDS) {
            expect(ledger[key]).toEqual(artifact[key as keyof typeof artifact]);
        }
        expect(carried).toEqual([...INTEGRITY_FIELDS]);
    });

    it('produces the same field set a hand-written ledger carries', () => {
        const { ledger } = merge_ingest(emptyLedger('15.0.0'), { ...artifact });
        const committed = JSON.parse(
            fs.readFileSync(
                path.join(REPO_ROOT, 'agents', 'evidence', 'release-findings', '14.23.0.json'),
                'utf-8',
            ),
        ) as Record<string, unknown>;
        expect(new Set(Object.keys(committed))).toEqual(new Set(Object.keys(ledger)));
    });

    it('adds each finding once, by id', () => {
        const first = merge_ingest(emptyLedger(), { ...artifact });
        expect(first.added).toBe(2);
        const second = merge_ingest(first.ledger, { ...artifact });
        expect(second.added).toBe(0);
        expect(second.ledger.findings).toHaveLength(2);
    });

    it('does not restate an integrity claim the ledger already carries', () => {
        const { ledger } = merge_ingest(emptyLedger(), { ...artifact });
        ledger['review_independence'] = 'cross-model';
        const second = merge_ingest(ledger, { ...artifact });
        expect(second.ledger['review_independence']).toBe('cross-model');
        expect(second.carried).toEqual([]);
    });

    it('leaves a disposition a human wrote untouched', () => {
        const { ledger } = merge_ingest(emptyLedger(), { ...artifact });
        ledger.findings[0]!.status = 'false_positive';
        ledger.findings[0]!.rationale = 'the suffix cannot be reached';
        const second = merge_ingest(ledger, { ...artifact });
        expect(second.ledger.findings[0]!.status).toBe('false_positive');
        expect(second.ledger.findings[0]!.rationale).toBe('the suffix cannot be reached');
    });

    it('reports nothing carried when the artifact has no integrity fields', () => {
        const { carried, added } = merge_ingest(emptyLedger(), { findings: artifact.findings });
        expect(carried).toEqual([]);
        expect(added).toBe(2);
    });

    it('returns the ledger it mutated, so a caller may use either', () => {
        const input = emptyLedger();
        const { ledger } = merge_ingest(input, { ...artifact });
        expect(ledger).toBe(input);
    });
});

// A clean review used to deadlock the release: `findings: []` ingests to an
// empty ledger, empty_ledger_problem refuses it, and the release then demanded
// dispositions for zero findings — an instruction nobody can follow, repeated
// forever by --resume.
describe('merge_ingest — a review that found nothing', () => {
    const clean = {
        schema_version: 1,
        review_independence: 'single-member',
        acceptance_status: 'provisional',
        assurance: 'single-pass',
        reviewers: ['anthropic'],
        coverage: { chunks: 2, filesReviewed: 12, filesTotal: 12 },
        findings: [],
    };

    it('writes a no_findings_reason so the empty ledger is legible', () => {
        const { ledger, reasoned } = merge_ingest(emptyLedger(), { ...clean });
        expect(reasoned).toBe(true);
        expect(empty_ledger_problem(ledger)).toBeNull();
    });

    it('states the coverage, so the reason is checkable rather than an assurance', () => {
        const { ledger } = merge_ingest(emptyLedger(), { ...clean });
        expect(ledger.no_findings_reason).toContain('12 of 12');
    });

    it('still writes a reason when the artifact carries no coverage block', () => {
        const { ledger } = merge_ingest(emptyLedger(), { findings: [] });
        expect(empty_ledger_problem(ledger)).toBeNull();
    });

    // Without the key check, any JSON object reads as an empty finding set and
    // the sentence asserts a review that never happened — in the durable
    // record, which is worse than the deadlock it replaces.
    it('asserts nothing about a file that does not declare a findings array', () => {
        const { ledger, reasoned } = merge_ingest(emptyLedger(), { schema_version: 1 });
        expect(reasoned).toBe(false);
        expect(ledger.no_findings_reason).toBeUndefined();
        expect(empty_ledger_problem(ledger)).not.toBeNull();
    });

    it('treats a non-array findings value as undeclared rather than empty', () => {
        const { reasoned } = merge_ingest(emptyLedger(), { findings: null });
        expect(reasoned).toBe(false);
    });

    it('does not overwrite a reason a human already wrote', () => {
        const l = emptyLedger();
        l.no_findings_reason = 'the review was skipped deliberately, see the record';
        const { ledger, reasoned } = merge_ingest(l, { ...clean });
        expect(reasoned).toBe(false);
        expect(ledger.no_findings_reason).toContain('skipped deliberately');
    });

    it('writes no reason when there are findings to disposition', () => {
        const { ledger, reasoned } = merge_ingest(emptyLedger(), {
            findings: [{ finding_id: 'a1', severity: 'high', kind: 'security', title: 'x' }],
        });
        expect(reasoned).toBe(false);
        expect(ledger.no_findings_reason).toBeUndefined();
    });
});

describe('dispositionStopMessage', () => {
    it('carries the gate report, which is the reason the release stopped', () => {
        const msg = dispositionStopMessage('1.2.3', 'scanned: 1\n- `a1`: no disposition', 1, 'x');
        expect(msg).toContain('- `a1`: no disposition');
    });

    it('names the file and the way forward', () => {
        const msg = dispositionStopMessage('1.2.3', 'report', 4, 'task release -- --resume --yes');
        expect(msg).toContain(ledgerRelPath('1.2.3'));
        expect(msg).toContain('task release -- --resume --yes');
    });

    // The old message asserted "N blocking findings carry no disposition" for
    // every refusal shape. At N = 0 — an empty ledger with no reason, a `fixed`
    // with no commit — that is an instruction nobody can follow.
    it('claims no blocking count when there is none', () => {
        const msg = dispositionStopMessage('1.2.3', 'the ledger records nothing', 0, 'x');
        expect(msg).not.toContain('0 of them');
        expect(msg).toContain('the ledger records nothing');
    });

    it('mentions the count only when it is non-zero', () => {
        expect(dispositionStopMessage('1.2.3', 'r', 3, 'x')).toContain('3 of them');
    });

    it('says a human writes the disposition, because that is why it stops', () => {
        expect(dispositionStopMessage('1.2.3', 'r', 1, 'x')).toContain(
            'no automation may write one',
        );
    });

    it('does not pretend the gate spoke when it printed nothing', () => {
        expect(dispositionStopMessage('1.2.3', '   ', 0, 'x')).toContain('the gate printed nothing');
    });
});

describe('ledgerAbsentMessage', () => {
    it('names the ref it actually checked, not just the branch', () => {
        const msg = ledgerAbsentMessage('1.2.3', 'release/1.2.3', 'origin');
        expect(msg).toContain('origin/release/1.2.3');
        expect(msg).toContain(ledgerRelPath('1.2.3'));
    });

    it('says why continuing would be worse than stopping', () => {
        expect(ledgerAbsentMessage('1.2.3', 'b', 'origin')).toContain(
            'reds every pull request in the repository',
        );
    });

    // Most causes are ordinary and one is a standing cost. An operator who
    // meets this message needs to know which, in the order worth checking.
    it('names waiting first, and the keyless case as its own answer', () => {
        const msg = ledgerAbsentMessage('1.2.3', 'b', 'origin');
        expect(msg).toContain('has not finished yet');
        expect(msg).toContain('ANTHROPIC_API_KEY');
        expect(msg).toContain('no_findings_reason');
    });

    it('points at the workflow that produces the file', () => {
        expect(ledgerAbsentMessage('1.2.3', 'b', 'origin')).toContain(FINDINGS_WORKFLOW);
    });
});

describe('ledgerRelPath', () => {
    it('resolves beside the committed ledgers', () => {
        expect(fs.existsSync(path.join(REPO_ROOT, ledgerRelPath('14.23.0')))).toBe(true);
    });
});
