#!/usr/bin/env tsx
/**
 * Plan + apply the physical monorepo migration (Phase 4).
 *
 * TypeScript twin of `src/scripts/plan_physical_move.py` (ADR-200, Phase 8 /
 * Wave 8b). Mirrors the CLI contract EXACTLY — the `--apply`, `--out` flags,
 * exit codes (0 clean dry-run / 1 dry-run-with-conflicts / 2 refuse-apply /
 * 3 source-missing / 4 git-mv-failed), the stdout/stderr split, byte-identical
 * messages AND the byte-identical written `move-plan.json`
 * (`json.dumps(indent=2, sort_keys=False, ensure_ascii=False) + "\n"`).
 *
 * Reads every artefact under `.agent-src.uncondensed/`, decides its
 * destination under `packages/core/` or `packages/pack-<id>/`, and emits
 * `dist/migration/move-plan.json`. `--apply` executes the moves via `git mv`.
 *
 * No behaviour changes — latent Python quirks replicated. (The dry-run path
 * writes the plan JSON to BOTH the default location and `--out`; when they
 * coincide the file is written twice, exactly as the Python original does.)
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { parse_frontmatter, type YamlValue } from './validate_frontmatter.js';

const _HERE = fileURLToPath(import.meta.url);

// src/scripts/plan_physical_move.ts → parents[2] of the .py file is repo root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SRC = path.join(ROOT, '.agent-src.uncondensed');
const PACKAGES = path.join(ROOT, 'packages');
const CORE = path.join(PACKAGES, 'core', '.agent-src.uncondensed');
const VOCAB_DIR = path.join(ROOT, 'src', 'config', 'discovery');
const PLAN_OUT = path.join(ROOT, 'dist', 'migration', 'move-plan.json');
const UNASSIGNED_YAML = path.join(VOCAB_DIR, 'unassigned-artefacts.yml');

// Locked kernel — pinned to core regardless of frontmatter.
const KERNEL_RULES: ReadonlySet<string> = new Set([
    'agent-authority',
    'ask-when-uncertain',
    'commit-policy',
    'direct-answers',
    'language-and-tone',
    'no-cheap-questions',
    'non-destructive-by-default',
    'scope-control',
    'verify-before-complete',
    'user-interrupt-priority',
]);

// Non-frontmatter trees that follow the host package (core) by default.
const CORE_DIRS: readonly string[] = [
    'templates',
    'profiles',
    'presets',
    'contexts',
    'user-types',
    'scripts',
    'ghostwriter',
    'packs',
    'personas',
];

type Fm = Record<string, YamlValue> | null;
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

interface PlanEntry {
    from: string;
    to: string;
    reason: string;
}
interface ConflictEntry {
    path: string;
    reason: string;
    fallback_to?: string;
}
interface Plan {
    schema_version: string;
    source_root: string;
    packages_root: string;
    totals: { moves: number; stays_in_core: number; conflicts: number };
    moves: PlanEntry[];
    stays_in_core: PlanEntry[];
    conflicts: ConflictEntry[];
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _relToRootPosix(p: string): string {
    return path.relative(ROOT, p).split(path.sep).join('/');
}

/**
 * Mirror Python `Path.relative_to(ROOT)` — throws when `p` is not under ROOT
 * (Python `relative_to` raises ValueError → exit 1; traceback prose is
 * Python-version-dependent and not matched).
 */
function _pyRelativeTo(p: string): string {
    const rel = path.relative(ROOT, p);
    if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
        throw new Error(`'${p}' is not in the subpath of '${ROOT}'`);
    }
    return rel.split(path.sep).join('/');
}

function _relToSrcPosix(p: string): string {
    return path.relative(SRC, p).split(path.sep).join('/');
}

