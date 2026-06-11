#!/usr/bin/env node
/**
 * Enforce cross-pack reference boundaries.
 *
 * TypeScript twin of `src/scripts/lint_pack_boundaries.py` (ADR-088, Phase 4 /
 * Wave 4b). Mirrors the Python CLI contract exactly: `--format text|json`,
 * `--quiet`, same scan scope (packages/*\/.agent-src.uncondensed/), file
 * ordering, link regex, resolution semantics, finding messages, stdout/stderr
 * split, and exit codes (0 clean / skipped, 1 violations). No behaviour
 * changes — latent bugs replicated.
 *
 * Walks every markdown link in every artefact under
 * `packages/*\/.agent-src.uncondensed/` and verifies the link target's pack is
 * the same pack, `core` (always allowed), or in the source pack's `requires`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

// ROOT = Path(__file__).resolve().parents[2] — canonical (symlinks resolved).
const _HERE = path.resolve(fileURLToPath(import.meta.url));
const ROOT = _realpath(path.resolve(path.dirname(_HERE), '..', '..'));
const PACKAGES = path.join(ROOT, 'packages');

// [..](target) with an optional #fragment / ?query stripped from the target.
const LINK_RE = /\[[^\]]*\]\(([^)#?]+)(?:[#?][^)]*)?\)/g;

interface ViolationRecord {
    source_pack: string;
    target_pack: string;
    source: string;
    target: string;
    link: string;
}

/** Mirror Python `Path.resolve()`: canonicalize existing prefix, append rest. */
function _realpath(p: string): string {
    try {
        return fs.realpathSync(p);
    } catch {
        // Resolve the longest existing ancestor, then re-append the tail.
        const abs = path.resolve(p);
        const parts = abs.split(path.sep);
        for (let i = parts.length; i > 0; i--) {
            const prefix = parts.slice(0, i).join(path.sep) || path.sep;
            try {
                const real = fs.realpathSync(prefix);
                const tail = parts.slice(i);
                return tail.length > 0 ? path.join(real, ...tail) : real;
            } catch {
                continue;
            }
        }
        return abs;
    }
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
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

function _relPosix(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

function _load_pack_meta(pkg_dir: string): Record<string, unknown> {
    const pack_yaml = path.join(pkg_dir, 'pack.yaml');
    if (!_exists(pack_yaml)) {
        return {};
    }
    const data = parseYaml(fs.readFileSync(pack_yaml, 'utf-8'), { version: '1.1' });
    return data !== null && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};
}

/** Sorted list of immediate child dir entries of `packages/`, dirs only. */
function _sortedPackageDirs(): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(PACKAGES, { withFileTypes: true });
    } catch {
        return [];
    }
    return entries
        .map((e) => path.join(PACKAGES, e.name))
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        .filter((p) => _isDir(p));
}

function _packId(meta: Record<string, unknown>, pkgName: string): string {
    const id = meta['id'];
    if (typeof id === 'string' && id.length > 0) {
        return id;
    }
    // pkg.name.removeprefix("pack-")
    return pkgName.startsWith('pack-') ? pkgName.slice('pack-'.length) : pkgName;
}

/** Recursively list `*.md` files under `dir`, sorted (sorted(rglob)). */
function _rglobMdSorted(dir: string): string[] {
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
    return out.sort();
}

/** Map repo-relative POSIX artefact path -> pack id. Insertion order matters. */
function _build_artefact_index(): Map<string, string> {
    const index = new Map<string, string>();
    if (!_exists(PACKAGES)) {
        return index;
    }
    for (const pkg of _sortedPackageDirs()) {
        const src_root = path.join(pkg, '.agent-src.uncondensed');
        if (!_isDir(src_root)) {
            continue;
        }
        const pid = _packId(_load_pack_meta(pkg), path.basename(pkg));
        for (const p of _rglobMdSorted(src_root)) {
            index.set(_relPosix(p, ROOT), pid);
        }
    }
    return index;
}

/** Resolve a markdown link target to a repo-relative path, or null. */
function _resolve_link(source_file: string, raw: string): string | null {
    const target = raw.trim();
    if (
        target === '' ||
        target.startsWith('http://') ||
        target.startsWith('https://') ||
        target.startsWith('mailto:') ||
        target.startsWith('ftp://')
    ) {
        return null;
    }
    if (target.startsWith('/')) {
        return null; // absolute web paths, ignored
    }
    let resolved: string;
    try {
        resolved = _realpath(path.resolve(path.dirname(source_file), target));
    } catch {
        return null;
    }
    // relative_to(ROOT) raises ValueError if not under ROOT → return None.
    const rel = path.relative(ROOT, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return null;
    }
    return rel.split(path.sep).join('/');
}

