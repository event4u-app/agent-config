// The CLI over the invocation-plan linearizer: the agent hands it the
// structured stages of one input and reads back the order, the coalesced sinks
// and the one Order line.
import { describe, expect, it } from 'vitest';

import { main } from '../../src/scripts/invocation_plan.js';

const INCIDENT = {
    stages: [
        {
            id: 'inbox',
            kind: 'analysis',
            effects: [
                { effect: 'commit', object: 'branch' },
                { effect: 'push', object: 'branch' },
                { effect: 'pr-open', object: 'pr' },
                { effect: 'ci-settle', object: 'pr' },
            ],
        },
        {
            id: 'process-full',
            kind: 'implement',
            dependsOn: ['inbox'],
            effects: [
                { effect: 'commit', object: 'branch' },
                { effect: 'push', object: 'branch' },
                { effect: 'pr-update', object: 'pr' },
                { effect: 'ci-settle', object: 'pr' },
            ],
        },
    ],
};

function run(argv: string[], stdin: string): { code: number; out: string; err: string } {
    let out = '';
    let err = '';
    const code = main(argv, stdin, {
        out: (s) => {
            out += s;
        },
        err: (s) => {
            err += s;
        },
    });
    return { code, out, err };
}

describe('invocation_plan CLI', () => {
    it('linearizes the incident: delivery after the last stage that writes the branch, one Order line', () => {
        const r = run([], JSON.stringify(INCIDENT));
        expect(r.code).toBe(0);
        const plan = JSON.parse(r.out) as { fires: boolean; line: string | null; order: Array<{ id: string; effects: Array<{ effect: string }> }> };
        expect(plan.fires).toBe(true);
        expect(plan.line).toMatch(/^Order: /);
        const inbox = plan.order.find((s) => s.id === 'inbox');
        expect(inbox?.effects.map((e) => e.effect)).not.toContain('push');
    });

    it('--done re-plans only the remaining stages', () => {
        const r = run(['--done', 'inbox'], JSON.stringify(INCIDENT));
        expect(r.code).toBe(0);
        const plan = JSON.parse(r.out) as { order: Array<{ id: string }> };
        expect(plan.order.map((s) => s.id)).toEqual(['process-full']);
    });

    it('--failed returns the partial delivery for what is done', () => {
        const r = run(['--failed', 'process-full'], JSON.stringify(INCIDENT));
        expect(r.code).toBe(0);
        const d = JSON.parse(r.out) as { partial: boolean; line: string };
        expect(d.partial).toBe(true);
        expect(d.line.length).toBeGreaterThan(0);
    });

    it('rejects unreadable input and an unknown stage with exit 2, never a plan', () => {
        expect(run([], 'not json').code).toBe(2);
        const bad = run(['--failed', 'nope'], JSON.stringify(INCIDENT));
        expect(bad.code).toBe(2);
        expect(bad.out).toBe('');
        expect(bad.err).toMatch(/nope/);
    });
});
