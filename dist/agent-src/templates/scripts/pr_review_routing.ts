#!/usr/bin/env node
/**
 * PR review-routing classifier.
 *
 * TypeScript twin of `src/agent-src/templates/scripts/pr_review_routing.py`
 * (ADR-200). Byte-for-byte behavioural parity: same CLI flags, same
 * glob→regex translation, same ownership / pattern matching, same role
 * merge + sort order, same Markdown routing block, same severity level,
 * same exit codes, same stdout/stderr split.
 *
 * Reads changed files between two git refs, resolves reviewer roles from
 * `ownership-map.yml`, and matches the diff against
 * `historical-bug-patterns.yml`. Emits a Markdown routing block plus a
 * single-word severity level (low / medium / high) for downstream CI steps.
 *
 * This classifier is **informational** — it surfaces who should review and
 * what regression tests historical patterns demand. It is not a merge gate.
 *
 * If --ownership-map / --patterns are omitted, the script searches
 * `.github/` first and falls back to `agents/`.
 * Missing data files are not an error; the script emits a generic
 * fallback block.
 *
 * Exit codes: 0 = success, 2 = invalid arguments, 3 = git/config error.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import * as path from 'node:path';

// Mirrors Python's top-level `import yaml` (with its ImportError → exit 3
// fallback). `yaml` is a hard dependency; version '1.1' matches PyYAML's
// safe_load tolerance, including date scalars parsed to a Date. Resolved
// relative to THIS module (not cwd) because the script runs `git diff` in the
// caller's cwd, which may carry its own (possibly invalid) package.json.
const YAML = createRequire(import.meta.url)('yaml') as typeof import('yaml');

export const LEVELS = ['high', 'medium', 'low'] as const;
export const STALE_MONTHS = 6;

type Dict = Record<string, unknown>;

export interface OwnershipHit {
    path: string;
    roles: string[];
    focus: string | null;
    risk: string | null;
}

export interface PatternHit {
    id: string;
    label: string;
    severity: string;
    required_test: string;
    references: string[];
    matched_files: string[];
}

const _compileCache = new Map<string, RegExp>();

/** Translate a gitignore-ish glob to a regex (same semantics as pr_risk_review.py). */
export function _compile(pattern: string): RegExp {
    const cached = _compileCache.get(pattern);
    if (cached !== undefined) {
        return cached;
    }
    const out: string[] = [];
    let i = 0;
    const n = pattern.length;
    const special = '.^$+{}()[]|\\';
    while (i < n) {
        const c = pattern[i] as string;
        if (c === '*') {
            if (i + 1 < n && pattern[i + 1] === '*') {
                if (i + 2 < n && pattern[i + 2] === '/') {
                    out.push('(?:.*/)?');
                    i += 3;
                    continue;
                }
                if (i > 0 && pattern[i - 1] === '/') {
                    out[out.length - 1] = '(?:/.*)?';
                    i += 2;
                    continue;
                }
                out.push('.*');
                i += 2;
                continue;
            }
            out.push('[^/]*');
        } else if (c === '?') {
            out.push('[^/]');
        } else if (special.includes(c)) {
            out.push(`\\${c}`);
        } else {
            out.push(c);
        }
        i += 1;
    }
    const re = new RegExp(`^${out.join('')}$`, 'su');
    if (_compileCache.size < 512) {
        _compileCache.set(pattern, re);
    }
    return re;
}

function _match(p: string, pattern: string): boolean {
    return _compile(pattern).test(p);
}

