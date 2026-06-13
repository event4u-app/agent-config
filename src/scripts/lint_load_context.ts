#!/usr/bin/env tsx
/**
 * Lint the `load_context:` / `load_context_eager:` frontmatter schema.
 *
 * TypeScript twin of `src/scripts/lint_load_context.py` (ADR-092,
 * Phase 4 / Wave 4b). The CLI contract is mirrored EXACTLY — `--quiet`
 * flag (positional `--quiet` detection in argv, like the Python
 * `"--quiet" in sys.argv`), exit codes (0 clean / warnings-only, 1 errors),
 * byte-identical error + warning + success messages, same scan dirs,
 * same rglob('*.md') iteration order, same cycle-detection traversal,
 * and the same char-budget accounting. No behaviour changes — latent
 * bugs replicated.
 *
 * Validates per docs/contracts/load-context-schema.md:
 *   - Paths exist and are .md
 *   - Allowed roots only (dist/agent-src contexts/, agents/settings/contexts/)
 *   - No public→project-local leak (warn)
 *   - No circular refs across lazy + eager edges
 *   - Combined char-budget for eager edges (rule + eager targets ≤ cap)
 *
 * Exits non-zero on error; warnings are reported but do not fail.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
// `"--quiet" in sys.argv` — argv is process.argv.slice(2) for parity with the
// Python module's `sys.argv` semantics (it does not strip flags positionally,
// so any `--quiet` anywhere triggers QUIET — including paths). We replicate the
// any-position membership test.
const QUIET = process.argv.slice(2).includes('--quiet');

// src/scripts/lint_load_context.ts → three dirs up is the repo root.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const SCAN_DIRS = [
    path.join(ROOT, '.agent-src.uncondensed', 'rules'),
    path.join(ROOT, '.agent-src.uncondensed', 'contexts'),
    path.join(ROOT, 'agents', 'contexts'),
];

const ALLOWED_PREFIXES = [
    'contexts/', // logical name (canonical)
    'dist/agent-src/contexts/', // projected (defensive)
    'agents/settings/contexts/', // project-local
] as const;

const LEGACY_PREFIX = '.agent-src.uncondensed/contexts/';

const SOURCE_ROOT = path.join(ROOT, '.agent-src.uncondensed');

const PUBLIC_RULE_PREFIX = '.agent-src.uncondensed/rules/';
const PROJECT_LOCAL_PREFIX = 'agents/settings/contexts/';

const HARD_FLOOR_RULES: ReadonlySet<string> = new Set([
    'non-destructive-by-default',
    'security-sensitive-stop',
]);

const CAP_ALWAYS = 2_500;
const CAP_AUTO = 4_000;
const CAP_SAFETY = 5_000;

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** Resolve a `load_context:` entry to an absolute path on disk. */
function resolve_entry(entry: string): string {
    if (entry.startsWith('contexts/')) {
        return path.join(SOURCE_ROOT, entry);
    }
    return path.join(ROOT, entry);
}

/** Parse YAML frontmatter; returns {} on any failure (mirrors Python). */
function parse_frontmatter(p: string): Record<string, unknown> {
    const text = fs.readFileSync(p, 'utf-8');
    if (!text.startsWith('---\n')) {
        return {};
    }
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) {
        return {};
    }
    let data: unknown;
    try {
        data = parseYaml(text.slice(4, end), { version: '1.1' });
    } catch {
        return {};
    }
    return data !== null && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};
}

/** Recursively yield `*.md` files under `dir`, mirroring Path.rglob('*.md'). */
function _rglobMd(dir: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                out.push(full);
            }
        }
    };
    walk(dir);
    return out;
}

function collect_files(): string[] {
    const out: string[] = [];
    for (const d of SCAN_DIRS) {
        if (_exists(d)) {
            out.push(..._rglobMd(d));
        }
    }
    return out;
}

/** POSIX relative path under ROOT (Path.relative_to(ROOT).as_posix()). */
function rel(p: string): string {
    return path.relative(ROOT, p).split(path.sep).join('/');
}

/** Strip ALL leading/trailing single+double quotes after a quote-type strip
 * chain, mirroring Python `.strip('"').strip("'")`. */
function _stripQuotes(value: string): string {
    return value.replace(/^"+/, '').replace(/"+$/, '').replace(/^'+/, '').replace(/'+$/, '');
}

function cap_for(rule_path: string, fm: Record<string, unknown>): number {
    const stem = path.basename(rule_path, '.md');
    if (HARD_FLOOR_RULES.has(stem)) {
        return CAP_SAFETY;
    }
    const rtypeRaw = fm['type'];
    const rtype = typeof rtypeRaw === 'string' ? _stripQuotes(rtypeRaw.trim()) : '';
    if (rtype === 'always') {
        return CAP_ALWAYS;
    }
    if (rtype === 'auto') {
        return CAP_AUTO;
    }
    return CAP_AUTO;
}

function find_cycles(graph: Record<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const stack: string[] = [];

    const dfs = (node: string): void => {
        if (visiting.has(node)) {
            const i = stack.indexOf(node);
            cycles.push([...stack.slice(i), node]);
            return;
        }
        if (visited.has(node)) {
            return;
        }
        visiting.add(node);
        stack.push(node);
        for (const nxt of graph[node] ?? []) {
            dfs(nxt);
        }
        stack.pop();
        visiting.delete(node);
        visited.add(node);
    };

    for (const n of Object.keys(graph)) {
        dfs(n);
    }
    return cycles;
}

