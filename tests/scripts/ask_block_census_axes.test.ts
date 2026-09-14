import { describe, expect, it } from 'vitest';

import {
    PHASES,
    axesFor,
    ownershipOf,
    phaseOf,
    renderTargets,
    scanFile,
    targets,
    type AxisRow,
} from '../../src/scripts/ask_block_census.js';

function rowsFor(file: string, text: string): AxisRow[] {
    return scanFile(text).map((r) => axesFor(file, r));
}

describe('ask_block_census — phase', () => {
    it('reads delivery from the file, not from the words in it', () => {
        expect(phaseOf('src/domains/meta/commit/command.md')).toBe('delivery');
        expect(phaseOf('src/domains/meta/pr/create/command.md')).toBe('delivery');
    });

    it('reads execution from the run surfaces', () => {
        expect(phaseOf('src/domains/product-basic/roadmap/process-full/command.md')).toBe(
            'execution',
        );
        expect(phaseOf('src/agent-src/contexts/execution/roadmap-process-loop.md')).toBe('execution');
    });

    it('reads planning from the producers', () => {
        expect(phaseOf('src/domains/product-basic/roadmap/create/command.md')).toBe('planning');
        expect(phaseOf('src/domains/meta/challenge-me/closure/command.md')).toBe('planning');
    });

    it('keeps the vocabulary closed', () => {
        expect([...PHASES]).toEqual(['planning', 'execution', 'delivery']);
    });
});

describe('ask_block_census — ownership', () => {
    it.each([
        ['Then merge the branch.', 'destructive-owned'],
        ['This is user-visible.', 'product-owned'],
        ['The deadline is fixed.', 'business-owned'],
        ['It crosses the ceiling.', 'spend-exhaustion'],
        ['This touches auth.', 'critical-technical'],
        ['Two valid architectures exist.', 'contested-technical'],
        ['A refactor of the reader.', 'reversible-technical'],
        ['The naming of the file.', 'deterministic'],
    ])('classifies %s as %s', (text, cls) => {
        expect(ownershipOf(text)).toBe(cls);
    });

    it('an unsignalled region reads unknown, never technical', () => {
        // Reporting unknown as technical would inflate target 1 with regions
        // the classifier never actually read anything from.
        expect(ownershipOf('Please have a look at this.')).toBe('unknown');
    });
});

describe('ask_block_census — avoidable and resolver_attempted', () => {
    it('a continuation ask is a workflow ask', () => {
        const rows = rowsFor('src/domains/x/command.md', 'Shall I continue?\n');
        expect(rows[0]?.workflow).toBe(true);
        expect(rows[0]?.avoidable).toBe(true);
    });

    it.each(['Should I commit this?', 'One commit or multiple?', 'Which branch?'])(
        '%s is a workflow ask',
        (q) => {
            expect(rowsFor('src/domains/x/command.md', `${q}\n`)[0]?.workflow).toBe(true);
        },
    );

    it('a technical ask in EXECUTION is avoidable even without a workflow shape', () => {
        const rows = rowsFor(
            'src/agent-src/contexts/execution/roadmap-process-loop.md',
            'Which of the two valid architectures do you want?\n',
        );
        expect(rows[0]?.workflow).toBe(false);
        expect(rows[0]?.avoidable).toBe(true);
    });

    it('the same technical question in PLANNING is not avoidable', () => {
        // Planning is where a decision is SUPPOSED to be closed; the defect is
        // meeting it in execution, not asking it at all.
        const rows = rowsFor(
            'src/domains/product-basic/roadmap/create/command.md',
            'Which of the two valid architectures do you want?\n',
        );
        expect(rows[0]?.avoidable).toBe(false);
    });

    it('a region naming a rung it tried records resolver_attempted', () => {
        const rows = rowsFor('src/domains/x/command.md', 'The council split — which one?\n');
        expect(rows[0]?.resolver_attempted).toBe(true);
    });

    it('a region naming none did not try', () => {
        expect(rowsFor('src/domains/x/command.md', 'Which one?\n')[0]?.resolver_attempted).toBe(
            false,
        );
    });
});

describe('ask_block_census — the targets', () => {
    it('an empty corpus meets both measurable targets', () => {
        const t = targets([]);
        expect(t.technical_owner_asks_in_execution).toBe(0);
        expect(t.workflow_asks).toBe(0);
    });

    it('target 1 CAN miss — a technical ask in execution counts', () => {
        // Sensitivity: a target that cannot miss is not a measurement.
        const rows = rowsFor(
            'src/agent-src/contexts/execution/roadmap-process-loop.md',
            'Which of the two valid architectures do you want?\n',
        );
        expect(targets(rows).technical_owner_asks_in_execution).toBe(1);
    });

    it('target 2 CAN miss — a commit ask counts', () => {
        const rows = rowsFor('src/domains/x/command.md', 'Should I commit this?\n');
        expect(targets(rows).workflow_asks).toBe(1);
    });

    it('an owner-owned ask in execution does NOT miss target 1', () => {
        // The discriminating row: the target is about TECHNICAL questions
        // reaching a person, never about the owner being asked at all.
        const rows = rowsFor(
            'src/agent-src/contexts/execution/roadmap-process-loop.md',
            'This is user-visible — which semantics do you want?\n',
        );
        expect(rows[0]?.ownership).toBe('product-owned');
        expect(targets(rows).technical_owner_asks_in_execution).toBe(0);
    });

    it('the repeat target is NOT MEASURED, never zero', () => {
        expect(targets([]).repeat_asks).toBeNull();
        expect(renderTargets(targets([])).join('\n')).toContain('NOT MEASURED');
    });

    it('only single/batch regions count as asks', () => {
        // A bypass and a parked question are their own axes; neither is an ask,
        // so neither may move a target that counts asks.
        const rows = rowsFor(
            'src/agent-src/contexts/execution/roadmap-process-loop.md',
            'An explicit just write it drops the two valid architectures question.\n',
        );
        expect(rows[0]?.cls).toBe('bypass');
        expect(targets(rows).technical_owner_asks_in_execution).toBe(0);
    });
});
