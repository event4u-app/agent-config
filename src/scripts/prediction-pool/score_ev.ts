#!/usr/bin/env tsx
/**
 * Exact-score EV optimiser for prediction-pool-optimizer.
 *
 * TypeScript twin of `src/scripts/prediction-pool/score_ev.py` (ADR-094,
 * Phase 8). The CLI contract is mirrored EXACTLY — the positional `matches`
 * JSON file, `--lh` / `--la` / `--exact` / `--diff` / `--tendency` /
 * `--max-tip` / `--top` / `--json`, exit codes, the stdout/stderr split, and
 * byte-identical text AND `--json` output. No behaviour changes.
 *
 * Float parity: `round(x, 3)` uses CPython half-to-even (pyRound from _lib);
 * JSON renders every Python `float` via the PyFloat marker so integer-valued
 * floats keep the `.0` suffix (`0.0`, not `0`); text uses Python `str(float)`
 * and `f"{x:.3f}"` semantics. The Poisson grid is a pure deterministic
 * computation (no RNG) — its sibling sims poisson_sim / pool_winsim DO use
 * RNG and are out of scope.
 *
 * Original module docstring (verbatim):
 *
 * Honest replacement for eyeballing the favourite — given each side's expected
 * goals (lambda) and the pool's scoring rule, this builds the full Poisson
 * score grid and computes the expected points of EVERY candidate tip, then
 * prints the EV-maximizing scoreline. It exists to kill two recurring failure
 * modes:
 *
 *   1. Hallucinated high scorelines (4:2, 1:4, 3:2 ...). Under any partial-points
 *      rule these are almost never EV-max for a moderate favourite — the points
 *      live in the tendency and goal-difference tiers, not the exact high score.
 *   2. Under-tipped draws. A correctly-tipped draw banks the goal-difference
 *      tier on every draw scoreline, so a 1:1 can beat a 1:0 in a close game.
 *      The grid surfaces this; intuition does not.
 *
 * The scoring model (configurable points per tier):
 *
 *     exact result  → --exact     (default 4)
 *     goal diff      → --diff      (default 3)   # same difference, not exact; draw-on-draw lands here
 *     tendency       → --tendency  (default 2)   # same W/D/L sign only
 *     else           → 0
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { pyRound } from '../_lib/value_ladder.js';

const MAX_GOALS = 12; // truncation of the Poisson grid; tail beyond this is negligible

/** Marker for a Python `float` so JSON renders integer-valued floats as `0.0`, not `0`. */
class PyFloat {
    constructor(readonly value: number) {}
}

/** Mirror Python `str(float(x))` — integer-valued floats keep the `.0` suffix. */
function pyFloatStr(x: number): string {
    if (!Number.isFinite(x)) {
        if (Number.isNaN(x)) {
            return 'nan';
        }
        return x > 0 ? 'inf' : '-inf';
    }
    return Number.isInteger(x) ? `${x}.0` : String(x);
}

/** Mirror Python `f"{x:.3f}"` — fixed 3 decimals, round-half-to-even on the exact value. */
function pyFixed3(x: number): string {
    if (!Number.isFinite(x)) {
        return String(x);
    }
    const neg = x < 0 || Object.is(x, -0);
    const abs = Math.abs(x);
    const factor = 1000;
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
    if (intStr.length <= 3) {
        intStr = '0'.repeat(3 - intStr.length + 1) + intStr;
    }
    const whole = intStr.slice(0, intStr.length - 3);
    const dec = intStr.slice(intStr.length - 3);
    const result = `${whole}.${dec}`;
    return neg ? `-${result}` : result;
}

/** Mirror Python `f"{s:>5}"` — right-justify a string in a field of width 5. */
function rjust5(s: string): string {
    return s.length >= 5 ? s : ' '.repeat(5 - s.length) + s;
}

/** Mirror Python `math.factorial(k)` for the small k this grid uses (exact in a double up to 12!). */
function factorial(k: number): number {
    let r = 1;
    for (let i = 2; i <= k; i += 1) {
        r *= i;
    }
    return r;
}

function _pois_pmf(k: number, rate: number): number {
    if (rate <= 0) {
        return k === 0 ? 1.0 : 0.0;
    }
    return (Math.exp(-rate) * rate ** k) / factorial(k);
}

function _sign(x: number): number {
    return (x > 0 ? 1 : 0) - (x < 0 ? 1 : 0);
}

/** Points a tip (th:ta) earns against an actual result (ah:aa). */
export function _score(
    th: number,
    ta: number,
    ah: number,
    aa: number,
    pts_exact: number,
    pts_diff: number,
    pts_tend: number,
): number {
    if (th === ah && ta === aa) {
        return pts_exact;
    }
    if (th - ta === ah - aa) {
        return pts_diff;
    }
    if (_sign(th - ta) === _sign(ah - aa)) {
        return pts_tend;
    }
    return 0.0;
}

