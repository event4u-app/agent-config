/**
 * The release self-review runs ONCE, at the cut — asserted against the real
 * workflow, not a copy of it.
 *
 * WHY THIS EXISTS. `release/*` branches cannot carry reviewable code:
 * `check_release_pr_shape` admits only the version-bump allowlist plus the
 * findings ledger. So a second review there re-reads an unchanged diff and
 * returns new opinions rather than new defects, and `ingest-release-ledger`
 * appends them. Dispositions can only be recorded by a commit; a commit is a
 * push; a push starts another review. There is no exit state.
 *
 * MEASURED on `release/16.0.0`, 2026-09-12: the cut's ingest carried 39
 * findings, nine blocking ones were adjudicated and pushed, and the review that
 * push triggered landed the ledger at 74 with 13 fresh blockers. One cycle,
 * +35 findings, no convergence.
 *
 * The predicate is SHELL, so the shell is what these cases run — the step's own
 * `run:` block, lifted out of the workflow and executed against a temp tree.
 * Asserting the YAML alone would pass over a predicate that never fires.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const WORKFLOW = path.join(REPO_ROOT, '.github', 'workflows', 'self-review-gate.yml');

interface Step {
    readonly name?: string;
    readonly id?: string;
    readonly if?: string;
    readonly run?: string;
    readonly uses?: string;
}

function liveAdvisorySteps(): readonly Step[] {
    const wf = parseYaml(fs.readFileSync(WORKFLOW, 'utf-8')) as {
        jobs: Record<string, { steps: Step[] }>;
    };
    return wf.jobs['live-advisory']!.steps;
}

function guardStep(): Step {
    const step = liveAdvisorySteps().find((s) => s.id === 'ledger');
    if (!step) throw new Error('live-advisory has no step with id `ledger`');
    return step;
}

const tmps: string[] = [];
afterEach(() => {
    for (const d of tmps) fs.rmSync(d, { recursive: true, force: true });
    tmps.length = 0;
});

/** Run the workflow step's own shell, and return what it wrote to GITHUB_OUTPUT. */
function runGuard(headRef: string, ledger: { version: string; body: string } | null): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-review-once-'));
    tmps.push(dir);
    if (ledger) {
        const p = path.join(dir, 'agents', 'evidence', 'release-findings');
        fs.mkdirSync(p, { recursive: true });
        fs.writeFileSync(path.join(p, `${ledger.version}.json`), ledger.body);
    }
    const out = path.join(dir, 'gh-output');
    fs.writeFileSync(out, '');
    execFileSync('bash', ['-c', guardStep().run!], {
        cwd: dir,
        env: { ...process.env, HEAD_REF: headRef, GITHUB_OUTPUT: out },
        encoding: 'utf-8',
    });
    return fs.readFileSync(out, 'utf-8').trim();
}

const WITH_FINDINGS = JSON.stringify({
    schema_version: 1,
    release: '16.0.0',
    findings: [{ finding_id: 'aaaaaaaaaaaa', severity: 'high', kind: 'claim', title: 't' }],
});

describe('the release review is not re-run over an unchanged release diff', () => {
    it('skips when the release already carries a ledger with findings', () => {
        expect(runGuard('release/16.0.0', { version: '16.0.0', body: WITH_FINDINGS })).toBe(
            'reviewed=true',
        );
    });

    it('reviews at the cut, when no ledger exists yet', () => {
        expect(runGuard('release/16.0.0', null)).toBe('reviewed=false');
    });

    it('reviews when the ledger exists but recorded nothing', () => {
        // An empty `findings` array is a review that ran and found nothing, or
        // one that never produced an artifact. Either way the next push is
        // still the first real chance to review, so it must not be suppressed.
        const empty = JSON.stringify({ schema_version: 1, release: '16.0.0', findings: [] });
        expect(runGuard('release/16.0.0', { version: '16.0.0', body: empty })).toBe(
            'reviewed=false',
        );
    });

    it('never suppresses a review on an ordinary feature branch', () => {
        // The loop is a property of release branches only — everywhere else a
        // push changes the code, so re-reviewing is the point of the gate.
        expect(runGuard('feat/whatever', { version: '16.0.0', body: WITH_FINDINGS })).toBe(
            'reviewed=false',
        );
    });

    it('reads the version out of the branch name, not out of the ledger', () => {
        // A ledger for a DIFFERENT version must not silence this release's
        // first review — the step resolves `release/<v>` to `<v>.json`.
        expect(runGuard('release/17.0.0', { version: '16.0.0', body: WITH_FINDINGS })).toBe(
            'reviewed=false',
        );
    });
});

describe('the guard is wired to the steps that cost money', () => {
    it('gates the review itself, and the install it needs', () => {
        const steps = liveAdvisorySteps();
        const gated = steps.filter((s) => s.if === "steps.ledger.outputs.reviewed != 'true'");
        // setup-node, npm ci, and the review call. A guard on the review alone
        // would still pay for a full install on every release push.
        expect(gated).toHaveLength(3);
        expect(gated.some((s) => (s.run ?? '').includes('self_review_gate.ts'))).toBe(true);
        expect(gated.some((s) => (s.run ?? '').includes('npm ci'))).toBe(true);
    });

    it('leaves workflow_dispatch a way to force a re-review', () => {
        // The guard step itself only runs on `pull_request`, so on a manual
        // dispatch its output is empty and every `!= 'true'` gate passes. A
        // maintainer asking for a second opinion is asking on purpose.
        expect(guardStep().if).toBe("github.event_name == 'pull_request'");
    });

    it('still uploads the artifact unconditionally, so a skipped review is a clean no-op', () => {
        const upload = liveAdvisorySteps().find((s) => (s.uses ?? '').includes('upload-artifact'));
        expect(upload?.if).toBe('always()');
    });
});
