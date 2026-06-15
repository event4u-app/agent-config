#!/usr/bin/env tsx
/**
 * Abstraction-budget inventory — read-only discovery pass.
 *
 * TypeScript twin of `src/scripts/inventory_abstraction_budget.py`
 * (ADR-200 — Python→TS migration, Phase 8 / Wave 8c). Mirrors the
 * Python CLI contract EXACTLY — the `--quiet` flag, exit code (always
 * 0), the stdout/stderr split routed through the `script_output` twin,
 * byte-identical written artefacts (the Markdown report + two CSVs,
 * including `csv.writer`'s `\r\n` line terminator and QUOTE_MINIMAL
 * quoting).
 *
 * Imports the `_lib/agent_src` + `_lib/script_output` twins (the SAME
 * surfaces the Python original imports). Reference counts are grep-backed
 * (ripgrep with python-walk fallback) — `rg` is invoked as a subprocess
 * exactly like the Python original, so the counts agree.
 *
 * Read-only. Touches no abstraction file. No behaviour changes — latent
 * Python quirks replicated.
 *
 * NOTE (divergence-free by construction): the Markdown report carries a
 * `_Generated: <UTC date>_` line, so the report is non-deterministic
 * between two invocations on different days; golden-parity comparison
 * normalises that single line. The two CSVs are deterministic and are
 * compared byte-for-byte.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as script_output from './_lib/script_output.js';
import { SRC_AGENT } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/inventory_abstraction_budget.py → parent.parent.parent == repo root.
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// 6.0.x: uncondensed source container moved to src/agent-src/ (ADR-051).
const CORE_SRC = SRC_AGENT();
// Enforced source target — read by scripts/check_gate_paths.py.
export const GATE_CORE_PATHS = [CORE_SRC];
void GATE_CORE_PATHS;
const DIRECTIVES_ROOT = path.join(CORE_SRC, 'templates', 'scripts', 'work_engine', 'directives');
const EVIDENCE_DIR = path.join(REPO_ROOT, 'agents', 'evidence', 'analysis');

const EXCLUDE_DIRS: readonly string[] = [
    '.git',
    'node_modules',
    'dist',
    '.claude/worktrees',
    '.cursor',
    '.windsurf',
    '.clinerules',
    '.augment',
    'dist/agent-src',
    '.claude/skills',
    '.claude/commands',
    '.claude/personas',
    'agents/evidence',
    'agents/runtime',
];
// EXCLUDE_PATH_FRAGMENTS = tuple(EXCLUDE_DIRS) — Python set iteration order is
// insertion-ordered-by-hash; the fragments only feed `rg -g !frag/**` globs and
// a prefix test, both order-independent. Preserve the source list order.
const EXCLUDE_PATH_FRAGMENTS: readonly string[] = EXCLUDE_DIRS;

const ROLES_ENUM: readonly string[] = ['developer', 'reviewer', 'tester', 'po', 'incident', 'planner'];
const TRUST_LEVELS_ENUM: readonly string[] = [
    'core',
    'professional',
    'advisory',
    'restricted',
    'experimental',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

interface InventoryRow {
    name: string;
    cls: string;
    ref_count: number;
    last_modified: string;
    bloat_candidate: boolean;
    notes: string;
}

function rowToRow(r: InventoryRow): string[] {
    return [
        r.cls,
        r.name,
        String(r.ref_count),
        r.last_modified,
        r.bloat_candidate ? 'Y' : 'N',
        r.notes,
    ];
}

interface FrontmatterAudit {
    field: string;
    cls: string;
    total: number;
    distinct: number;
    dominant_value: string;
    dominant_share: number;
    bloat_candidate: boolean;
}

function fmToRow(r: FrontmatterAudit): string[] {
    return [
        r.cls,
        r.field,
        String(r.total),
        String(r.distinct),
        r.dominant_value,
        _pctFormat(r.dominant_share, 2),
        r.bloat_candidate ? 'Y' : 'N',
    ];
}

interface Stats {
    rows: InventoryRow[];
    fm_rows: FrontmatterAudit[];
    overlap_notes: string[];
}

function newStats(): Stats {
    return { rows: [], fm_rows: [], overlap_notes: [] };
}

function _log(level: 'info' | 'success' | 'warn' | 'error', msg: string): void {
    // script_output twin is always present here (unlike the Python original's
    // graceful-degradation guard, which exists only for the rare run outside the
    // repo). Mirror the Python branch: when script_output is None it would print
    // only on error to stderr — but in this twin the module is always imported.
    (script_output[level] as (m: string) => void)(msg);
}

// --- grep helpers ------------------------------------------------------------

function _hasRg(): boolean {
    // shutil.which("rg") equivalent.
    const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['rg'], {
        encoding: 'utf8',
    });
    return r.status === 0 && (r.stdout ?? '').trim().length > 0;
}
const _RG_AVAILABLE = _hasRg();

function has_rg(): boolean {
    return _RG_AVAILABLE;
}

function _relPosix(child: string, root: string): string {
    return path.relative(root, child).split(path.sep).join('/');
}

/** Count matches across repo, excluding generated trees and optionally a self-dir. */
export function grep_count(
    pattern: string,
    opts: { regex?: boolean; exclude_dir?: string | null } = {},
): number {
    const regex = opts.regex ?? false;
    const exclude_dir = opts.exclude_dir ?? null;
    if (has_rg()) {
        const cmd: string[] = ['--count-matches', '--no-heading'];
        if (!regex) {
            cmd.push('--fixed-strings');
        }
        for (const frag of EXCLUDE_PATH_FRAGMENTS) {
            cmd.push('-g', `!${frag}/**`);
        }
        if (exclude_dir !== null) {
            // Python: rel = exclude_dir.relative_to(REPO_ROOT); on ValueError pass.
            const rel = path.relative(REPO_ROOT, exclude_dir);
            if (rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)) {
                cmd.push('-g', `!${rel.split(path.sep).join('/')}/**`);
            }
        }
        cmd.push(pattern, REPO_ROOT);
        let out;
        try {
            out = spawnSync('rg', cmd, { encoding: 'utf8' });
        } catch {
            return _python_grep(pattern, { regex, exclude_dir });
        }
        if (out.error) {
            return _python_grep(pattern, { regex, exclude_dir });
        }
        let total = 0;
        for (const line of (out.stdout ?? '').split('\n')) {
            if (!line) {
                continue;
            }
            // format: <path>:<count> ; rsplit(":", 1)
            const idx = line.lastIndexOf(':');
            if (idx === -1) {
                continue;
            }
            const count = line.slice(idx + 1);
            if (/^\d+$/.test(count)) {
                total += parseInt(count, 10);
            }
        }
        return total;
    }
    return _python_grep(pattern, { regex, exclude_dir });
}