/** Coerce a frontmatter value to a list-or-empty, mirroring `fm.get(k) or []`. */
function _asListOrEmpty(value: unknown): unknown[] | null {
    // Python `fm.get("load_context") or []`: falsy (None / empty list / missing)
    // → []. A non-list truthy value passes through (the `isinstance` check
    // below catches it). Returns null to signal "present but not a list".
    if (value === undefined || value === null) {
        return [];
    }
    if (Array.isArray(value)) {
        return value;
    }
    // Falsy non-list values (empty string, 0, false) → []; truthy non-list →
    // returned as a non-array marker for the isinstance check.
    if (value === '' || value === 0 || value === false) {
        return [];
    }
    return null; // present, truthy, not a list
}

function main(): number {
    const errors: string[] = [];
    const warnings: string[] = [];
    const graph: Record<string, string[]> = {};

    for (const f of collect_files()) {
        const fm = parse_frontmatter(f);
        const lazyRaw = fm['load_context'];
        const eagerRaw = fm['load_context_eager'];
        const lazy = _asListOrEmpty(lazyRaw);
        const eager = _asListOrEmpty(eagerRaw);
        // `if not (lazy or eager): continue` — both empty/falsy → skip.
        const lazyEmpty = lazy !== null && lazy.length === 0;
        const eagerEmpty = eager !== null && eager.length === 0;
        if (lazyEmpty && eagerEmpty) {
            continue;
        }
        if (lazy === null || eager === null) {
            errors.push(`${rel(f)}: load_context* must be a list`);
            continue;
        }

        const edges = [...lazy, ...eager];
        graph[rel(f)] = edges.map((e) => String(e));

        for (const entryRaw of edges) {
            const isStr = typeof entryRaw === 'string';
            if (!isStr || !(entryRaw as string).endsWith('.md')) {
                errors.push(`${rel(f)}: entry not str ending in .md → ${_pyReprValue(entryRaw)}`);
                continue;
            }
            const entry = entryRaw as string;
            if (entry.startsWith(LEGACY_PREFIX)) {
                const logical = entry.slice('.agent-src.uncondensed/'.length);
                errors.push(
                    `${rel(f)}: legacy \`.agent-src.uncondensed/\` prefix in load_context → ${entry} ` +
                        `— use logical name \`${logical}\` instead (road-to-path-fixes.md P5.3)`,
                );
                continue;
            }
            if (!ALLOWED_PREFIXES.some((pfx) => entry.startsWith(pfx))) {
                errors.push(`${rel(f)}: disallowed root → ${entry}`);
                continue;
            }
            const target = resolve_entry(entry);
            if (!_exists(target)) {
                errors.push(`${rel(f)}: target missing → ${entry}`);
                continue;
            }
            if (rel(f).startsWith(PUBLIC_RULE_PREFIX) && entry.startsWith(PROJECT_LOCAL_PREFIX)) {
                warnings.push(
                    `${rel(f)}: public rule references project-local context → ${entry}`,
                );
            }
        }

        if (eager.length) {
            const cap = cap_for(f, fm);
            let total = fs.readFileSync(f, 'utf-8').length;
            for (const entryRaw of eager) {
                const tgt = resolve_entry(String(entryRaw));
                if (_exists(tgt)) {
                    total += fs.readFileSync(tgt, 'utf-8').length;
                }
            }
            if (total > cap) {
                errors.push(`${rel(f)}: eager-load combined chars ${total} > cap ${cap}`);
            }
        }
    }

    for (const cycle of find_cycles(graph)) {
        errors.push('circular load_context: ' + cycle.join(' → '));
    }

    for (const w of warnings) {
        process.stdout.write(`⚠️  ${w}\n`);
    }
    for (const e of errors) {
        process.stdout.write(`❌  ${e}\n`);
    }
    if (errors.length) {
        return 1;
    }
    if (!QUIET) {
        process.stdout.write(
            `✅  load_context schema clean (${Object.keys(graph).length} declarer(s))\n`,
        );
    }
    return 0;
}

/** Mirror Python `repr()` for an arbitrary frontmatter value used in the
 * "entry not str ending in .md" error (`{entry!r}`). Strings use Python's
 * quote rules; other scalars fall back to a JSON-ish form (the corpus only
 * ever surfaces strings here, so non-string is a divergence candidate). */
function _pyReprValue(v: unknown): string {
    if (typeof v === 'string') {
        const hasSingle = v.includes("'");
        const hasDouble = v.includes('"');
        const quote = hasSingle && !hasDouble ? '"' : "'";
        let out = quote;
        for (const ch of v) {
            const code = ch.codePointAt(0)!;
            if (ch === '\\') {
                out += '\\\\';
            } else if (ch === quote) {
                out += '\\' + quote;
            } else if (ch === '\n') {
                out += '\\n';
            } else if (ch === '\r') {
                out += '\\r';
            } else if (ch === '\t') {
                out += '\\t';
            } else if (code < 0x20 || code === 0x7f) {
                out += '\\x' + code.toString(16).padStart(2, '0');
            } else {
                out += ch;
            }
        }
        return out + quote;
    }
    if (v === null || v === undefined) {
        return 'None';
    }
    if (v === true) {
        return 'True';
    }
    if (v === false) {
        return 'False';
    }
    return String(v);
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    ROOT,
    SCAN_DIRS,
    ALLOWED_PREFIXES,
    LEGACY_PREFIX,
    HARD_FLOOR_RULES,
    CAP_ALWAYS,
    CAP_AUTO,
    CAP_SAFETY,
    resolve_entry,
    parse_frontmatter,
    collect_files,
    cap_for,
    find_cycles,
    main,
};
