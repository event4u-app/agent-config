import { execFileSync } from 'node:child_process';
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

    // Two jobs, and the split is the point. `ingest-release-ledger` runs
    // `npm ci` plus a script from the checked-out release branch, so it
    // executes third-party lifecycle code; `commit-release-ledger` carries the
    // write credential. One job doing both put a repo-write token in
    // `.git/config` next to `npm ci`.
    it('carries both halves: the build and the commit', () => {
        expect(workflow).toContain('ingest-release-ledger:');
        expect(workflow).toContain('commit-release-ledger:');
        expect(workflow).toMatch(/commit-release-ledger:[\s\S]*?needs: ingest-release-ledger/);
    });

    it('grants write scope to the commit job only, over a read-only floor', () => {
        expect(workflow).toMatch(/^permissions:\n\s*contents: read/m);
        expect(workflow).toMatch(
            /commit-release-ledger:[\s\S]*?permissions:\n\s*contents: write\n\s*actions: read/,
        );
        expect(workflow).toMatch(
            /ingest-release-ledger:[\s\S]*?permissions:\n\s*contents: read\n\s*actions: read/,
        );
    });

    // The half that makes the split worth its line count: the job holding the
    // credential must not install anything or run a repository script.
    it('installs nothing in the job that holds the credential', () => {
        const commitJob = workflow.slice(workflow.indexOf('  commit-release-ledger:'));
        expect(commitJob).not.toContain('npm ci');
        expect(commitJob).not.toContain('setup-node');
        expect(commitJob).not.toContain('./scripts-run');
    });

    // A job-level `permissions:` block REPLACES the workflow map. Declaring
    // only `contents: write` left `actions: none`, so the artifact reads 403 —
    // and a tolerated 403 read as a review that found nothing.
    it('re-declares the actions read scope both jobs need for the artifacts', () => {
        expect(workflow.match(/actions: read/g)?.length).toBeGreaterThanOrEqual(2);
    });

    it('restricts both to a release branch', () => {
        expect(workflow.match(/startsWith\(github\.head_ref, 'release\/'\)/g)?.length).toBe(2);
    });

    // A fork PR gets a read-only token, so the push would fail rather than skip.
    it('restricts them to the same repository', () => {
        expect(
            workflow.match(/github\.event\.pull_request\.head\.repo\.full_name/g)?.length,
        ).toBe(2);
    });

    // The actor condition was the recursion guard, and it skipped the job on
    // precisely the CI-native release path — where the PR is opened by
    // GITHUB_TOKEN, so the actor IS the bot and the one flow that cannot ingest
    // by hand never got a ledger at all.
    it('does not gate on the actor, which skipped the CI-native release path', () => {
        expect(workflow).not.toContain("github.actor != 'github-actions[bot]'");
    });

    // The push must produce checks, or it lands inside the release's own check
    // wait on a head that can never satisfy a protection requiring one. A
    // GITHUB_TOKEN push creates no run; a PAT push does.
    it('checks out with the PAT, so its push creates the checks the release waits for', () => {
        expect(workflow).toContain('token: ${{ secrets.RELEASE_PR_TOKEN || github.token }}');
    });

    it('declines to push when the PAT is absent, rather than deadlocking the wait', () => {
        expect(workflow).toContain("HAVE_RELEASE_PR_TOKEN: ${{ secrets.RELEASE_PR_TOKEN != '' }}");
        expect(workflow).toMatch(/if \[ "\$HAVE_RELEASE_PR_TOKEN" != 'true' \]/);
    });

    // A PAT push re-enters this workflow by design. The bound is the head
    // commit's own subject, which terminates the chain at one push without
    // depending on who the actor was — and it has to hold in BOTH jobs, or the
    // one without it does the work its sibling declined.
    it('bounds its own recursion on the head commit subject, in both jobs', () => {
        expect(
            workflow.match(/if \[ "\$\(git log -1 --pretty=%s\)" = "\$subject" \]/g)?.length,
        ).toBe(2);
        expect(workflow.match(/subject="chore\(release\): ingest self-review findings/g)?.length)
            .toBe(2);
    });

    it('reads the artifacts of ITS OWN run, so no run-picking is possible', () => {
        expect(workflow).toContain('gh run download "$RUN_ID"');
        expect(workflow).toContain('RUN_ID: ${{ github.run_id }}');
    });

    // `gh run download || true` collapsed four worlds into one green path: a
    // missing permission, an API outage, a renamed artifact, and a review that
    // genuinely found nothing. Only the last is ordinary, so existence is asked
    // first and a failed LOOKUP is an error rather than a shrug.
    it('asks whether the artifact exists instead of tolerating a failed download', () => {
        expect(workflow).not.toMatch(/gh run download[^\n]*\|\| true/);
        expect(workflow).toContain("--jq '.artifacts[].name'");
        expect(workflow).toContain("grep -qx 'self-review-findings'");
    });

    // A branch that moved between checkout and push is ordinary — a maintainer
    // pushing a disposition fix, a resumed release re-pushing. Failing the job
    // there makes the release die naming a bot check; retrying once and then
    // standing down lets step 7 say what actually happened.
    it('rebuilds the commit once on a moved branch, then stands down quietly', () => {
        expect(workflow).toContain('git fetch origin "$HEAD_REF"');
        expect(workflow).toContain('git reset --hard "origin/$HEAD_REF"');
        expect(workflow).toMatch(/::warning::could not push the ledger/);
    });

    // THE defect of the first CI attempt: `git diff --quiet -- <path>` exits 0
    // on an UNTRACKED path, so a first-ever ledger reported "already current"
    // and the job exited green having written nothing. Staging first is what
    // makes the comparison — and the path-scoped commit — possible at all.
    it('stages the ledger before asking whether it changed', () => {
        expect(workflow).toMatch(/git add -- "\$ledger"/);
        expect(workflow).toMatch(/if git diff --cached --quiet -- "\$ledger"/);
    });

    it('never asks the unstaged question, which is blind to a new file', () => {
        expect(workflow).not.toMatch(/if git diff --quiet -- "\$ledger"/);
    });

    it('commits path-scoped, so nothing else rides in', () => {
        expect(workflow).toMatch(/git commit -m "\$subject" -- "\$ledger"/);
    });

    it('ignores a missing findings file rather than failing — absence is normal', () => {
        expect(workflow).toContain('if-no-files-found: ignore');
        expect(workflow).toContain('nothing to ingest');
    });
});

