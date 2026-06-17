#!/usr/bin/env tsx
/**
 * Generate `CAPABILITIES.yaml` — the package's capability-coverage index.
 *
 * TypeScript twin of `src/scripts/generate_capabilities_index.py` (ADR-200).
 * Mirrors the Python CLI contract EXACTLY — the `--check` flag, exit codes
 * (0 / 1 / 2), stdout/stderr split, and the byte-identical generated
 * `CAPABILITIES.yaml` (header comment block, `meta:` block, `capability_areas:`
 * by domain, `gaps:` block, the `json.dumps(..., ensure_ascii=False)` scalar
 * encoding, dict insertion order, `sorted()` ordering, and the trailing
 * newline). No behaviour changes — the two kill-switches (generation > 5 s,
 * output > 50 KB → exit 1) are replicated, and the same `parse_frontmatter`
 * primitive backs the skill/command scan.
 *
 * Road-to-capability-discoverability Phase 2. The "what this package already
 * covers" surface: capability area → coverage band → backing skills/commands →
 * named gaps. **Generated, never hand-maintained** — drift-checked in CI via
 * `--check` like `generate_capability_matrix.py` / `generate_ownership_matrix.py`.
 *
 * Derivation (all source-of-truth, stable across `task sync`):
 *   - Capability areas  = `src/config/discovery/packs.yml` (in-use packs only:
 *     a pack carrying a `domain` key is in use per the packs.yml contract;
 *     reserved vocabulary ids without `domain` are skipped).
 *   - Backing skills    = `src/skills/*\/SKILL.md` frontmatter `packs:`.
 *   - Backing commands  = `iter_commands()` frontmatter `pack:` (owner) +
 *     `packs:` (discovery tags).
 *
 * Coverage band (mechanical, from backing-artefact count):
 *   none (0) · thin (1-2) · moderate (3-6) · strong (7+).
 * A "gap" is an in-use capability area with band `none`.
 *
 * Output is deterministic (sorted, no timestamp) so `--check` is stable.
 *
 * Usage:
 *     python3 src/scripts/generate_capabilities_index.py
 *     python3 src/scripts/generate_capabilities_index.py --check   # fail if stale
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { iter_commands } from './_lib/agent_src.js';
import { parse_frontmatter } from './validate_frontmatter.js';

const _HERE = fileURLToPath(import.meta.url);

// src/scripts/generate_capabilities_index.ts → parents[2] is repo root.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const OUT = path.join(ROOT, 'CAPABILITIES.yaml');
const PACKS_YML = path.join(ROOT, 'src', 'config', 'discovery', 'packs.yml');
const SKILLS_DIR = path.join(ROOT, 'src', 'skills');

const TIME_BUDGET_S = 5.0;
const SIZE_BUDGET_BYTES = 50 * 1024;

type Dict = Record<string, unknown>;

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** Mirror Python `truthiness` for a frontmatter value: `if not fm:` etc. */
function _pyTruthy(v: unknown): boolean {
    if (v === null || v === undefined || v === false) {
        return false;
    }
    if (v === '' || v === 0) {
        return false;
    }
    if (Array.isArray(v)) {
        return v.length > 0;
    }
    if (typeof v === 'object') {
        return Object.keys(v as Dict).length > 0;
    }
    return true;
}

export function _coverage_band(count: number): string {
    if (count === 0) {
        return 'none';
    }
    if (count <= 2) {
        return 'thin';
    }
    if (count <= 6) {
        return 'moderate';
    }
    return 'strong';
}

/** Mirror `yaml.safe_load(text) or []` returning a list of dicts. */
export function _load_packs(): Dict[] {
    let raw: unknown;
    try {
        raw = parseYaml(fs.readFileSync(PACKS_YML, 'utf-8'), { version: '1.1' });
    } catch {
        raw = null;
    }
    if (raw === null || raw === undefined || raw === false) {
        raw = [];
    }
    if (!Array.isArray(raw)) {
        // `yaml.safe_load(...) or []` keeps a truthy non-list as-is, but no real
        // packs.yml is anything but a list; the `for p in raw` would then iterate
        // its members. Keep the list shape so the filter below stays total.
        return [];
    }
    const out: Dict[] = [];
    for (const p of raw) {
        if (p !== null && typeof p === 'object' && !Array.isArray(p) && _pyTruthy((p as Dict)['domain'])) {
            out.push(p as Dict);
        }
    }
    return out;
}

