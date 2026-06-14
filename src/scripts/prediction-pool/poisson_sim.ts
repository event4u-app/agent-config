#!/usr/bin/env tsx
/**
 * Poisson tournament simulator for prediction-pool-optimizer.
 *
 * TypeScript twin of `src/scripts/prediction-pool/poisson_sim.py` (ADR-094).
 * The CLI contract is mirrored EXACTLY — the positional `config` JSON file,
 * `--runs` / `--seed`, exit codes, the stdout/stderr split, and byte-identical
 * output. No behaviour changes.
 *
 * RNG parity: `random.Random(seed)` is reproduced bit-for-bit by `PyRandom`
 * (MT19937) in `../_lib/py_random.js`. The two consumers are `rng.random()`
 * (Poisson draws + the group-table tiebreak) and `rng.shuffle()` (knockout
 * seeding). The group-table sort consumes `rng.random()` once per group member
 * in iteration order BEFORE sorting, matching CPython's `sorted(key=…)`
 * single-key-evaluation order exactly.
 *
 * Float parity: JSON renders every Python `float` via the PyFloat marker so
 * integer-valued floats keep the `.0` suffix (`seed` is rendered as a Python
 * int or `null`; `advance_pct` / `title_pct` values via CPython `round(x, 2)`).
 *
 * Original module docstring (verbatim):
 *
 * Honest replacement for "I simulated 10,000 runs" — this actually runs them.
 * Goals per match are drawn from a Poisson whose rate comes from each team's
 * attack / defence strength; group stages are round-robin, then a single-
 * elimination bracket runs over the qualifiers. Aggregates advancement and
 * title probabilities over N runs.
 *
 * It is an APPROXIMATION, stated as such: real tournament bracket pairings
 * (winner-of-A vs runner-up-of-B …) are format-specific. Provide an explicit
 * `bracket` (list of name pairs per round, or "auto" for a random seed) to
 * control this; the default "auto" randomly seeds qualifiers and is good
 * enough for outright/advancement estimates, not for exact-pairing bonus
 * questions.
 *
 * Input JSON shape:
 * {
 *   "base_goals": 1.35,                       # league-average goals per side
 *   "teams": { "Germany": {"att": 1.3, "def": 0.8}, ... },   # att/def multipliers (1.0 = average)
 *   "groups": [ ["Germany","Scotland","Hungary","Switzerland"], ... ],
 *   "advance_per_group": 2,
 *   "bracket": "auto"                          # or omit; "auto" = random seed of qualifiers
 * }
 *
 * Usage:
 *   python3 scripts/prediction-pool/poisson_sim.py teams.json --runs 20000 [--seed 1]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { PyRandom } from '../_lib/py_random.js';

/**
 * CPython `round(value, ndigits)` — correct decimal rounding of the *exact*
 * IEEE-754 value, half-to-even. Uses `toFixed(40)` (far beyond double
 * precision) so a value that displays as an exact half at 17 sig digits but is
 * truly just below/above (e.g. `31/800 = 0.03874999999999999972`) rounds the
 * way CPython does. The value-ladder `pyRound` trusts `toPrecision(17)` and
 * diverges on these simulation ratios, so this twin carries its own.
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

interface TeamStats {
    att?: number;
    def?: number;
}

type TeamsMap = Record<string, TeamStats>;

/** Knuth's algorithm — stdlib only, no numpy. */
function _poisson(rate: number, rng: PyRandom): number {
    if (rate <= 0) {
        return 0;
    }
    const L = Math.exp(-rate);
    let k = 0;
    let p = 1.0;
    for (;;) {
        k += 1;
        p *= rng.random();
        if (p <= L) {
            return k - 1;
        }
    }
}

