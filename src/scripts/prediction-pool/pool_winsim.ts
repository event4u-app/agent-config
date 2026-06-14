#!/usr/bin/env tsx
/**
 * Field model + P(finish 1st) simulator for prediction-pool-optimizer.
 *
 * TypeScript twin of `src/scripts/prediction-pool/pool_winsim.py` (ADR-096).
 * The CLI contract is mirrored EXACTLY — the positional `config` JSON file,
 * `--runs` / `--max-flips` / `--max-opponents` / `--top-flip` / `--seed` /
 * `--json`, exit codes, the stdout/stderr split, and byte-identical text AND
 * `--json` output. No behaviour changes.
 *
 * RNG parity: `random.Random(seed)` is reproduced bit-for-bit by `PyRandom`
 * (MT19937) in `../_lib/py_random.js`; the only consumer is `rng.random()`
 * (outcome sampling + field softmax-pick), consumed in the same order as the
 * Python source.
 *
 * Score engine: imports `ev_table`, `grid`, `_score` from the already-ported
 * `./score_ev.js` twin (a `.ts` MUST NOT import a `.py`; the Python source
 * does `from score_ev import …`).
 *
 * Float parity: `round(x, N)` uses CPython half-to-even (pyRound from _lib);
 * text uses Python `f"{x:.4f}"` / `f"{x:+.3f}"` / `f"{x:+.4f}"` semantics;
 * JSON renders every Python `float` via the PyFloat marker (`my_lead`,
 * `field_temperature`, the rule values, ev_cost, p_win figures).
 *
 * Original module docstring (verbatim):
 *
 * Honest operationalisation of the large-pool strategy note: in a big pool the
 * target is **P(finish ahead of the whole field)**, not E(points). Maximizing EV
 * makes your tip-set converge with everyone else's EV-max set, so you cannot open
 * the gap you need. This script measures that — and greedily finds the few tips
 * worth flipping off EV-max to manufacture upside.
 *
 * What it does:
 *
 *   1. Models the FIELD: each opponent commits one tip per match, drawn from a
 *      softmax over the per-match EV table (temperature controls spread — low =
 *      the crowd clusters tightly on EV-max, high = noisy). This is a model of
 *      the crowd, stated as such; feed a real field distribution if you have one.
 *   2. Pre-draws R outcome scenarios from the Poisson grids and pre-scores every
 *      opponent once, so evaluating any of MY tip-sets is cheap.
 *   3. Reports P(win) for the EV-max-everywhere baseline, then runs a greedy
 *      flip search: repeatedly flip the single tip that most raises P(win),
 *      reporting the EV cost and the P(win) gain per flip, up to --max-flips.
 *
 * The lesson it makes concrete: with small N the EV-max set already wins often
 * and flips do not help (don't add variance you don't need); with large N and a
 * deficit, a handful of calculated flips can lift P(win) materially at a small
 * EV cost. The crossover is empirical — run it.
 *
 * It is an APPROXIMATION: the field is a softmax-EV model, not your real pool's
 * tips, and the Poisson grids are only as good as the lambdas you feed (de-vigged
 * consensus odds — see reference/odds-and-bonus.md). Outcomes and EV are exact
 * for that model; the field shape is a prior.
 *
 * Input JSON:
 * {
 *   "rule": {"exact": 5, "diff": 3, "tendency": 2},
 *   "participants": 120,            # field size N; opponents modelled = N-1 (capped by --max-opponents)
 *   "my_lead": 0,                   # my current points minus the rival-to-beat's (negative = behind)
 *   "field_temperature": 0.6,       # softmax temp for crowd spread around EV-max
 *   "matches": [
 *     {"match": "A", "lh": 2.0, "la": 0.7},
 *     {"match": "B", "lh": 0.6, "la": 2.1}
 *   ]
 * }
 *
 * Usage:
 *   python3 scripts/prediction-pool/pool_winsim.py pool.json --runs 4000 --max-flips 4 [--seed 1]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { PyRandom } from '../_lib/py_random.js';
import { _score, ev_table, grid, type EvRow } from './score_ev.js';

/**
 * CPython `round(value, ndigits)` — correct decimal rounding of the *exact*
 * IEEE-754 value, half-to-even. Uses `toFixed(40)` (far beyond double
 * precision) so a value that displays as an exact half at 17 sig digits but is
 * truly just below/above (e.g. `31/800 = 0.03874999999999999972`) rounds the
 * way CPython does. The value-ladder `pyRound` trusts `toPrecision(17)` and
 * diverges on these P(win) ratios, so this twin carries its own.
 */
