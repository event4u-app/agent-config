#!/usr/bin/env tsx
/**
 * Versioned-cache lint (road-to-retrieval-substrate-hardening B5b).
 *
 * Every derived cache the suite writes MUST be safe to invalidate when its
 * producer changes — otherwise a tool-version bump silently reads a
 * stale-format cache and corrupts the read path. This lint makes that
 * discipline structural: any cache-file path literal in `src/scripts/**`
 * must EITHER carry a version namespace in the path (`v<N>`, a `${…version…}`
 * interpolation, or a `_VERSION`/`schema_version` reference), OR carry an
 * explicit invalidation justification comment (`cache-version:` /
 * `cache-invalidation:`) within a few lines — an author's ack that the cache
 * is invalidated by another mechanism (full overwrite, content hash, …).
 *
 * It is a FAILING gate (this roadmap introduces it), scoped tightly to
 * cache-file SUFFIXES so it has near-zero false-positive surface: it fires on
 * the derived caches later phases create (B2 index, B3 learning sidecar, B5a
 * stat-index), not on directories or ordinary data files.
 *
 * road-to-reachable-code-memory Phase 6: also covers `.sqlite3` / `.db` path
 * literals — every derived SQLite store this suite writes (telemetry, the
 * memory FTS index, the graph store) is exactly the "invalidate me on a
 * format change" cache this lint exists to catch, and none of them carry a
 * `-index`/`-cache` infix the original `.json`-only pattern required.
 *
 * Usage: lint_versioned_cache.ts [--dir <root>] [--format text|json] [--quiet]
 * Exit codes: 0 = clean, 1 = usage error, 2 = violations found, 3 = internal.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const PROG = 'lint_versioned_cache.ts';

/** Window (lines) around a cache-path literal scanned for a justification. */
export const JUSTIFY_WINDOW = 6;

/**
 * A path literal is a "derived cache file" when its basename matches one of
 * these suffixes. Suffix-based (not dir-based) to keep the trigger precise —
 * ordinary data/config JSON does not match.
 */
export const CACHE_SUFFIX_RE =
    /(?:^|[\/'"`\-.])(?:[a-z0-9_\-.]*)(?:(?:-index|\.index|-cache|\.cache|\.stat-index|-stat-index|\.agent-learning)\.json|\.sqlite3|\.db)(?:['"`]|$)/i;

/** A version namespace present in the path literal itself. */
const VERSION_IN_PATH_RE = /(?:[\/_\-.]v\d+|\$\{[^}]*[Vv]ersion[^}]*\}|\$\{[^}]*VERSION[^}]*\})/;

/** An explicit author justification comment near the literal. */
const JUSTIFY_RE = /(?:cache-version:|cache-invalidation:)/i;

/** A string / template literal containing a cache-file path. */
const LITERAL_RE = /(['"`])((?:\\.|(?!\1).)*?)\1/g;

export interface Violation {
    file: string;
    line: number; // 1-indexed
    literal: string;
    message: string;
}

function listTsFiles(root: string): string[] {
    const out: string[] = [];
    const skip = new Set([
        'node_modules',
        '.git',
        'dist',
        'coverage',
        '.turbo',
        '.cache',
        '__pycache__',
    ]);
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            if (e.isDirectory()) {
                if (!skip.has(e.name)) walk(path.join(dir, e.name));
            } else if (e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) {
                out.push(path.join(dir, e.name));
            }
        }
    };
    walk(root);
    return out.sort();
}

function _isCachePathLiteral(value: string): boolean {
    // Reset lastIndex — CACHE_SUFFIX_RE has no /g flag, so test() is safe.
    return CACHE_SUFFIX_RE.test(value);
}

export function scanFile(file: string, source: string): Violation[] {
    const lines = source.split('\n');
    const violations: Violation[] = [];
    for (let i = 0; i < lines.length; i++) {
        const text = lines[i] as string;
        LITERAL_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = LITERAL_RE.exec(text)) !== null) {
            const value = m[2] as string;
            if (!_isCachePathLiteral(value)) continue;
            if (VERSION_IN_PATH_RE.test(value)) continue; // versioned in the path itself

            // Look for a justification comment in the window around the literal.
            const from = Math.max(0, i - JUSTIFY_WINDOW);
            const to = Math.min(lines.length - 1, i + JUSTIFY_WINDOW);
            let justified = false;
            for (let j = from; j <= to; j++) {
                if (JUSTIFY_RE.test(lines[j] as string)) {
                    justified = true;
                    break;
                }
            }
            if (justified) continue;

            violations.push({
                file,
                line: i + 1,
                literal: value,
                message:
                    'derived cache without a version namespace — add a `v<N>` (or ' +
                    '`${…version…}`) segment to the path, or an inline ' +
                    '`// cache-invalidation: <why no version is needed>` comment',
            });
        }
    }
    return violations;
}

export function runChecks(root: string): Violation[] {
    const violations: Violation[] = [];
    const files = listTsFiles(root);
    // The unit is every `.ts` walked — `.ts` defines this gate's corpus, while
    // the cache-suffix match is the finding. Asserting on matches would read
    // green for a moved `--dir` exactly as it does for a clean tree.
    assertScanned({
        gate: 'lint_versioned_cache',
        scanned: files.length,
        units: 'TypeScript file(s)',
        roots: [root],
    });
    for (const file of files) {
        // Never lint this file itself — its regexes contain the very suffixes
        // it hunts for.
        if (path.basename(file) === 'lint_versioned_cache.ts') continue;
        let source: string;
        try {
            source = fs.readFileSync(file, 'utf-8');
        } catch {
            continue;
        }
        violations.push(...scanFile(file, source));
    }
    return violations;
}

export function main(argv: string[]): number {
    let dir = 'src/scripts';
    let format: 'text' | 'json' = 'text';
    let quiet = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--dir') {
            dir = argv[++i] ?? dir;
        } else if (a.startsWith('--dir=')) {
            dir = a.slice('--dir='.length);
        } else if (a === '--format') {
            format = (argv[++i] as 'text' | 'json') ?? 'text';
        } else if (a === '--quiet') {
            quiet = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(`usage: ${PROG} [--dir <root>] [--format text|json] [--quiet]\n`);
            return 0;
        } else {
            process.stderr.write(`${PROG}: error: unknown argument ${a}\n`);
            return 1;
        }
    }

    let violations: Violation[];
    try {
        violations = runChecks(path.resolve(dir));
    } catch (exc) {
        // 3 (internal) over 2 (violations found): a dead `--dir` means the
        // gate could not run, not that it found an unversioned cache.
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`${PROG}: ${exc.message}\n`);
            return 3;
        }
        process.stderr.write(`${PROG}: internal error: ${String(exc)}\n`);
        return 3;
    }

    if (format === 'json') {
        process.stdout.write(JSON.stringify({ violations }, null, 2) + '\n');
        return violations.length > 0 ? 2 : 0;
    }
    if (violations.length === 0) {
        if (!quiet) process.stdout.write(`${PROG}: no unversioned derived caches\n`);
        return 0;
    }
    for (const v of violations) {
        process.stdout.write(`❌ ${v.file}:${v.line} — cache '${v.literal}': ${v.message}\n`);
    }
    process.stdout.write(`${PROG}: ${violations.length} unversioned derived cache(s)\n`);
    return 2;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main(process.argv.slice(2)));
}
