// A streak of three or more red scheduled runs of the existing cross-model
// canary writes one status line that `doctor` and session start surface; one
// green run clears it. No new scheduled workflow (ADR-118).

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { foldCanaryRuns, recordCanaryRuns, type CanaryRun } from '../../src/scripts/canary_liveness.js';
import { CANARY_RED_STREAK, readCanaryStatusLine } from '../../src/scripts/_lib/canary_status.js';
import { wiringRunners } from '../../src/scripts/_lib/runtime_wiring_checks.js';
import { run as councilAvailability } from '../../src/scripts/council_availability_hook.js';

const cleanups: (() => void)[] = [];
afterEach(() => {
    while (cleanups.length > 0) (cleanups.pop() as () => void)();
});

function tmpRoot(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'canary-liveness-'));
    cleanups.push(() => fs.rmSync(d, { recursive: true, force: true }));
    return d;
}

function runOn(day: number, conclusion: string): CanaryRun {
    return { id: day, conclusion, created_at: `2026-10-${String(day).padStart(2, '0')}T06:00:00Z` };
}

const REDS = [runOn(5, 'failure'), runOn(12, 'failure'), runOn(19, 'failure')];

describe('foldCanaryRuns', () => {
    it('counts consecutive reds from the newest run; a skipped or cancelled run is no evidence', () => {
        expect(foldCanaryRuns([...REDS, runOn(20, 'skipped')]).red_streak).toBe(3);
        expect(foldCanaryRuns([runOn(1, 'success'), ...REDS]).red_streak).toBe(3);
        expect(foldCanaryRuns([...REDS, runOn(26, 'success')]).red_streak).toBe(0);
        expect(foldCanaryRuns([runOn(12, 'failure'), runOn(19, 'failure')]).red_streak).toBe(2);
    });
});

describe('the status line', () => {
    it(`${CANARY_RED_STREAK} seeded reds put the status line in place; one green clears it`, () => {
        const root = tmpRoot();
        recordCanaryRuns(root, REDS, new Date('2026-10-22T12:00:00Z'));
        const line = readCanaryStatusLine(root);
        expect(line).toMatch(/cross-model canary: 3 scheduled runs red in a row since 2026-10-05/);
        recordCanaryRuns(root, [...REDS, runOn(26, 'success')], new Date('2026-10-26T12:00:00Z'));
        expect(readCanaryStatusLine(root)).toBeNull();
    });

    it('two reds write no line', () => {
        const root = tmpRoot();
        recordCanaryRuns(root, REDS.slice(1), new Date('2026-10-22T12:00:00Z'));
        expect(readCanaryStatusLine(root)).toBeNull();
    });

    it('doctor surfaces the line as a warning, and is ok without it', () => {
        const root = tmpRoot();
        const check = (): Record<string, string> =>
            wiringRunners({ packageRoot: root, projectRoot: root, iterOverrides: () => [] })['canary-liveness']!() as unknown as Record<string, string>;
        expect(check()['status']).toBe('ok');
        recordCanaryRuns(root, REDS, new Date('2026-10-22T12:00:00Z'));
        expect(check()).toMatchObject({ status: 'warn', message: readCanaryStatusLine(root) });
    });

    it('session start surfaces the line through the council-availability concern', () => {
        const root = tmpRoot();
        recordCanaryRuns(root, REDS, new Date('2026-10-22T12:00:00Z'));
        const out: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        (process.stdout as unknown as { write: (c: string) => boolean }).write = (c: string): boolean => {
            out.push(String(c));
            return true;
        };
        try {
            councilAvailability(JSON.stringify({ event: 'session_start', cwd: root }), {
                env: { AI_COUNCIL_CONFIG: path.join(root, 'absent.yml') },
            });
        } finally {
            (process.stdout as unknown as { write: typeof orig }).write = orig;
        }
        const ctx = (JSON.parse(out.join('')) as { context: string }).context;
        expect(ctx).toContain(readCanaryStatusLine(root)!);
    });
});