/** Sorted immediate child entries (mirrors `sorted(p.glob(...))` component-wise). */
function _sortedPosix(items: string[]): string[] {
    return [...items].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Mirror `sorted(SKILLS_DIR.glob("*\/SKILL.md"))` — every `<dir>/SKILL.md` one
 * level below SKILLS_DIR, sorted by full POSIX path string (the pathlib sort
 * key). On POSIX hosts the absolute path string sorts identically.
 */
function _globSkillMds(): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
    } catch {
        return [];
    }
    const found: string[] = [];
    for (const ent of entries) {
        const dir = path.join(SKILLS_DIR, ent.name);
        const isDir = ent.isDirectory() || (ent.isSymbolicLink() && (() => {
            try {
                return fs.statSync(dir).isDirectory();
            } catch {
                return false;
            }
        })());
        if (!isDir) {
            continue;
        }
        const md = path.join(dir, 'SKILL.md');
        if (_isFile(md)) {
            found.push(md);
        }
    }
    return _sortedPosix(found);
}

/** Mirror Python `sorted(set(v))` for a list of strings. */
function _sortedUnique(v: string[]): string[] {
    return _sortedPosix([...new Set(v)]);
}

/** Mirror Python `fm.get("name") or <fallback>` — falsy value falls back. */
function _nameOr(v: unknown, fallback: string): string {
    return _pyTruthy(v) ? String(v) : fallback;
}

/** pack id → sorted skill names backing it. */
export function _skill_packs(): Record<string, string[]> {
    const byPack: Record<string, string[]> = {};
    for (const skillMd of _globSkillMds()) {
        const [fm] = parse_frontmatter(fs.readFileSync(skillMd, 'utf-8'));
        if (!fm || !_pyTruthy(fm as unknown)) {
            continue;
        }
        const fmDict = fm as Dict;
        const name = _nameOr(fmDict['name'], path.basename(path.dirname(skillMd)));
        const packs = fmDict['packs'];
        const packList = _pyTruthy(packs) ? (packs as unknown[]) : [];
        for (const pidRaw of packList) {
            const pid = String(pidRaw);
            (byPack[pid] ??= []).push(name);
        }
    }
    const result: Record<string, string[]> = {};
    for (const k of Object.keys(byPack)) {
        result[k] = _sortedUnique(byPack[k] as string[]);
    }
    return result;
}

/** pack id → sorted command names backing it (owner `pack:` + `packs:`). */
export function _command_packs(): Record<string, string[]> {
    const byPack: Record<string, string[]> = {};
    for (const cmdMd of iter_commands()) {
        const [fm] = parse_frontmatter(fs.readFileSync(cmdMd, 'utf-8'));
        if (!fm || !_pyTruthy(fm as unknown)) {
            continue;
        }
        const fmDict = fm as Dict;
        const name = _nameOr(fmDict['name'], path.basename(path.dirname(cmdMd)));
        const packsVal = fmDict['packs'];
        const pids = new Set<string>(
            (_pyTruthy(packsVal) ? (packsVal as unknown[]) : []).map((x) => String(x)),
        );
        if (_pyTruthy(fmDict['pack'])) {
            pids.add(String(fmDict['pack']));
        }
        for (const pid of pids) {
            (byPack[pid] ??= []).push(name);
        }
    }
    const result: Record<string, string[]> = {};
    for (const k of Object.keys(byPack)) {
        result[k] = _sortedUnique(byPack[k] as string[]);
    }
    return result;
}

/** JSON-encode a string scalar — `json.dumps(value, ensure_ascii=False)`. */
export function _scalar(value: string): string {
    return JSON.stringify(value);
}

