import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REPORT_REL, readingContradictions, renderReport, runCensus } from '../../src/scripts/hook_carrier_census.js';
import { recordProblems, type InjectionRecord } from '../../src/scripts/_lib/injection_effect.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

describe('hook_carrier_census (road-to-a-hook-carrier-that-is-never-silent 0.1)', () => {
    it('two runs at one commit are byte-equal, and equal to the committed report', () => {
        const first = renderReport(runCensus());
        const second = renderReport(runCensus());
        expect(second).toBe(first);
        expect(readFileSync(path.join(REPO_ROOT, REPORT_REL), 'utf8')).toBe(first);
    }, 120_000);

    it('every unstaged checkout and npx cell is silent and every staged cell reaches', () => {
        for (const row of runCensus()) {
            if (row.staged) {
                expect([row.ip.id, row.launcher, row.stripped]).toEqual([row.ip.id, true, true]);
            } else {
                expect(row.stripped).toBe(false);
                if (row.ip.id !== 'npm-global') expect(row.launcher).toBe(false);
            }
        }
    }, 120_000);

    it('a flipped cell makes the generator refuse rather than print a Reading its table contradicts', () => {
        const rows = runCensus();
        expect(readingContradictions(rows)).toEqual([]);
        const flipped = rows.map((r) => (r.staged && r.ip.id === 'npx' ? { ...r, stripped: false } : r));
        expect(readingContradictions(flipped)).toEqual(['npx (staged): staged, yet a PATH did not reach the dispatcher']);
        expect(() => renderReport(flipped)).toThrow(/Reading no longer matches/);
    }, 120_000);
});

describe('hook-carrier-probes.json (0.2)', () => {
    it('has one valid row per probe item, each with a host and an expiry', () => {
        const rec = JSON.parse(
            readFileSync(path.join(REPO_ROOT, 'src', 'config', 'hook-carrier-probes.json'), 'utf8'),
        ) as Record<string, { host?: string; expiry?: string }>;
        const rows = Object.entries(rec).filter(([k]) => !k.startsWith('_'));
        expect(rows.map(([k]) => k)).toEqual([
            'session-start-stdout-reaches-model',
            'launcher-path-terminal-vs-app',
            'rule-file-replaced-mid-session',
        ]);
        for (const [, row] of rows) {
            expect(row.host).toBe('claude');
            expect(row.expiry).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
        expect(recordProblems(rec as unknown as InjectionRecord)).toEqual([]);
    });
});