function pyRound(value: number, ndigits: number): number {
    if (!Number.isFinite(value) || value === 0) {
        return value;
    }
    const sign = value < 0 ? -1 : 1;
    const abs = Math.abs(value);
    const str = abs.toFixed(40);
    const [intPart, fracRaw = ''] = str.split('.');
    let fracPart = fracRaw;
    while (fracPart.length <= ndigits) {
        fracPart += '0';
    }
    const keepFrac = fracPart.slice(0, ndigits);
    const decider = fracPart.slice(ndigits);
    let scaledInt = BigInt((intPart ?? '0') + keepFrac || '0');
    const first = decider.charAt(0);
    const restNonZero = /[1-9]/u.test(decider.slice(1));
    let roundUp = false;
    if (first > '5' || (first === '5' && restNonZero)) {
        roundUp = true;
    } else if (first === '5' && !restNonZero) {
        roundUp = scaledInt % 2n === 1n;
    }
    if (roundUp) {
        scaledInt += 1n;
    }
    const factor = 10 ** ndigits;
    return (Number(scaledInt) / factor) * sign;
}

/** Marker for a Python `float` so JSON renders integer-valued floats as `0.0`, not `0`. */
class PyFloat {
    constructor(readonly value: number) {}
}

/** Marker for a Python `int` so JSON renders it without a `.0` suffix. */
class PyInt {
    constructor(readonly value: number) {}
}

type Tip = [number, number];
type FlatEntry = [number, Tip]; // (prob, (h, a))

interface PerMatch {
    name: string;
    rows: EvRow[];
    flat: FlatEntry[];
}

/** Flatten a joint grid into (prob, (h,a)) pairs for sampling. */
function _flat_grid(g: number[][]): FlatEntry[] {
    const flat: FlatEntry[] = [];
    for (let h = 0; h < g.length; h += 1) {
        const row = g[h] as number[];
        for (let a = 0; a < row.length; a += 1) {
            const p = row[a] as number;
            if (p > 0) {
                flat.push([p, [h, a]]);
            }
        }
    }
    return flat;
}

function _sample_outcome(flat: FlatEntry[], rng: PyRandom): Tip {
    const r = rng.random();
    let acc = 0.0;
    for (const [p, ha] of flat) {
        acc += p;
        if (r <= acc) {
            return ha;
        }
    }
    return (flat[flat.length - 1] as FlatEntry)[1];
}

/** Pick a tip (h,a) from EV rows via softmax(EV / temperature). */
function _softmax_pick(rows: EvRow[], temperature: number, rng: PyRandom): Tip {
    if (temperature <= 0) {
        const first = rows[0] as EvRow;
        return [first[0], first[1]];
    }
    const top = rows.slice(0, 24); // the tail has negligible mass; cap for speed
    const mx = (top[0] as EvRow)[2];
    const weights = top.map(([, , ev]) => Math.exp((ev - mx) / temperature));
    let tot = 0.0;
    for (const w of weights) {
        tot += w;
    }
    const r = rng.random() * tot;
    let acc = 0.0;
    for (let idx = 0; idx < top.length; idx += 1) {
        const [h, a] = top[idx] as EvRow;
        acc += weights[idx] as number;
        if (r <= acc) {
            return [h, a];
        }
    }
    const last = top[top.length - 1] as EvRow;
    return [last[0], last[1]];
}