export function _flow_list(items: string[]): string {
    if (items.length === 0) {
        return '[]';
    }
    return '[' + items.map((i) => _scalar(i)).join(', ') + ']';
}

interface AreaRecord {
    id: string;
    label: string;
    description: string;
    size_class: string;
    coverage: string;
    skills: string[];
    commands: string[];
}

interface Gap {
    id: string;
    label: string;
    domain: string;
}

/** `dict.get(key, default)` returning a string. */
function _getStr(d: Dict, key: string, dflt: string): string {
    const v = d[key];
    if (v === undefined || v === null) {
        return dflt;
    }
    return String(v);
}

export function build(): string {
    const packs = _load_packs();
    const skillMap = _skill_packs();
    const cmdMap = _command_packs();

    const skillSet = new Set<string>();
    for (const names of Object.values(skillMap)) {
        for (const s of names) {
            skillSet.add(s);
        }
    }
    const cmdSet = new Set<string>();
    for (const names of Object.values(cmdMap)) {
        for (const c of names) {
            cmdSet.add(c);
        }
    }
    const skillsTotal = skillSet.size;
    const commandsTotal = cmdSet.size;

    // domain → list of area records (sorted by pack id within domain).
    // Insertion-ordered map mirrors Python dict insertion order.
    const byDomain = new Map<string, AreaRecord[]>();
    const gaps: Gap[] = [];
    for (const pack of packs) {
        const pid = String(pack['id']);
        const skills = skillMap[pid] ?? [];
        const commands = cmdMap[pid] ?? [];
        const band = _coverage_band(skills.length + commands.length);
        const domain = String(pack['domain']);
        const record: AreaRecord = {
            id: pid,
            label: _getStr(pack, 'label', pid),
            description: _getStr(pack, 'description', ''),
            size_class: _getStr(pack, 'size_class', ''),
            coverage: band,
            skills,
            commands,
        };
        if (!byDomain.has(domain)) {
            byDomain.set(domain, []);
        }
        (byDomain.get(domain) as AreaRecord[]).push(record);
        if (band === 'none') {
            gaps.push({ id: pid, label: record.label, domain });
        }
    }

    const lines: string[] = [];
    lines.push('# CAPABILITIES.yaml — what agent-config already covers');
    lines.push('#');
    lines.push('# GENERATED by src/scripts/generate_capabilities_index.py — do NOT hand-edit.');
    lines.push('# Drift-checked in CI (`--check`). Regenerate after adding/removing a');
    lines.push('# skill, command, or capability pack.');
    lines.push('#');
    lines.push('# Read this BEFORE proposing a new capability: an area listed below with');
    lines.push('# `coverage: moderate|strong` is already shipped. `gaps:` names the in-use');
    lines.push('# areas with zero backing skills/commands.');
    lines.push('');
    lines.push('meta:');
    lines.push('  generated_by: src/scripts/generate_capabilities_index.py');
    lines.push(
        '  purpose: ' + _scalar(
            'Machine-readable coverage index so external reviews stop ' +
                're-proposing what already ships.',
        ),
    );
    lines.push(`  skills_total: ${skillsTotal}`);
    lines.push(`  commands_total: ${commandsTotal}`);
    lines.push(`  capability_areas: ${packs.length}`);
    lines.push(`  gaps: ${gaps.length}`);
    lines.push('  coverage_bands: ' + _scalar('none(0) thin(1-2) moderate(3-6) strong(7+)'));
    lines.push('');
    lines.push('capability_areas:');
    for (const domain of _sortedPosix([...byDomain.keys()])) {
        lines.push(`  ${domain}:`);
        const recs = [...(byDomain.get(domain) as AreaRecord[])].sort((a, b) =>
            a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
        );
        for (const rec of recs) {
            lines.push(`    - id: ${rec.id}`);
            lines.push(`      label: ${_scalar(rec.label)}`);
            lines.push(`      description: ${_scalar(rec.description)}`);
            lines.push(`      size_class: ${_scalar(rec.size_class)}`);
            lines.push(`      coverage: ${rec.coverage}`);
            lines.push(`      skill_count: ${rec.skills.length}`);
            lines.push(`      command_count: ${rec.commands.length}`);
            lines.push(`      skills: ${_flow_list(rec.skills)}`);
            lines.push(`      commands: ${_flow_list(rec.commands)}`);
        }
    }
    lines.push('');
    lines.push('gaps:');
    if (gaps.length > 0) {
        const sortedGaps = [...gaps].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        for (const gap of sortedGaps) {
            lines.push(`  - id: ${gap.id}`);
            lines.push(`    label: ${_scalar(gap.label)}`);
            lines.push(`    domain: ${gap.domain}`);
            lines.push(
                '    reason: ' + _scalar(
                    'in-use capability area with 0 backing skills or commands',
                ),
            );
        }
    } else {
        lines.push('  []  # every in-use capability area has at least one backing artefact');
    }
    return lines.join('\n') + '\n';
}