const _GREP_SUFFIXES = ['.md', '.py', '.yml', '.yaml', '.json', '.sh', '.ts', '.js'];

function _python_grep(
    pattern: string,
    opts: { regex?: boolean; exclude_dir?: string | null } = {},
): number {
    const regex = opts.regex ?? false;
    const exclude_dir = opts.exclude_dir ?? null;
    const rx = regex ? new RegExp(pattern, 'g') : null;
    let total = 0;
    const exclStr = exclude_dir;
    const walk = (root: string): void => {
        const rel = path.relative(REPO_ROOT, root) || '.';
        for (const frag of EXCLUDE_PATH_FRAGMENTS) {
            if (rel === frag || rel.startsWith(frag + path.sep) || rel === frag) {
                return;
            }
        }
        if (exclStr !== null && root.startsWith(exclStr)) {
            return;
        }
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(root, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(root, ent.name);
            // Mirror os.walk(REPO_ROOT) with followlinks=False:
            //   - an entry is a "directory" iff os.path.isdir(entry) — which
            //     FOLLOWS symlinks. A symlink→dir is listed but NOT descended
            //     (followlinks=False), so we classify-as-dir-and-skip-recursion.
            //   - everything else is a "file", INCLUDING a symlink→file, whose
            //     content read() follows the link. (My earlier readdir-Dirent
            //     classification dropped symlink→file entries — the latent bug
            //     this branch fixes; `.claude/rules/*.md` are such symlinks.)
            const isDir = _isDir(full); // stat-follows-symlink, == os.path.isdir
            if (isDir) {
                // Only recurse into a REAL directory (followlinks=False); a
                // symlink→dir is listed by os.walk but not descended.
                if (!ent.isSymbolicLink()) {
                    walk(full);
                }
                continue;
            }
            // Treat as a file (real file or symlink→file).
            if (!_GREP_SUFFIXES.some((s) => ent.name.endsWith(s))) {
                continue;
            }
            let text: string;
            try {
                text = fs.readFileSync(full, 'utf-8');
            } catch {
                continue;
            }
            if (regex && rx !== null) {
                const m = text.match(rx);
                total += m ? m.length : 0;
            } else {
                total += _countSubstr(text, pattern);
            }
        }
    };
    walk(REPO_ROOT);
    return total;
}

