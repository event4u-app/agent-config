// Contract tests for src/scripts/prediction-pool/poisson_sim.ts (py2ts Phase 1).
//
// The sim uses `random.Random(seed)`, so with a FIXED `--seed` the tsx run is
// fully deterministic (PyRandom reproduces CPython MT19937 bit-for-bit). The
// tsx twin is the source of truth (the python original was deleted in the
// teardown); its output is pinned via an inline snapshot. Argparse usage prose
// is COLUMNS-dependent, so error cases assert exit 2 + a stable token, not the
// full byte stream.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'prediction-pool', 'poisson_sim.ts');
const TSX_BIN =
    process.env.TSX_BIN ??
    path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');


const tmpDirs: string[] = [];
function writeTmp(name: string, content: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'poisson-sim-'));
    const p = path.join(d, name);
    fs.writeFileSync(p, content);
    tmpDirs.push(d);
    return p;
}
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop();
        if (d && fs.existsSync(d)) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

interface RunOut {
    stdout: string;
    stderr: string;
    status: number | null;
}

function runTs(args: string[]): RunOut {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

const TEAMS = JSON.stringify({
    base_goals: 1.35,
    teams: {
        Germany: { att: 1.4, def: 0.7 },
        Scotland: { att: 0.8, def: 1.2 },
        Hungary: { att: 1.0, def: 1.0 },
        Switzerland: { att: 1.1, def: 0.9 },
        Spain: { att: 1.5, def: 0.75 },
        Croatia: { att: 1.05, def: 0.95 },
        Italy: { att: 1.2, def: 0.8 },
        Albania: { att: 0.7, def: 1.3 },
    },
    groups: [
        ['Germany', 'Scotland', 'Hungary', 'Switzerland'],
        ['Spain', 'Croatia', 'Italy', 'Albania'],
    ],
    advance_per_group: 2,
});

const NO_GROUPS = JSON.stringify({
    base_goals: 1.4,
    teams: { A: { att: 1.2, def: 0.9 }, B: { att: 0.9, def: 1.1 }, C: { att: 1.0, def: 1.0 } },
});

describe('poisson_sim — CLI contract (deterministic seed)', () => {
    const cases: Array<{ label: string; seed: string; runs: string; fixture: string }> = [
        { label: 'groups runs=500 seed=0', seed: '0', runs: '500', fixture: TEAMS },
        { label: 'groups runs=500 seed=1', seed: '1', runs: '500', fixture: TEAMS },
        { label: 'groups runs=500 seed=7', seed: '7', runs: '500', fixture: TEAMS },
        { label: 'groups runs=300 seed=42', seed: '42', runs: '300', fixture: TEAMS },
        { label: 'groups runs=1000 seed=999', seed: '999', runs: '1000', fixture: TEAMS },
        { label: 'no-groups runs=600 seed=8', seed: '8', runs: '600', fixture: NO_GROUPS },
    ];

    it('deterministic sim output across seeds (pinned)', () => {
        const results = Object.fromEntries(
            cases.map(({ label, seed, runs, fixture }) => {
                const cfg = writeTmp('config.json', fixture);
                const ts = runTs([cfg, '--runs', runs, '--seed', seed]);
                expect(ts.status, ts.stderr).toBe(0);
                return [label, JSON.parse(ts.stdout)];
            }),
        );
        expect(results).toMatchInlineSnapshot(`
          {
            "groups runs=1000 seed=999": {
              "advance_pct": {
                "Albania": 10.1,
                "Croatia": 41.9,
                "Germany": 83.8,
                "Hungary": 42.4,
                "Italy": 65.6,
                "Scotland": 15.7,
                "Spain": 82.4,
                "Switzerland": 58.1,
              },
              "runs": 1000,
              "seed": 999,
              "title_pct": {
                "Croatia": 4,
                "Germany": 29.9,
                "Hungary": 2.4,
                "Italy": 13,
                "Scotland": 0.3,
                "Spain": 42,
                "Switzerland": 8.4,
              },
            },
            "groups runs=300 seed=42": {
              "advance_pct": {
                "Albania": 16,
                "Croatia": 44.67,
                "Germany": 83.33,
                "Hungary": 38.33,
                "Italy": 62,
                "Scotland": 18.33,
                "Spain": 77.33,
                "Switzerland": 60,
              },
              "runs": 300,
              "seed": 42,
              "title_pct": {
                "Albania": 0.33,
                "Croatia": 3.33,
                "Germany": 31.67,
                "Hungary": 2,
                "Italy": 11.67,
                "Scotland": 0.33,
                "Spain": 42.67,
                "Switzerland": 8,
              },
            },
            "groups runs=500 seed=0": {
              "advance_pct": {
                "Albania": 10.2,
                "Croatia": 44.6,
                "Germany": 83.6,
                "Hungary": 43.4,
                "Italy": 62.8,
                "Scotland": 18.8,
                "Spain": 82.4,
                "Switzerland": 54.2,
              },
              "runs": 500,
              "seed": 0,
              "title_pct": {
                "Albania": 0.2,
                "Croatia": 4,
                "Germany": 29.6,
                "Hungary": 2.8,
                "Italy": 16.4,
                "Scotland": 0.2,
                "Spain": 41,
                "Switzerland": 5.8,
              },
            },
            "groups runs=500 seed=1": {
              "advance_pct": {
                "Albania": 9.4,
                "Croatia": 41.6,
                "Germany": 84.4,
                "Hungary": 42,
                "Italy": 66,
                "Scotland": 17,
                "Spain": 83,
                "Switzerland": 56.6,
              },
              "runs": 500,
              "seed": 1,
              "title_pct": {
                "Croatia": 3.4,
                "Germany": 29,
                "Hungary": 2.2,
                "Italy": 12.8,
                "Scotland": 0.2,
                "Spain": 45,
                "Switzerland": 7.4,
              },
            },
            "groups runs=500 seed=7": {
              "advance_pct": {
                "Albania": 8.2,
                "Croatia": 46.6,
                "Germany": 85.4,
                "Hungary": 43,
                "Italy": 64.8,
                "Scotland": 18.6,
                "Spain": 80.4,
                "Switzerland": 53,
              },
              "runs": 500,
              "seed": 7,
              "title_pct": {
                "Albania": 0.2,
                "Croatia": 4,
                "Germany": 35.4,
                "Hungary": 2.4,
                "Italy": 14.2,
                "Scotland": 0.2,
                "Spain": 38,
                "Switzerland": 5.6,
              },
            },
            "no-groups runs=600 seed=8": {
              "advance_pct": {},
              "runs": 600,
              "seed": 8,
              "title_pct": {
                "A": 59.33,
                "B": 14.33,
                "C": 26.33,
              },
            },
          }
        `);
    });

    it('missing config file → exit 2', () => {
        const ts = runTs([path.join(os.tmpdir(), 'definitely-missing-poisson.json'), '--seed', '1']);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toContain('config not found:');
    });

    it("config without 'teams' → exit 2", () => {
        const cfg = writeTmp('noteams.json', JSON.stringify({ base_goals: 1.3 }));
        const ts = runTs([cfg, '--seed', '1']);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toContain("config needs a 'teams' object");
    });

    it('no args → exit 2 with the stable required-config error line', () => {
        const ts = runTs([]);
        expect(ts.status).toBe(2);
        // The usage block wraps to terminal width (env-dependent); assert the
        // stable error line.
        expect(ts.stderr).toContain('the following arguments are required: config');
    });
});
