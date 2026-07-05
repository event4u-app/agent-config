// Contract tests for src/scripts/prediction-pool/score_ev.ts (py2ts Phase 8).
//
// score_ev is a pure deterministic computation (Poisson grid, NO RNG), so its
// output is fully reproducible. The tsx twin is the source of truth (the python
// original was deleted in the teardown); its text/json output is pinned via
// inline snapshots. Argparse usage prose is COLUMNS-dependent, so the no-input
// case asserts exit 2 + a stable token.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'prediction-pool', 'score_ev.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);


const tmpFiles: string[] = [];
function writeTmp(name: string, content: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'score-ev-'));
    const p = path.join(d, name);
    fs.writeFileSync(p, content);
    tmpFiles.push(d);
    return p;
}
afterEach(() => {
    while (tmpFiles.length > 0) {
        const d = tmpFiles.pop();
        if (d && fs.existsSync(d)) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

function runTs(args: string[]): { stdout: string; stderr: string; status: number | null } {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

describe('score_ev — CLI contract (deterministic)', () => {
    it('all lambda/flag cases, text + json (pinned)', () => {
        const cases: Array<{ label: string; args: string[] }> = [
            { label: 'text — moderate favourite', args: ['--lh', '2.0', '--la', '0.7'] },
            { label: 'text — kicktipp 2/3/5 underdog', args: ['--lh', '0.6', '--la', '2.1', '--tendency', '2', '--diff', '3', '--exact', '5'] },
            { label: 'text — even draw-likely', args: ['--lh', '1.5', '--la', '1.5'] },
            { label: 'text — zero rates', args: ['--lh', '0', '--la', '0'] },
            { label: 'text — custom top + max-tip', args: ['--lh', '2.3', '--la', '1.1', '--top', '3', '--max-tip', '4'] },
            { label: 'json — moderate favourite', args: ['--lh', '2.0', '--la', '0.7', '--json'] },
            { label: 'json — kicktipp config', args: ['--lh', '0.6', '--la', '2.1', '--tendency', '2', '--diff', '3', '--exact', '5', '--json'] },
            { label: 'json — fractional lambdas, top 2', args: ['--lh', '1.234', '--la', '0.876', '--top', '2', '--json'] },
        ];
        const out = Object.fromEntries(
            cases.map(({ label, args }) => {
                const ts = runTs(args);
                expect(ts.status, ts.stderr).toBe(0);
                return [label, args.includes('--json') ? JSON.parse(ts.stdout) : ts.stdout];
            }),
        );
        expect(out).toMatchInlineSnapshot(`
          {
            "json — fractional lambdas, top 2": [
              {
                "ev_max": {
                  "ev": 1.286,
                  "tip": "1:0",
                },
                "lambda": [
                  1.234,
                  0.876,
                ],
                "modal_result": {
                  "prob": 0.15,
                  "score": "1:0",
                },
                "p_draw": 0.292,
                "ranked": [
                  {
                    "ev": 1.286,
                    "tip": "1:0",
                  },
                  {
                    "ev": 1.217,
                    "tip": "2:1",
                  },
                ],
                "rule": {
                  "diff": 3,
                  "exact": 4,
                  "tendency": 2,
                },
              },
            ],
            "json — kicktipp config": [
              {
                "ev_max": {
                  "ev": 1.981,
                  "tip": "0:1",
                },
                "lambda": [
                  0.6,
                  2.1,
                ],
                "modal_result": {
                  "prob": 0.148,
                  "score": "0:2",
                },
                "p_draw": 0.183,
                "ranked": [
                  {
                    "ev": 1.981,
                    "tip": "0:1",
                  },
                  {
                    "ev": 1.965,
                    "tip": "0:2",
                  },
                  {
                    "ev": 1.876,
                    "tip": "1:2",
                  },
                  {
                    "ev": 1.796,
                    "tip": "0:3",
                  },
                  {
                    "ev": 1.793,
                    "tip": "1:3",
                  },
                  {
                    "ev": 1.736,
                    "tip": "2:3",
                  },
                ],
                "rule": {
                  "diff": 3,
                  "exact": 5,
                  "tendency": 2,
                },
              },
            ],
            "json — moderate favourite": [
              {
                "ev_max": {
                  "ev": 1.747,
                  "tip": "1:0",
                },
                "lambda": [
                  2,
                  0.7,
                ],
                "modal_result": {
                  "prob": 0.134,
                  "score": "1:0",
                },
                "p_draw": 0.2,
                "ranked": [
                  {
                    "ev": 1.747,
                    "tip": "1:0",
                  },
                  {
                    "ev": 1.706,
                    "tip": "2:1",
                  },
                  {
                    "ev": 1.703,
                    "tip": "2:0",
                  },
                  {
                    "ev": 1.634,
                    "tip": "3:2",
                  },
                  {
                    "ev": 1.631,
                    "tip": "3:1",
                  },
                  {
                    "ev": 1.615,
                    "tip": "4:3",
                  },
                ],
                "rule": {
                  "diff": 3,
                  "exact": 4,
                  "tendency": 2,
                },
              },
            ],
            "text — custom top + max-tip": "lambda 2.3:1.1  rule exact=4.0 diff=3.0 tendency=2.0
          EV-max tip : 2:1  (EV 1.607)
          modal score: 2:1  (P 0.097)  P(draw) 0.189
          ranked by EV:
              2:1  EV 1.607  <- EV-max
              1:0  EV 1.586
              2:0  EV 1.564
          ",
            "text — even draw-likely": "lambda 1.5:1.5  rule exact=4.0 diff=3.0 tendency=2.0
          EV-max tip : 2:1  (EV 1.038)
          modal score: 1:1  (P 0.112)  P(draw) 0.243
          ranked by EV:
              2:1  EV 1.038  <- EV-max
              1:2  EV 1.038
              1:0  EV 1.029
              0:1  EV 1.029
              2:3  EV 0.985
              3:2  EV 0.985
          ",
            "text — kicktipp 2/3/5 underdog": "lambda 0.6:2.1  rule exact=5.0 diff=3.0 tendency=2.0
          EV-max tip : 0:1  (EV 1.981)
          modal score: 0:2  (P 0.148)  P(draw) 0.183
          ranked by EV:
              0:1  EV 1.981  <- EV-max
              0:2  EV 1.965
              1:2  EV 1.876
              0:3  EV 1.796
              1:3  EV 1.793
              2:3  EV 1.736
          ",
            "text — moderate favourite": "lambda 2.0:0.7  rule exact=4.0 diff=3.0 tendency=2.0
          EV-max tip : 1:0  (EV 1.747)
          modal score: 1:0  (P 0.134)  P(draw) 0.2
          ranked by EV:
              1:0  EV 1.747  <- EV-max
              2:1  EV 1.706
              2:0  EV 1.703
              3:2  EV 1.634
              3:1  EV 1.631
              4:3  EV 1.615
          ",
            "text — zero rates": "lambda 0.0:0.0  rule exact=4.0 diff=3.0 tendency=2.0
          EV-max tip : 0:0  (EV 4.0)
          modal score: 0:0  (P 1.0)  P(draw) 1.0
          ranked by EV:
              0:0  EV 4.000  <- EV-max
              1:1  EV 3.000
              2:2  EV 3.000
              3:3  EV 3.000
              4:4  EV 3.000
              5:5  EV 3.000
          ",
          }
        `);
    });

    it('JSON batch input — text mode (pinned)', () => {
        const file = writeTmp(
            'm.json',
            JSON.stringify([
                { match: 'Senegal-Iraq', lh: 2.0, la: 0.7 },
                { match: 'Qatar-Switzerland', lh: 0.6, la: 2.1 },
            ]),
        );
        const ts = runTs([file, '--tendency', '2', '--diff', '3', '--exact', '5']);
        expect(ts.status, ts.stderr).toBe(0);
        expect(ts.stdout).toMatchInlineSnapshot(`
          "
          ## Senegal-Iraq
          lambda 2.0:0.7  rule exact=5.0 diff=3.0 tendency=2.0
          EV-max tip : 1:0  (EV 1.881)
          modal score: 1:0  (P 0.134)  P(draw) 0.2
          ranked by EV:
              1:0  EV 1.881  <- EV-max
              2:0  EV 1.837
              2:1  EV 1.800
              3:1  EV 1.694
              3:0  EV 1.664
              3:2  EV 1.656

          ## Qatar-Switzerland
          lambda 0.6:2.1  rule exact=5.0 diff=3.0 tendency=2.0
          EV-max tip : 0:1  (EV 1.981)
          modal score: 0:2  (P 0.148)  P(draw) 0.183
          ranked by EV:
              0:1  EV 1.981  <- EV-max
              0:2  EV 1.965
              1:2  EV 1.876
              0:3  EV 1.796
              1:3  EV 1.793
              2:3  EV 1.736
          "
        `);
    });

    it('JSON batch input — --json mode (pinned)', () => {
        const file = writeTmp(
            'm.json',
            JSON.stringify([
                { match: 'A-B', lh: 1.8, la: 1.1 },
                { match: 'C-D', lh: 0.9, la: 0.9 },
            ]),
        );
        const ts = runTs([file, '--json']);
        expect(ts.status, ts.stderr).toBe(0);
        expect(JSON.parse(ts.stdout)).toMatchInlineSnapshot(`
          [
            {
              "ev_max": {
                "ev": 1.41,
                "tip": "1:0",
              },
              "lambda": [
                1.8,
                1.1,
              ],
              "match": "A-B",
              "modal_result": {
                "prob": 0.109,
                "score": "1:1",
              },
              "p_draw": 0.231,
              "ranked": [
                {
                  "ev": 1.41,
                  "tip": "1:0",
                },
                {
                  "ev": 1.409,
                  "tip": "2:1",
                },
                {
                  "ev": 1.343,
                  "tip": "3:2",
                },
                {
                  "ev": 1.329,
                  "tip": "2:0",
                },
                {
                  "ev": 1.316,
                  "tip": "4:3",
                },
                {
                  "ev": 1.311,
                  "tip": "5:4",
                },
              ],
              "rule": {
                "diff": 3,
                "exact": 4,
                "tendency": 2,
              },
            },
            {
              "ev_max": {
                "ev": 1.152,
                "tip": "0:0",
              },
              "lambda": [
                0.9,
                0.9,
              ],
              "match": "C-D",
              "modal_result": {
                "prob": 0.165,
                "score": "0:0",
              },
              "p_draw": 0.329,
              "ranked": [
                {
                  "ev": 1.152,
                  "tip": "0:0",
                },
                {
                  "ev": 1.121,
                  "tip": "1:1",
                },
                {
                  "ev": 1.038,
                  "tip": "0:1",
                },
                {
                  "ev": 1.038,
                  "tip": "1:0",
                },
                {
                  "ev": 1.014,
                  "tip": "2:2",
                },
                {
                  "ev": 0.989,
                  "tip": "3:3",
                },
              ],
              "rule": {
                "diff": 3,
                "exact": 4,
                "tendency": 2,
              },
            },
          ]
        `);
    });

    // Error path: no input. Argparse usage prose is COLUMNS-dependent, so
    // assert exit 2 + the stable error line, not the full byte stream.
    it('no input → exit 2 with the stable error line', () => {
        const ts = runTs([]);
        expect(ts.status).toBe(2);
        expect(ts.stdout).toBe('');
        expect(ts.stderr).toContain('provide either a matches JSON file or --lh and --la');
    });
});
