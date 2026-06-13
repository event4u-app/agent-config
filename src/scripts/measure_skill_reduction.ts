#!/usr/bin/env node
/**
 * Skill-count reduction measurement — step-12 Phase 3 L74 deliverable.
 *
 * TypeScript twin of `src/scripts/measure_skill_reduction.py` (ADR-092 —
 * Python→TS migration, Phase 8 / Wave 8c). Mirrors the CLI contract EXACTLY:
 * flag (`--json`), exit codes (0 pass / 1 fail / 2 no-skills), byte-identical
 * stdout (report or `json.dumps(indent=2)`) and stderr. No behaviour changes.
 *
 * Computes the skill-count reduction achieved by filtering on
 * `recommended_for_user_types` frontmatter tags. Each non-developer
 * user-type that lands ≥40% under the default-loaded skill count
 * satisfies the Phase 3 acceptance criterion.
 *
 * The runtime filter (loaded vs. registered) ships with step-9; this
 * script measures the data already in place, so the box can close on
 * the basis of the underlying tagging being correct.
 *
 * Usage:
 *     measure_skill_reduction
 *     measure_skill_reduction --json
 *
 * NOTE: the .py references the legacy `.agent-src.uncondensed/skills`
 * literal; this faithful twin replicates it byte-for-byte. When the
 * directory is absent the .py raises an uncaught FileNotFoundError
 * (iterdir on a missing dir) → exit 1, empty stdout; this twin mirrors
 * that by throwing, so the dispatcher / Node surfaces a non-zero exit.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/measure_skill_reduction.ts → parents[2] is the repo root.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SKILLS_DIR = path.join(REPO_ROOT, '.agent-src.uncondensed', 'skills');
const TARGET_REDUCTION = 0.4;
const PHASE_3_USER_TYPES = ['consultant', 'creator'] as const;

interface UserTypeEntry {
    loaded_skills: number;
    reduction_pct: PyFloat;
    passes_target: boolean;
}

interface Report {
    total_skills: number;
    target_reduction: PyFloat;
    per_user_type: Record<string, UserTypeEntry>;
    phase_3_user_types: string[];
    phase_3_passed: boolean;
}

/**
 * Mirror python sorted(SKILLS_DIR.iterdir()): a FileNotFoundError when the
 * directory is missing (matching pathlib.iterdir on a non-existent dir).
 */
function _iterdirSorted(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch (e) {
        const err = e as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
            throw new Error(
                `FileNotFoundError: [Errno 2] No such file or directory: '${dir}'`,
            );
        }
        throw e;
    }
    // sorted() over Path objects compares the full path string component-wise;
    // here every entry shares the same parent, so a code-point sort of the
    // basenames is equivalent.
    return names.sort(_pyStrCmp).map((n) => path.join(dir, n));
}

function load_tags(): [number, Record<string, number>] {
    let total = 0;
    const per_type: Record<string, number> = {};
    for (const skill_dir of _iterdirSorted(SKILLS_DIR)) {
        const skill_md = path.join(skill_dir, 'SKILL.md');
        if (!_isFile(skill_md)) {
            continue;
        }
        const text = fs.readFileSync(skill_md, 'utf-8');
        if (!text.startsWith('---')) {
            continue;
        }
        let fm: Record<string, unknown>;
        try {
            fm = (_yamlSafeLoad(_splitParts(text, '---', 2)[1] ?? '') as Record<string, unknown>) || {};
        } catch {
            // yaml.YAMLError → skip this skill.
            continue;
        }
        if (fm === null || fm === undefined) {
            fm = {};
        }
        total += 1;
        const tags = fm['recommended_for_user_types'];
        const list = Array.isArray(tags) ? tags : _pyTruthy(tags) ? tags : [];
        if (Array.isArray(list)) {
            for (const t of list) {
                const key = String(t);
                per_type[key] = (per_type[key] ?? 0) + 1;
            }
        }
    }
    return [total, per_type];
}

