import { describe, expect, it } from 'vitest';

import {
    EVALUATORS,
    validateEvaluatorOutput,
    type RawRun,
} from '../../src/scripts/_lib/evaluator_contract.js';

const raw = (stdout: string, stderr = '', exitCode = 0): RawRun => ({ stdout, stderr, exitCode });
const byName = (n: string) => EVALUATORS.find((e) => e.name === n)!;

describe('evaluator-output contract', () => {
    it('registers the three verifiers spike s02 wrapped', () => {
        expect(EVALUATORS.map((e) => e.name).sort()).toEqual([
            'check_references',
            'lint_output_slop',
            'validate_frontmatter',
        ]);
    });

    it('every adapter emits schema-conformant output on a green reading', () => {
        const runs: Record<string, RawRun> = {
            validate_frontmatter: raw('== Frontmatter schema: 437 artefacts, 0 failing ==\n'),
            lint_output_slop: raw('✅  lint_output_slop: clean — no placeholder-prose patterns found.\n'),
            check_references: raw('✅  No broken references found.\n', 'scanned: 1289\n'),
        };
        for (const adapter of EVALUATORS) {
            expect(validateEvaluatorOutput(adapter.parse(runs[adapter.name]!))).toEqual([]);
        }
    });

    it('negates a minimize metric so score is higher-is-better', () => {
        const out = byName('validate_frontmatter').parse(
            raw('== Frontmatter schema: 437 artefacts, 3 failing ==\n', '', 1),
        );
        expect(out.metric).toBe(3);
        expect(out.score).toBe(-3);
        expect(out.pass).toBe(false);
    });

    it('reads a metric off stderr — the s02 finding, pinned', () => {
        // check_references writes `scanned:` to stderr. A stdout-only reader
        // returned no metric beside pass:true, which is the silently degraded
        // reading the contract exists to make impossible.
        const out = byName('check_references').parse(raw('✅  No broken references found.\n', 'scanned: 1289\n'));
        expect(out.metric_state).toBe('present');
        expect(out.metric).toBe(0);
    });

    it('reports an expected-but-missing metric as unreadable, never as absent or zero', () => {
        const out = byName('check_references').parse(raw('checking...\n', 'no summary\n'));
        expect(out.metric_state).toBe('unreadable');
        expect(out.metric).toBeUndefined();
        expect(out.error).toBeDefined();
        // The distinction is the point: an unreadable metric must not read as a
        // clean zero, which would let a loop keep a change it never measured.
        expect(out.score).not.toBe(0);
    });

    it('treats a scanned-nothing reference run as unreadable rather than clean', () => {
        const out = byName('check_references').parse(raw('✅  No broken references found.\n', 'scanned: 0\n'));
        expect(out.metric_state).toBe('unreadable');
    });

    it('rejects output carrying an unknown key', () => {
        const bad = { schema_version: 1, name: 'x', pass: true, score: 0, surprise: 1 };
        expect(validateEvaluatorOutput(bad).length).toBeGreaterThan(0);
    });

    it('rejects a missing required field', () => {
        expect(validateEvaluatorOutput({ schema_version: 1, name: 'x', pass: true }).length).toBeGreaterThan(0);
    });
});