/** Joint probability of every actual scoreline up to max_goals. */
export function grid(lh: number, la: number, max_goals: number = MAX_GOALS): number[][] {
    const ph: number[] = [];
    const pa: number[] = [];
    for (let k = 0; k <= max_goals; k += 1) {
        ph.push(_pois_pmf(k, lh));
        pa.push(_pois_pmf(k, la));
    }
    const g: number[][] = [];
    for (let h = 0; h <= max_goals; h += 1) {
        const rowVals: number[] = [];
        for (let a = 0; a <= max_goals; a += 1) {
            rowVals.push((ph[h] as number) * (pa[a] as number));
        }
        g.push(rowVals);
    }
    return g;
}

export type EvRow = [number, number, number];

/** EV (expected points) of every candidate tip up to max_tip goals/side. */
export function ev_table(
    lh: number,
    la: number,
    pts_exact: number,
    pts_diff: number,
    pts_tend: number,
    max_tip = 6,
    max_goals: number = MAX_GOALS,
): [EvRow[], number[][]] {
    const g = grid(lh, la, max_goals);
    const rows: EvRow[] = [];
    for (let th = 0; th <= max_tip; th += 1) {
        for (let ta = 0; ta <= max_tip; ta += 1) {
            let ev = 0.0;
            for (let ah = 0; ah <= max_goals; ah += 1) {
                for (let aa = 0; aa <= max_goals; aa += 1) {
                    const p = (g[ah] as number[])[aa] as number;
                    if (p <= 0) {
                        continue;
                    }
                    const s = _score(th, ta, ah, aa, pts_exact, pts_diff, pts_tend);
                    if (s) {
                        ev += p * s;
                    }
                }
            }
            rows.push([th, ta, ev]);
        }
    }
    // Python `rows.sort(key=lambda r: r[2], reverse=True)` — stable descending.
    rows.sort((rowA, rowB) => rowB[2] - rowA[2]);
    return [rows, g];
}

function _modal(g: number[][]): [number, number, number] {
    let best: [number, number, number] = [0, 0, 0.0];
    for (let h = 0; h < g.length; h += 1) {
        const gRow = g[h] as number[];
        for (let a = 0; a < gRow.length; a += 1) {
            if ((gRow[a] as number) > best[2]) {
                best = [h, a, gRow[a] as number];
            }
        }
    }
    return best;
}

function _p_draw(g: number[][]): number {
    let total = 0.0;
    for (let i = 0; i < g.length; i += 1) {
        total += (g[i] as number[])[i] as number;
    }
    return total;
}

interface RankedEntry {
    tip: string;
    ev: PyFloat;
}

interface Analysis {
    lambda: PyFloat[];
    rule: { exact: PyFloat; diff: PyFloat; tendency: PyFloat };
    ev_max: { tip: string; ev: PyFloat };
    modal_result: { score: string; prob: PyFloat };
    p_draw: PyFloat;
    ranked: RankedEntry[];
    match?: string;
}

function analyse(
    lh: number,
    la: number,
    pts_exact: number,
    pts_diff: number,
    pts_tend: number,
    max_tip = 6,
    top = 6,
): Analysis {
    const [rows, g] = ev_table(lh, la, pts_exact, pts_diff, pts_tend, max_tip);
    const [mh, ma, mp] = _modal(g);
    const first = rows[0] as EvRow;
    return {
        lambda: [new PyFloat(lh), new PyFloat(la)],
        rule: { exact: new PyFloat(pts_exact), diff: new PyFloat(pts_diff), tendency: new PyFloat(pts_tend) },
        ev_max: { tip: `${first[0]}:${first[1]}`, ev: new PyFloat(pyRound(first[2], 3)) },
        modal_result: { score: `${mh}:${ma}`, prob: new PyFloat(pyRound(mp, 3)) },
        p_draw: new PyFloat(pyRound(_p_draw(g), 3)),
        ranked: rows.slice(0, top).map(([h, a, ev]) => ({ tip: `${h}:${a}`, ev: new PyFloat(pyRound(ev, 3)) })),
    };
}

