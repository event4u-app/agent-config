import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { criticalWins, criticalWinsExact, planPower, parseAa } from '../../internal/bench/core/bench_ab_power.js';
import { exactOneSidedP, MIN_DISCORDANT } from '../../src/scripts/_lib/paired_verdict.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
const SCRIPT = path.join(REPO_ROOT, 'internal', 'bench', 'core', 'bench_ab_power.ts');

describe('bench_ab_power', () => {
    it('at a fully one-directional share the discordant pairs required are the paired_verdict floor', () => {
        const p = planPower({ discordance: 1 / 6, share: 1 });
        expect(p.reachable).toBe(true);
        expect(p.discordant_required).toBe(MIN_DISCORDANT);
    });

    it('a share at or below one half is not reachable, never a number', () => {
        for (const share of [0.5, 0.4]) {
            const p = planPower({ discordance: 1 / 6, share });
            expect(p.reachable).toBe(false);
            expect(p.pairs_required).toBeNull();
            expect(p.discordant_required).toBeNull();
        }
    });

    it('required pairs fall as the discordance rate rises', () => {
        const low = planPower({ discordance: 0.1, share: 0.9 }).pairs_required as number;
        const mid = planPower({ discordance: 1 / 6, share: 0.9 }).pairs_required as number;
        const high = planPower({ discordance: 0.4, share: 0.9 }).pairs_required as number;
        expect(low).toBeGreaterThan(mid);
        expect(mid).toBeGreaterThan(high);
    });

    it('a weaker share needs more discordant pairs', () => {
        const strong = planPower({ discordance: 1 / 6, share: 1 }).discordant_required as number;
        const weak = planPower({ discordance: 1 / 6, share: 0.8 }).discordant_required as number;
        expect(weak).toBeGreaterThan(strong);
    });

    it('the planned power matches a simulation of the same sign test', () => {
        // Independent check: simulate sweeps of the planned size and count how
        // often the exact sign test clears alpha. Seeded LCG, so deterministic.
        const p = planPower({ discordance: 1 / 6, share: 0.9, power: 0.8 });
        const n = p.pairs_required as number;
        let seed = 12345;
        const rand = (): number => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
        let hits = 0;
        const trials = 4000;
        for (let t = 0; t < trials; t += 1) {
            let d = 0;
            let w = 0;
            for (let i = 0; i < n; i += 1) {
                if (rand() < 1 / 6) {
                    d += 1;
                    if (rand() < 0.9) w += 1;
                }
            }
            if (exactOneSidedP(w, d) <= 0.05) hits += 1;
        }
        expect(Math.abs(hits / trials - (p.power_at_required as number))).toBeLessThan(0.03);
    });

    it('rejects out-of-range inputs with the reason that applies', () => {
        expect(planPower({ discordance: 0, share: 1 }).reason).toMatch(/discordance of 0/);
        expect(planPower({ discordance: 1 / 6, share: Number.NaN }).reason).toMatch(/share must be/);
        expect(planPower({ discordance: 1 / 6, share: 1.5 }).reason).toMatch(/share must be/);
    });

    it('the log-space critical count agrees with the exact sign test', () => {
        for (let d = 0; d <= 60; d += 1) expect(criticalWins(d, 0.05), `d=${d}`).toBe(criticalWinsExact(d, 0.05));
    });

    it('parses the published A/A figure', () => {
        expect(parseAa('2/12')).toBeCloseTo(1 / 6, 9);
        expect(parseAa('0/12')).toBe(0);
        expect(() => parseAa('13/12')).toThrow();
        expect(() => parseAa('x')).toThrow();
    });

    it('the CLI prints required pairs from an A/A figure and exits 0', () => {
        const r = spawnSync(TSX, [SCRIPT, '--aa', '2/12', '--share', '1'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/discordant pairs required: 5/);
        expect(r.stdout).toMatch(/pairs per arm required: \d+/);
    });
});
