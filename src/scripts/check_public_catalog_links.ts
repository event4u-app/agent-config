#!/usr/bin/env tsx
/**
 * Public-catalog link checker (regression guard for road-to-pr-34-followups 1.1).
 *
 * TypeScript twin of `src/scripts/check_public_catalog_links.py` (ADR-200,
 * Phase 4 / Wave 4c). CLI contract mirrored EXACTLY — `--quiet` flag,
 * exit codes (0 clean, 1 violations / missing catalog), byte-identical
 * messages, stdout-only output, same link regex / resolution / truncation
 * (first 10 per bucket).
 *
 * `docs/catalog.md` is the consumer-facing catalog. Consumers receive the
 * package via npm / Composer / archive surfaces — `.agent-src.uncondensed/`
 * is NOT shipped (see `package.json#files`). Every link in the public
 * catalog must therefore resolve to a shipped surface.
 *
 * Checks:
 *   1. No link href contains `.agent-src.uncondensed/`.
 *   2. Every link href resolves on disk.
 *   3. Every link href starts with a path declared in `package.json#files`
 *      (or one of the always-shipped root files).
 *
 * Exit codes: 0 = clean, 1 = violations found.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const QUIET = process.argv.slice(2).includes('--quiet');

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CATALOG = path.join(ROOT, 'docs', 'catalog.md');
const PACKAGE_JSON = path.join(ROOT, 'package.json');

// Python: re.compile(r"\]\((?P<href>[^)\s]+)(?:\s+\"[^\"]*\")?\)")
const LINK_RE = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const FORBIDDEN_PREFIX = '.agent-src.uncondensed/';

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** Return [shipped_dirs, shipped_files] from package.json#files. */
function _shipped_roots(): [Set<string>, Set<string>] {
    const data = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8')) as Record<string, unknown>;
    const dirs = new Set<string>();
    const files = new Set<string>();
    const entries = Array.isArray(data['files']) ? (data['files'] as unknown[]) : [];
    for (const entry of entries) {
        const e = String(entry);
        if (e.endsWith('/')) {
            dirs.add(e.replace(/\/+$/, ''));
        } else {
            files.add(e);
        }
    }
    return [dirs, files];
}

/** Resolve an href to a repo-relative POSIX path, or null (external/out-of-root). */
function _resolve(hrefIn: string): string | null {
    const href = hrefIn.split('#', 1)[0]!;
    if (!href || /^(http:\/\/|https:\/\/|mailto:|tel:)/.test(href)) {
        return null;
    }
    const target = path.resolve(path.dirname(CATALOG), href);
    const rootResolved = path.resolve(ROOT);
    const rel = path.relative(rootResolved, target);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        return null;
    }
    return rel.split(path.sep).join('/');
}

function _under_shipped_surface(rel: string, dirs: Set<string>, files: Set<string>): boolean {
    if (files.has(rel)) {
        return true;
    }
    for (const d of dirs) {
        if (rel === d || rel.startsWith(d + '/')) {
            return true;
        }
    }
    return false;
}

/** Mirror Python `str.splitlines()`. */
function _splitlines(text: string): string[] {
    if (text === '') return [];
    const parts = text.split(/\r\n|\r|\n/);
    if (parts.length > 0 && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

function _relToPosix(child: string, root: string): string {
    return path.relative(root, child).split(path.sep).join('/');
}

function main(): number {
    if (!_exists(CATALOG)) {
        process.stdout.write(`❌  ${_relToPosix(CATALOG, ROOT)} not found\n`);
        return 1;
    }

    const [dirs, files] = _shipped_roots();
    const text = fs.readFileSync(CATALOG, 'utf-8');

    const forbidden: Array<[number, string]> = [];
    const missing: Array<[number, string]> = [];
    const unshipped: Array<[number, string]> = [];

    const lines = _splitlines(text);
    for (let i = 0; i < lines.length; i++) {
        const lineno = i + 1;
        const line = lines[i]!;
        LINK_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = LINK_RE.exec(line)) !== null) {
            const href = m[1]!;
            if (href.includes(FORBIDDEN_PREFIX)) {
                forbidden.push([lineno, href]);
                continue;
            }
            const rel = _resolve(href);
            if (rel === null) {
                continue; // external / non-resolvable
            }
            if (!_exists(path.join(ROOT, rel))) {
                missing.push([lineno, href]);
                continue;
            }
            if (!_under_shipped_surface(rel, dirs, files)) {
                unshipped.push([lineno, href]);
            }
        }
    }

    const total_violations = forbidden.length + missing.length + unshipped.length;
    if (total_violations === 0) {
        if (!QUIET) {
            process.stdout.write('✅  docs/catalog.md — all links resolve to shipped surfaces.\n');
        }
        return 0;
    }

    process.stdout.write(`❌  docs/catalog.md — ${total_violations} violation(s):\n`);
    if (forbidden.length > 0) {
        process.stdout.write(
            `\n  ${forbidden.length} link(s) point at unshipped \`.agent-src.uncondensed/\`:\n`,
        );
        for (const [ln, href] of forbidden.slice(0, 10)) {
            process.stdout.write(`    line ${ln}: ${href}\n`);
        }
        if (forbidden.length > 10) {
            process.stdout.write(`    … and ${forbidden.length - 10} more\n`);
        }
    }
    if (missing.length > 0) {
        process.stdout.write(`\n  ${missing.length} link(s) do not resolve on disk:\n`);
        for (const [ln, href] of missing.slice(0, 10)) {
            process.stdout.write(`    line ${ln}: ${href}\n`);
        }
    }
    if (unshipped.length > 0) {
        process.stdout.write(
            `\n  ${unshipped.length} link(s) point outside \`package.json#files\`:\n`,
        );
        for (const [ln, href] of unshipped.slice(0, 10)) {
            process.stdout.write(`    line ${ln}: ${href}\n`);
        }
    }
    process.stdout.write(
        '\nFix: update `scripts/generate_index.py` _to_shipped_path() / catalog renderer,\n',
    );
    process.stdout.write('then re-run `./scripts-run src/scripts/generate_index`.\n');
    return 1;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    ROOT,
    CATALOG,
    PACKAGE_JSON,
    LINK_RE,
    FORBIDDEN_PREFIX,
    _shipped_roots,
    _resolve,
    _under_shipped_surface,
    main,
};
