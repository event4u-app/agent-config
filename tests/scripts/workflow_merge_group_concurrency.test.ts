import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const REPO_ROOT = resolve(__dirname, '..', '..');
const WORKFLOWS = ['tests.yml', 'consistency.yml', 'standing-payload-delta.yml'] as const;

const GROUP = "${{ github.workflow }}-${{ github.event_name == 'merge_group' && github.run_id || github.ref }}";
const CANCEL = "${{ github.event_name != 'merge_group' }}";

interface Workflow {
    on: Record<string, unknown>;
    concurrency: { group: string; 'cancel-in-progress': unknown };
}

function load(name: string): Workflow {
    return parse(readFileSync(join(REPO_ROOT, '.github', 'workflows', name), 'utf8')) as Workflow;
}

describe('merge_group concurrency — queue runs never cancel each other', () => {
    for (const name of WORKFLOWS) {
        it(`${name} declares merge_group and the per-run group expression`, () => {
            const wf = load(name);
            expect(Object.keys(wf.on)).toContain('merge_group');
            expect(wf.concurrency.group).toBe(GROUP);
            expect(wf.concurrency['cancel-in-progress']).toBe(CANCEL);
        });
    }

    it('reads only workflow, event_name, run_id and ref inside the expressions', () => {
        for (const name of WORKFLOWS) {
            const { group, 'cancel-in-progress': cancel } = load(name).concurrency;
            const contexts = `${group} ${String(cancel)}`.match(/github\.[a-z_]+/g) ?? [];
            for (const c of contexts) {
                expect(['github.workflow', 'github.event_name', 'github.run_id', 'github.ref']).toContain(c);
            }
        }
    });
});