interface ParsedArgs {
    check: boolean;
}

class _ArgExit extends Error {}

function _argError(msg: string): never {
    process.stderr.write('usage: generate_capabilities_index.py [-h] [--check]\n');
    process.stderr.write(`generate_capabilities_index.py: error: ${msg}\n`);
    process.exitCode = 2;
    throw new _ArgExit();
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { check: false };
    for (const a of argv) {
        if (a === '-h' || a === '--help') {
            process.stdout.write('usage: generate_capabilities_index.py [-h] [--check]\n');
            process.exitCode = 0;
            throw new _ArgExit();
        } else if (a === '--check') {
            out.check = true;
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return out;
}

/** Mirror Python `f"{x // 1024}"` (integer floor division). */
function _kib(sizeBytes: number): number {
    return Math.floor(sizeBytes / 1024);
}

/** Mirror Python `f"{elapsed * 1000:.0f}"` — round-half-to-even to integer. */
function _msFmt(elapsedS: number): string {
    const ms = elapsedS * 1000;
    const floor = Math.floor(ms);
    const frac = ms - floor;
    let rounded: number;
    if (frac < 0.5) {
        rounded = floor;
    } else if (frac > 0.5) {
        rounded = floor + 1;
    } else {
        // exactly .5 → round to even
        rounded = floor % 2 === 0 ? floor : floor + 1;
    }
    return String(rounded);
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

    const start = process.hrtime.bigint();
    const content = build();
    const elapsed = Number(process.hrtime.bigint() - start) / 1e9;

    // Kill-switch: generation latency.
    if (elapsed > TIME_BUDGET_S) {
        process.stderr.write(
            `❌  capabilities index generation took ${elapsed.toFixed(1)}s ` +
                `(> ${TIME_BUDGET_S.toFixed(0)}s budget) — investigate before it blocks CI.\n`,
        );
        return 1;
    }

    // Kill-switch: output size.
    const size = Buffer.byteLength(content, 'utf-8');
    if (size > SIZE_BUDGET_BYTES) {
        process.stderr.write(
            `❌  CAPABILITIES.yaml is ${_kib(size)} KB ` +
                `(> ${_kib(SIZE_BUDGET_BYTES)} KB budget) — split or summarize; ` +
                'an oversized index defeats discoverability.\n',
        );
        return 1;
    }

    if (args.check) {
        const onDisk = _exists(OUT) ? fs.readFileSync(OUT, 'utf-8') : '';
        if (onDisk !== content) {
            process.stderr.write(
                '❌  CAPABILITIES.yaml is stale — run ' +
                    '`python3 src/scripts/generate_capabilities_index.py`\n',
            );
            return 1;
        }
        process.stdout.write(
            `✅  CAPABILITIES.yaml up to date (${_kib(size)} KB, ${_msFmt(elapsed)}ms).\n`,
        );
        return 0;
    }

    fs.writeFileSync(OUT, content, 'utf-8');
    process.stdout.write(
        `✅  Wrote CAPABILITIES.yaml — ${_kib(size)} KB, ${_msFmt(elapsed)}ms · ` +
            `${_load_packs().length} areas.\n`,
    );
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}
