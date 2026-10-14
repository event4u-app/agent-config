/**
 * The Host Docs Digest Watch went red on main twice, a week apart, and nobody
 * acted: a scheduled failure is mailed only to whoever last edited the cron
 * line, so the red had no route to anyone who would read the page. These cases
 * pin the route that now exists, and the bounds it must keep — the watch still
 * never writes the table, the issue write grant lives on a job that runs no
 * repository code, and only a detected drift (never a broken runner) is routed.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'host-docs-digest.yml');

interface Step { id?: string; name?: string; if?: string; run?: string; uses?: string }
interface Job {
    if?: string;
    needs?: string | string[];
    outputs?: Record<string, string>;
    permissions?: Record<string, string>;
    steps: Step[];
}
interface Workflow { permissions?: Record<string, string>; jobs: Record<string, Job> }

const wf = parse(fs.readFileSync(WORKFLOW, 'utf-8')) as Workflow;
const jobNamed = (name: string): Job => {
    const found = wf.jobs[name];
    if (!found) throw new Error(`host-docs-digest.yml has no \`${name}\` job`);
    return found;
};
const watch = jobNamed('digest-watch');
const route = jobNamed('route-drift');
const fetchStep = (): Step | undefined => watch.steps.find((s) => (s.run ?? '').includes('check_host_docs_digest --fetch'));

describe('host-docs-digest workflow routes a drift red to a tracked issue', () => {
    it('opens or updates one issue', () => {
        const run = route.steps.map((s) => s.run ?? '').join('\n');
        expect(run).toMatch(/gh issue create/);
        expect(run).toMatch(/gh issue comment/);
    });

    it('routes only scheduled runs, so a manual dispatch from a branch files nothing', () => {
        expect(route.if ?? '').toMatch(/github\.event_name\s*==\s*'schedule'/);
    });

    it('routes only a detected drift, never a broken runner', () => {
        const step = fetchStep();
        expect(step?.id, 'the --fetch step needs an id').toBeTruthy();
        expect(step?.run ?? '').toMatch(/changed since the row was established/);
        expect(step?.run ?? '').toMatch(/GITHUB_OUTPUT/);
        expect(watch.outputs?.drifted ?? '').toContain(`steps.${step?.id}.outputs.drifted`);
        expect(route.needs).toEqual('digest-watch');
        expect(route.if ?? '').toContain("needs.digest-watch.outputs.drifted == 'true'");
    });

    it('keeps the issue grant off every job that runs repository code', () => {
        expect(wf.permissions).toEqual({ contents: 'read' });
        expect(watch.permissions ?? wf.permissions).toEqual({ contents: 'read' });
        expect(route.permissions).toEqual({ issues: 'write' });
        for (const s of route.steps) {
            expect(s.uses ?? '', 'the routing job checks nothing out').not.toMatch(/checkout/);
            expect(s.run ?? '').not.toMatch(/scripts-run|npm /);
        }
    });

    it('interpolates no expression into a shell body', () => {
        for (const s of route.steps) expect(s.run ?? '').not.toMatch(/\$\{\{/);
        expect(fetchStep()?.run ?? '').not.toMatch(/\$\{\{/);
    });

    it('still never writes the table', () => {
        for (const s of watch.steps) expect(s.run ?? '').not.toMatch(/--write/);
    });
});