function _asObj(v: Json | undefined): { [k: string]: Json } | null {
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function _loadYamlList(p: string): Json[] {
    const parsed = parseYaml(fs.readFileSync(p, 'utf-8'), { version: '1.1' }) as Json;
    return Array.isArray(parsed) ? parsed : [];
}

function _load_pack_ids(): Set<string> {
    const packs = _loadYamlList(path.join(VOCAB_DIR, 'packs.yml'));
    const out = new Set<string>();
    for (const p of packs) {
        const o = _asObj(p);
        if (o && typeof o['id'] === 'string') {
            out.add(o['id']);
        }
    }
    return out;
}

function _load_unassigned(): Map<string, string> {
    const raw = _loadYamlList(UNASSIGNED_YAML);
    const out = new Map<string, string>();
    for (const e of raw) {
        const o = _asObj(e);
        if (o && typeof o['path'] === 'string') {
            out.set(o['path'], typeof o['reason'] === 'string' ? o['reason'] : String(o['reason']));
        }
    }
    return out;
}

function _fmGet(fm: Fm, key: string): YamlValue | undefined {
    if (fm === null) {
        return undefined;
    }
    return fm[key];
}

function _is_core(fm: Fm, stem: string): boolean {
    if (KERNEL_RULES.has(stem)) {
        return true;
    }
    if (fm === null) {
        return false;
    }
    const trustRaw = _fmGet(fm, 'trust');
    const installRaw = _fmGet(fm, 'install');
    const trust =
        trustRaw !== null && typeof trustRaw === 'object' && !Array.isArray(trustRaw)
            ? (trustRaw as Record<string, YamlValue>)
            : {};
    const install =
        installRaw !== null && typeof installRaw === 'object' && !Array.isArray(installRaw)
            ? (installRaw as Record<string, YamlValue>)
            : {};
    return trust['level'] === 'core' && install['removable'] === false;
}

function _primary_pack(fm: Fm): string | null {
    if (!fm) {
        return null;
    }
    const explicit = fm['primary_pack'];
    if (typeof explicit === 'string' && explicit.trim()) {
        return explicit.trim();
    }
    const packs = fm['packs'];
    if (!Array.isArray(packs) || packs.length === 0) {
        return null;
    }
    const first = packs[0];
    return typeof first === 'string' ? first : (first as unknown as string);
}

function _dest_for(
    src: string,
    fm: Fm,
    packIds: Set<string>,
): [string, string, string | null] {
    const rel = _relToSrcPosix(src);
    const parts = rel.split('/');
    const top = parts.length ? (parts[0] as string) : '';

    if (CORE_DIRS.includes(top)) {
        return [path.join(CORE, rel), `core dir: ${top}/`, null];
    }

    const base = path.basename(src);
    const stem = base !== 'SKILL.md' ? _stem(base) : path.basename(path.dirname(src));

    if (_is_core(fm, stem)) {
        const reason = KERNEL_RULES.has(stem)
            ? 'kernel rule'
            : 'trust.level=core + install.removable=false';
        return [path.join(CORE, rel), reason, null];
    }

    const primary = _primary_pack(fm);
    if (primary === null) {
        return [path.join(CORE, rel), 'no primary pack — falling back to core', 'missing primary pack'];
    }
    if (!packIds.has(primary)) {
        return [
            path.join(CORE, rel),
            `unknown pack '${primary}' — falling back to core`,
            `unknown pack: ${primary}`,
        ];
    }
    if (primary === 'meta') {
        return [path.join(CORE, rel), 'primary pack: meta (package internals → core)', null];
    }
    const destRoot = path.join(PACKAGES, `pack-${primary}`, '.agent-src.uncondensed');
    return [path.join(destRoot, rel), `primary pack: ${primary}`, null];
}

/** Python `Path.stem` — filename without the final suffix. */
function _stem(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(0, dot) : name;
}

const _SKIP_DIR_NAMES: ReadonlySet<string> = new Set([
    '.pytest_cache',
    '__pycache__',
    '.mypy_cache',
    '.ruff_cache',
    'node_modules',
    '.DS_Store',
]);

function _should_skip(p: string): boolean {
    // any(part in _SKIP_DIR_NAMES for part in p.parts) — over the full path.
    const parts = p.split(path.sep);
    return parts.some((part) => _SKIP_DIR_NAMES.has(part));
}

function _gitignored(paths: string[]): Set<string> {
    if (paths.length === 0) {
        return new Set();
    }
    const rel = paths.map((p) => _relToRootPosix(p));
    const result = spawnSync('git', ['check-ignore', '--stdin'], {
        cwd: ROOT,
        input: rel.join('\n'),
        encoding: 'utf-8',
    });
    const code = result.status ?? 0;
    if (code > 1) {
        return new Set();
    }
    const ignored = new Set<string>();
    for (const line of (result.stdout ?? '').split('\n')) {
        const t = line.trim();
        if (t) {
            ignored.add(t);
        }
    }
    const out = new Set<string>();
    for (const r of rel) {
        if (ignored.has(r)) {
            out.add(path.join(ROOT, r));
        }
    }
    return out;
}

/** Mirror Python `sorted(Path…)` component-wise comparison. */
function _pathCompare(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i += 1) {
        const x = pa[i] as string;
        const y = pb[i] as string;
        if (x < y) return -1;
        if (x > y) return 1;
    }
    return pa.length - pb.length;
}