export function main(argv: string[] | null = null): number {
    const rawArgv = argv ?? process.argv.slice(2);
    const args = parse_args(rawArgv);

    const [total, per_type] = load_tags();
    if (total === 0) {
        process.stderr.write('error: no skills found\n');
        return 2;
    }

    const report: Report = {
        total_skills: total,
        target_reduction: new PyFloat(TARGET_REDUCTION),
        per_user_type: {},
        phase_3_user_types: [...PHASE_3_USER_TYPES],
        phase_3_passed: true,
    };
    for (const ut of Object.keys(per_type).sort(_pyStrCmp)) {
        const loaded = per_type[ut]!;
        const reduction = 1 - loaded / total;
        report.per_user_type[ut] = {
            loaded_skills: loaded,
            reduction_pct: new PyFloat(_pyRound(reduction, 4)),
            passes_target: reduction >= TARGET_REDUCTION,
        };
    }
    for (const ut of PHASE_3_USER_TYPES) {
        const entry = report.per_user_type[ut];
        if (!entry || !entry.passes_target) {
            report.phase_3_passed = false;
        }
    }

    if (args.json) {
        process.stdout.write(_jsonDumpsIndent2(_reportToJson(report)) + '\n');
    } else {
        // f"≥{TARGET_REDUCTION:.0%}" → 40%.
        process.stdout.write(
            `total_skills: ${total}  target_reduction: ≥${_fmtPct0(TARGET_REDUCTION)}\n`,
        );
        // Insertion order of report.per_user_type mirrors the .py dict (sorted keys).
        for (const [ut, e] of Object.entries(report.per_user_type)) {
            const mark = e.passes_target ? '✓' : '✗';
            const star = (PHASE_3_USER_TYPES as readonly string[]).includes(ut) ? ' *' : '';
            process.stdout.write(
                `  ${mark} ${_ljust(ut, 12)} loaded=${_rjust(String(e.loaded_skills), 3)} ` +
                    `reduction=${_fmtPct1(e.reduction_pct.value)}${star}\n`,
            );
        }
        process.stdout.write(`verdict: ${report.phase_3_passed ? 'PASS' : 'FAIL'}\n`);
        process.stdout.write('(* = step-12 Phase 3 L74 anchor user-types)\n');
    }
    return report.phase_3_passed ? 0 : 1;
}

interface Args {
    json: boolean;
}

function parse_args(argv: string[]): Args {
    const args: Args = { json: false };
    for (const a of argv) {
        if (a === '--json') {
            args.json = true;
        } else {
            // argparse error prose is Python-version-dependent; mirror exit 2.
            process.stderr.write(`measure_skill_reduction: error: unrecognized arguments: ${a}\n`);
            process.exitCode = 2;
            throw new ArgExit();
        }
    }
    return args;
}

class ArgExit extends Error {}

// --- JSON shaping ------------------------------------------------------------

/** Wrapper marking a value as a Python float (renders integer-valued with `.0`). */
class PyFloat {
    constructor(readonly value: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [k: string]: Json };

function _reportToJson(r: Report): Json {
    const per: { [k: string]: Json } = {};
    for (const [ut, e] of Object.entries(r.per_user_type)) {
        per[ut] = {
            loaded_skills: e.loaded_skills,
            reduction_pct: e.reduction_pct,
            passes_target: e.passes_target,
        };
    }
    return {
        total_skills: r.total_skills,
        target_reduction: r.target_reduction,
        per_user_type: per,
        phase_3_user_types: r.phase_3_user_types,
        phase_3_passed: r.phase_3_passed,
    };
}

function _jsonDumpsIndent2(obj: Json): string {
    return _jsonDumps(obj, { sortKeys: false, indent: 2 });
}

/**
 * json.dumps replica. sort_keys is False here (.py uses default); indent=2.
 * ensure_ascii defaults True → non-ASCII escaped to \uXXXX.
 */
function _jsonDumps(obj: Json, opts: { sortKeys: boolean; indent: number | null }): string {
    const { sortKeys, indent } = opts;
    const pad = indent !== null ? ' '.repeat(indent) : '';
    const itemSep = indent !== null ? ',' : ', ';
    const kvSep = ': ';

    function enc(value: Json, depth: number): string {
        if (value === null) return 'null';
        if (value instanceof PyFloat) {
            return Number.isInteger(value.value) ? `${value.value}.0` : _floatRepr(value.value);
        }
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return Number.isInteger(value) ? String(value) : _floatRepr(value);
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            if (indent !== null) {
                const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
                return '[\n' + inner.join(itemSep + '\n') + '\n' + pad.repeat(depth) + ']';
            }
            return '[' + value.map((v) => enc(v, depth + 1)).join(itemSep) + ']';
        }
        const o = value as { [k: string]: Json };
        let keys = Object.keys(o);
        if (keys.length === 0) return '{}';
        if (sortKeys) {
            keys = [...keys].sort(_pyStrCmp);
        }
        if (indent !== null) {
            const inner = keys.map(
                (k) => pad.repeat(depth + 1) + encStr(k) + kvSep + enc(o[k]!, depth + 1),
            );
            return '{\n' + inner.join(itemSep + '\n') + '\n' + pad.repeat(depth) + '}';
        }
        return '{' + keys.map((k) => encStr(k) + kvSep + enc(o[k]!, depth + 1)).join(itemSep) + '}';
    }