function _rates(home: string, away: string, teams: TeamsMap, base: number): [number, number] {
    const h = teams[home] ?? {};
    const a = teams[away] ?? {};
    const lam_h = base * (h.att ?? 1.0) * (a.def ?? 1.0);
    const lam_a = base * (a.att ?? 1.0) * (h.def ?? 1.0);
    return [lam_h, lam_a];
}

function _play(
    home: string,
    away: string,
    teams: TeamsMap,
    base: number,
    rng: PyRandom,
    allow_draw = true,
): [number, number] {
    const [lam_h, lam_a] = _rates(home, away, teams, base);
    const gh = _poisson(lam_h, rng);
    const ga = _poisson(lam_a, rng);
    if (!allow_draw && gh === ga) {
        // extra-time / penalties proxy: edge to the stronger attack, else coin flip
        if (lam_h === lam_a) {
            return rng.random() < 0.5 ? [gh + 1, ga] : [gh, ga + 1];
        }
        return lam_h > lam_a ? [gh + 1, ga] : [gh, ga + 1];
    }
    return [gh, ga];
}

function _group_table(group: string[], teams: TeamsMap, base: number, rng: PyRandom): string[] {
    const pts: Record<string, number> = {};
    const gd: Record<string, number> = {};
    const gf: Record<string, number> = {};
    const bump = (m: Record<string, number>, key: string, by: number): void => {
        m[key] = (m[key] ?? 0) + by;
    };
    for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) {
            const gi = group[i] as string;
            const gj = group[j] as string;
            const [gh, ga] = _play(gi, gj, teams, base, rng);
            bump(gd, gi, gh - ga);
            bump(gd, gj, ga - gh);
            bump(gf, gi, gh);
            bump(gf, gj, ga);
            if (gh > ga) {
                bump(pts, gi, 3);
            } else if (ga > gh) {
                bump(pts, gj, 3);
            } else {
                bump(pts, gi, 1);
                bump(pts, gj, 1);
            }
        }
    }
    // rank: points, then goal difference, then goals for, then random tiebreak.
    // CPython `sorted(group, key=lambda t: (pts[t], gd[t], gf[t], rng.random()),
    // reverse=True)` evaluates the key once per element in iteration order, so
    // `rng.random()` is consumed in group order BEFORE the sort.
    const keyed = group.map((t) => ({
        t,
        key: [pts[t] ?? 0, gd[t] ?? 0, gf[t] ?? 0, rng.random()] as [number, number, number, number],
    }));
    // reverse=True stable sort: descending tuple compare, ties keep original
    // order (Array.prototype.sort is stable; comparator returns 0 on full ties).
    keyed.sort((a, b) => {
        for (let i = 0; i < 4; i += 1) {
            const av = a.key[i] as number;
            const bv = b.key[i] as number;
            if (av < bv) {
                return 1;
            }
            if (av > bv) {
                return -1;
            }
        }
        return 0;
    });
    return keyed.map((e) => e.t);
}

function _knockout(qualifiers: string[], teams: TeamsMap, base: number, rng: PyRandom): string | null {
    let field: Array<string | null> = qualifiers.slice();
    rng.shuffle(field);
    // pad to a power of two with byes
    while ((field.length & (field.length - 1)) !== 0) {
        field.push(null);
    }
    while (field.length > 1) {
        const nxt: Array<string | null> = [];
        for (let i = 0; i < field.length; i += 2) {
            const a = field[i] as string | null;
            const b = field[i + 1] as string | null;
            if (a === null) {
                nxt.push(b);
            } else if (b === null) {
                nxt.push(a);
            } else {
                const [gh, ga] = _play(a, b, teams, base, rng, false);
                nxt.push(gh > ga ? a : b);
            }
        }
        field = nxt;
    }
    return field[0] ?? null;
}

interface Config {
    base_goals?: number;
    teams: TeamsMap;
    groups?: string[][];
    advance_per_group?: number;
    bracket?: unknown;
}

interface SimResult {
    runs: PyInt;
    seed: PyInt | null;
    advance_pct: Record<string, PyFloat>;
    title_pct: Record<string, PyFloat>;
}