/** Mirror Python str.count(sub) — non-overlapping occurrences. */
function _countSubstr(text: string, sub: string): number {
    if (sub === '') {
        // Python "abc".count("") == len+1; not used here but mirror anyway.
        return pyLen(text) + 1;
    }
    let count = 0;
    let i = 0;
    for (;;) {
        const idx = text.indexOf(sub, i);
        if (idx === -1) {
            break;
        }
        count++;
        i = idx + sub.length;
    }
    return count;
}

/** Mirror Python len(str) — count Unicode code points. */
function pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n++;
    }
    return n;
}

// --- last_modified -----------------------------------------------------------

export function last_modified(p: string): string {
    try {
        const out = spawnSync('git', ['log', '-1', '--format=%cs', '--', p], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });
        if (!out.error) {
            const date = (out.stdout ?? '').trim();
            if (date) {
                return date;
            }
        }
    } catch {
        // fall through to mtime
    }
    try {
        const st = fs.statSync(p);
        return _isoDateUTC(st.mtime);
    } catch {
        return 'unknown';
    }
}

/** datetime.fromtimestamp(mtime, tz=utc).date().isoformat() — YYYY-MM-DD (UTC). */
function _isoDateUTC(d: Date): string {
    return d.toISOString().slice(0, 10);
}

// --- frontmatter -------------------------------------------------------------

/** Return frontmatter as flat dict[str, str]. Empty when absent. */
export function parse_frontmatter(p: string): Record<string, string> {
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        return {};
    }
    if (!text.startsWith('---\n')) {
        return {};
    }
    const end = text.indexOf('\n---\n', 4);
    if (end < 0) {
        return {};
    }
    const block = text.slice(4, end);
    const out: Record<string, string> = {};
    let indent_path: string[] = [];
    for (const raw of block.split('\n')) {
        const stripped = pyStrip(raw);
        if (!stripped || pyLStrip(raw).startsWith('#')) {
            continue;
        }
        const indent = raw.length - pyLStripSpaces(raw).length;
        const depth = Math.floor(indent / 2);
        if (!raw.includes(':')) {
            continue;
        }
        // key_part, _, value = raw.lstrip().partition(":")
        const ls = pyLStrip(raw);
        const ci = ls.indexOf(':');
        const key_part = ls.slice(0, ci);
        let value = ls.slice(ci + 1);
        const key = pyStrip(key_part);
        value = pyStrip(value);
        indent_path = indent_path.slice(0, depth);
        indent_path.push(key);
        if (value) {
            const full_key = indent_path.join('.');
            out[full_key] = value;
        }
    }
    return out;
}

/** Mirror Python str.strip(). */
function pyStrip(s: string): string {
    return s.replace(/^\s+/, '').replace(/\s+$/, '');
}
/** Mirror Python str.lstrip() (all leading whitespace). */
function pyLStrip(s: string): string {
    return s.replace(/^\s+/, '');
}
/** Mirror Python str.lstrip(" ") (leading spaces only). */
function pyLStripSpaces(s: string): string {
    return s.replace(/^ +/, '');
}

// --- inventory passes --------------------------------------------------------

function _rgSelfRefs(targetDir: string, name: string): number {
    let self_refs = 0;
    try {
        const out = spawnSync(
            'rg',
            ['--count-matches', '--no-heading', '--fixed-strings', name, targetDir],
            { encoding: 'utf8' },
        );
        if (!out.error) {
            for (const line of (out.stdout ?? '').split('\n')) {
                if (!line) {
                    continue;
                }
                const idx = line.lastIndexOf(':');
                if (idx === -1) {
                    continue;
                }
                const count = line.slice(idx + 1);
                if (/^\d+$/.test(count)) {
                    self_refs += parseInt(count, 10);
                }
            }
        }
    } catch {
        // pass
    }
    return self_refs;
}

function _iterdirSorted(p: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(p);
    } catch {
        return [];
    }
    names.sort();
    return names.map((n) => path.join(p, n));
}

