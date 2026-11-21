import { describe, expect, it } from 'vitest';

import type { FreshnessLedger } from '../../src/scripts/_lib/trigger_eval_freshness.js';
import {
    apply_runs,
    type RotationResultFile,
    type RotationRun,
} from '../../src/scripts/import_trigger_eval_rotation.js';

const BLOB = 'a'.repeat(40);

function result(over: Partial<RotationResultFile> = {}): RotationResultFile {
    return {
        skill: 'alpha',
        model: 'm',
        timestamp: '2026-11-16T14:00:00+00:00',
        router: 'anthropic',
        metrics: { precision: 1, recall: 1 },
        input_tokens: 10,
        output_tokens: 5,
        ...over,
    };
}

function apply(runs: RotationRun[], ledger: FreshnessLedger = { schema: 1, suites: {} }) {
    const changes = apply_runs(
        ledger,
        runs,
        (_sha, skill) => (skill === 'gone-at-sha' ? null : BLOB),
        (skill) => skill !== 'deleted',
    );
    return { ledger, changes };
}

describe('import_trigger_eval_rotation — apply_runs', () => {
    it('records a live pass with its date, blob and run', () => {
        const { ledger, changes } = apply([{ runId: '7', ref: 's', results: [result()] }]);
        expect(ledger.suites['alpha']).toEqual({
            date: '2026-11-16',
            blob: BLOB,
            run_id: '7',
            model: 'm',
            precision: 1,
            recall: 1,
        });
        expect(changes).toEqual([{ skill: 'alpha', action: 'recorded', date: '2026-11-16', runId: '7' }]);
    });

    it('never records a suite below its floors', () => {
        const { ledger } = apply([
            { runId: '7', ref: 's', results: [result({ metrics: { precision: 1, recall: 0.8 } })] },
        ]);
        expect(ledger.suites).toEqual({});
    });

    it('never records a mock-routed or unanswered result', () => {
        const { ledger } = apply([
            {
                runId: '7',
                ref: 's',
                results: [
                    result({ router: 'mock' }),
                    result({ skill: 'beta', input_tokens: 0, output_tokens: 0 }),
                ],
            },
        ]);
        expect(ledger.suites).toEqual({});
    });

    it('a newer failing run removes an older pass', () => {
        const { ledger, changes } = apply([
            { runId: '1', ref: 's', results: [result({ timestamp: '2026-09-01T00:00:00+00:00' })] },
            {
                runId: '2',
                ref: 's',
                results: [result({ timestamp: '2026-11-16T00:00:00+00:00', metrics: { precision: 1, recall: 0.5 } })],
            },
        ]);
        expect(ledger.suites).toEqual({});
        expect(changes.map((c) => c.action)).toEqual(['recorded', 'removed']);
    });

    it('an older run never replaces a newer record, in any input order', () => {
        const { ledger } = apply([
            { runId: '2', ref: 's', results: [result({ timestamp: '2026-11-16T00:00:00+00:00' })] },
            {
                runId: '1',
                ref: 's',
                results: [result({ timestamp: '2026-09-01T00:00:00+00:00', metrics: { precision: 0, recall: 0 } })],
            },
        ]);
        expect(ledger.suites['alpha']?.run_id).toBe('2');
    });

    it('skips suites deleted from the tree or absent at the measured commit', () => {
        const { ledger } = apply([
            {
                runId: '7',
                ref: 's',
                results: [result({ skill: 'deleted' }), result({ skill: 'gone-at-sha' })],
            },
        ]);
        expect(ledger.suites).toEqual({});
    });
});
