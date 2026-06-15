#!/usr/bin/env node
/**
 * Block D · D5 — eval gate runner.
 *
 * TypeScript twin of `src/scripts/skill_tools/run_block_d_eval.py`
 * (ADR-096, Phase 8 Wave 8h). Mirrors the Python CLI contract EXACTLY —
 * flags (`--skills-dir`, `--personas-dir`, `--corpus-dir`, `--json`), exit
 * codes (0 pass / 1 fail), stdout split, byte-identical human summary AND
 * byte-identical JSON (`json.dump(..., indent=2)`, ensure_ascii default).
 *
 * Runs D2 (`score_skill_relevance`), D3 (`audit_persona_coverage`), and
 * D4 (`suggest_skill_for_task`) against the corpora in
 * `agents/evidence/eval-corpora/block-d/` and emits a pass/fail summary per the
 * council verdict targets:
 *
 *   - **D2**: ≥ 85 % of corpus tasks have an `expected_top3` skill in
 *     the actual top-3 ranking.
 *   - **D3**: ≥ 2 personas flagged as `under-cited`.
 *   - **D4**: ≥ 3 / 5 blind tasks where suggestion #1 matches the
 *     human-curated top-1.
 *
 * Pilot pass = ≥ 2 / 3 tools pass. Anything less → kill switch.
 *
 * No behaviour changes — latent Python quirks replicated.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { audit, type PersonaRow } from './audit_persona_coverage.js';
import { DEFAULT_SKILLS_DIR, rank } from './score_skill_relevance.js';
import { suggest } from './suggest_skill_for_task.js';
import { pyRound } from '../_lib/value_ladder.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/skill_tools/run_block_d_eval.ts → parents[3] of the .py
// (skill_tools → scripts → src → repo root) is the package root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');
export const CORPUS_DIR = path.join(ROOT, 'agents', 'eval-corpora', 'block-d');
export const PERSONAS_DIR = path.join(ROOT, '.agent-src.uncondensed', 'personas');

/**
 * Wrapper so a Python `float` whose value happens to be integer-valued
 * (e.g. `round(1.0, 3)` → `1.0`) still renders WITH a trailing `.0`,
 * exactly as `json.dumps` does. Mirrors the PyFloat convention used across
 * the ported scripts.
 */
class PyFloat {
    constructor(public readonly value: number) {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

interface D2Task {
    id: Json;
    task: string;
    expected_top3: string[];
}

interface D4Task {
    id: Json;
    task: string;
    expected_top1: string;
}

export interface D2Report {
    hits: number;
    total: number;
    pct: number;
    passed: boolean;
    misses: Array<{ id: Json; expected: string[]; got: string[] }>;
}

export interface D3Report {
    flagged: string[];
    count: number;
    passed: boolean;
}

export interface D4Report {
    hits: number;
    total: number;
    passed: boolean;
    misses: Array<{ id: Json; expected: string; got: string | null }>;
}

export interface FullReport {
    D2: D2Report;
    D3: D3Report;
    D4: D4Report;
    tools_passed: number;
    pilot_passed: boolean;
}

function _eval_d2(corpus: string, skillsDir: string): D2Report {
    const data = JSON.parse(fs.readFileSync(corpus, 'utf-8')) as { tasks: D2Task[] };
    const tasks = data.tasks;
    let hits = 0;
    const misses: D2Report['misses'] = [];
    for (const t of tasks) {
        const ranked = rank(t.task, skillsDir).slice(0, 3);
        const names = ranked.map(([n]) => n);
        if (t.expected_top3.some((e) => names.includes(e))) {
            hits += 1;
        } else {
            misses.push({ id: t.id, expected: t.expected_top3, got: names });
        }
    }
    const pct = tasks.length > 0 ? hits / tasks.length : 0.0;
    return {
        hits,
        total: tasks.length,
        pct: pyRound(pct, 3),
        passed: pct >= 0.85,
        misses,
    };
}

function _eval_d3(skillsDir: string, personasDir: string): D3Report {
    const rows: PersonaRow[] = audit(skillsDir, personasDir);
    const flagged = rows.filter((r) => r.status === 'under-cited').map((r) => r.persona);
    return { flagged, count: flagged.length, passed: flagged.length >= 2 };
}

function _eval_d4(corpus: string, skillsDir: string, personasDir: string): D4Report {
    const data = JSON.parse(fs.readFileSync(corpus, 'utf-8')) as { tasks: D4Task[] };
    const tasks = data.tasks;
    let hits = 0;
    const misses: D4Report['misses'] = [];
    for (const t of tasks) {
        const out = suggest(t.task, skillsDir, personasDir, 1);
        const got = out.length > 0 ? (out[0] as { skill: string }).skill : null;
        if (got === t.expected_top1) {
            hits += 1;
        } else {
            misses.push({ id: t.id, expected: t.expected_top1, got });
        }
    }
    return { hits, total: tasks.length, passed: hits >= 3, misses };
}

export function run_all(
    skillsDir: string,
    personasDir: string,
    corpusDir: string,
): FullReport {
    const d2 = _eval_d2(path.join(corpusDir, 'd2-tasks.json'), skillsDir);
    const d3 = _eval_d3(skillsDir, personasDir);
    const d4 = _eval_d4(path.join(corpusDir, 'd4-tasks.json'), skillsDir, personasDir);
    const passes = [d2, d3, d4].filter((r) => r.passed).length;
    return {
        D2: d2,
        D3: d3,
        D4: d4,
        tools_passed: passes,
        pilot_passed: passes >= 2,
    };
}

function _summary(key: string, r: D2Report | D3Report | D4Report): string {
    if (key === 'D2') {
        const d = r as D2Report;
        return `${d.hits}/${d.total} (${_pctFmt(d.pct * 100)}%) ≥ 85% target`;
    }
    if (key === 'D3') {
        const d = r as D3Report;
        return `${d.count} under-cited personas (≥ 2 target)`;
    }
    const d = r as D4Report;
    return `${d.hits}/${d.total} top-1 hits (≥ 3/5 target)`;
}

/** Mirror Python f"{x:.0f}" — round-half-to-even to an integer string. */
function _pctFmt(x: number): string {
    // Python `format(x, '.0f')` uses round-half-to-even on the IEEE value.
    return String(pyRound(x, 0));
}

function _print_human(report: FullReport): string[] {
    const lines: string[] = [];
    const icons: Record<string, string> = { true: '✅', false: '❌' };
    for (const key of ['D2', 'D3', 'D4'] as const) {
        const r = report[key];
        lines.push(`  ${icons[String(Boolean(r.passed))] as string}  ${key}: ${_summary(key, r)}`);
    }
    const overall = Boolean(report.pilot_passed);
    lines.push(`\n  pilot: ${report.tools_passed}/3 tools passed → ${overall ? 'PASS' : 'FAIL'}`);
    return lines;
}

// --- json.dumps(indent=2) emulation (ensure_ascii=True default) -------------

function _pyJsonStr(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (code < 0x20) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else if (code < 0x7f) {
            out += ch;
        } else if (code <= 0xffff) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
        }
    }
    return out + '"';
}