/**
 * Strict variant mirroring `sorted(Path.iterdir())` — propagates the read
 * error (FileNotFoundError / NotADirectoryError) instead of returning [].
 * Used only by `inventory_packs`, whose Python call site is NOT is_dir()-
 * guarded and therefore crashes when `packages/` is absent.
 */
function _iterdirSortedStrict(p: string): string[] {
    const names = fs.readdirSync(p); // throws ENOENT when p is missing
    names.sort();
    return names.map((n) => path.join(p, n));
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}
function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

export function inventory_packs(stats: Stats): void {
    const packs_dir = path.join(REPO_ROOT, 'packages');
    // Python: `sorted(packs_dir.iterdir())` — `Path.iterdir()` raises
    // FileNotFoundError when the directory does not exist (it is NOT guarded
    // by an is_dir() check, unlike the other inventory passes). Replicate that
    // latent crash faithfully: on the current src/-based layout (no packages/
    // dir) the Python original aborts with a FileNotFoundError traceback and
    // exit 1. See the divergence note in the wave report — this is a real
    // latent Python bug being mirrored, not a TS choice.
    for (const child of _iterdirSortedStrict(packs_dir)) {
        if (!_isDir(child) || !path.basename(child).startsWith('pack-')) {
            continue;
        }
        const name = path.basename(child);
        const ref = grep_count(name);
        let self_refs = 0;
        if (has_rg()) {
            self_refs = _rgSelfRefs(child, name);
        }
        const external = Math.max(ref - self_refs, 0);
        stats.rows.push({
            name,
            cls: 'pack',
            ref_count: external,
            last_modified: last_modified(child),
            bloat_candidate: external === 0,
            notes: `total=${ref}, internal=${self_refs}`,
        });
    }
}

export function inventory_roles(stats: Stats): void {
    for (const role of ROLES_ENUM) {
        let ref = grep_count(`active_role: ${role}`);
        ref += grep_count(`active_role: "${role}"`);
        ref += grep_count(`active_role: '${role}'`);
        const contract = path.join(
            REPO_ROOT,
            'docs',
            'guidelines',
            'agent-infra',
            'role-contracts.md',
        );
        stats.rows.push({
            name: role,
            cls: 'role',
            ref_count: ref,
            last_modified: last_modified(contract),
            bloat_candidate: ref === 0,
            notes: 'enum role-contracts.md',
        });
    }
}

export function inventory_directives(stats: Stats): void {
    if (!_isDir(DIRECTIVES_ROOT)) {
        return;
    }
    for (const child of _iterdirSorted(DIRECTIVES_ROOT)) {
        const cn = path.basename(child);
        if (!_isDir(child) || cn.startsWith('_') || cn.startsWith('.')) {
            continue;
        }
        let ref = grep_count(`directive_set: ${cn}`) + grep_count(`directive_set="${cn}"`);
        ref += grep_count(`"${cn}"`);
        stats.rows.push({
            name: cn,
            cls: 'directive_set',
            ref_count: ref,
            last_modified: last_modified(child),
            bloat_candidate: ref < 2,
            notes: 'work_engine directive set',
        });
    }
}

export function inventory_council_members(stats: Stats): void {
    for (const member of ['anthropic', 'openai', 'gemini']) {
        const ref = grep_count(`    ${member}:`);
        const cfg = path.join(REPO_ROOT, 'docs', 'contracts', 'ai-council-config.md');
        stats.rows.push({
            name: member,
            cls: 'council_member',
            ref_count: ref,
            last_modified: last_modified(cfg),
            bloat_candidate: ref === 0,
            notes: 'ai-council provider slot',
        });
    }
}

export function inventory_trust_levels(stats: Stats): void {
    const cfg = path.join(REPO_ROOT, 'docs', 'contracts', 'trust-and-safety.md');
    for (const level of TRUST_LEVELS_ENUM) {
        let ref = grep_count(`trust.level: ${level}`) + grep_count(`level: ${level}`);
        ref += grep_count(`\`${level}\``);
        stats.rows.push({
            name: level,
            cls: 'trust_level',
            ref_count: ref,
            last_modified: last_modified(cfg),
            bloat_candidate: ref < 2,
            notes: 'trust enum value',
        });
    }
}

/** `sorted(contracts.glob("*flow*.md"))`. */
function _globFlow(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out = names
        .filter((n) => n.includes('flow') && n.endsWith('.md'))
        .map((n) => path.join(dir, n));
    out.sort();
    return out;
}

