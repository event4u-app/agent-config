// Intent tests for the py2ts memory_visibility hook twin (ADR-094). The hook
// threads the `🧠 Memory: …` line into work.report on BEFORE_SAVE; the
// resulting report text is asserted directly via inline snapshots. Was a
// python3-vs-tsx byte-parity rig; the `.py` original is gone.
import { describe, expect, it } from 'vitest';

import {
    MemoryVisibilityHook,
    derive_visibility,
} from '../../../src/agent-src/templates/scripts/work_engine/hooks/builtin/memory_visibility.js';
import { HookContext } from '../../../src/agent-src/templates/scripts/work_engine/hooks/context.js';
import { HookEvent } from '../../../src/agent-src/templates/scripts/work_engine/hooks/events.js';
import { HookRegistry } from '../../../src/agent-src/templates/scripts/work_engine/hooks/registry.js';

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

describe('MemoryVisibilityHook — report line contract', () => {
    it('rich memory + verify → full report line', () => {
        const tsWork: FakeWork = {
            memory: [
                { id: 'r1', type: 'rule', hit: true },
                { id: 'r2', type: 'incident', hit: true },
            ],
            verify: { claims: 2, first_try_passes: 2 },
            questions: [],
            changes: [{ file: 'a.ts' }],
            report: '',
        };
        expect(fireSave(tsWork)).toMatchInlineSnapshot(`
          "🧠 Memory: 2/3 · ids=[r1, r2] · affected: confidence_band

          Memory changed decisions:
          - r1 → confidence_band
          - r2 → confidence_band"
        `);
    });

    it('existing report → separator + full line', () => {
        const tsWork: FakeWork = {
            memory: [{ id: 'r1', type: 'rule', hit: true }],
            verify: null,
            report: 'Prior body.',
        };
        expect(fireSave(tsWork)).toMatchInlineSnapshot(`
          "Prior body.

          🧠 Memory: 1/3 · ids=[r1] · affected: confidence_band

          Memory changed decisions:
          - r1 → confidence_band"
        `);
    });

    it('cadence auto with ≥3 asked types → emits the line', () => {
        const tsWork: FakeWork = { memory: [{ id: 'r1', type: 'rule', hit: true }], report: '' };
        expect(fireSave(tsWork, { memory_cadence: 'auto' })).toMatchInlineSnapshot(`
          "🧠 Memory: 1/3 · ids=[r1] · affected: confidence_band

          Memory changed decisions:
          - r1 → confidence_band"
        `);
    });
});
