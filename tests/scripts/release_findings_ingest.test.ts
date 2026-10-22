import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    INTEGRITY_FIELDS,
    type Ledger,
    empty_ledger_problem,
    merge_ingest,
} from '../../src/scripts/check_finding_dispositions.js';
import { assuranceOverrideLimitation, ledgerRelPath } from '../../src/scripts/_lib/release_findings_ingest.js';

const FINDINGS_WORKFLOW = 'self-review-gate.yml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function emptyLedger(release = '9.9.9'): Ledger {
    return { schema_version: 1, release, findings: [] };
}

// A release waits for no review ledger since 2026-10-22 (owner): the jobs that
// built one and pushed it onto the release branch mid-release are gone, and
// nothing in the workflow may write to the repository.
describe('the self-review workflow commits nothing', () => {
    const workflow = fs.readFileSync(
        path.join(REPO_ROOT, '.github', 'workflows', FINDINGS_WORKFLOW),
        'utf-8',
    );

    it('exists', () => {
        expect(workflow.length).toBeGreaterThan(0);
    });

    it('keeps a read-only floor', () => {
        expect(workflow).toMatch(/^permissions:\n\s*contents: read/m);
    });

    it('ignores a missing findings file rather than failing — absence is normal', () => {
        expect(workflow).toMatch(/name: self-review-findings[\s\S]*?if-no-files-found: ignore/);
    });

    it('carries no ledger job and grants no write scope to the repository', () => {
        expect(workflow).not.toMatch(/^  (ingest|commit)-release-ledger:/m);
        expect(workflow).not.toMatch(/contents: write/);
        expect(workflow).not.toContain('RELEASE_PR_TOKEN');
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
        // The seventh field, carried since 2026-10-01. `self_review_gate` has
        // written it under `--findings-out` for longer than that, and
        // `merge_ingest` dropped it — so the falsifier for the supplied-facts
        // change never reached the record it is a falsifier for. The fixture
        // tracks the producer's real shape (`factClaimCounts`), because both
        // assertions below are stated over the WHOLE field set and a fixture
        // one field short would quietly narrow them.
        fact_claims: { asserting_removal: 1, disproved_by_tree: 0 },
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

    // Stated as a property of the ingest, not as equality with one historical
    // artifact. Pinning it to `14.23.0.json` made any later edit to a PAST
    // release's ledger — a field added, a re-ingest, a schema bump — fail a
    // test about `merge_ingest`.
    it('emits the ledger identity, the findings, and every integrity field — and nothing else', () => {
        const { ledger } = merge_ingest(emptyLedger('15.0.0'), { ...artifact });
        expect(new Set(Object.keys(ledger))).toEqual(
            new Set(['schema_version', 'release', 'findings', ...INTEGRITY_FIELDS]),
        );
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

describe('ledgerRelPath', () => {
    it('resolves beside the committed ledgers', () => {
        expect(fs.existsSync(path.join(REPO_ROOT, ledgerRelPath('14.23.0')))).toBe(true);
    });
});

/**
 * A cut taken on an override says so where a consumer reads, not only where a
 * releaser does. The override lives inside the ledger JSON; without this line
 * the published notes of an unreviewed release are byte-indistinguishable from
 * those of a reviewed one, which is the silence-reads-as-acceptance defect
 * `assurance` exists to end one layer down.
 */
describe('assuranceOverrideLimitation', () => {
    function root(body: unknown | null): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aol-'));
        if (body !== null) {
            const abs = path.join(dir, ledgerRelPath('1.2.3'));
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.writeFileSync(abs, JSON.stringify(body), 'utf-8');
        }
        return dir;
    }

    it('names the version and the directive the cut was taken on', () => {
        const line = assuranceOverrideLimitation(
            '1.2.3',
            root({
                assurance: 'unreviewed',
                assurance_override: 'agents/evidence/owner-directives/d.md',
                findings: [],
            }),
        );
        expect(line).toContain('1.2.3');
        expect(line).toContain('agents/evidence/owner-directives/d.md');
        expect(line).toContain('without a self-review');
    });

    it('prints the override as one line with no markdown, keeping a path intact', () => {
        const line = assuranceOverrideLimitation(
            '1.2.3',
            root({
                assurance: 'unreviewed',
                assurance_override: 'agents/evidence/owner_directives/d.md\n## Shipped clean\n[x](http://e)',
                findings: [],
            }),
        );
        expect(line).toContain('agents/evidence/owner_directives/d.md');
        expect(line).not.toContain('\n');
        expect(line).not.toContain('## Shipped');
        expect(line).not.toContain('](http');
    });

    it('is silent on every ordinary release — no ledger, no override, or reviewed', () => {
        expect(assuranceOverrideLimitation('1.2.3', root(null))).toBeNull();
        expect(
            assuranceOverrideLimitation('1.2.3', root({ assurance: 'unreviewed', findings: [] })),
        ).toBeNull();
        expect(
            assuranceOverrideLimitation(
                '1.2.3',
                root({
                    assurance: 'single-pass',
                    assurance_override: 'agents/evidence/owner-directives/d.md',
                    findings: [],
                }),
            ),
        ).toBeNull();
    });

    it('a malformed ledger is the disposition gate’s finding, not a crash here', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aol-bad-'));
        const abs = path.join(dir, ledgerRelPath('1.2.3'));
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, '{ not json', 'utf-8');
        expect(assuranceOverrideLimitation('1.2.3', dir)).toBeNull();
    });
});
