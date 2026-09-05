/**
 * Every release-validation job answers "how does a maintainer run this before
 * pushing?" — and the answer is checked, not merely written down.
 *
 * The failure this pins is a recurrence, not a one-off. `release-validation.yml`
 * runs after `gh pr create`, so every assertion it owns is discovered at the
 * most expensive moment available: a branch, a pull request and a CI run are
 * already spent. Twice in three releases an assertion that reproduces locally
 * in under two seconds was discovered there instead — 14.14.0 (PR #1812) on the
 * curated head, 14.17.0 (PR #1856) on the governance-mix response.
 *
 * `src/config/release-gate-locality.yml` is the relation the tree was missing.
 * This test is what keeps it true: a new job in the workflow with no row fails
 * here, so the "and locally?" question is asked at authoring time rather than
 * remembered.
 *
 * It deliberately does NOT assert that every job HAS a local command. Three
 * genuinely cannot run before the PR exists, and a test demanding the
 * impossible would be satisfied by a fake. It asserts that the impossibility is
 * DECLARED, with a classified reason.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { on_release_branch, resolve_version } from '../../src/scripts/release_verify.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REGISTRY = path.join(REPO_ROOT, 'src', 'config', 'release-gate-locality.yml');

/** Reason prefixes that classify WHY a job has no local command. */
const REASON_PREFIXES = ['NEEDS_PR:', 'NEEDS_ARTIFACT:', 'NEEDS_NETWORK:', 'NEEDS_TOKEN:'];

interface Row {
    local: string | null;
    reason?: string;
    verify: boolean;
    script: string | null;
    guard?: string | null;
}

interface Registry {
    version: number;
    workflow: string;
    jobs: Record<string, Row>;
}

function loadRegistry(): Registry {
    return parseYaml(fs.readFileSync(REGISTRY, 'utf-8')) as Registry;
}

/**
 * Job ids as the workflow declares them.
 *
 * A two-space-indented `<id>:` under `jobs:` — the same shape every job in this
 * workflow uses. Parsing the YAML would also work; this stays textual so a
 * malformed workflow surfaces as a missing job rather than as a parser crash
 * three files away from the edit that caused it.
 */
function workflowJobIds(workflowPath: string): string[] {
    const text = fs.readFileSync(path.join(REPO_ROOT, workflowPath), 'utf-8');
    const body = text.slice(text.indexOf('\njobs:'));
    const ids: string[] = [];
    for (const line of body.split('\n')) {
        const m = /^ {2}([a-z0-9][a-z0-9-]*):\s*$/u.exec(line);
        if (m) ids.push(m[1]!);
    }
    return ids;
}

describe('release-gate locality registry', () => {
    const reg = loadRegistry();
    const jobIds = workflowJobIds(reg.workflow);

    it('finds the workflow it claims to describe', () => {
        expect(fs.existsSync(path.join(REPO_ROOT, reg.workflow))).toBe(true);
        // A zero-job read would make every assertion below vacuously true —
        // the exact shape a dead-scope guard exists to reject.
        expect(jobIds.length).toBeGreaterThan(0);
    });

    it('carries a row for every release-validation job', () => {
        const missing = jobIds.filter((id) => !(id in reg.jobs));
        expect(
            missing,
            `release-validation.yml gained job(s) with no row in ${path.relative(REPO_ROOT, REGISTRY)}. ` +
                'Add one, answering how a maintainer reproduces the assertion before pushing — ' +
                'or declare `local: ~` with a NEEDS_* reason if it genuinely cannot run pre-PR.',
        ).toEqual([]);
    });

    it('carries no row for a job the workflow no longer has', () => {
        const stale = Object.keys(reg.jobs).filter((id) => !jobIds.includes(id));
        expect(stale, 'stale registry row(s) — the job was renamed or removed').toEqual([]);
    });

    it('classifies every missing local command with a NEEDS_* reason', () => {
        const unexplained = Object.entries(reg.jobs)
            .filter(([, r]) => r.local === null || r.local === undefined)
            .filter(([, r]) => !REASON_PREFIXES.some((p) => (r.reason ?? '').startsWith(p)))
            .map(([id]) => id);
        expect(
            unexplained,
            `a job with no local command carries a reason starting with one of ${REASON_PREFIXES.join(' / ')}. ` +
                'An unclassified gap reads as an oversight and is indistinguishable from one.',
        ).toEqual([]);
    });

    it('names only scripts that exist', () => {
        const dangling = Object.entries(reg.jobs)
            .map(([id, r]) => [id, r.script] as const)
            .filter(([, s]) => typeof s === 'string' && s.length > 0)
            .filter(([, s]) => !fs.existsSync(path.join(REPO_ROOT, s!)))
            .map(([id, s]) => `${id} -> ${String(s)}`);
        expect(dangling, 'registry names a script that is not in the tree').toEqual([]);
    });

    it('marks nothing for `task release:verify` that it cannot run', () => {
        const unrunnable = Object.entries(reg.jobs)
            .filter(([, r]) => r.verify)
            .filter(([, r]) => typeof r.local !== 'string' || r.local.length === 0)
            .map(([id]) => id);
        expect(unrunnable, 'a `verify: true` row needs a local command to run').toEqual([]);
    });
});

/**
 * The runner's two branch-dependent decisions.
 *
 * Both are pure reads over `git rev-parse` plus `package.json`, and both change
 * WHICH gates run — so a silent regression here would turn a green
 * `task release:verify` into a run that checked less than it says. The counts
 * the runner prints are the only thing standing between that and a false
 * clearance.
 */
describe('release_verify — what the run covers', () => {
    it('prefers an explicit --version over anything it could infer', () => {
        expect(resolve_version(['--version', '9.9.9'])).toBe('9.9.9');
    });

    it('falls back to a resolvable version off a release branch', () => {
        // This spec runs on a feature branch in CI and locally, so the fallback
        // is the path exercised; it must produce a version rather than null,
        // because `null` makes the runner exit 2 and check nothing.
        expect(resolve_version([])).toMatch(/^\d+\.\d+\.\d+/u);
    });

    it('knows it is not on a release branch here', () => {
        // Pinned rather than assumed: a `release/X.Y.Z` head would make the
        // release_branch_only rows run, and this suite never executes on one.
        expect(on_release_branch()).toBe(false);
    });
});