function _iter_artefacts(): string[] {
    const paths: string[] = [];
    const all: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            all.push(full);
            if (e.isDirectory() && !e.isSymbolicLink()) {
                walk(full);
            }
        }
    };
    walk(SRC);
    all.sort(_pathCompare);
    for (const p of all) {
        let st: fs.Stats;
        try {
            st = fs.statSync(p);
        } catch {
            continue;
        }
        if (!st.isFile()) {
            continue;
        }
        if (_should_skip(p)) {
            continue;
        }
        paths.push(p);
    }
    const ignored = _gitignored(paths);
    return paths.filter((p) => !ignored.has(p));
}

function _find_owning_skill_fm(src: string): Fm {
    const parts = _relToRootPosix(src).split('/');
    // src.parts on the absolute path — but "skills" segment is what matters.
    const absParts = src.split(path.sep);
    if (!absParts.includes('skills')) {
        return null;
    }
    const idx = absParts.indexOf('skills');
    if (idx + 1 >= absParts.length) {
        return null;
    }
    const skillName = absParts[idx + 1] as string;
    const candidates: string[] = [
        path.join(absParts.slice(0, idx + 2).join(path.sep), 'SKILL.md'),
    ];
    const pkgsRoot = path.join(ROOT, 'packages');
    if (_exists(pkgsRoot)) {
        let entries: fs.Dirent[] = [];
        try {
            entries = fs.readdirSync(pkgsRoot, { withFileTypes: true });
        } catch {
            entries = [];
        }
        for (const pkg of entries) {
            const cand = path.join(
                pkgsRoot,
                pkg.name,
                '.agent-src.uncondensed',
                'skills',
                skillName,
                'SKILL.md',
            );
            if (_exists(cand)) {
                candidates.push(cand);
            }
        }
    }
    void parts;
    for (const cand of candidates) {
        if (_exists(cand)) {
            const [parsed] = parse_frontmatter(fs.readFileSync(cand, 'utf-8'));
            if (parsed !== null) {
                return parsed;
            }
        }
    }
    return null;
}

function _build_plan(): Plan {
    const packIds = _load_pack_ids();
    const unassigned = _load_unassigned();
    const moves: PlanEntry[] = [];
    const staysInCore: PlanEntry[] = [];
    const conflicts: ConflictEntry[] = [];

    for (const src of _iter_artefacts()) {
        const relSrc = _relToRootPosix(src);
        let fm: Fm = null;
        if (src.endsWith('.md')) {
            try {
                const text = fs.readFileSync(src, 'utf-8');
                const [parsed] = parse_frontmatter(text);
                if (parsed !== null) {
                    fm = parsed;
                }
            } catch (exc) {
                conflicts.push({ path: relSrc, reason: `parse error: ${String(exc)}` });
                continue;
            }
        }

        // Quarantined scaffolds → core, no conflict.
        if (unassigned.has(relSrc) && fm === null) {
            const dest = path.join(CORE, _relToSrcPosix(src));
            staysInCore.push({
                from: relSrc,
                to: _relToRootPosix(dest),
                reason: `unassigned scaffold: ${unassigned.get(relSrc) as string}`,
            });
            continue;
        }

        let inherited = false;
        if (fm === null && path.basename(src) !== 'SKILL.md') {
            const ownerFm = _find_owning_skill_fm(src);
            if (ownerFm !== null) {
                fm = ownerFm;
                inherited = true;
            }
        }

        const [dest, reasonRaw, conflict] = _dest_for(src, fm, packIds);
        const reason = inherited ? `inherits parent SKILL.md → ${reasonRaw}` : reasonRaw;
        const entry: PlanEntry = { from: relSrc, to: _relToRootPosix(dest), reason };
        if (conflict) {
            conflicts.push({ path: relSrc, reason: conflict, fallback_to: entry.to });
        }
        if (_isRelativeTo(dest, CORE)) {
            staysInCore.push(entry);
        } else {
            moves.push(entry);
        }
    }

    return {
        schema_version: '1',
        source_root: _relToRootPosix(SRC),
        packages_root: _relToRootPosix(PACKAGES),
        totals: {
            moves: moves.length,
            stays_in_core: staysInCore.length,
            conflicts: conflicts.length,
        },
        moves,
        stays_in_core: staysInCore,
        conflicts,
    };
}