function simulate(cfg: Config, runs: number, seed: number | null): SimResult {
    const rng = new PyRandom(seed === null ? undefined : seed);
    const base = Number(cfg.base_goals ?? 1.35);
    const teams = cfg.teams;
    const groups = cfg.groups ?? [];
    const adv = Math.trunc(Number(cfg.advance_per_group ?? 2));

    // defaultdict(int) — insertion-ordered, like a Python dict.
    const advanced: Record<string, number> = {};
    const champ: Record<string, number> = {};
    for (let run = 0; run < runs; run += 1) {
        let qualifiers: string[] = [];
        if (groups.length > 0) {
            for (const g of groups) {
                const ranked = _group_table(g, teams, base, rng);
                const top = ranked.slice(0, adv);
                qualifiers.push(...top);
                for (const t of top) {
                    advanced[t] = (advanced[t] ?? 0) + 1;
                }
            }
        } else {
            qualifiers = Object.keys(teams);
        }
        let winner: string | null;
        if (qualifiers.length > 1) {
            winner = _knockout(qualifiers, teams, base, rng);
        } else {
            winner = qualifiers.length > 0 ? (qualifiers[0] as string) : null;
        }
        if (winner !== null) {
            champ[winner] = (champ[winner] ?? 0) + 1;
        }
    }

    const pct = (d: Record<string, number>): Record<string, PyFloat> => {
        // sorted(d.items(), key=lambda kv: -kv[1]) — descending by count,
        // stable on ties (insertion order preserved).
        const entries = Object.entries(d);
        entries.sort((a, b) => {
            const ka = -(a[1]);
            const kb = -(b[1]);
            if (ka < kb) {
                return -1;
            }
            if (ka > kb) {
                return 1;
            }
            return 0;
        });
        const out: Record<string, PyFloat> = {};
        for (const [t, c] of entries) {
            out[t] = new PyFloat(pyRound((100 * c) / runs, 2));
        }
        return out;
    };

    return {
        runs: new PyInt(runs),
        seed: seed === null ? null : new PyInt(seed),
        advance_pct: pct(advanced),
        title_pct: pct(champ),
    };
}

// --- JSON (json.dumps(result, indent=2)) parity ----------------------------

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

const USAGE = 'usage: poisson_sim.py [-h] [--runs RUNS] [--seed SEED] config\n';

interface Args {
    config: string | null;
    runs: number;
    seed: number | null;
}

class ArgError extends Error {}

function _apError(msg: string): never {
    process.stderr.write(USAGE);
    process.stderr.write(`poisson_sim.py: error: ${msg}\n`);
    process.exitCode = 2;
    throw new ArgError(msg);
}

/** Mirror `int(x)` parsing with argparse's invalid-value error. */
function _parseIntArg(name: string, raw: string): number {
    if (!/^[+-]?\d+$/u.test(raw.trim())) {
        _apError(`argument ${name}: invalid int value: '${raw}'`);
    }
    return parseInt(raw, 10);
}

function parseArgs(argv: string[]): Args {
    const args: Args = { config: null, runs: 20000, seed: null };
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
        } else if (a === '--seed' || a.startsWith('--seed=')) {
            args.seed = _parseIntArg('--seed', takeValue('--seed'));
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

    const cfgPath = args.config as string;
    if (!isFile(cfgPath)) {
        process.stderr.write(`ERROR: config not found: ${cfgPath}\n`);
        return 2;
    }
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as Config;
    if (!('teams' in cfg) || cfg.teams === undefined) {
        process.stderr.write("ERROR: config needs a 'teams' object.\n");
        return 2;
    }

    const result = simulate(cfg, args.runs, args.seed);
    process.stdout.write(`${_jsonDumps(result, 2)}\n`);
    return 0;
}

/** Mirror Python `Path.is_file()`. */
function isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
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