export function inventory_flows(stats: Stats): void {
    const contracts = path.join(REPO_ROOT, 'docs', 'contracts');
    if (!_isDir(contracts)) {
        return;
    }
    for (const p of _globFlow(contracts)) {
        const stem = path.basename(p).replace(/\.md$/, '');
        const ref = grep_count(stem);
        stats.rows.push({
            name: stem,
            cls: 'flow',
            ref_count: ref,
            last_modified: last_modified(p),
            bloat_candidate: ref < 3,
            notes: _relPosix(p, REPO_ROOT),
        });
    }
}

/** Sorted recursive `*.md` paths under a dir (mirrors `rglob("*.md")`). */
function _rglobMd(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.name.endsWith('.md')) {
                out.push(full);
            }
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
                walk(full);
            }
        }
    };
    walk(root);
    out.sort();
    return out;
}

export function inventory_artefacts(stats: Stats, opts: { subdir: string; cls: string }): void {
    const { subdir, cls } = opts;
    const root = path.join(CORE_SRC, subdir);
    if (!_isDir(root)) {
        return;
    }
    for (const child of _iterdirSorted(root)) {
        const cn = path.basename(child);
        if (_isDir(child)) {
            const md = cls === 'skill' ? path.join(child, 'SKILL.md') : null;
            if (md && _isFile(md)) {
                _record_artefact(stats, cn, cls, md, child);
            } else if (cls === 'command') {
                for (const cmd_file of _rglobMd(child)) {
                    const name = _relPosix(cmd_file, root).replace(/\.md$/, '').split('/').join(':');
                    _record_artefact(stats, name, cls, cmd_file, null);
                }
            } else if (cls === 'persona') {
                if (cn.startsWith('_')) {
                    continue;
                }
                for (const persona_file of _rglobMd(child)) {
                    const name = path.basename(persona_file).replace(/\.md$/, '');
                    if (name.startsWith('_')) {
                        continue;
                    }
                    _record_artefact(stats, name, cls, persona_file, null);
                }
            }
        } else if (cn.endsWith('.md')) {
            const name = cn.replace(/\.md$/, '');
            if (name.startsWith('_') || name.toUpperCase() === 'README') {
                continue;
            }
            _record_artefact(stats, name, cls, child, null);
        }
    }
}

function _record_artefact(
    stats: Stats,
    name: string,
    cls: string,
    p: string,
    exclude_dir: string | null,
): void {
    let external: number;
    if (exclude_dir !== null) {
        external = grep_count(name, { exclude_dir });
    } else {
        const total = grep_count(name);
        let self_refs: number;
        try {
            const self_text = fs.readFileSync(p, 'utf-8');
            self_refs = _countSubstr(self_text, name);
        } catch {
            self_refs = 0;
        }
        external = Math.max(total - self_refs, 0);
    }
    const bloat = external < 3;
    stats.rows.push({
        name,
        cls,
        ref_count: external,
        last_modified: last_modified(p),
        bloat_candidate: bloat,
        notes: _relPosix(p, REPO_ROOT),
    });
}

export function overlap_audit(stats: Stats): void {
    const by_class: Map<string, string[]> = new Map();
    for (const row of stats.rows) {
        if (!by_class.has(row.cls)) {
            by_class.set(row.cls, []);
        }
        (by_class.get(row.cls) as string[]).push(row.name);
    }
    for (const [cls, names] of by_class) {
        if (!['skill', 'rule', 'command', 'persona'].includes(cls)) {
            continue;
        }
        const families: Map<string, string[]> = new Map();
        for (const n of names) {
            // re.split(r"[:_-]", n, maxsplit=1)[0]
            const stem = n.split(/[:_-]/, 1)[0] as string;
            if (!families.has(stem)) {
                families.set(stem, []);
            }
            (families.get(stem) as string[]).push(n);
        }
        for (const [stem, group] of families) {
            if (group.length >= 4) {
                stats.overlap_notes.push(
                    `${cls} family '${stem}' has ${group.length} members: ${[...group].sort().join(', ')}`,
                );
            }
        }
    }
}

