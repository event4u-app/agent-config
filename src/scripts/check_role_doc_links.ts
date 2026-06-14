#!/usr/bin/env tsx
/**
 * Verify every skill link in role-based docs resolves to a real file.
 *
 * TypeScript twin of `src/scripts/check_role_doc_links.py` (ADR-096,
 * Phase 4 / Wave 4c). Mirrors the Python CLI contract EXACTLY — `--quiet`
 * flag, exit codes (0 all resolve, 1 broken links, 2 missing role doc),
 * stdout/stderr split, byte-identical finding messages, same scan + link
 * regex + path resolution. No behaviour changes.
 *
 * Scans the role docs for markdown links and checks each non-external link
 * target exists on disk (resolved relative to the doc's own directory,
 * with `..` and symlinks normalized via realpath, mirroring Path.resolve()).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DOCS_DIR = path.join(ROOT, 'docs');

const ROLE_DOCS = [
    path.join(DOCS_DIR, 'getting-started-by-role.md'),
    path.join(DOCS_DIR, 'getting-started-laravel.md'),
];

// Markdown link: ](path). Only the (path) part. The Python regex is
// `\]\(([^)\s]+)\)` with re.finditer.
const LINK_RE = /\]\(([^)\s]+)\)/g;

// Anchors we know how to resolve (defined for parity; unused in scan/main,
// mirroring the Python module-level constant).
const ANCHORS: ReadonlyArray<[string, string]> = [
    ['../dist/agent-src/skills/', path.join(ROOT, 'dist/agent-src', 'skills')],
    ['../dist/agent-src/commands/', path.join(ROOT, 'dist/agent-src', 'commands')],
    ['../dist/agent-src/rules/', path.join(ROOT, 'dist/agent-src', 'rules')],
    ['../agents/', path.join(ROOT, 'agents')],
    ['contracts/', path.join(DOCS_DIR, 'contracts')],
    ['guidelines/', path.join(DOCS_DIR, 'guidelines')],
];

const _EXTERNAL_PREFIXES = ['http://', 'https://', 'mailto:'];

/**
 * Mirror Python `Path.resolve()`: make absolute (it already is, joined off
 * doc dir), normalize `..`, and resolve symlinks where the path exists.
 * Python `Path.resolve()` resolves symlinks for existing prefixes and
 * lexically normalizes the rest.
 */
function _resolvePy(p: string): string {
    const normalized = path.resolve(p);
    try {
        return fs.realpathSync(normalized);
    } catch {
        // Target (or a prefix) does not exist — realpath fails; fall back to
        // the lexically-normalized absolute path (Python keeps the tail).
        return normalized;
    }
}

function resolveLink(url: string, doc_path: string): string | null {
    if (_EXTERNAL_PREFIXES.some((pre) => url.startsWith(pre))) {
        return null;
    }
    const bare = url.split('#', 1)[0]!;
    if (bare === '') {
        return null;
    }
    const target = path.join(path.dirname(doc_path), bare);
    return _resolvePy(target);
}

function scan(doc_path: string): Array<[number, string]> {
    if (!_isFile(doc_path)) {
        process.stderr.write(`error: missing role doc: ${doc_path}\n`);
        process.exit(2);
    }
    const links: Array<[number, string]> = [];
    const lines = fs.readFileSync(doc_path, 'utf-8').split('\n');
    for (let idx = 0; idx < lines.length; idx++) {
        const i = idx + 1;
        const line = lines[idx]!;
        LINK_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = LINK_RE.exec(line)) !== null) {
            const url = m[1]!;
            if (_EXTERNAL_PREFIXES.some((pre) => url.startsWith(pre))) {
                continue;
            }
            links.push([i, url]);
        }
    }
    return links;
}

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

function _relTo(target: string): string {
    return path.relative(ROOT, target).split(path.sep).join('/');
}

interface ParsedArgs {
    quiet: boolean;
}

function _argparse_error(message: string): never {
    process.stderr.write(`check_role_doc_links: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let quiet = false;
    for (const arg of argv) {
        if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: check_role_doc_links [-h] [--quiet]\n');
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { quiet };
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const failures: Array<[string, number, string]> = [];
    let checked = 0;

    for (const doc of ROLE_DOCS) {
        for (const [line_no, url] of scan(doc)) {
            const target = resolveLink(url, doc);
            if (target === null) {
                continue;
            }
            checked += 1;
            if (!_exists(target)) {
                failures.push([doc, line_no, url]);
            }
        }
    }

    if (failures.length > 0) {
        process.stderr.write('Broken links in role docs:\n');
        for (const [doc, line_no, url] of failures) {
            const rel = _relTo(doc);
            process.stderr.write(`  ${rel}:${line_no}  -> ${url}\n`);
        }
        process.stderr.write(`\n${failures.length} broken / ${checked} checked\n`);
        return 1;
    }

    if (!args.quiet) {
        process.stdout.write(
            `check_role_doc_links: ${checked} links OK across ${ROLE_DOCS.length} files\n`,
        );
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { ROOT, DOCS_DIR, ROLE_DOCS, ANCHORS, resolveLink as resolve, scan, main };