function pyJsonDumpsIndent2(obj: Json, level = 0): string {
    if (obj === null) {
        return 'null';
    }
    if (obj instanceof PyFloat) {
        return Number.isInteger(obj.value) ? `${obj.value}.0` : String(obj.value);
    }
    if (typeof obj === 'number') {
        return String(obj);
    }
    if (typeof obj === 'string') {
        return _pyJsonStr(obj);
    }
    if (obj === true) {
        return 'true';
    }
    if (obj === false) {
        return 'false';
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '[]';
        }
        const pad = ' '.repeat(2 * (level + 1));
        const closePad = ' '.repeat(2 * level);
        return `[\n${obj.map((v) => pad + pyJsonDumpsIndent2(v, level + 1)).join(',\n')}\n${closePad}]`;
    }
    const keys = Object.keys(obj as Record<string, Json>);
    if (keys.length === 0) {
        return '{}';
    }
    const pad = ' '.repeat(2 * (level + 1));
    const closePad = ' '.repeat(2 * level);
    const parts = keys.map(
        (k) => `${pad}${_pyJsonStr(k)}: ${pyJsonDumpsIndent2((obj as Record<string, Json>)[k], level + 1)}`,
    );
    return `{\n${parts.join(',\n')}\n${closePad}}`;
}

/**
 * Build the JSON-shaped report mirror with `pct` wrapped as a PyFloat so an
 * integer-valued result (e.g. `round(1.0, 3)` → "1.0") keeps the trailing
 * `.0`. Field order matches the Python dict insertion order exactly.
 */
function _reportForJson(report: FullReport): Record<string, Json> {
    return {
        D2: {
            hits: report.D2.hits,
            total: report.D2.total,
            pct: new PyFloat(report.D2.pct),
            passed: report.D2.passed,
            misses: report.D2.misses,
        },
        D3: {
            flagged: report.D3.flagged,
            count: report.D3.count,
            passed: report.D3.passed,
        },
        D4: {
            hits: report.D4.hits,
            total: report.D4.total,
            passed: report.D4.passed,
            misses: report.D4.misses,
        },
        tools_passed: report.tools_passed,
        pilot_passed: report.pilot_passed,
    };
}

// --- argparse surface --------------------------------------------------------

const PROG = 'run_block_d_eval.py';

interface Args {
    skills_dir: string;
    personas_dir: string;
    corpus_dir: string;
    json: boolean;
}

function _argError(message: string): never {
    process.stderr.write(`${PROG}: error: ${message}\n`);
    process.exit(2);
}

export function parse_args(argv: string[]): Args {
    const args: Args = {
        skills_dir: DEFAULT_SKILLS_DIR,
        personas_dir: PERSONAS_DIR,
        corpus_dir: CORPUS_DIR,
        json: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--json') {
            args.json = true;
        } else if (a === '--skills-dir') {
            const v = argv[++i];
            if (v === undefined) {
                _argError('argument --skills-dir: expected one argument');
            }
            args.skills_dir = v;
        } else if (a.startsWith('--skills-dir=')) {
            args.skills_dir = a.slice('--skills-dir='.length);
        } else if (a === '--personas-dir') {
            const v = argv[++i];
            if (v === undefined) {
                _argError('argument --personas-dir: expected one argument');
            }
            args.personas_dir = v;
        } else if (a.startsWith('--personas-dir=')) {
            args.personas_dir = a.slice('--personas-dir='.length);
        } else if (a === '--corpus-dir') {
            const v = argv[++i];
            if (v === undefined) {
                _argError('argument --corpus-dir: expected one argument');
            }
            args.corpus_dir = v;
        } else if (a.startsWith('--corpus-dir=')) {
            args.corpus_dir = a.slice('--corpus-dir='.length);
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return args;
}

export const _SAMPLE = { corpus_dir: CORPUS_DIR };

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const report = run_all(args.skills_dir, args.personas_dir, args.corpus_dir);
    if (args.json) {
        process.stdout.write(pyJsonDumpsIndent2(_reportForJson(report)));
        process.stdout.write('\n');
    } else {
        const lines = _print_human(report);
        process.stdout.write(lines.join('\n') + '\n');
    }
    return report.pilot_passed ? 0 : 1;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    process.exitCode = main();
}
