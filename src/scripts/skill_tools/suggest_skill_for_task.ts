#!/usr/bin/env node
/**
 * Block D · D4 — suggest_skill_for_task.
 *
 * TypeScript twin of `src/scripts/skill_tools/suggest_skill_for_task.py`
 * (ADR-092, Phase 8 Wave 8h). Mirrors the Python CLI contract EXACTLY —
 * flags (`--task`, `--skills-dir`, `--personas-dir`, `--top`, `--json`,
 * `--sample`), exit codes (0 / 2), stdout/stderr split, byte-identical
 * human output AND byte-identical JSON (`json.dump(..., indent=2)`,
 * ensure_ascii default).
 *
 * CLI wrapper that combines D2 (`score_skill_relevance`) with the persona
 * matrix from D3 (`audit_persona_coverage`) and emits the top-3 skill +
 * persona combos with a one-line justification each.
 *
 * Inputs:
 *   --task TEXT        — task description (required)
 *   --skills-dir DIR   — SKILL.md directory
 *   --personas-dir DIR — persona Markdown directory
 *   --top N            — emit top-N combos (default: 3)
 *   --json             — machine-readable output
 *
 * Output: ranked combos with `skill`, `score`, `personas[]`, and `why`.
 *
 * No behaviour changes — latent Python quirks replicated.
 */
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { audit, type PersonaRow } from './audit_persona_coverage.js';
import { DEFAULT_SKILLS_DIR, rank } from './score_skill_relevance.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/skill_tools/suggest_skill_for_task.ts → parents[3] of the .py
// (skill_tools → scripts → src → repo root) is the package root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');
export const DEFAULT_PERSONAS = path.join(ROOT, '.agent-src.uncondensed', 'personas');

function _persona_status(rows: PersonaRow[]): Map<string, string> {
    // {str(r["persona"]): str(r["status"]) for r in rows} — last write wins
    // on duplicate keys, matching Python dict-comprehension semantics.
    const out = new Map<string, string>();
    for (const r of rows) {
        out.set(String(r.persona), String(r.status));
    }
    return out;
}

export function _justify(
    name: string,
    score: number,
    personas: string[],
    status: Map<string, string>,
): string {
    let head: string;
    if (score >= 70) {
        head = 'high keyword + persona match';
    } else if (score >= 40) {
        head = 'strong keyword overlap';
    } else {
        head = 'partial overlap — confirm with reviewer';
    }
    if (personas.length > 0) {
        const tierHits = personas.map((p) => `${p} (${status.get(p) ?? 'unknown'})`).join(', ');
        return `${head}; lenses: ${tierHits}`;
    }
    return `${head}; no persona declared on \`${name}\``;
}

export interface Combo {
    skill: string;
    score: number;
    personas: string[];
    why: string;
}

export function suggest(
    task: string,
    skillsDir: string,
    personasDir: string,
    top = 3,
): Combo[] {
    const ranked = rank(task, skillsDir).slice(0, top);
    const personaRows = audit(skillsDir, personasDir);
    const status = _persona_status(personaRows);
    return ranked.map(([name, score, personas]) => ({
        skill: name,
        score,
        personas,
        why: _justify(name, score, personas, status),
    }));
}

function _print_human(combos: Combo[]): string[] {
    if (combos.length === 0) {
        return ['(no skill suggestions for this task)'];
    }
    const lines: string[] = [];
    let i = 1;
    for (const c of combos) {
        const personas = c.personas.length > 0 ? c.personas.join(', ') : '—';
        lines.push(`  ${i}. ${c.skill}  (${c.score}/100)`);
        lines.push(`     personas: ${personas}`);
        lines.push(`     why: ${c.why}`);
        i++;
    }
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

function pyJsonDumpsIndent2(obj: Json, level = 0): string {
    if (obj === null) {
        return 'null';
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

// --- argparse surface --------------------------------------------------------

const PROG = 'suggest_skill_for_task.py';

interface Args {
    task: string;
    skills_dir: string;
    personas_dir: string;
    top: number;
    json: boolean;
    sample: boolean;
}

function _argError(message: string): never {
    process.stderr.write(`${PROG}: error: ${message}\n`);
    process.exit(2);
}

function _parseInt(raw: string): number {
    if (!/^[+-]?\d+$/u.test(raw.trim())) {
        _argError(`argument --top: invalid int value: '${raw}'`);
    }
    return parseInt(raw, 10);
}

export function parse_args(argv: string[]): Args {
    const args: Args = {
        task: '',
        skills_dir: DEFAULT_SKILLS_DIR,
        personas_dir: DEFAULT_PERSONAS,
        top: 3,
        json: false,
        sample: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--json') {
            args.json = true;
        } else if (a === '--sample') {
            args.sample = true;
        } else if (a === '--task') {
            const v = argv[++i];
            if (v === undefined) {
                _argError('argument --task: expected one argument');
            }
            args.task = v;
        } else if (a.startsWith('--task=')) {
            args.task = a.slice('--task='.length);
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
        } else if (a === '--top') {
            const v = argv[++i];
            if (v === undefined) {
                _argError('argument --top: expected one argument');
            }
            args.top = _parseInt(v);
        } else if (a.startsWith('--top=')) {
            args.top = _parseInt(a.slice('--top='.length));
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return args;
}

export const _SAMPLE = {
    task: 'review a livewire component for accessibility and reactive state',
};

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const task = args.sample ? _SAMPLE.task : args.task;
    if (!task) {
        _argError('--task is required (or pass --sample)');
    }
    const combos = suggest(task, args.skills_dir, args.personas_dir, args.top);
    if (args.json) {
        process.stdout.write(pyJsonDumpsIndent2({ task, suggestions: combos }));
        process.stdout.write('\n');
    } else {
        const lines = _print_human(combos);
        process.stdout.write(lines.join('\n') + '\n');
    }
    return 0;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    process.exitCode = main();
}