// The string assertions above are only worth their line count if the git
// behaviour they encode is real. It is, and it is cheap to show: the unstaged
// question is BLIND to a path git has never seen, which is every first ingest.
describe('why the staged question is the only one that answers', () => {
    function scratchRepo(): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-diff-'));
        for (const argv of [
            ['init', '-q'],
            ['config', 'user.email', 't@example.com'],
            ['config', 'user.name', 't'],
            ['commit', '-q', '--allow-empty', '-m', 'root'],
        ]) {
            execFileSync('git', ['-C', dir, ...argv]);
        }
        return dir;
    }

    function exits(dir: string, argv: string[]): number {
        try {
            execFileSync('git', ['-C', dir, ...argv], { stdio: 'ignore' });
            return 0;
        } catch (e) {
            return (e as { status?: number }).status ?? 1;
        }
    }

    it('reports an UNTRACKED new ledger as unchanged', () => {
        const dir = scratchRepo();
        fs.writeFileSync(path.join(dir, 'ledger.json'), '{}\n');
        expect(exits(dir, ['diff', '--quiet', '--', 'ledger.json'])).toBe(0);
    });

    it('reports it as changed once staged, which is what the job asks', () => {
        const dir = scratchRepo();
        fs.writeFileSync(path.join(dir, 'ledger.json'), '{}\n');
        execFileSync('git', ['-C', dir, 'add', '--', 'ledger.json']);
        expect(exits(dir, ['diff', '--cached', '--quiet', '--', 'ledger.json'])).not.toBe(0);
    });

    it('accepts the path-scoped commit only after the add', () => {
        const dir = scratchRepo();
        fs.writeFileSync(path.join(dir, 'ledger.json'), '{}\n');
        expect(exits(dir, ['commit', '-m', 'x', '--', 'ledger.json'])).not.toBe(0);
        execFileSync('git', ['-C', dir, 'add', '--', 'ledger.json']);
        expect(exits(dir, ['commit', '-m', 'x', '--', 'ledger.json'])).toBe(0);
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

    // The job declines to push without the PAT, so its absence surfaces HERE as
    // a missing ledger. An operator who is not told that reads a warning in a
    // run log as noise and the stop as a mystery.
    it('names the missing PAT, which is why the job refused to push', () => {
        expect(ledgerAbsentMessage('1.2.3', 'b', 'origin')).toContain('RELEASE_PR_TOKEN');
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
