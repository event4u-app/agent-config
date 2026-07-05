// Contract tests for src/scripts/prediction-pool/pool_winsim.ts (py2ts Phase 1).
//
// The sim uses `random.Random(seed)` with half-to-even `round()`, so with a
// FIXED `--seed` the tsx run is fully deterministic (PyRandom reproduces
// CPython MT19937 bit-for-bit). The tsx twin is the source of truth (the python
// original was deleted in the teardown); its text/json output is pinned via
// inline snapshots. Argparse usage prose is COLUMNS-dependent, so error cases
// assert exit 2 + a stable token.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'prediction-pool', 'pool_winsim.ts');
const TSX_BIN =
    process.env.TSX_BIN ??
    path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');


const tmpDirs: string[] = [];
function writeTmp(name: string, content: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-winsim-'));
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

const POOL = JSON.stringify({
    rule: { exact: 5, diff: 3, tendency: 2 },
    participants: 120,
    my_lead: 0,
    field_temperature: 0.6,
    matches: [
        { match: 'A', lh: 2.0, la: 0.7 },
        { match: 'B', lh: 0.6, la: 2.1 },
        { match: 'C', lh: 1.3, la: 1.3 },
        { match: 'D', lh: 1.8, la: 1.1 },
    ],
});

// Negative float lead + non-default temperature exercises the PyFloat
// rendering paths (`-3.0`, `1.0`) and the signed text formatter.
const POOL_NEG = JSON.stringify({
    rule: { exact: 4, diff: 3, tendency: 2 },
    participants: 50,
    my_lead: -3,
    field_temperature: 1.0,
    matches: [
        { match: 'X', lh: 1.7, la: 1.2 },
        { match: 'Y', lh: 0.9, la: 0.9 },
    ],
});

describe('pool_winsim — CLI contract (deterministic seed)', () => {
    const seeds = ['1', '2', '3', '7', '42', '99', '12345'];

    it('text output across the seed sweep (pinned)', () => {
        const out = Object.fromEntries(
            seeds.map((seed) => {
                const cfg = writeTmp('pool.json', POOL);
                const ts = runTs([cfg, '--runs', '800', '--max-flips', '2', '--seed', seed]);
                expect(ts.status, ts.stderr).toBe(0);
                return [seed, ts.stdout];
            }),
        );
        expect(out).toMatchInlineSnapshot(`
          {
            "1": "participants 120 (modelled 119)  runs 800  my_lead 0.0  field_temp 0.6
          EV-max set: A=1:0, B=0:1, C=0:1, D=1:0
          P(win) all-EV-max : 0.0200
          suggested flips (greedy, each raises P(win) most):
            flip B -> 0:2  (EV cost +0.016)  P(win) 0.0213
            flip A -> 2:1  (EV cost +0.081)  P(win) 0.0312
          P(win) after flips: 0.0312  (+0.0112)
          ",
            "12345": "participants 120 (modelled 119)  runs 800  my_lead 0.0  field_temp 0.6
          EV-max set: A=1:0, B=0:1, C=0:1, D=1:0
          P(win) all-EV-max : 0.0175
          suggested flips (greedy, each raises P(win) most):
            flip C -> 1:2  (EV cost +0.030)  P(win) 0.0262
            flip B -> 0:2  (EV cost +0.016)  P(win) 0.0312
          P(win) after flips: 0.0312  (+0.0137)
          ",
            "2": "participants 120 (modelled 119)  runs 800  my_lead 0.0  field_temp 0.6
          EV-max set: A=1:0, B=0:1, C=0:1, D=1:0
          P(win) all-EV-max : 0.0238
          suggested flips (greedy, each raises P(win) most):
            flip D -> 2:1  (EV cost +0.002)  P(win) 0.0300
            flip A -> 2:0  (EV cost +0.044)  P(win) 0.0325
          P(win) after flips: 0.0325  (+0.0087)
          ",
            "3": "participants 120 (modelled 119)  runs 800  my_lead 0.0  field_temp 0.6
          EV-max set: A=1:0, B=0:1, C=0:1, D=1:0
          P(win) all-EV-max : 0.0250
          suggested flips (greedy, each raises P(win) most):
            flip A -> 2:1  (EV cost +0.081)  P(win) 0.0300
          P(win) after flips: 0.0300  (+0.0050)
          ",
            "42": "participants 120 (modelled 119)  runs 800  my_lead 0.0  field_temp 0.6
          EV-max set: A=1:0, B=0:1, C=0:1, D=1:0
          P(win) all-EV-max : 0.0387
          suggested flips (greedy, each raises P(win) most):
            flip D -> 2:1  (EV cost +0.002)  P(win) 0.0425
          P(win) after flips: 0.0425  (+0.0038)
          ",
            "7": "participants 120 (modelled 119)  runs 800  my_lead 0.0  field_temp 0.6
          EV-max set: A=1:0, B=0:1, C=0:1, D=1:0
          P(win) all-EV-max : 0.0138
          suggested flips (greedy, each raises P(win) most):
            flip C -> 2:1  (EV cost +0.030)  P(win) 0.0288
          P(win) after flips: 0.0288  (+0.0150)
          ",
            "99": "participants 120 (modelled 119)  runs 800  my_lead 0.0  field_temp 0.6
          EV-max set: A=1:0, B=0:1, C=0:1, D=1:0
          P(win) all-EV-max : 0.0262
          suggested flips (greedy, each raises P(win) most):
            flip B -> 0:2  (EV cost +0.016)  P(win) 0.0362
            flip D -> 2:0  (EV cost +0.091)  P(win) 0.0450
          P(win) after flips: 0.0450  (+0.0188)
          ",
          }
        `);
    });

    it('json output across the seed sweep (pinned)', () => {
        const out = Object.fromEntries(
            seeds.map((seed) => {
                const cfg = writeTmp('pool.json', POOL);
                const ts = runTs([
                    cfg, '--runs', '800', '--max-flips', '2', '--seed', seed, '--json',
                ]);
                expect(ts.status, ts.stderr).toBe(0);
                return [seed, JSON.parse(ts.stdout)];
            }),
        );
        expect(out).toMatchInlineSnapshot(`
          {
            "1": {
              "ev_max_set": [
                "A=1:0",
                "B=0:1",
                "C=0:1",
                "D=1:0",
              ],
              "field_temperature": 0.6,
              "flips": [
                {
                  "ev_cost": 0.016,
                  "match": "B",
                  "p_win_after": 0.0213,
                  "to": "0:2",
                },
                {
                  "ev_cost": 0.081,
                  "match": "A",
                  "p_win_after": 0.0312,
                  "to": "2:1",
                },
              ],
              "my_lead": 0,
              "opponents_modelled": 119,
              "p_win_after_flips": 0.0312,
              "p_win_ev_max": 0.02,
              "participants": 120,
              "rule": {
                "diff": 3,
                "exact": 5,
                "tendency": 2,
              },
              "runs": 800,
            },
            "12345": {
              "ev_max_set": [
                "A=1:0",
                "B=0:1",
                "C=0:1",
                "D=1:0",
              ],
              "field_temperature": 0.6,
              "flips": [
                {
                  "ev_cost": 0.03,
                  "match": "C",
                  "p_win_after": 0.0262,
                  "to": "1:2",
                },
                {
                  "ev_cost": 0.016,
                  "match": "B",
                  "p_win_after": 0.0312,
                  "to": "0:2",
                },
              ],
              "my_lead": 0,
              "opponents_modelled": 119,
              "p_win_after_flips": 0.0312,
              "p_win_ev_max": 0.0175,
              "participants": 120,
              "rule": {
                "diff": 3,
                "exact": 5,
                "tendency": 2,
              },
              "runs": 800,
            },
            "2": {
              "ev_max_set": [
                "A=1:0",
                "B=0:1",
                "C=0:1",
                "D=1:0",
              ],
              "field_temperature": 0.6,
              "flips": [
                {
                  "ev_cost": 0.002,
                  "match": "D",
                  "p_win_after": 0.03,
                  "to": "2:1",
                },
                {
                  "ev_cost": 0.044,
                  "match": "A",
                  "p_win_after": 0.0325,
                  "to": "2:0",
                },
              ],
              "my_lead": 0,
              "opponents_modelled": 119,
              "p_win_after_flips": 0.0325,
              "p_win_ev_max": 0.0238,
              "participants": 120,
              "rule": {
                "diff": 3,
                "exact": 5,
                "tendency": 2,
              },
              "runs": 800,
            },
            "3": {
              "ev_max_set": [
                "A=1:0",
                "B=0:1",
                "C=0:1",
                "D=1:0",
              ],
              "field_temperature": 0.6,
              "flips": [
                {
                  "ev_cost": 0.081,
                  "match": "A",
                  "p_win_after": 0.03,
                  "to": "2:1",
                },
              ],
              "my_lead": 0,
              "opponents_modelled": 119,
              "p_win_after_flips": 0.03,
              "p_win_ev_max": 0.025,
              "participants": 120,
              "rule": {
                "diff": 3,
                "exact": 5,
                "tendency": 2,
              },
              "runs": 800,
            },
            "42": {
              "ev_max_set": [
                "A=1:0",
                "B=0:1",
                "C=0:1",
                "D=1:0",
              ],
              "field_temperature": 0.6,
              "flips": [
                {
                  "ev_cost": 0.002,
                  "match": "D",
                  "p_win_after": 0.0425,
                  "to": "2:1",
                },
              ],
              "my_lead": 0,
              "opponents_modelled": 119,
              "p_win_after_flips": 0.0425,
              "p_win_ev_max": 0.0387,
              "participants": 120,
              "rule": {
                "diff": 3,
                "exact": 5,
                "tendency": 2,
              },
              "runs": 800,
            },
            "7": {
              "ev_max_set": [
                "A=1:0",
                "B=0:1",
                "C=0:1",
                "D=1:0",
              ],
              "field_temperature": 0.6,
              "flips": [
                {
                  "ev_cost": 0.03,
                  "match": "C",
                  "p_win_after": 0.0288,
                  "to": "2:1",
                },
              ],
              "my_lead": 0,
              "opponents_modelled": 119,
              "p_win_after_flips": 0.0288,
              "p_win_ev_max": 0.0138,
              "participants": 120,
              "rule": {
                "diff": 3,
                "exact": 5,
                "tendency": 2,
              },
              "runs": 800,
            },
            "99": {
              "ev_max_set": [
                "A=1:0",
                "B=0:1",
                "C=0:1",
                "D=1:0",
              ],
              "field_temperature": 0.6,
              "flips": [
                {
                  "ev_cost": 0.016,
                  "match": "B",
                  "p_win_after": 0.0362,
                  "to": "0:2",
                },
                {
                  "ev_cost": 0.091,
                  "match": "D",
                  "p_win_after": 0.045,
                  "to": "2:0",
                },
              ],
              "my_lead": 0,
              "opponents_modelled": 119,
              "p_win_after_flips": 0.045,
              "p_win_ev_max": 0.0262,
              "participants": 120,
              "rule": {
                "diff": 3,
                "exact": 5,
                "tendency": 2,
              },
              "runs": 800,
            },
          }
        `);
    });

    it('flag variants + negative-lead float rendering (pinned)', () => {
        const runStdout = (fixtureName: string, fixture: string, args: string[]): string => {
            const cfg = writeTmp(fixtureName, fixture);
            const ts = runTs([cfg, ...args]);
            expect(ts.status, ts.stderr).toBe(0);
            return ts.stdout;
        };
        const variants = {
            'default json (seed=1 runs=4000)': JSON.parse(runStdout('pool.json', POOL, ['--json'])),
            'small field max-opponents=3 text': runStdout('pool.json', POOL, [
                '--runs', '1000', '--max-opponents', '3', '--seed', '3',
            ]),
            'top-flip=6 json seed=9': JSON.parse(runStdout('pool.json', POOL, [
                '--runs', '1500', '--top-flip', '6', '--seed', '9', '--json',
            ])),
            'neg-lead temp1.0 text': runStdout('pool-neg.json', POOL_NEG, [
                '--runs', '1000', '--seed', '4',
            ]),
            'neg-lead temp1.0 json': JSON.parse(runStdout('pool-neg.json', POOL_NEG, [
                '--runs', '1000', '--seed', '4', '--json',
            ])),
        };
        expect(variants).toMatchInlineSnapshot(`
          {
            "default json (seed=1 runs=4000)": {
              "ev_max_set": [
                "A=1:0",
                "B=0:1",
                "C=0:1",
                "D=1:0",
              ],
              "field_temperature": 0.6,
              "flips": [
                {
                  "ev_cost": 0.044,
                  "match": "A",
                  "p_win_after": 0.018,
                  "to": "2:0",
                },
                {
                  "ev_cost": 0,
                  "match": "C",
                  "p_win_after": 0.0248,
                  "to": "1:0",
                },
              ],
              "my_lead": 0,
              "opponents_modelled": 119,
              "p_win_after_flips": 0.0248,
              "p_win_ev_max": 0.0168,
              "participants": 120,
              "rule": {
                "diff": 3,
                "exact": 5,
                "tendency": 2,
              },
              "runs": 4000,
            },
            "neg-lead temp1.0 json": {
              "ev_max_set": [
                "X=2:1",
                "Y=0:0",
              ],
              "field_temperature": 1,
              "flips": [],
              "my_lead": -3,
              "opponents_modelled": 49,
              "p_win_after_flips": 0,
              "p_win_ev_max": 0,
              "participants": 50,
              "rule": {
                "diff": 3,
                "exact": 4,
                "tendency": 2,
              },
              "runs": 1000,
            },
            "neg-lead temp1.0 text": "participants 50 (modelled 49)  runs 1000  my_lead -3.0  field_temp 1.0
          EV-max set: X=2:1, Y=0:0
          P(win) all-EV-max : 0.0000
          greedy flips: none improved P(win) — EV-max is already best (small/easy field).
          ",
            "small field max-opponents=3 text": "participants 120 (modelled 3)  runs 1000  my_lead 0.0  field_temp 0.6
          EV-max set: A=1:0, B=0:1, C=0:1, D=1:0
          P(win) all-EV-max : 0.2390
          suggested flips (greedy, each raises P(win) most):
            flip C -> 1:0  (EV cost +0.000)  P(win) 0.2590
          P(win) after flips: 0.2590  (+0.0200)
          ",
            "top-flip=6 json seed=9": {
              "ev_max_set": [
                "A=1:0",
                "B=0:1",
                "C=0:1",
                "D=1:0",
              ],
              "field_temperature": 0.6,
              "flips": [
                {
                  "ev_cost": 0.091,
                  "match": "C",
                  "p_win_after": 0.022,
                  "to": "1:1",
                },
                {
                  "ev_cost": 0.185,
                  "match": "B",
                  "p_win_after": 0.0227,
                  "to": "0:3",
                },
              ],
              "my_lead": 0,
              "opponents_modelled": 119,
              "p_win_after_flips": 0.0227,
              "p_win_ev_max": 0.014,
              "participants": 120,
              "rule": {
                "diff": 3,
                "exact": 5,
                "tendency": 2,
              },
              "runs": 1500,
            },
          }
        `);
    });

    it('invalid int for --runs → exit 2', () => {
        const cfg = writeTmp('pool.json', POOL);
        const ts = runTs([cfg, '--runs', 'abc']);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toContain('invalid int value');
    });

    it('no args → exit 2 with the stable required-config error line', () => {
        const ts = runTs([]);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toContain('the following arguments are required: config');
    });
});
