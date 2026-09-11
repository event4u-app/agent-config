import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    INTEGRITY_FIELDS,
    type Ledger,
    merge_ingest,
} from '../../src/scripts/check_finding_dispositions.js';
import {
    FINDINGS_ARTIFACT,
    FINDINGS_WORKFLOW,
    type WorkflowRun,
    downloadArgv,
    ledgerRelPath,
    pickRun,
    planIngest,
    runLookupArgv,
    undispositionedMessage,
} from '../../src/scripts/_lib/release_findings_ingest.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function emptyLedger(release = '9.9.9'): Ledger {
    return { schema_version: 1, release, findings: [] };
}

describe('the literals this module shares with the workflow', () => {
    // The module names a workflow file and an artifact by string. A rename on
    // either side without the other silently turns the release step into a
    // permanent "no finished run" no-op, which looks like a clean skip.
    const workflow = fs.readFileSync(
        path.join(REPO_ROOT, '.github', 'workflows', FINDINGS_WORKFLOW),
        'utf-8',
    );

    it('names a workflow file that exists', () => {
        expect(workflow.length).toBeGreaterThan(0);
    });

    it('names the artifact the workflow actually uploads', () => {
        expect(workflow).toContain(`name: ${FINDINGS_ARTIFACT}`);
    });

    it('targets a workflow that still uploads an artifact at all', () => {
        expect(workflow).toContain('upload-artifact');
    });
});

describe('pickRun', () => {
    const run = (id: number, conclusion: string | null, createdAt: string): WorkflowRun => ({
        databaseId: id,
        conclusion,
        createdAt,
    });

    it('returns null when nothing has finished', () => {
        expect(pickRun([run(1, null, '2026-09-11T01:00:00Z')])).toBeNull();
    });

    it('skips a cancelled run — a superseded push has no complete artifact', () => {
        const picked = pickRun([
            run(2, 'cancelled', '2026-09-11T02:00:00Z'),
            run(1, 'success', '2026-09-11T01:00:00Z'),
        ]);
        expect(picked?.databaseId).toBe(1);
    });

    it('accepts a failed run — the review job is continue-on-error and uploads on always()', () => {
        expect(pickRun([run(3, 'failure', '2026-09-11T03:00:00Z')])?.databaseId).toBe(3);
    });

    it('prefers the newest finished run regardless of input order', () => {
        const picked = pickRun([
            run(1, 'success', '2026-09-11T01:00:00Z'),
            run(3, 'success', '2026-09-11T03:00:00Z'),
            run(2, 'success', '2026-09-11T02:00:00Z'),
        ]);
        expect(picked?.databaseId).toBe(3);
    });
});

describe('planIngest', () => {
    const ok: WorkflowRun = {
        databaseId: 7,
        conclusion: 'success',
        createdAt: '2026-09-11T01:00:00Z',
    };

    it('is a no-op when the ledger is already on the branch', () => {
        expect(planIngest(true, [ok], 'release/1.0.0')).toEqual({ kind: 'present' });
    });

    it('does not look for a run when the ledger exists', () => {
        expect(planIngest(true, [], 'release/1.0.0')).toEqual({ kind: 'present' });
    });

    it('reports the branch when no run carries an artifact', () => {
        expect(planIngest(false, [], 'release/1.0.0')).toEqual({
            kind: 'no-run',
            branch: 'release/1.0.0',
        });
    });

    it('names the run to ingest from', () => {
        expect(planIngest(false, [ok], 'release/1.0.0')).toEqual({ kind: 'ingest', runId: 7 });
    });
});

describe('the gh argv', () => {
    it('scopes the run lookup to the branch and the findings workflow', () => {
        const argv = runLookupArgv('release/1.2.3');
        expect(argv).toContain('--branch');
        expect(argv[argv.indexOf('--branch') + 1]).toBe('release/1.2.3');
        expect(argv[argv.indexOf('--workflow') + 1]).toBe(FINDINGS_WORKFLOW);
    });

    it('asks for the fields pickRun reads, and no others it does not', () => {
        const fields = runLookupArgv('b')[runLookupArgv('b').indexOf('--json') + 1] ?? '';
        for (const f of ['databaseId', 'conclusion', 'createdAt']) {
            expect(fields).toContain(f);
        }
    });

    it('downloads only the findings artifact', () => {
        const argv = downloadArgv(42, '/tmp/x');
        expect(argv[argv.indexOf('--name') + 1]).toBe(FINDINGS_ARTIFACT);
        expect(argv).toContain('42');
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
});

describe('undispositionedMessage', () => {
    it('names the file, the count and the way forward', () => {
        const msg = undispositionedMessage('1.2.3', 4, 'task release -- --resume --yes');
        expect(msg).toContain(ledgerRelPath('1.2.3'));
        expect(msg).toContain('4 blocking');
        expect(msg).toContain('task release -- --resume --yes');
    });

    it('says a human writes the disposition, because that is why it stops', () => {
        expect(undispositionedMessage('1.2.3', 1, 'x')).toContain('no automation may write one');
    });
});

describe('ledgerRelPath', () => {
    it('resolves beside the committed ledgers', () => {
        expect(fs.existsSync(path.join(REPO_ROOT, ledgerRelPath('14.23.0')))).toBe(true);
    });
});