class ExitError extends Error {
    constructor(public code: number) {
        super(`__exit__${code}`);
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

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _isPlainObject(v: unknown): v is Dict {
    return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

function _asList(v: unknown): unknown[] {
    return Array.isArray(v) ? v : [];
}

function _yamlErr(exc: unknown): string {
    return exc instanceof Error ? exc.message : String(exc);
}

export function _load_yaml(p: string | null): Dict | null {
    if (p === null || !_exists(p)) {
        return null;
    }
    let data: unknown;
    try {
        data = YAML.parse(fs.readFileSync(p, 'utf-8'), { version: '1.1' });
    } catch (exc) {
        process.stderr.write(`error: ${p} parse failed: ${_yamlErr(exc)}\n`);
        throw new ExitError(3);
    }
    const obj: Dict = _isPlainObject(data) ? data : {};
    if (obj['version'] !== 1) {
        process.stderr.write(`error: ${p} missing or unsupported 'version: 1'\n`);
        throw new ExitError(3);
    }
    return obj;
}

export function changed_files(base: string, head: string): string[] {
    const res = spawnSync('git', ['diff', '--name-only', `${base}...${head}`], {
        encoding: 'utf-8',
    });
    if (res.status !== 0) {
        process.stderr.write(`error: git diff failed: ${res.stderr ?? ''}\n`);
        throw new ExitError(3);
    }
    return (res.stdout ?? '').split('\n').filter((line) => line.trim() !== '');
}

/** Return per-file hits, fallback roles, and a stale flag. */
export function match_ownership(
    files: string[],
    cfg: Dict | null,
): [OwnershipHit[], string[], boolean] {
    if (!cfg) {
        return [[], [], false];
    }

    const entries = _asList(cfg['entries']);
    const defaultsObj = _isPlainObject(cfg['defaults']) ? cfg['defaults'] : {};
    const defaults = (_asList(defaultsObj['roles'])).map((r) => r as string);

    const hits: OwnershipHit[] = [];
    for (const p of files) {
        for (const entryRaw of entries) {
            const entry = _isPlainObject(entryRaw) ? entryRaw : {};
            const globs = _asList(entry['paths']);
            if (globs.some((g) => _match(p, g as string))) {
                hits.push({
                    path: p,
                    roles: _asList(entry['roles']).map((r) => r as string),
                    focus: (entry['focus'] === undefined ? null : (entry['focus'] as string | null)),
                    risk: (entry['risk'] === undefined ? null : (entry['risk'] as string | null)),
                });
                break;
            }
        }
    }

    let stale = false;
    const updated = cfg['updated'];
    if (updated instanceof Date) {
        // PyYAML parses a bare `YYYY-MM-DD` to date and `…THH:MM:SS` to
        // datetime; both reduce to a Y/M comparison here. `yaml` v1.1 returns
        // a JS Date for both; we compare in UTC to match PyYAML's naive date.
        const now = new Date();
        const months =
            (now.getFullYear() - updated.getUTCFullYear()) * 12 +
            (now.getMonth() - updated.getUTCMonth());
        stale = months >= STALE_MONTHS;
    }

    return [hits, defaults, stale];
}

export function match_patterns(files: string[], cfg: Dict | null): PatternHit[] {
    if (!cfg) {
        return [];
    }
    const result: PatternHit[] = [];
    for (const patternRaw of _asList(cfg['patterns'])) {
        const pattern = _isPlainObject(patternRaw) ? patternRaw : {};
        const globs = _asList(pattern['paths']);
        const matched = files.filter((f) => globs.some((g) => _match(f, g as string)));
        if (matched.length === 0) {
            continue;
        }
        const id = _pyStr(pattern['id'] ?? 'unknown');
        result.push({
            id,
            label: _pyStr(pattern['label'] ?? pattern['id'] ?? 'unknown'),
            severity: _pyStr(pattern['severity'] ?? 'medium'),
            required_test: _pyStr(pattern['required_test'] ?? ''),
            references: _asList(pattern['references']).map((r) => r as string),
            matched_files: matched,
        });
    }
    return result;
}

/** Mirror Python `str(x)` for the scalar shapes that appear in a YAML config. */
function _pyStr(v: unknown): string {
    if (typeof v === 'string') {
        return v;
    }
    if (v === null || v === undefined) {
        return 'None';
    }
    if (typeof v === 'boolean') {
        return v ? 'True' : 'False';
    }
    return String(v);
}

export function overall_level(patterns: PatternHit[]): string {
    if (patterns.some((p) => p.severity === 'high')) {
        return 'high';
    }
    if (patterns.some((p) => p.severity === 'medium')) {
        return 'medium';
    }
    return 'low';
}

/** Return [(role, focus_notes, files), …] ordered by hit count then name. */
export function _merge_roles(
    ownership: OwnershipHit[],
    fallback: string[],
): Array<[string, string[], string[]]> {
    // Insertion-ordered map mirroring Python dict ordering.
    const byRole = new Map<string, [Set<string>, Set<string>]>();
    for (const hit of ownership) {
        for (const role of hit.roles) {
            let pair = byRole.get(role);
            if (pair === undefined) {
                pair = [new Set<string>(), new Set<string>()];
                byRole.set(role, pair);
            }
            const [notes, files] = pair;
            if (hit.focus) {
                notes.add(hit.focus);
            }
            files.add(hit.path);
        }
    }
    if (byRole.size === 0 && fallback.length > 0) {
        for (const role of fallback) {
            if (!byRole.has(role)) {
                byRole.set(role, [new Set<string>(), new Set<string>()]);
            }
        }
    }
    // Python: sorted(items, key=lambda kv: (-len(files), name)) — stable sort,
    // and Python's sort is stable so ties keep insertion order. JS Array.sort
    // is stable in ES2019+; replicate the same comparator.
    const items = [...byRole.entries()];
    items.sort((a, b) => {
        const la = a[1][1].size;
        const lb = b[1][1].size;
        if (la !== lb) {
            return lb - la; // -len ascending == len descending
        }
        return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0);
    });
    return items.map(([role, [notes, files]]) => [
        role,
        _sortedStrs([...notes]),
        _sortedStrs([...files]),
    ]);
}

/** Python `sorted()` on a list of str — lexicographic by code unit. */
function _sortedStrs(arr: string[]): string[] {
    return [...arr].sort((a, b) => (a < b ? -1 : (a > b ? 1 : 0)));
}

export function render(
    level: string,
    ownership: OwnershipHit[],
    fallback: string[],
    stale: boolean,
    patterns: PatternHit[],
    total: number,
    have_ownership_file: boolean,
    have_patterns_file: boolean,
): string {
    const emojiMap: Record<string, string> = { high: '🔴', medium: '🟡', low: '🟢' };
    const emoji = emojiMap[level] as string;
    const lines: string[] = [
        `## ${emoji} Review Routing: **${level}**`,
        '',
        `_${total} changed file(s), ${patterns.length} historical pattern(s) matched._`,
        '',
    ];

    const roles = _merge_roles(ownership, fallback);
    lines.push('### Suggested reviewers (role-based)');
    if (roles.length === 0) {
        lines.push('- No ownership map and no fallback roles configured.');
        lines.push('  Fall back to generic reviewer selection per `reviewer-awareness`.');
    } else {
        const labels = ['primary', 'secondary'];
        for (let k = 1; k < 20; k += 1) {
            labels.push(`additional #${k}`);
        }
        const pairCount = Math.min(roles.length, labels.length);
        for (let idx = 0; idx < pairCount; idx += 1) {
            const [role, notes, files] = roles[idx] as [string, string[], string[]];
            const label = labels[idx] as string;
            const focus = notes.length > 0 ? notes.join(' / ') : 'anchored in diff';
            lines.push(`- **${label}**: \`${role}\` — focus: ${focus}`);
            if (files.length > 0) {
                const preview = files.slice(0, 3).map((f) => `\`${f}\``).join(', ');
                const suffix = files.length > 3 ? ` (+${files.length - 3} more)` : '';
                lines.push(`  - files: ${preview}${suffix}`);
            }
        }
    }
    lines.push('');

    if (patterns.length > 0) {
        lines.push('### Historical patterns matched');
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
        const sorted = [...patterns].sort(
            (a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9),
        );
        const bulletMap: Record<string, string> = { high: '🔴', medium: '🟡', low: '🟢' };
        for (const p of sorted) {
            const bullet = bulletMap[p.severity] ?? '•';
            lines.push(`- ${bullet} **${p.id}** — ${p.label}`);
            if (p.required_test) {
                lines.push(`  - required test: ${p.required_test}`);
            }
            for (const ref of p.references) {
                lines.push(`  - ref: ${ref}`);
            }
        }
        lines.push('');
    }

    if (stale) {
        lines.push(
            '> ⚠️ Ownership map last updated > 6 months ago — treat roles as hints.',
            '',
        );
    }

    const sourceBits: string[] = [];
    if (have_ownership_file) {
        sourceBits.push('ownership-map.yml');
    }
    if (have_patterns_file) {
        sourceBits.push('historical-bug-patterns.yml');
    }
    const source = sourceBits.length > 0
        ? sourceBits.join(' + ')
        : 'no project data — generic fallback';
    lines.push(`_Data source: ${source}. Routing is informational — merge is not blocked._`);

    return `${lines.join('\n')}\n`;
}

const OWNERSHIP_CANDIDATES = [
    '.github/ownership-map.yml',
    'agents/ownership-map.yml',
];
const PATTERN_CANDIDATES = [
    '.github/historical-bug-patterns.yml',
    'agents/historical-bug-patterns.yml',
];

function _first_existing(candidates: string[]): string | null {
    for (const p of candidates) {
        if (_isFile(p)) {
            return p;
        }
    }
    return null;
}

interface Args {
    base: string;
    head: string;
    ownershipMap: string | null;
    patterns: string | null;
    output: string;
    levelFile: string;
}

class ArgError extends Error {}

function _parseArgs(argv: string[]): Args {
    const a: Partial<Args> = { ownershipMap: null, patterns: null };
    for (let i = 0; i < argv.length; i += 1) {
        const tok = argv[i] as string;
        const next = (): string => {
            i += 1;
            return argv[i] as string;
        };
        const eq = (prefix: string): string => tok.slice(prefix.length);
        if (tok === '--base') a.base = next();
        else if (tok === '--head') a.head = next();
        else if (tok === '--ownership-map') a.ownershipMap = next();
        else if (tok === '--patterns') a.patterns = next();
        else if (tok === '--output') a.output = next();
        else if (tok === '--level-file') a.levelFile = next();
        else if (tok.startsWith('--base=')) a.base = eq('--base=');
        else if (tok.startsWith('--head=')) a.head = eq('--head=');
        else if (tok.startsWith('--ownership-map=')) a.ownershipMap = eq('--ownership-map=');
        else if (tok.startsWith('--patterns=')) a.patterns = eq('--patterns=');
        else if (tok.startsWith('--output=')) a.output = eq('--output=');
        else if (tok.startsWith('--level-file=')) a.levelFile = eq('--level-file=');
        else throw new ArgError(`unrecognized arguments: ${tok}`);
    }
    const missing: string[] = [];
    if (a.base === undefined) missing.push('--base');
    if (a.head === undefined) missing.push('--head');
    if (a.output === undefined) missing.push('--output');
    if (a.levelFile === undefined) missing.push('--level-file');
    if (missing.length > 0) {
        throw new ArgError(`the following arguments are required: ${missing.join(', ')}`);
    }
    return a as Args;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    let args: Args;
    try {
        args = _parseArgs(argv);
    } catch (exc) {
        if (exc instanceof ArgError) {
            process.stderr.write(`error: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    try {
        const ownership_path = args.ownershipMap ?? _first_existing(OWNERSHIP_CANDIDATES);
        const patterns_path = args.patterns ?? _first_existing(PATTERN_CANDIDATES);

        const ownership_cfg = _load_yaml(ownership_path);
        const patterns_cfg = _load_yaml(patterns_path);

        const files = changed_files(args.base, args.head);
        const [ownership_hits, fallback_roles, stale] = match_ownership(files, ownership_cfg);
        const pattern_hits = match_patterns(files, patterns_cfg);
        const level = overall_level(pattern_hits);

        fs.writeFileSync(
            args.output,
            render(
                level, ownership_hits, fallback_roles, stale, pattern_hits,
                files.length,
                ownership_cfg !== null,
                patterns_cfg !== null,
            ),
            { encoding: 'utf-8' },
        );
        fs.writeFileSync(args.levelFile, level, { encoding: 'utf-8' });
    } catch (exc) {
        if (exc instanceof ExitError) {
            return exc.code;
        }
        throw exc;
    }
    return 0;
}

const _invokedDirectly =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_invokedDirectly) {
    process.exitCode = main();
}
