/**
 * concern_timings — per-dispatch memory and CPU columns
 * (road-to-a-fleet-that-pays-less-per-event step 2.1).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { readResourceSample, writeConcernTimings } from '../../src/scripts/hooks/concern_timings.js';

const tmp_dirs: string[] = [];
afterEach(() => {
    while (tmp_dirs.length > 0) fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
});

function sinkPath(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'concern-timings-'));
    tmp_dirs.push(dir);
    return path.join(dir, 'timings.jsonl');
}

function rows(file: string): Record<string, unknown>[] {
    return fs
        .readFileSync(file, 'utf-8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Record<string, unknown>);
}

describe('writeConcernTimings resource columns', () => {
    it('stamps every row of one dispatch with the same numeric max_rss_kb and cpu_us', () => {
        const sink = sinkPath();
        writeConcernTimings(
            'stop',
            'claude',
            [
                { concern: 'a', duration_us: 12.4 },
                { concern: 'b', duration_us: 3 },
            ],
            sink,
            () => ({ max_rss_kb: 81234, cpu_us: 45678 }),
        );
        const out = rows(sink);
        expect(out).toHaveLength(2);
        for (const row of out) {
            expect(row['max_rss_kb']).toBe(81234);
            expect(row['cpu_us']).toBe(45678);
            // Numeric only: every value is a number except the three labels.
            for (const [k, v] of Object.entries(row)) {
                if (k === 'concern' || k === 'event' || k === 'platform') continue;
                expect(typeof v, k).toBe('number');
            }
        }
        expect(Object.keys(out[0] ?? {}).sort()).toEqual(
            ['concern', 'cpu_us', 'duration_us', 'event', 'max_rss_kb', 'platform'].sort(),
        );
    });

    it('omits a resource column that is not a finite number rather than writing it', () => {
        const sink = sinkPath();
        writeConcernTimings('stop', 'claude', [{ concern: 'a', duration_us: 1 }], sink, () => ({
            max_rss_kb: Number.NaN,
            cpu_us: 10,
        }));
        const [row] = rows(sink);
        expect(row).not.toHaveProperty('max_rss_kb');
        expect(row?.['cpu_us']).toBe(10);
    });

    it('does not read resource usage at all when the sink is off', () => {
        let reads = 0;
        writeConcernTimings('stop', 'claude', [{ concern: 'a', duration_us: 1 }], undefined, () => {
            reads += 1;
            return { max_rss_kb: 1, cpu_us: 1 };
        });
        expect(reads).toBe(0);
    });

    it('never fails the dispatch when the usage read throws', () => {
        const sink = sinkPath();
        writeConcernTimings('stop', 'claude', [{ concern: 'a', duration_us: 1 }], sink, () => {
            throw new Error('no resourceUsage');
        });
        const [row] = rows(sink);
        expect(row).toEqual({ concern: 'a', duration_us: 1, event: 'stop', platform: 'claude' });
    });
});

describe('readResourceSample', () => {
    it('reads this process: positive integers, CPU in microseconds', () => {
        const s = readResourceSample();
        expect(Number.isInteger(s.max_rss_kb) && s.max_rss_kb > 0).toBe(true);
        expect(Number.isInteger(s.cpu_us) && s.cpu_us > 0).toBe(true);
        const u = process.resourceUsage();
        expect(s.cpu_us).toBeLessThanOrEqual(u.userCPUTime + u.systemCPUTime);
    });
});
