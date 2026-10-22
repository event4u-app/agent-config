import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    type GateSpec,
    assert_from_output,
    floor_delegation_problem,
    ledgerOutcomeFor,
    parse_jobs,
    runPool,
} from '../../src/scripts/check_gate_coverage.js';

const spec = (over: Partial<GateSpec> = {}): GateSpec => ({
    id: 'check_static_parity',
    argv: ['--quiet'],
    min_scanned: 20,
    corpus: 'parity suite',
    status: 'enforced',
    ...over,
});

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('runPool — concurrency without reordering the report', () => {
    it('returns results in input order when items finish in reverse order', async () => {
        const finished: number[] = [];
        const out = await runPool([0, 1, 2, 3], 4, async (n) => {
            await sleep((4 - n) * 15);
            finished.push(n);
            return n * 10;
        });
        expect(finished).toEqual([3, 2, 1, 0]);
        expect(out).toEqual([0, 10, 20, 30]);
    });

    it('never runs more than `jobs` at once', async () => {
        let live = 0;
        let peak = 0;
        await runPool([...Array(9).keys()], 3, async () => {
            live++;
            peak = Math.max(peak, live);
            await sleep(5);
            live--;
        });
        expect(peak).toBe(3);
    });

    it('gives the same results serially and in parallel', async () => {
        const fn = async (n: number): Promise<string> => {
            await sleep(n % 3);
            return `r${String(n)}`;
        };
        const items = [...Array(12).keys()];
        expect(await runPool(items, 1, fn)).toEqual(await runPool(items, 6, fn));
    });
});

describe('parse_jobs', () => {
    it('honours a valid --jobs and falls back on an invalid one', () => {
        expect(parse_jobs(['--jobs', '3'])).toBe(3);
        expect(parse_jobs(['--jobs', '0'])).toBeGreaterThanOrEqual(1);
        expect(parse_jobs([])).toBeGreaterThanOrEqual(1);
    });
});

describe('floor_asserted_in — delegation is honoured only while the assertion exists', () => {
    const withAssertion = [
        '      - run: ./scripts-run src/scripts/check_static_parity --quiet | tee "$RUNNER_TEMP/parity.out"',
        '      - run: ./scripts-run src/scripts/check_gate_coverage --from-output "$RUNNER_TEMP/parity.out" --only check_static_parity',
    ].join('\n');

    it('accepts a workflow that asserts the floor for that id', () => {
        expect(floor_delegation_problem(withAssertion, 'check_static_parity')).toBeNull();
    });

    it('refuses once the assertion is removed, so the census runs the gate itself', () => {
        const without = withAssertion.split('\n')[0] as string;
        expect(floor_delegation_problem(without, 'check_static_parity')).toMatch(/no `check_gate_coverage --from-output/);
    });

    it('refuses an assertion for a different id', () => {
        expect(floor_delegation_problem(withAssertion, 'check_secret_leak')).not.toBeNull();
    });

    it('is not counted as inspected in the ledger', () => {
        expect(ledgerOutcomeFor('delegated')).toBe('declared_exemption');
    });
});

describe('--from-output — the floor applied to a captured gate output', () => {
    const run = (body: string, id = 'check_static_parity'): number => {
        const dir = mkdtempSync(join(tmpdir(), 'gcov-'));
        try {
            const f = join(dir, 'out.txt');
            writeFileSync(f, body);
            return assert_from_output([spec()], ['--from-output', f, '--only', id]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    };

    it('passes at or above the floor', () => {
        expect(run('noise\nscanned: 20\n')).toBe(0);
    });

    it('fails below the floor', () => {
        expect(run('scanned: 3\n')).toBe(1);
    });

    it('fails a silent gate', () => {
        expect(run('no count here\n')).toBe(1);
    });

    it('refuses an id that is not in the manifest', () => {
        expect(run('scanned: 99\n', 'no_such_gate')).toBe(2);
    });
});
