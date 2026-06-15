#!/usr/bin/env tsx
/**
 * Generate the named cookbook (road-to-competitive-borrow P1.4).
 *
 * TypeScript twin of `src/scripts/generate_cookbook.py` (ADR-096). Mirrors the
 * Python CLI contract EXACTLY — the `--check` / `--quiet` flags, exit codes
 * (0 / 1 / 2), stdout/stderr split, and the byte-identical generated
 * `docs/cookbook.md` (heading prose, the named-recipe sections, the four
 * work-flow sections, the ` → ` / `, ` joins, dict insertion order, and the
 * trailing newline). No behaviour changes — the anti-cargo-cult guard
 * (`BadRecipe` → exit 1 with `❌  generate_cookbook: <msg>`) is replicated, and
 * every ref is validated via the SAME `resolve_logical` primitive
 * `lint_flows.py` uses.
 *
 * Renders `docs/cookbook.md` — "10 things you can do in a minute" — from
 * `src/flows/cookbook.yaml` (curated recipe seed) plus the four validated
 * `src/flows/<flow>.yaml` user-work flows.
 *
 * Output (deterministic — no timestamp, so `--check` is stable):
 *   - `docs/cookbook.md`
 *
 * Usage:
 *     python3 scripts/generate_cookbook.py
 *     python3 scripts/generate_cookbook.py --check   # fail if out of date
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { resolve_logical } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);

// src/scripts/generate_cookbook.ts → parents[2] is repo root.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const COOKBOOK_SEED = path.join(ROOT, 'src', 'flows', 'cookbook.yaml');
const FLOWS_DIR = path.join(ROOT, 'src', 'flows');
const USER_WORK_FLOWS = ['discovery', 'implementation', 'review', 'delivery'];
const OUT = path.join(ROOT, 'docs', 'cookbook.md');

type Dict = Record<string, unknown>;

class BadRecipe extends Error {}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Mirror `yaml.safe_load(text) or {}` collapsing null / non-object to `{}`. */
function _safeLoadOrEmpty(text: string): Dict {
    let data: unknown;
    try {
        data = parseYaml(text, { version: '1.1' });
    } catch {
        data = null;
    }
    if (data === null || data === undefined || data === false) {
        return {};
    }
    if (typeof data === 'object' && !Array.isArray(data)) {
        return data as Dict;
    }
    // A scalar / list is truthy in Python; `.get(...)` would then AttributeError.
    // No real seed/flow file is a scalar, so this branch never fires on the real
    // tree; keep the object shape so `.get` semantics below stay total.
    return data as Dict;
}

/** `dict.get(key, default)` for string lists. */
function _getList(d: Dict, key: string): string[] {
    const v = d[key];
    if (v === undefined || v === null) {
        return [];
    }
    return v as string[];
}

function _command_exists(ref: string): boolean {
    return resolve_logical(`commands/${ref}.md`) !== null;
}

function _skill_exists(slug: string): boolean {
    return resolve_logical(`skills/${slug}/SKILL.md`) !== null;
}

export function validate_refs(label: string, commands: string[], skills: string[]): void {
    for (const c of commands) {
        if (!_command_exists(c)) {
            throw new BadRecipe(`recipe '${label}' references non-existent command \`${c}\``);
        }
    }
    for (const s of skills) {
        if (!_skill_exists(s)) {
            throw new BadRecipe(`recipe '${label}' references non-existent skill \`${s}\``);
        }
    }
}

export function load_seed(): Dict[] {
    const data = _safeLoadOrEmpty(fs.readFileSync(COOKBOOK_SEED, 'utf-8'));
    const recipes = data['recipes'];
    if (recipes === undefined || recipes === null) {
        return [];
    }
    return recipes as Dict[];
}

export function load_flow(flow: string): Dict {
    return _safeLoadOrEmpty(fs.readFileSync(path.join(FLOWS_DIR, `${flow}.yaml`), 'utf-8'));
}

/** Mirror Python `" ".join(s.split())` — split on any whitespace run, rejoin with one space. */
function _collapseWs(s: string): string {
    const parts = s.split(/[\s]+/u).filter((p) => p.length > 0);
    return parts.join(' ');
}