interface Rule {
    exact: number;
    diff: number;
    tendency: number;
}

interface MatchSpec {
    match?: string;
    lh: number | string;
    la: number | string;
}

interface Config {
    rule?: Partial<Rule>;
    participants?: number;
    my_lead?: number;
    field_temperature?: number;
    matches: MatchSpec[];
}

interface FlipRecord {
    mi: number;
    tip: Tip;
    pwin: number;
    ev_cost: number;
    name: string;
}

interface FlipOut {
    match: string;
    to: string;
    ev_cost: PyFloat;
    p_win_after: PyFloat;
}

interface RunResult {
    participants: PyInt;
    opponents_modelled: PyInt;
    runs: PyInt;
    my_lead: PyFloat;
    field_temperature: PyFloat;
    rule: { exact: PyFloat; diff: PyFloat; tendency: PyFloat };
    ev_max_set: string[];
    p_win_ev_max: PyFloat;
    flips: FlipOut[];
    p_win_after_flips: PyFloat;
}

function run(
    cfg: Config,
    runs: number,
    max_flips: number,
    max_opponents: number,
    top_flip: number,
    seed: number,
): RunResult {
    const rng = new PyRandom(seed);
    const rule = cfg.rule ?? { exact: 4, diff: 3, tendency: 2 };
    const pe = Number(rule.exact);
    const pd = Number(rule.diff);
    const pt = Number(rule.tendency);
    const n = Math.trunc(Number(cfg.participants ?? 20));
    const my_lead = Number(cfg.my_lead ?? 0);
    const temp = Number(cfg.field_temperature ?? 0.6);
    const matches = cfg.matches;
    const n_opp = Math.max(0, Math.min(n - 1, max_opponents));

    // Per match: EV table + sampling grid.
    const per: PerMatch[] = [];
    for (const m of matches) {
        const [rows] = ev_table(Number(m.lh), Number(m.la), pe, pd, pt, 6);
        const g = grid(Number(m.lh), Number(m.la));
        per.push({ name: m.match ?? '?', rows, flat: _flat_grid(g) });
    }

    // Pre-draw R outcome scenarios (one actual scoreline per match per run).
    const scenarios: Tip[][] = [];
    for (let i = 0; i < runs; i += 1) {
        scenarios.push(per.map((p) => _sample_outcome(p.flat, rng)));
    }

    // Model the field: each opponent commits a fixed tip per match (softmax-EV),
    // then score each opponent across all scenarios. Keep the per-scenario field
    // MAX so any of my tip-sets can be evaluated against it cheaply.
    const field_max: number[] = new Array<number>(runs).fill(-1e9);
    for (let o = 0; o < n_opp; o += 1) {
        const opp_tips = per.map((p) => _softmax_pick(p.rows, temp, rng));
        for (let s_idx = 0; s_idx < scenarios.length; s_idx += 1) {
            const sc = scenarios[s_idx] as Tip[];
            let tot = 0.0;
            for (let mi = 0; mi < opp_tips.length; mi += 1) {
                const [th, ta] = opp_tips[mi] as Tip;
                const [ah, aa] = sc[mi] as Tip;
                tot += _score(th, ta, ah, aa, pe, pd, pt);
            }
            if (tot > (field_max[s_idx] as number)) {
                field_max[s_idx] = tot;
            }
        }
    }

    const my_total = (tipset: Tip[], s_idx: number): number => {
        const sc = scenarios[s_idx] as Tip[];
        let tot = 0.0;
        for (let mi = 0; mi < tipset.length; mi += 1) {
            const [th, ta] = tipset[mi] as Tip;
            const [ah, aa] = sc[mi] as Tip;
            tot += _score(th, ta, ah, aa, pe, pd, pt);
        }
        return tot;
    };

    const p_win = (tipset: Tip[]): number => {
        let wins = 0;
        for (let s_idx = 0; s_idx < runs; s_idx += 1) {
            if (my_total(tipset, s_idx) + my_lead > (field_max[s_idx] as number)) {
                wins += 1;
            }
        }
        return wins / runs;
    };

    // Baseline: EV-max on every match.
    const ev_max_set: Tip[] = per.map((p) => {
        const first = p.rows[0] as EvRow;
        return [first[0], first[1]];
    });
    const base_pwin = p_win(ev_max_set);

    // Greedy flips: repeatedly flip the one tip that most raises P(win),
    // considering each match's top-`top_flip` EV candidates.
    const current: Tip[] = ev_max_set.slice();
    const flips: FlipRecord[] = [];
    const used = new Set<number>();
    for (let f = 0; f < max_flips; f += 1) {
        let best: FlipRecord | null = null;
        for (let mi = 0; mi < per.length; mi += 1) {
            if (used.has(mi)) {
                continue;
            }
            const p = per[mi] as PerMatch;
            for (const [h, a, ev] of p.rows.slice(0, top_flip)) {
                const cur = current[mi] as Tip;
                if (h === cur[0] && a === cur[1]) {
                    continue;
                }
                const trial = current.slice();
                trial[mi] = [h, a];
                const pw = p_win(trial);
                const ev_cost = (p.rows[0] as EvRow)[2] - ev;
                if (best === null || pw > best.pwin) {
                    best = { mi, tip: [h, a], pwin: pw, ev_cost, name: p.name };
                }
            }
        }
        const threshold = flips.length > 0 ? (flips[flips.length - 1] as FlipRecord).pwin : base_pwin;
        if (best === null || best.pwin <= threshold) {
            break;
        }
        current[best.mi] = best.tip;
        used.add(best.mi);
        flips.push(best);
    }

    const lastPwin = flips.length > 0 ? (flips[flips.length - 1] as FlipRecord).pwin : base_pwin;

    return {
        participants: new PyInt(n),
        opponents_modelled: new PyInt(n_opp),
        runs: new PyInt(runs),
        my_lead: new PyFloat(my_lead),
        field_temperature: new PyFloat(temp),
        rule: { exact: new PyFloat(pe), diff: new PyFloat(pd), tendency: new PyFloat(pt) },
        ev_max_set: ev_max_set.map((tip, i) => `${(per[i] as PerMatch).name}=${tip[0]}:${tip[1]}`),
        p_win_ev_max: new PyFloat(pyRound(base_pwin, 4)),
        flips: flips.map((fl) => ({
            match: fl.name,
            to: `${fl.tip[0]}:${fl.tip[1]}`,
            ev_cost: new PyFloat(pyRound(fl.ev_cost, 3)),
            p_win_after: new PyFloat(pyRound(fl.pwin, 4)),
        })),
        p_win_after_flips: new PyFloat(pyRound(lastPwin, 4)),
    };
}

