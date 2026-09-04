/**
 * The repeated-run mode and the `flaky` outcome.
 *
 * The 4-of-5 case is the roadmap's own verify line for step 4.2, so it is
 * asserted here rather than described in a contract nobody executes.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    aggregateRepeatedRuns,
    describeRepeatedRun,
    parseExecutionMode,
} from '../../src/scripts/_lib/repeated_run.js';

describe('aggregation is by unanimity, with no threshold', () => {
    it('records a 4-of-5 pass as flaky, not as passing', () => {
        expect(aggregateRepeatedRuns([true, true, true, true, false])).toBe('flaky');
    });

    it('records a 1-of-5 pass as flaky, not as failing', () => {
        expect(aggregateRepeatedRuns([false, false, false, false, true])).toBe('flaky');
    });

    it('records unanimous passes as a pass', () => {
        expect(aggregateRepeatedRuns([true, true, true])).toBe('pass');
    });

    it('records unanimous failures as a fail', () => {
        expect(aggregateRepeatedRuns([false, false, false])).toBe('fail');
    });

    it('refuses a single run — that is `single-run`, not a repeat', () => {
        expect(() => aggregateRepeatedRuns([true])).toThrow(/at least 2 retained runs/);
    });
});

describe('flaky is reported as itself, never silently', () => {
    it('says so in the rendered line', () => {
        const line = describeRepeatedRun([true, true, true, true, false]);
        expect(line).toContain('outcome: flaky');
        expect(line).toContain('4/5 passed');
        expect(line).toMatch(/neither a pass nor a fail/);
    });

    it('does not attach the caveat to a genuine pass', () => {
        expect(describeRepeatedRun([true, true])).not.toMatch(/neither a pass nor a fail/);
    });
});

describe('the mode axis', () => {
    it('defaults to single-run when nothing is declared, so nothing is retrofitted', () => {
        expect(parseExecutionMode('# an artifact with no marker')).toEqual({ kind: 'single-run' });
    });

    it('reads a declared repeat', () => {
        expect(parseExecutionMode('<!-- evidence-mode: repeated:5 -->')).toEqual({
            kind: 'repeated',
            n: 5,
        });
    });

    it('rejects repeated:1 instead of rounding it to single-run', () => {
        const parsed = parseExecutionMode('<!-- evidence-mode: repeated:1 -->');
        expect(parsed.kind).toBe('invalid');
    });
});

describe('the contract carries the mode', () => {
    const contract = fs.readFileSync(
        path.resolve(__dirname, '../../docs/contracts/evidence-artifact-types.md'),
        'utf-8',
    );

    it('declares repeated:<n> and single-run as an axis distinct from the five types', () => {
        expect(contract).toContain('evidence-mode: repeated:5');
        expect(contract).toContain('`single-run`');
        expect(contract).toMatch(/separate axis/);
    });

    it('declares flaky as an outcome and states the unanimity rule', () => {
        expect(contract).toMatch(/\*\*flaky\*\*/);
        expect(contract).toMatch(/Aggregate by unanimity/);
        expect(contract).toMatch(/4-of-5 pass/);
    });

    it('still lists exactly the five types — the mode did not become a sixth', () => {
        for (const t of ['original-review', 'current-binding', 'declared-skip', 'honest-null', 'analysis']) {
            expect(contract).toContain(`\`${t}\``);
        }
        expect(contract).not.toMatch(/\|\s*`flaky`\s*\|/);
    });
});