export function render(): string {
    const seed = load_seed();
    const flows: Record<string, Dict> = {};
    for (const f of USER_WORK_FLOWS) {
        flows[f] = load_flow(f);
    }

    // Validate every ref BEFORE rendering — generation fails on any bad recipe.
    for (const r of seed) {
        validate_refs(String(r['title']), _getList(r, 'commands'), _getList(r, 'skills'));
    }
    for (const fid of USER_WORK_FLOWS) {
        const f = flows[fid] as Dict;
        validate_refs(`flow:${fid}`, _getList(f, 'default_path'), _getList(f, 'skills'));
    }

    const lines: string[] = [
        '# Cookbook — things you can do in a minute',
        '',
        '> **Generated** by `scripts/generate_cookbook.py` from ' +
            '`src/flows/cookbook.yaml` + `src/flows/<flow>.yaml` — do NOT hand-edit.',
        '> Every command and skill below is validated to exist at generation ' +
            'time; a recipe naming a missing command fails the build.',
        '',
        'Each recipe is a short command sequence. Run the commands in order; the ' +
            'listed skills are the capabilities they compose.',
        '',
        '## Named recipes',
        '',
    ];
    for (const r of seed) {
        const cmds = _getList(r, 'commands')
            .map((c) => `\`/${c}\``)
            .join(' → ');
        const sk = _getList(r, 'skills')
            .map((s) => `\`${s}\``)
            .join(', ');
        lines.push(`### ${String(r['title'])}`);
        lines.push('');
        lines.push(`*${String(r['when'])}*`);
        lines.push('');
        lines.push(`- **Commands:** ${cmds}`);
        if (sk) {
            lines.push(`- **Skills:** ${sk}`);
        }
        lines.push('');
    }

    lines.push('## The four work flows');
    lines.push('');
    lines.push('Broader than a single recipe — the end-to-end shapes most work follows.');
    lines.push('');
    for (const fid of USER_WORK_FLOWS) {
        const f = flows[fid] as Dict;
        const flowPath = _getList(f, 'default_path')
            .map((c) => `\`/${c}\``)
            .join(' → ');
        const sk = _getList(f, 'skills')
            .map((s) => `\`${s}\``)
            .join(', ');
        const rawSummary = f['summary'];
        const summary = _collapseWs(rawSummary === undefined || rawSummary === null ? '' : String(rawSummary));
        const titleVal = f['title'];
        const title = titleVal === undefined || titleVal === null ? fid : String(titleVal);
        lines.push(`### ${title} flow`);
        lines.push('');
        if (summary) {
            lines.push(summary);
            lines.push('');
        }
        lines.push(`- **Path:** ${flowPath}`);
        if (sk) {
            lines.push(`- **Skills:** ${sk}`);
        }
        lines.push('');
    }

    return lines.join('\n').replace(/\s+$/, '') + '\n';
}

interface ParsedArgs {
    check: boolean;
    quiet: boolean;
}

class _ArgExit extends Error {}

function _argError(msg: string): never {
    process.stderr.write('usage: generate_cookbook.py [-h] [--check] [--quiet]\n');
    process.stderr.write(`generate_cookbook.py: error: ${msg}\n`);
    process.exitCode = 2;
    throw new _ArgExit();
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { check: false, quiet: false };
    for (const a of argv) {
        if (a === '-h' || a === '--help') {
            process.stdout.write('usage: generate_cookbook.py [-h] [--check] [--quiet]\n');
            process.exitCode = 0;
            throw new _ArgExit();
        } else if (a === '--check') {
            out.check = true;
        } else if (a === '--quiet') {
            out.quiet = true;
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    let args: ParsedArgs;
    try {
        args = parse_args(argv ?? process.argv.slice(2));
    } catch (e) {
        if (e instanceof _ArgExit) {
            return process.exitCode === undefined ? 0 : (process.exitCode as number);
        }
        throw e;
    }

    let content: string;
    try {
        content = render();
    } catch (e) {
        if (e instanceof BadRecipe) {
            process.stderr.write(`❌  generate_cookbook: ${e.message}\n`);
            return 1;
        }
        throw e;
    }

    if (args.check) {
        const current = _isFile(OUT) ? fs.readFileSync(OUT, 'utf-8') : '';
        if (current !== content) {
            process.stderr.write(
                'generate_cookbook: docs/cookbook.md is stale — run ' +
                    '`python3 scripts/generate_cookbook.py`\n',
            );
            return 1;
        }
        if (!args.quiet) {
            process.stdout.write('generate_cookbook: OK — docs/cookbook.md up to date\n');
        }
        return 0;
    }

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, content, 'utf-8');
    if (!args.quiet) {
        const rel = path.relative(ROOT, OUT).split(path.sep).join('/');
        process.stdout.write(
            `generate_cookbook: wrote ${rel} ` +
                `(${load_seed().length} recipes + ${USER_WORK_FLOWS.length} flows)\n`,
        );
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}