// --- Python format helpers --------------------------------------------------

/** Mirror Python `f"{x:.4f}"` — fixed 4 decimals, round-half-to-even. */
function pyFixed(x: number, ndigits: number): string {
    if (!Number.isFinite(x)) {
        return String(x);
    }
    const neg = x < 0 || Object.is(x, -0);
    const abs = Math.abs(x);
    const factor = 10 ** ndigits;
    const scaled = abs * factor;
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    const tol = Math.max(Math.abs(scaled), 1) * 2 ** -40;
    let rounded: number;
    if (Math.abs(frac - 0.5) <= tol) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    let intStr = String(rounded);
    if (intStr.length <= ndigits) {
        intStr = '0'.repeat(ndigits - intStr.length + 1) + intStr;
    }
    const whole = intStr.slice(0, intStr.length - ndigits);
    const dec = intStr.slice(intStr.length - ndigits);
    const result = ndigits > 0 ? `${whole}.${dec}` : whole;
    return neg ? `-${result}` : result;
}

/** Mirror Python `f"{x:+.3f}"` — explicit sign, fixed decimals. */
function pySigned(x: number, ndigits: number): string {
    const neg = x < 0 || Object.is(x, -0);
    const body = pyFixed(Math.abs(x), ndigits);
    return neg ? `-${body}` : `+${body}`;
}