/** `sorted(CORE_SRC.glob(pattern))` for the fixed frontmatter-audit globs. */
function _globPattern(pattern: string): string[] {
    // Patterns: "skills/*/SKILL.md", "rules/*.md", "commands/**/*.md",
    // "personas/**/*.md".
    const parts = pattern.split('/');
    const out: string[] = [];
    if (pattern === 'skills/*/SKILL.md') {
        const base = path.join(CORE_SRC, 'skills');
        for (const child of _iterdirSorted(base)) {
            if (_isDir(child)) {
                const sm = path.join(child, 'SKILL.md');
                if (_isFile(sm)) {
                    out.push(sm);
                }
            }
        }
    } else if (pattern === 'rules/*.md') {
        const base = path.join(CORE_SRC, 'rules');
        let names: string[];
        try {
            names = fs.readdirSync(base);
        } catch {
            names = [];
        }
        for (const n of names) {
            if (n.endsWith('.md')) {
                out.push(path.join(base, n));
            }
        }
    } else if (parts.length >= 2 && parts[1] === '**') {
        // "<cat>/**/*.md" → recursive *.md under CORE_SRC/<cat>.
        const base = path.join(CORE_SRC, parts[0] as string);
        if (_isDir(base)) {
            out.push(..._rglobMd(base));
        }
    }
    out.sort();
    return out;
}

export function frontmatter_audit(stats: Stats): void {
    const classes: Array<[string, string[]]> = [
        ['skill', _globPattern('skills/*/SKILL.md')],
        ['rule', _globPattern('rules/*.md')],
        ['command', _globPattern('commands/**/*.md')],
        ['persona', _globPattern('personas/**/*.md')],
    ];
    for (const [cls, paths] of classes) {
        const field_values: Map<string, string[]> = new Map();
        for (const p of paths) {
            const base = path.basename(p);
            if (base.startsWith('_') || base.toUpperCase() === 'README.MD') {
                continue;
            }
            const fm = parse_frontmatter(p);
            for (const [k, v] of Object.entries(fm)) {
                if (!field_values.has(k)) {
                    field_values.set(k, []);
                }
                (field_values.get(k) as string[]).push(v);
            }
        }
        for (const [fkey, values] of field_values) {
            const [dominant_value, dominant_count] = _counterMostCommon(values);
            const total = values.length;
            const distinct = new Set(values).size;
            const share = total ? dominant_count / total : 0;
            const bloat = share > 0.95 && total >= 10;
            const dv = pyLen(dominant_value) > 60 ? slice60(dominant_value) + '…' : dominant_value;
            stats.fm_rows.push({
                field: fkey,
                cls,
                total,
                distinct,
                dominant_value: dv,
                dominant_share: share,
                bloat_candidate: bloat,
            });
        }
    }
}

/** dominant_value[:60] — first 60 code points. */
function slice60(s: string): string {
    let out = '';
    let n = 0;
    for (const ch of s) {
        if (n >= 60) {
            break;
        }
        out += ch;
        n++;
    }
    return out;
}

/**
 * Mirror Counter(values).most_common(1)[0]. CPython's `most_common` is a stable
 * sort by count descending; ties keep first-insertion order. Reproduce that:
 * count via a Map (insertion-ordered), then pick the max-count entry, ties → the
 * earliest-inserted.
 */
