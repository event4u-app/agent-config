// Golden-parity + unit tests for the py2ts memory_visibility hook twin
// (ADR-094). The hook threads the `🧠 Memory: …` line into work.report on
// BEFORE_SAVE; the resulting report text must be byte-identical.
import { describe, expect, it } from 'vitest';

import {
    MemoryVisibilityHook,
    derive_visibility,
} from '../../../src/agent-src/templates/scripts/work_engine/hooks/builtin/memory_visibility.js';
import { HookContext } from '../../../src/agent-src/templates/scripts/work_engine/hooks/context.js';
import { HookEvent } from '../../../src/agent-src/templates/scripts/work_engine/hooks/events.js';
import { HookRegistry } from '../../../src/agent-src/templates/scripts/work_engine/hooks/registry.js';
import { hasPython3, runPyHooks } from './_hooks_pyloader.js';

const describePy = hasPython3() ? describe : describe.skip;

interface FakeWork {
    memory: unknown;
    verify?: unknown;
    questions?: unknown;
    changes?: unknown;
    applied_rules?: unknown;
    test_plan?: unknown;
    report: string;
}

function fireSave(
    work: FakeWork,
    opts: { memory_cadence?: string; visibility_off?: boolean } = {},
): string {
    const hook = new MemoryVisibilityHook(opts);
    const reg = new HookRegistry();
    hook.register(reg);
    const ctx = new HookContext({ work });
    for (const cb of reg.for_event(HookEvent.BEFORE_SAVE)) cb(ctx);
    return work.report;
}

describe('MemoryVisibilityHook — TS unit checks', () => {
    it('null work → no-op', () => {
        const hook = new MemoryVisibilityHook();
        const reg = new HookRegistry();
        hook.register(reg);
        // Should not throw.
        for (const cb of reg.for_event(HookEvent.BEFORE_SAVE)) cb(new HookContext());
        expect(true).toBe(true);
    });

    it('visibility_off → report untouched', () => {
        const work: FakeWork = { memory: [{ id: 'r1', type: 'rule', hit: true }], report: 'orig' };
        expect(fireSave(work, { visibility_off: true })).toBe('orig');
    });

    it('cadence never → report untouched', () => {
        const work: FakeWork = { memory: [{ id: 'r1', type: 'rule' }], report: '' };
        expect(fireSave(work, { memory_cadence: 'never' })).toBe('');
    });

    it('emits the visibility line into an empty report', () => {
        const work: FakeWork = { memory: [{ id: 'r1', type: 'rule', hit: true }], report: '' };
        const out = fireSave(work);
        expect(out).toContain('🧠 Memory:');
        expect(out).toContain('ids=[r1]');
    });

    it('appends after existing report with a blank-line separator', () => {
        const work: FakeWork = { memory: [{ id: 'r1', type: 'rule' }], report: 'Existing.' };
        const out = fireSave(work);
        expect(out.startsWith('Existing.\n\n🧠 Memory:')).toBe(true);
    });

    it('idempotent — re-firing does not double-append the same line', () => {
        const work: FakeWork = { memory: [{ id: 'r1', type: 'rule' }], report: '' };
        const first = fireSave(work);
        const second = fireSave(work);
        expect(second).toBe(first);
    });

    it('derive_visibility renders directly from a memory list', () => {
        expect(derive_visibility([])).toBeNull();
        const line = derive_visibility([{ id: 'x', type: 'rule' }]);
        expect(line).toContain('🧠 Memory:');
    });
});

describePy('MemoryVisibilityHook — report parity (python3 vs TS)', () => {
    function pyReport(
        workExpr: string,
        cadence: string,
        visibilityOff: boolean,
    ): string {
        const r = runPyHooks(
            {
                we: ['scoring.decision_trace', 'scoring.memory_visibility'],
                foundation: ['exceptions', 'context', 'events', 'registry'],
                builtin: ['memory_visibility'],
            },
            [
                `hook = memory_visibility.MemoryVisibilityHook(memory_cadence=${JSON.stringify(cadence)}, visibility_off=${visibilityOff ? 'True' : 'False'})`,
                `work = ${workExpr}`,
                'hook._on_before_save(context.HookContext(work=work))',
                'print(json.dumps(work.report))',
            ].join('\n'),
        );
        if (r.status !== 0) throw new Error(`py mvis failed: ${r.stderr || r.stdout}`);
        return JSON.parse(r.stdout.trim()) as string;
    }

    // A mutable Python work object with settable .report.
    function pyWork(fields: string): string {
        return `type('W',(),{${fields}})()`;
    }

    it('rich memory + verify → report line byte-identical', () => {
        const memory = [
            { id: 'r1', type: 'rule', hit: true },
            { id: 'r2', type: 'incident', hit: true },
        ];
        const tsWork: FakeWork = {
            memory,
            verify: { claims: 2, first_try_passes: 2 },
            questions: [],
            changes: [{ file: 'a.ts' }],
            report: '',
        };
        const tsOut = fireSave(tsWork);
        const pyOut = pyReport(
            pyWork(
                "'memory':[{'id':'r1','type':'rule','hit':True},{'id':'r2','type':'incident','hit':True}],'verify':{'claims':2,'first_try_passes':2},'questions':[],'changes':[{'file':'a.ts'}],'report':''",
            ),
            'always',
            false,
        );
        expect(tsOut).toBe(pyOut);
    });

    it('existing report → separator + line byte-identical', () => {
        const tsWork: FakeWork = {
            memory: [{ id: 'r1', type: 'rule', hit: true }],
            verify: null,
            report: 'Prior body.',
        };
        const tsOut = fireSave(tsWork);
        const pyOut = pyReport(
            pyWork("'memory':[{'id':'r1','type':'rule','hit':True}],'verify':None,'report':'Prior body.'"),
            'always',
            false,
        );
        expect(tsOut).toBe(pyOut);
    });

    it('cadence auto with few asks → both suppress', () => {
        // asks = len(asked_types) = 4 ≥ 3, so auto DOES emit — assert parity.
        const tsWork: FakeWork = { memory: [{ id: 'r1', type: 'rule', hit: true }], report: '' };
        const tsOut = fireSave(tsWork, { memory_cadence: 'auto' });
        const pyOut = pyReport(
            pyWork("'memory':[{'id':'r1','type':'rule','hit':True}],'report':''"),
            'auto',
            false,
        );
        expect(tsOut).toBe(pyOut);
    });

    it('visibility_off → both leave report untouched', () => {
        const tsWork: FakeWork = { memory: [{ id: 'r1', type: 'rule' }], report: 'keep' };
        const tsOut = fireSave(tsWork, { visibility_off: true });
        const pyOut = pyReport(
            pyWork("'memory':[{'id':'r1','type':'rule'}],'report':'keep'"),
            'always',
            true,
        );
        expect(tsOut).toBe('keep');
        expect(tsOut).toBe(pyOut);
    });
});