// --- JSON (json.dumps(res, indent=2)) parity -------------------------------

function _jsonDumps(value: unknown, indent: number): string {
    return _escapeNonAscii(_dumpsIndent(value, indent, 0));
}

function _dumpsIndent(value: unknown, indent: number, depth: number): string {
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return String(value);
    }
    if (typeof value === 'string') {
        return _jsonStr(value);
    }
    if (value instanceof PyInt) {
        return String(value.value);
    }
    if (value instanceof PyFloat) {
        return _jsonFloat(value.value);
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _dumpsIndent(v, indent, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
        return '{}';
    }
    const items = keys.map((k) => `${pad}${_jsonStr(k)}: ${_dumpsIndent(obj[k], indent, depth + 1)}`);
    return `{\n${items.join(',\n')}\n${closePad}}`;
}

/** Render a Python float — integer-valued floats keep a `.0` suffix (repr(float)). */
function _jsonFloat(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    return Number.isInteger(n) ? `${n}.0` : String(n);
}

function _jsonStr(s: string): string {
    let out = '"';
    for (const ch of s) {
        switch (ch) {
            case '"':
                out += '\\"';
                break;
            case '\\':
                out += '\\\\';
                break;
            case '\n':
                out += '\\n';
                break;
            case '\r':
                out += '\\r';
                break;
            case '\t':
                out += '\\t';
                break;
            default: {
                const code = ch.codePointAt(0) ?? 0;
                if (code < 0x20) {
                    out += `\\u${code.toString(16).padStart(4, '0')}`;
                } else {
                    out += ch;
                }
            }
        }
    }
    return `${out}"`;
}

/** json.dumps default ensure_ascii=True — escape any non-ASCII to \uXXXX. */
function _escapeNonAscii(s: string): string {
    let out = '';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
        if (code > 0x7f) {
            if (code > 0xffff) {
                const high = 0xd800 + ((code - 0x10000) >> 10);
                const low = 0xdc00 + ((code - 0x10000) & 0x3ff);
                out += `\\u${high.toString(16).padStart(4, '0')}\\u${low.toString(16).padStart(4, '0')}`;
            } else {
                out += `\\u${code.toString(16).padStart(4, '0')}`;
            }
        } else {
            out += ch;
        }
    }
    return out;
}

// --- argparse-equivalent CLI ------------------------------------------------

const USAGE =
    'usage: pool_winsim.py [-h] [--runs RUNS] [--max-flips MAX_FLIPS]\n' +
    '                      [--max-opponents MAX_OPPONENTS] [--top-flip TOP_FLIP]\n' +
    '                      [--seed SEED] [--json]\n' +
    '                      config\n';

interface Args {
    config: string | null;
    runs: number;
    max_flips: number;
    max_opponents: number;
    top_flip: number;
    seed: number;
    json: boolean;
}

class ArgError extends Error {}

function _apError(msg: string): never {
    process.stderr.write(USAGE);
    process.stderr.write(`pool_winsim.py: error: ${msg}\n`);
    process.exitCode = 2;
    throw new ArgError(msg);
}

function _parseIntArg(name: string, raw: string): number {
    if (!/^[+-]?\d+$/u.test(raw.trim())) {
        _apError(`argument ${name}: invalid int value: '${raw}'`);
    }
    return parseInt(raw, 10);
}

