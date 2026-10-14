/**
 * The Host Docs Digest Watch went red on main twice, a week apart, and nobody
 * acted: a scheduled failure is mailed only to whoever last edited the cron
 * line, so the red had no route to anyone who would read the page. These cases
 * pin the route that now exists, and the bounds it must keep — the watch still
 * never writes the table, and the write grant stays on the one job.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'host-docs-digest.yml');

interface Step { name?: string; if?: string; run?: string; env?: Record<string, string> }
interface Job { permissions?: Record<string, string>; steps: Step[] }
interface Workflow { permissions?: Record<string, string>; jobs: Record<string, Job> }

const wf = parse(fs.readFileSync(WORKFLOW, 'utf-8')) as Workflow;
const found = wf.jobs['digest-watch'];
if (!found) throw new Error('host-docs-digest.yml has no `digest-watch` job');
const job: Job = found;
const routeStep = (): Step | undefined => job.steps.find((s) => (s.run ?? '').includes('gh issue'));

describe('host-docs-digest workflow routes a red to a tracked issue', () => {
    it('has a step that opens or updates an issue on failure', () => {
        const step = routeStep();
        expect(step, 'no step runs `gh issue`').toBeDefined();
        expect(step?.if ?? '').toMatch(/failure\(\)/);
        expect(step?.run ?? '').toMatch(/gh issue create/);
        expect(step?.run ?? '').toMatch(/gh issue comment/);
    });

    it('routes only scheduled runs, so a manual dispatch from a branch files nothing', () => {
        expect(routeStep()?.if ?? '').toMatch(/github\.event_name\s*==\s*'schedule'/);
    });

    it('routes only a red from the comparison itself, never a broken runner', () => {
        const fetchIdx = job.steps.findIndex((s) => (s.run ?? '').includes('check_host_docs_digest --fetch'));
        const fetch = job.steps[fetchIdx] as Step & { id?: string };
        expect(fetch?.id, 'the --fetch step needs an id to be referenced').toBeTruthy();
        const step = routeStep();
        expect(job.steps.indexOf(step as Step)).toBeGreaterThan(fetchIdx);
        expect(step?.if ?? '').toContain(`steps.${fetch.id}.outcome == 'failure'`);
    });

    it('grants issues: write on the one job and keeps the workflow default read-only', () => {
        expect(wf.permissions).toEqual({ contents: 'read' });
        expect(job.permissions).toEqual({ contents: 'read', issues: 'write' });
    });

    it('interpolates no expression into the shell body', () => {
        expect(routeStep()?.run ?? '').not.toMatch(/\$\{\{/);
    });

    it('still never writes the table', () => {
        for (const s of job.steps) expect(s.run ?? '').not.toMatch(/--write/);
    });
});