function _scan_file(p: string): string[] {
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        return [];
    }
    const out: string[] = [];
    LINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LINK_RE.exec(text)) !== null) {
        out.push(m[1]!);
    }
    return out;
}

function _is_allowed(source_pack: string, target_pack: string, requires: string[]): boolean {
    if (source_pack === target_pack) {
        return true;
    }
    if (target_pack === 'core') {
        return true;
    }
    return (requires || []).includes(target_pack);
}

/** Mirror Python `json.dump(obj, indent=2)` with `ensure_ascii=True`. */
function _json_dumps_ascii(obj: unknown): string {
    const raw = JSON.stringify(obj, null, 2);
    let out = '';
    for (const ch of raw) {
        const code = ch.codePointAt(0)!;
        if (code < 0x80) {
            out += ch;
        } else {
            for (let k = 0; k < ch.length; k++) {
                out += '\\u' + ch.charCodeAt(k).toString(16).padStart(4, '0');
            }
        }
    }
    return out;
}

interface ParsedArgs {
    format: 'text' | 'json';
    quiet: boolean;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let format: 'text' | 'json' = 'text';
    let quiet = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--format') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --format: expected one argument');
            }
            if (v !== 'text' && v !== 'json') {
                _argparse_error(
                    `argument --format: invalid choice: '${v}' (choose from 'text', 'json')`,
                );
            }
            format = v;
        } else if (arg.startsWith('--format=')) {
            const v = arg.slice('--format='.length);
            if (v !== 'text' && v !== 'json') {
                _argparse_error(
                    `argument --format: invalid choice: '${v}' (choose from 'text', 'json')`,
                );
            }
            format = v;
        } else if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: lint_pack_boundaries [-h] [--format {text,json}] [--quiet]\n',
            );
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { format, quiet };
}

function _argparse_error(message: string): never {
    process.stderr.write(`lint_pack_boundaries: error: ${message}\n`);
    process.exit(2);
}

function main(): number {
    const args = parse_args(process.argv.slice(2));

    const artefact_pack = _build_artefact_index();
    if (artefact_pack.size === 0) {
        process.stderr.write('no packages/ tree to lint — skipping\n');
        return 0;
    }

    const pack_requires = new Map<string, string[]>();
    for (const pkg of _sortedPackageDirs()) {
        const meta = _load_pack_meta(pkg);
        const pid = _packId(meta, path.basename(pkg));
        const req = meta['requires'];
        pack_requires.set(pid, Array.isArray(req) ? (req as unknown[]).map(String) : []);
    }

    const violations: ViolationRecord[] = [];
    for (const [rel_path, src_pack] of artefact_pack) {
        const source_file = path.join(ROOT, rel_path);
        for (const raw of _scan_file(source_file)) {
            const target_rel = _resolve_link(source_file, raw);
            if (target_rel === null) {
                continue;
            }
            const target_pack = artefact_pack.get(target_rel);
            if (target_pack === undefined) {
                continue; // link to docs/, scripts/, root files — not pack-scoped
            }
            if (_is_allowed(src_pack, target_pack, pack_requires.get(src_pack) ?? [])) {
                continue;
            }
            violations.push({
                source_pack: src_pack,
                target_pack,
                source: rel_path,
                target: target_rel,
                link: raw,
            });
        }
    }

    if (args.format === 'json') {
        process.stdout.write(
            _json_dumps_ascii({ violations, count: violations.length }) + '\n',
        );
    } else {
        if (!args.quiet) {
            process.stdout.write(
                `lint_pack_boundaries: scanned ${artefact_pack.size} artefacts across ` +
                    `${pack_requires.size} packs\n`,
            );
        }
        for (const v of violations) {
            process.stdout.write(
                `  ✗ ${v.source_pack} -> ${v.target_pack} : ${v.source} → ${v.target} ` +
                    `(link: ${v.link})\n`,
            );
        }
        if (violations.length > 0) {
            process.stdout.write(
                `\n${violations.length} cross-pack violation(s) — declare 'requires' in ` +
                    'pack.yaml or move the artefact\n',
            );
        } else if (!args.quiet) {
            process.stdout.write('OK — no cross-pack drift\n');
        }
    }
    return violations.length > 0 ? 1 : 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    type ViolationRecord,
    ROOT,
    PACKAGES,
    LINK_RE,
    _build_artefact_index,
    _resolve_link,
    _scan_file,
    _is_allowed,
    _load_pack_meta,
    main,
};