function parseArgs(argv: string[]): Args {
    const args: Args = {
        config: null,
        runs: 4000,
        max_flips: 4,
        max_opponents: 300,
        top_flip: 4,
        seed: 1,
        json: false,
    };
    const positionals: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        const takeValue = (flag: string): string => {
            const eq = a.indexOf('=');
            if (eq !== -1) {
                return a.slice(eq + 1);
            }
            i += 1;
            if (i >= argv.length) {
                _apError(`argument ${flag}: expected one argument`);
            }
            return argv[i] as string;
        };
        if (a === '-h' || a === '--help') {
            process.stdout.write(USAGE);
            process.exitCode = 0;
            throw new ArgError('help');
        } else if (a === '--runs' || a.startsWith('--runs=')) {
            args.runs = _parseIntArg('--runs', takeValue('--runs'));
        } else if (a === '--max-flips' || a.startsWith('--max-flips=')) {
            args.max_flips = _parseIntArg('--max-flips', takeValue('--max-flips'));
        } else if (a === '--max-opponents' || a.startsWith('--max-opponents=')) {
            args.max_opponents = _parseIntArg('--max-opponents', takeValue('--max-opponents'));
        } else if (a === '--top-flip' || a.startsWith('--top-flip=')) {
            args.top_flip = _parseIntArg('--top-flip', takeValue('--top-flip'));
        } else if (a === '--seed' || a.startsWith('--seed=')) {
            args.seed = _parseIntArg('--seed', takeValue('--seed'));
        } else if (a === '--json') {
            args.json = true;
        } else if (a.startsWith('-') && a !== '-') {
            _apError(`unrecognized arguments: ${a}`);
        } else {
            positionals.push(a);
        }
    }
    if (positionals.length > 1) {
        _apError(`unrecognized arguments: ${positionals.slice(1).join(' ')}`);
    }
    if (positionals.length === 0) {
        _apError('the following arguments are required: config');
    }
    args.config = positionals[0] as string;
    return args;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    let args: Args;
    try {
        args = parseArgs(argv);
    } catch (e) {
        if (e instanceof ArgError) {
            return process.exitCode === undefined ? 0 : (process.exitCode as number);
        }
        throw e;
    }

    const cfg = JSON.parse(fs.readFileSync(args.config as string, 'utf-8')) as Config;
    const res = run(cfg, args.runs, args.max_flips, args.max_opponents, args.top_flip, args.seed);

    if (args.json) {
        process.stdout.write(`${_jsonDumps(res, 2)}\n`);
        return 0;
    }

    process.stdout.write(
        `participants ${res.participants.value} (modelled ${res.opponents_modelled.value})  ` +
            `runs ${res.runs.value}  my_lead ${pyFloatRepr(res.my_lead.value)}  ` +
            `field_temp ${pyFloatRepr(res.field_temperature.value)}\n`,
    );
    process.stdout.write(`EV-max set: ${res.ev_max_set.join(', ')}\n`);
    process.stdout.write(`P(win) all-EV-max : ${pyFixed(res.p_win_ev_max.value, 4)}\n`);
    if (res.flips.length === 0) {
        process.stdout.write(
            'greedy flips: none improved P(win) — EV-max is already best (small/easy field).\n',
        );
    } else {
        process.stdout.write('suggested flips (greedy, each raises P(win) most):\n');
        for (const f of res.flips) {
            process.stdout.write(
                `  flip ${f.match} -> ${f.to}  (EV cost ${pySigned(f.ev_cost.value, 3)})  ` +
                    `P(win) ${pyFixed(f.p_win_after.value, 4)}\n`,
            );
        }
        process.stdout.write(
            `P(win) after flips: ${pyFixed(res.p_win_after_flips.value, 4)}  ` +
                `(+${pyFixed(res.p_win_after_flips.value - res.p_win_ev_max.value, 4)})\n`,
        );
    }
    return 0;
}

/** Mirror Python `str(float(x))` for the text header (my_lead / field_temp). */
function pyFloatRepr(x: number): string {
    if (!Number.isFinite(x)) {
        if (Number.isNaN(x)) {
            return 'nan';
        }
        return x > 0 ? 'inf' : '-inf';
    }
    return Number.isInteger(x) ? `${x}.0` : String(x);
}

const _invokedDirectly =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_invokedDirectly) {
    try {
        const rc = main();
        if (process.exitCode === undefined) {
            process.exitCode = rc;
        }
    } catch (e) {
        if (!(e instanceof ArgError)) {
            throw e;
        }
    }
}