function _counterMostCommon(values: string[]): [string, number] {
    const counts: Map<string, number> = new Map();
    for (const v of values) {
        counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    let bestKey = '';
    let bestCount = -1;
    for (const [k, c] of counts) {
        if (c > bestCount) {
            bestCount = c;
            bestKey = k;
        }
    }
    return [bestKey, bestCount];
}

// --- CSV writer (mirror csv.writer: \r\n terminator, QUOTE_MINIMAL) ----------

function _csvField(field: string): string {
    // QUOTE_MINIMAL: quote when the field contains the delimiter (,), the
    // quotechar ("), \r, or \n. Doubled quotes escape an embedded quote.
    if (/[",\r\n]/.test(field)) {
        return '"' + field.replace(/"/g, '""') + '"';
    }
    return field;
}

export function write_csv(p: string, header: string[], rows: string[][]): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const lines: string[] = [];
    lines.push(header.map(_csvField).join(','));
    for (const row of rows) {
        lines.push(row.map(_csvField).join(','));
    }
    // csv.writer default lineterminator is "\r\n"; each writerow appends it.
    fs.writeFileSync(p, lines.map((l) => l + '\r\n').join(''), 'utf-8');
}

// --- Markdown report ---------------------------------------------------------

/** Mirror Python `f"{x:.0%}"` / `f"{x:.2%}"` — round-half-even ×100. */
function _pctFormat(x: number, decimals: number): string {
    const pct = pyRound(x * 100, decimals);
    return `${pct.toFixed(decimals)}%`;
}
/** `f"{x:.0%}"`. */
function _pct0(x: number): string {
    return `${pyRound(x * 100, 0).toFixed(0)}%`;
}

/** Mirror Python round() — round-half-to-even. */
function pyRound(x: number, ndigits: number): number {
    const factor = 10 ** ndigits;
    const scaled = x * factor;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let r: number;
    if (diff > 0.5) {
        r = floor + 1;
    } else if (diff < 0.5) {
        r = floor;
    } else {
        r = floor % 2 === 0 ? floor : floor + 1;
    }
    return r / factor;
}

function _todayUTC(): string {
    return new Date().toISOString().slice(0, 10);
}

export function write_markdown(p: string, stats: Stats): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const bloat_rows = stats.rows.filter((r) => r.bloat_candidate);
    const bloat_fm = stats.fm_rows.filter((r) => r.bloat_candidate);
    const by_class = _counter(stats.rows.map((r) => r.cls));
    const bloat_by_class = _counter(bloat_rows.map((r) => r.cls));

    const lines: string[] = [];
    lines.push('# Abstraction-Budget Inventory\n');
    lines.push(
        '> Read-only discovery output for ' +
            '`agents/roadmaps/road-to-abstraction-budget-discovery.md`. ' +
            'Counts are grep-backed via the inventory script ' +
            '`scripts/inventory_abstraction_budget.py`. ' +
            '`bloat_candidate = Y` means usage-count threshold not met ' +
            '(typically zero external references) OR purpose overlap.\n',
    );
    lines.push(`_Generated: ${_todayUTC()}_\n`);

    lines.push('\n## Summary\n');
    lines.push('| Class | Total | Bloat candidates |\n|---|---:|---:|');
    for (const cls of [...by_class.keys()].sort()) {
        lines.push(`| ${cls} | ${by_class.get(cls)} | ${bloat_by_class.get(cls) ?? 0} |`);
    }
    lines.push('');

    lines.push('\n## Phase 2 gate signals\n');
    const zero_usage = stats.rows.filter((r) => r.ref_count === 0);
    lines.push(`- **Abstractions with usage_count == 0:** ${zero_usage.length}`);
    lines.push(`- **Frontmatter fields >95% boilerplate:** ${bloat_fm.length}`);
    lines.push(`- **Overlap notes surfaced:** ${stats.overlap_notes.length}`);
    lines.push('');
    if (zero_usage.length > 0) {
        lines.push('Zero-usage list:\n');
        for (const r of zero_usage) {
            lines.push(`- \`${r.cls}/${r.name}\` (last modified ${r.last_modified})`);
        }
        lines.push('');
    }
    if (bloat_fm.length > 0) {
        lines.push('\nFrontmatter boilerplate candidates:\n');
        for (const r of bloat_fm) {
            lines.push(
                `- \`${r.cls}.${r.field}\` — dominant \`${r.dominant_value}\` ` +
                    `in ${_pct0(r.dominant_share)} of ${r.total} artefacts`,
            );
        }
        lines.push('');
    }
    if (stats.overlap_notes.length > 0) {
        lines.push('\nOverlap notes:\n');
        for (const note of stats.overlap_notes) {
            lines.push(`- ${note}`);
        }
        lines.push('');
    }

    lines.push('\n## Full inventory\n');
    lines.push('| Class | Name | Refs | Last modified | Bloat? | Notes |');
    lines.push('|---|---|---:|---|:---:|---|');
    for (const r of _sortRows(stats.rows)) {
        lines.push(
            `| ${r.cls} | \`${r.name}\` | ${r.ref_count} | ` +
                `${r.last_modified} | ${r.bloat_candidate ? 'Y' : 'N'} | ${r.notes} |`,
        );
    }

    lines.push('\n## Frontmatter field audit\n');
    lines.push('| Class | Field | Total | Distinct | Dominant value | Share | Bloat? |');
    lines.push('|---|---|---:|---:|---|---:|:---:|');
    for (const r of _sortFm(stats.fm_rows)) {
        lines.push(
            `| ${r.cls} | \`${r.field}\` | ${r.total} | ${r.distinct} | ` +
                `\`${r.dominant_value}\` | ${_pct0(r.dominant_share)} | ` +
                `${r.bloat_candidate ? 'Y' : 'N'} |`,
        );
    }

    fs.writeFileSync(p, lines.join('\n') + '\n', 'utf-8');
}

/** Counter() preserving first-seen order over the keys. */
function _counter(items: string[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const it of items) {
        m.set(it, (m.get(it) ?? 0) + 1);
    }
    return m;
}

/** sorted(rows, key=lambda x: (x.cls, x.name)) — stable string tuple sort. */
function _sortRows(rows: InventoryRow[]): InventoryRow[] {
    return [...rows].sort((a, b) => {
        if (a.cls !== b.cls) {
            return a.cls < b.cls ? -1 : 1;
        }
        if (a.name !== b.name) {
            return a.name < b.name ? -1 : 1;
        }
        return 0;
    });
}

/** sorted(fm_rows, key=lambda x: (x.cls, -x.dominant_share)) — stable. */
function _sortFm(rows: FrontmatterAudit[]): FrontmatterAudit[] {
    return rows
        .map((v, i) => [v, i] as [FrontmatterAudit, number])
        .sort((x, y) => {
            const a = x[0];
            const b = y[0];
            if (a.cls !== b.cls) {
                return a.cls < b.cls ? -1 : 1;
            }
            const d = -a.dominant_share - -b.dominant_share;
            if (d !== 0) {
                return d;
            }
            return x[1] - y[1];
        })
        .map(([v]) => v);
}

interface Args {
    quiet: boolean;
}

export function parse_args(argv: string[]): Args {
    const args: Args = { quiet: false };
    for (const a of argv) {
        if (a === '--quiet') {
            args.quiet = true;
        } else {
            process.stderr.write(`unrecognized arguments: ${a}\n`);
            process.exit(2);
        }
    }
    return args;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    if (args.quiet) {
        // os.environ.setdefault("AGENT_SCRIPT_VERBOSITY", "silent")
        if (process.env['AGENT_SCRIPT_VERBOSITY'] === undefined) {
            process.env['AGENT_SCRIPT_VERBOSITY'] = 'silent';
        }
    }

    _log('info', '[inventory] scanning packs…');
    const stats = newStats();
    inventory_packs(stats);
    _log('info', '[inventory] scanning roles…');
    inventory_roles(stats);
    _log('info', '[inventory] scanning directives…');
    inventory_directives(stats);
    _log('info', '[inventory] scanning council members…');
    inventory_council_members(stats);
    _log('info', '[inventory] scanning trust levels…');
    inventory_trust_levels(stats);
    _log('info', '[inventory] scanning flows…');
    inventory_flows(stats);
    _log('info', '[inventory] scanning skills…');
    inventory_artefacts(stats, { subdir: 'skills', cls: 'skill' });
    _log('info', '[inventory] scanning rules…');
    inventory_artefacts(stats, { subdir: 'rules', cls: 'rule' });
    _log('info', '[inventory] scanning commands…');
    inventory_artefacts(stats, { subdir: 'commands', cls: 'command' });
    _log('info', '[inventory] scanning personas…');
    inventory_artefacts(stats, { subdir: 'personas', cls: 'persona' });
    _log('info', '[inventory] overlap audit…');
    overlap_audit(stats);
    _log('info', '[inventory] frontmatter audit…');
    frontmatter_audit(stats);

    const out_md = path.join(EVIDENCE_DIR, 'abstraction-budget-inventory.md');
    const out_csv = path.join(EVIDENCE_DIR, 'abstraction-budget-inventory.csv');
    const out_fm_csv = path.join(EVIDENCE_DIR, 'abstraction-budget-frontmatter.csv');

    write_markdown(out_md, stats);
    write_csv(
        out_csv,
        ['class', 'name', 'ref_count', 'last_modified', 'bloat_candidate', 'notes'],
        _sortRows(stats.rows).map(rowToRow),
    );
    write_csv(
        out_fm_csv,
        ['class', 'field', 'total', 'distinct', 'dominant_value', 'dominant_share', 'bloat_candidate'],
        _sortFm(stats.fm_rows).map(fmToRow),
    );

    _log('success', `[inventory] wrote ${_relPosix(out_md, REPO_ROOT)}`);
    _log('success', `[inventory] wrote ${_relPosix(out_csv, REPO_ROOT)}`);
    _log('success', `[inventory] wrote ${_relPosix(out_fm_csv, REPO_ROOT)}`);
    script_output.flush_summary('[inventory] inventory written');
    return 0;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    process.exitCode = main();
}