/** Mirror Python `Path.is_relative_to`. */
function _isRelativeTo(child: string, parent: string): boolean {
    const rel = path.relative(parent, child);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// --- json.dumps(indent=2, sort_keys=False, ensure_ascii=False) replica ------

function _jsonDumps(obj: unknown): string {
    const pad = '  ';
    const enc = (value: unknown, depth: number): string => {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as Record<string, unknown>;
        const keys = Object.keys(o); // insertion order (sort_keys=False)
        if (keys.length === 0) return '{}';
        const inner = keys.map(
            (k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k], depth + 1),
        );
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    };
    const encStr = (s: string): string => {
        // ensure_ascii=False — only escape JSON-mandated control chars.
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
            else out += ch;
        }
        return out + '"';
    };
    return enc(obj, 0);
}

function _apply(plan: Plan): number {
    if (plan.conflicts.length) {
        process.stderr.write(
            `ERROR: ${plan.conflicts.length} unresolved conflict(s); refusing --apply.\n`,
        );
        return 2;
    }
    const allEntries = [...plan.moves, ...plan.stays_in_core];
    let moved = 0;
    let skipped = 0;
    for (const entry of allEntries) {
        const src = path.join(ROOT, entry.from);
        const dst = path.join(ROOT, entry.to);
        if (!_exists(src)) {
            if (_exists(dst)) {
                skipped += 1;
                continue;
            }
            process.stderr.write(
                `ERROR: source missing AND destination missing: ${entry.from}\n`,
            );
            return 3;
        }
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        const result = spawnSync('git', ['mv', src, dst], { cwd: ROOT, encoding: 'utf-8' });
        if ((result.status ?? 1) !== 0) {
            process.stderr.write(
                `ERROR: git mv failed: ${entry.from} -> ${entry.to}\n${result.stderr ?? ''}\n`,
            );
            return 4;
        }
        moved += 1;
    }
    process.stdout.write(`Applied ${moved} moves, skipped ${skipped} already-moved entries.\n`);
    return 0;
}

interface ParsedArgs {
    apply: boolean;
    out: string;
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { apply: false, out: PLAN_OUT };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--apply') {
            out.apply = true;
        } else if (a === '--out' || a.startsWith('--out=')) {
            const eq = a.indexOf('=');
            if (eq !== -1) {
                out.out = a.slice(eq + 1);
            } else {
                const next = argv[i + 1];
                if (next === undefined) {
                    process.stderr.write(
                        'plan_physical_move: error: argument --out: expected one argument\n',
                    );
                    process.exit(2);
                }
                out.out = next;
                i += 1;
            }
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: plan_physical_move [-h] [--apply] [--out OUT]\n');
            process.exit(0);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const plan = _build_plan();
    // Python writes PLAN_OUT first (via mkdir), then args.out. With the default
    // they coincide and the file is written twice — replicated verbatim.
    fs.mkdirSync(path.dirname(PLAN_OUT), { recursive: true });
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, _jsonDumps(plan) + '\n', 'utf-8');
    process.stdout.write(`Plan: ${_pyRelativeTo(path.resolve(args.out))}\n`);
    process.stdout.write(`  moves         : ${plan.totals.moves}\n`);
    process.stdout.write(`  stays_in_core : ${plan.totals.stays_in_core}\n`);
    process.stdout.write(`  conflicts     : ${plan.totals.conflicts}\n`);

    if (args.apply) {
        return _apply(plan);
    }
    return plan.conflicts.length ? 1 : 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