function _print_one(name: string | null, res: Analysis): void {
    if (name) {
        process.stdout.write(`\n## ${name}\n`);
    }
    const [lh, la] = res.lambda;
    const r = res.rule;
    process.stdout.write(
        `lambda ${pyFloatStr((lh as PyFloat).value)}:${pyFloatStr((la as PyFloat).value)}  ` +
            `rule exact=${pyFloatStr(r.exact.value)} diff=${pyFloatStr(r.diff.value)} tendency=${pyFloatStr(r.tendency.value)}\n`,
    );
    process.stdout.write(`EV-max tip : ${res.ev_max.tip}  (EV ${pyFloatStr(res.ev_max.ev.value)})\n`);
    process.stdout.write(
        `modal score: ${res.modal_result.score}  (P ${pyFloatStr(res.modal_result.prob.value)})  ` +
            `P(draw) ${pyFloatStr(res.p_draw.value)}\n`,
    );
    process.stdout.write('ranked by EV:\n');
    for (const rowEntry of res.ranked) {
        const flag = rowEntry.tip === res.ev_max.tip ? '  <- EV-max' : '';
        process.stdout.write(`  ${rjust5(rowEntry.tip)}  EV ${pyFixed3(rowEntry.ev.value)}${flag}\n`);
    }
}

// --- JSON (json.dumps(out, indent=2)) parity --------------------------------

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
    'usage: score_ev.py [-h] [--lh LH] [--la LA] [--exact EXACT] [--diff DIFF]\n' +
    '                   [--tendency TENDENCY] [--max-tip MAX_TIP] [--top TOP]\n' +
    '                   [--json]\n' +
    '                   [matches]\n';

interface Args {
    matches: string | null;
    lh: number | null;
    la: number | null;
    exact: number;
    diff: number;
    tendency: number;
    max_tip: number;
    top: number;
    json: boolean;
}

class ArgError extends Error {}

function _apError(msg: string): never {
    process.stderr.write(USAGE);
    process.stderr.write(`score_ev.py: error: ${msg}\n`);
    process.exitCode = 2;
    throw new ArgError(msg);
}

/** Mirror `float(x)` / `int(x)` parsing with argparse's invalid-value error. */
function _parseFloatArg(name: string, raw: string): number {
    const v = Number(raw);
    if (raw.trim() === '' || Number.isNaN(v)) {
        _apError(`argument ${name}: invalid float value: '${raw}'`);
    }
    return v;
}

function _parseIntArg(name: string, raw: string): number {
    if (!/^[+-]?\d+$/.test(raw.trim())) {
        _apError(`argument ${name}: invalid int value: '${raw}'`);
    }
    return parseInt(raw, 10);
}

function parseArgs(argv: string[]): Args {
    const args: Args = {
        matches: null,
        lh: null,
        la: null,
        exact: 4.0,
        diff: 3.0,
        tendency: 2.0,
        max_tip: 6,
        top: 6,
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
        } else if (a === '--lh' || a.startsWith('--lh=')) {
            args.lh = _parseFloatArg('--lh', takeValue('--lh'));
        } else if (a === '--la' || a.startsWith('--la=')) {
            args.la = _parseFloatArg('--la', takeValue('--la'));
        } else if (a === '--exact' || a.startsWith('--exact=')) {
            args.exact = _parseFloatArg('--exact', takeValue('--exact'));
        } else if (a === '--diff' || a.startsWith('--diff=')) {
            args.diff = _parseFloatArg('--diff', takeValue('--diff'));
        } else if (a === '--tendency' || a.startsWith('--tendency=')) {
            args.tendency = _parseFloatArg('--tendency', takeValue('--tendency'));
        } else if (a === '--max-tip' || a.startsWith('--max-tip=')) {
            args.max_tip = _parseIntArg('--max-tip', takeValue('--max-tip'));
        } else if (a === '--top' || a.startsWith('--top=')) {
            args.top = _parseIntArg('--top', takeValue('--top'));
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
    if (positionals.length === 1) {
        args.matches = positionals[0] as string;
    }
    return args;
}

interface MatchSpec {
    match?: string;
    lh: number | string;
    la: number | string;
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

    const jobs: Array<[string | null, number, number]> = [];
    if (args.matches) {
        const data = JSON.parse(fs.readFileSync(args.matches, 'utf-8')) as MatchSpec[];
        for (const m of data) {
            jobs.push([m.match ?? null, Number(m.lh), Number(m.la)]);
        }
    } else if (args.lh !== null && args.la !== null) {
        jobs.push([null, args.lh, args.la]);
    } else {
        _apError('provide either a matches JSON file or --lh and --la');
    }

    const out: Analysis[] = [];
    for (const [name, lh, la] of jobs) {
        const res = analyse(lh, la, args.exact, args.diff, args.tendency, args.max_tip, args.top);
        if (name) {
            res.match = name;
        }
        out.push(res);
        if (!args.json) {
            _print_one(name, res);
        }
    }

    if (args.json) {
        process.stdout.write(`${_jsonDumps(out, 2)}\n`);
    }
    return 0;
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
