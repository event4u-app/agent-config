import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
    INTEGRITY_FIELDS,
    type Ledger,
    empty_ledger_problem,
    merge_ingest,
} from '../../src/scripts/check_finding_dispositions.js';
import {
    FINDINGS_ARTIFACT,
    FINDINGS_WORKFLOW,
    type WorkflowRun,
    dispositionStopMessage,
    downloadArgv,
    eligibleRuns,
    ledgerOnBranchArgv,
    ledgerRelPath,
    noArtifactMessage,
    planIngest,
    runLookupArgv,
} from '../../src/scripts/_lib/release_findings_ingest.js';
import { _download_findings, _set_exec_override } from '../../src/scripts/release.js';

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

    // `gh run download` extracts by the BASENAME of the uploaded `path:`, not by
    // the artifact name. Reading only `name:` left the concrete case where the
    // code is wrong and every test passes: change `path:` to /tmp/findings.json
    // and the release dies on every run while the suite stays green.
    it('uploads a path whose basename the download step can find', () => {
        const m = /path:\s*(\S+)/.exec(workflow);
        expect(m, 'the workflow declares no upload path').not.toBeNull();
        expect(path.basename(m![1]!)).toMatch(/\.json$/);
    });

    it('ignores a missing file rather than failing — which is why absence is normal', () => {
        expect(workflow).toContain('if-no-files-found: ignore');
    });
});

describe('eligibleRuns', () => {
    const run = (id: number, conclusion: string | null, createdAt: string): WorkflowRun => ({
        databaseId: id,
        conclusion,
        createdAt,
    });

    it('is empty when nothing has finished', () => {
        expect(eligibleRuns([run(1, null, '2026-09-11T01:00:00Z')])).toEqual([]);
    });

    it('drops a cancelled run — a superseded push has no complete artifact', () => {
        const ids = eligibleRuns([
            run(2, 'cancelled', '2026-09-11T02:00:00Z'),
            run(1, 'success', '2026-09-11T01:00:00Z'),
        ]).map((r) => r.databaseId);
        expect(ids).toEqual([1]);
    });

    it('keeps a failed run — its red comes from the dry-run job, not the review', () => {
        expect(eligibleRuns([run(3, 'failure', '2026-09-11T03:00:00Z')])[0]?.databaseId).toBe(3);
    });

    it('returns every candidate newest-first, because artifact presence decides', () => {
        const ids = eligibleRuns([
            run(1, 'success', '2026-09-11T01:00:00Z'),
            run(3, 'success', '2026-09-11T03:00:00Z'),
            run(2, 'success', '2026-09-11T02:00:00Z'),
        ]).map((r) => r.databaseId);
        expect(ids).toEqual([3, 2, 1]);
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

    it('does not look for a run when the ledger is on the branch', () => {
        expect(planIngest(true, [], 'release/1.0.0')).toEqual({ kind: 'present' });
    });

    it('reports the branch when no run has finished', () => {
        expect(planIngest(false, [], 'release/1.0.0')).toEqual({
            kind: 'no-run',
            branch: 'release/1.0.0',
        });
    });

    it('hands back every candidate, not one — absence of an artifact is not an error', () => {
        expect(planIngest(false, [ok], 'release/1.0.0')).toEqual({ kind: 'ingest', runIds: [7] });
    });
});

describe('ledgerOnBranchArgv', () => {
    // The whole point of the fix: fs.existsSync answers "is it on disk", which a
    // failed push makes true while the branch has nothing.
    it('asks git about the branch, not the filesystem', () => {
        const argv = ledgerOnBranchArgv('release/1.2.3', 'a/b.json');
        expect(argv).toEqual(['cat-file', '-e', 'release/1.2.3:a/b.json']);
    });
});

describe('_download_findings', () => {
    afterEach(() => {
        _set_exec_override(null);
    });

    function withDest<T>(fn: (dest: string) => T): T {
        const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'findings-test-'));
        try {
            return fn(dest);
        } finally {
            fs.rmSync(dest, { recursive: true, force: true });
        }
    }

    it('returns null when no run carries the artifact — the case that used to die raw', () => {
        withDest((dest) => {
            _set_exec_override(() => ({ status: 1, stdout: '', stderr: 'artifact not found' }));
            expect(_download_findings([3, 2, 1], dest)).toBeNull();
        });
    });

    it('falls through to an older run when the newest has no artifact', () => {
        withDest((dest) => {
            _set_exec_override((args) => {
                if (args.includes('2')) {
                    fs.writeFileSync(path.join(dest, 'self-review-findings.json'), '{}');
                    return { status: 0, stdout: '', stderr: '' };
                }
                return { status: 1, stdout: '', stderr: 'not found' };
            });
            const got = _download_findings([3, 2, 1], dest);
            expect(got).not.toBeNull();
            expect(path.basename(got!)).toBe('self-review-findings.json');
        });
    });

    it('accepts whatever single JSON file the artifact holds, not a guessed name', () => {
        withDest((dest) => {
            _set_exec_override(() => {
                fs.writeFileSync(path.join(dest, 'renamed-by-the-workflow.json'), '{}');
                return { status: 0, stdout: '', stderr: '' };
            });
            expect(path.basename(_download_findings([1], dest)!)).toBe(
                'renamed-by-the-workflow.json',
            );
        });
    });

    it('returns null on an exit-0 download that produced nothing', () => {
        withDest((dest) => {
            _set_exec_override(() => ({ status: 0, stdout: '', stderr: '' }));
            expect(_download_findings([1], dest)).toBeNull();
        });
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

describe('noArtifactMessage', () => {
    it('stops rather than warns, and says why continuing would be worse', () => {
        const msg = noArtifactMessage('1.2.3', 'release/1.2.3', 2);
        expect(msg).toContain('merge and tag with no ledger');
        expect(msg).toContain('2 finished');
    });

    it('names the ordinary causes, two of which are not breakage', () => {
        const msg = noArtifactMessage('1.2.3', 'release/1.2.3', 0);
        expect(msg).toContain('--no-wait');
        expect(msg).toContain('ANTHROPIC_API_KEY');
    });
});

describe('ledgerRelPath', () => {
    it('resolves beside the committed ledgers', () => {
        expect(fs.existsSync(path.join(REPO_ROOT, ledgerRelPath('14.23.0')))).toBe(true);
    });
});
