import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const REPO_ROOT = resolve(__dirname, '..', '..');
const WORKFLOWS = ['commit-subjects.yml', 'consistency.yml', 'standing-payload-delta.yml', 'tests.yml'] as const;
const INVENTORY = join(REPO_ROOT, 'agents', 'evidence', 'analysis', 'merge-group-pr-only-steps-2026-11.md');
const PR_GUARD = /github\.event_name\s*==\s*'pull_request'/;

interface Step {
    name?: string;
    if?: unknown;
}

/** `<workflow> · <step name>` for every step whose `if:` admits only pull_request. */
function guardedSteps(): string[] {
    const out: string[] = [];
    for (const wf of WORKFLOWS) {
        const doc = parse(readFileSync(join(REPO_ROOT, '.github', 'workflows', wf), 'utf8')) as {
            jobs: Record<string, { if?: unknown; steps?: Step[] }>;
        };
        for (const job of Object.values(doc.jobs)) {
            const jobGuarded = typeof job.if === 'string' && PR_GUARD.test(job.if);
            for (const step of job.steps ?? []) {
                const stepGuarded = typeof step.if === 'string' && PR_GUARD.test(step.if);
                if ((jobGuarded || stepGuarded) && step.name !== undefined) out.push(`${wf} · ${step.name}`);
            }
        }
    }
    return out.sort();
}

/** `<workflow> · <step name>` for every inventory table row. */
function inventoryRows(): string[] {
    const rows: string[] = [];
    for (const line of readFileSync(INVENTORY, 'utf8').split('\n')) {
        const m = /^\|\s*`([^`]+\.yml)`\s*\|\s*([^|]+?)\s*\|/.exec(line);
        if (m !== null) rows.push(`${m[1]} · ${m[2]}`);
    }
    return rows.sort();
}

describe('merge_group PR-only step inventory', () => {
    it('finds the guarded steps it is meant to cover', () => {
        expect(guardedSteps().length).toBeGreaterThan(0);
    });

    it('lists every PR-guarded step as a row', () => {
        const rows = new Set(inventoryRows());
        const missing = guardedSteps().filter((s) => !rows.has(s));
        expect(missing).toEqual([]);
    });

    it('names no step that no longer exists or is no longer PR-guarded', () => {
        const live = new Set(guardedSteps());
        const stale = inventoryRows().filter((r) => !live.has(r));
        expect(stale).toEqual([]);
    });

    it('gives every row a disposition', () => {
        for (const line of readFileSync(INVENTORY, 'utf8').split('\n')) {
            if (!/^\|\s*`[^`]+\.yml`/.test(line)) continue;
            expect(line).toMatch(/enforced elsewhere|intentionally PR-only/);
        }
    });
});