    function encStr(s: string): string {
        let out = '"';
        for (const ch of s) {
            const cp = ch.codePointAt(0) as number;
            if (ch === '"') out += '\\"';
            else if (ch === '\\') out += '\\\\';
            else if (ch === '\n') out += '\\n';
            else if (ch === '\r') out += '\\r';
            else if (ch === '\t') out += '\\t';
            else if (ch === '\b') out += '\\b';
            else if (ch === '\f') out += '\\f';
            else if (cp < 0x20) out += '\\u' + cp.toString(16).padStart(4, '0');
            else if (cp < 0x7f) out += ch;
            else if (cp > 0xffff) {
                const v = cp - 0x10000;
                const hi = 0xd800 + (v >> 10);
                const lo = 0xdc00 + (v & 0x3ff);
                out += '\\u' + hi.toString(16).padStart(4, '0');
                out += '\\u' + lo.toString(16).padStart(4, '0');
            } else {
                out += '\\u' + cp.toString(16).padStart(4, '0');
            }
        }
        return out + '"';
    }

    return enc(obj, 0);
}

function _floatRepr(n: number): string {
    // For the rounded ratios produced here, JS String() matches Python repr.
    return String(n);
}

// --- Python helpers ----------------------------------------------------------

function _pyRound(value: number, ndigits: number): number {
    if (!Number.isFinite(value)) {
        return value;
    }
    const factor = Math.pow(10, ndigits);
    const scaled = value * factor;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let rounded: number;
    const eps = 1e-9;
    if (Math.abs(diff - 0.5) < eps) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    return rounded / factor;
}

/** f"{x:.0%}" — multiply by 100, round-half-even, no decimals, '%' suffix. */
function _fmtPct0(x: number): string {
    return `${_pyFixed(x * 100, 0)}%`;
}

/** f"{x:.1%}" — multiply by 100, round-half-even, 1 decimal, '%' suffix. */
function _fmtPct1(x: number): string {
    return `${_pyFixed(x * 100, 1)}%`;
}

function _pyFixed(x: number, ndigits: number): string {
    if (!Number.isFinite(x)) {
        return String(x);
    }
    const neg = x < 0 || Object.is(x, -0);
    const abs = Math.abs(x);
    const factor = Math.pow(10, ndigits);
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
    let result: string;
    if (ndigits === 0) {
        result = intStr;
    } else {
        if (intStr.length <= ndigits) {
            intStr = '0'.repeat(ndigits - intStr.length + 1) + intStr;
        }
        const whole = intStr.slice(0, intStr.length - ndigits);
        const dec = intStr.slice(intStr.length - ndigits);
        result = `${whole}.${dec}`;
    }
    return neg ? `-${result}` : result;
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _splitParts(text: string, sep: string, maxsplit: number): string[] {
    // Python str.split(sep, maxsplit).
    const out: string[] = [];
    let rest = text;
    let count = 0;
    while (count < maxsplit) {
        const idx = rest.indexOf(sep);
        if (idx < 0) break;
        out.push(rest.slice(0, idx));
        rest = rest.slice(idx + sep.length);
        count += 1;
    }
    out.push(rest);
    return out;
}

function _yamlSafeLoad(s: string): unknown {
    const v = parseYaml(s, { version: '1.1' });
    return restorePyScalars(v);
}

/**
 * yaml@2 with version 1.1 returns booleans for y/Y/n/N etc. PyYAML safe_load
 * keeps those as strings, and renders timestamps as a date marker. Restore.
 */
function restorePyScalars(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(restorePyScalars);
    if (v && typeof v === 'object' && !(v instanceof Date)) {
        const o = v as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(o)) out[k] = restorePyScalars(o[k]);
        return out;
    }
    return v;
}

function _pyTruthy(v: unknown): boolean {
    if (v === null || v === undefined || v === false) return false;
    if (v === '' || v === 0) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v as object).length > 0;
    return Boolean(v);
}

function _ljust(s: string, width: number): string {
    const len = Array.from(s).length;
    return len >= width ? s : s + ' '.repeat(width - len);
}

function _rjust(s: string, width: number): string {
    const len = Array.from(s).length;
    return len >= width ? s : ' '.repeat(width - len) + s;
}

function _pyStrCmp(a: string, b: string): number {
    const ca = Array.from(a);
    const cb = Array.from(b);
    const n = Math.min(ca.length, cb.length);
    for (let i = 0; i < n; i++) {
        const x = ca[i]!.codePointAt(0)!;
        const y = cb[i]!.codePointAt(0)!;
        if (x !== y) return x - y;
    }
    return ca.length - cb.length;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    try {
        process.exitCode = main();
    } catch (e) {
        if (e instanceof ArgExit) {
            process.exitCode = process.exitCode ?? 2;
        } else {
            throw e;
        }
    }
}
