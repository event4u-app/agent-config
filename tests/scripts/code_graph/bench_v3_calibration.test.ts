import { describe, expect, it } from 'vitest';

import { calibrationSection, type ClassSummary } from '../../../internal/bench/code-graph/run_bench_v3.js';

const s = (status: ClassSummary['status'], overconfidence_rate: number | null): ClassSummary => ({ status, n: 3, pending: 0, precision: 0.5, recall: 0.5, clean_rate: null, overconfidence_rate });

describe('calibrationSection (registration § Bars, no bar)', () => {
    const cells = [
        { class: 'precise-semantics', subject: 'all', arms: { grep: s('SCORED', null), native: s('SCORED', 0.455), foreign: s('ABSENT', null) } },
        { class: 'tests-for', subject: 'all', arms: { grep: s('SCORED', null), native: s('SCORED', null), foreign: s('SCORED', 0) } },
    ];

    it('prints each arm per class, the overconfidence rate where the arm labels confidence, and why it is blank where not', () => {
        const text = calibrationSection(cells).join('\n');
        expect(text).toContain('## Calibration diagnostic (no bar)');
        expect(text).toContain('| precise-semantics | all | no label | 0.455 | ABSENT |');
        expect(text).toContain('| tests-for | all | no label | no EXTRACTED item | 0 |');
    });
});
