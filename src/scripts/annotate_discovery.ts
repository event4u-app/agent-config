#!/usr/bin/env node
/**
 * R3 Phase 4 mass-annotator — discovery frontmatter helper.
 *
 * Ported from the retired Python `src/scripts/annotate_discovery.py` (ADR-200 —
 * Python→TS migration, Phase 8 / Wave 8g). Mirrors the Python CLI contract
 * EXACTLY — the `--pack` choice flag + positional `paths`, exit code (0),
 * the stdout/stderr split, byte-identical messages, and byte-identical
 * frontmatter rewrites of the source and the dist/agent-src mirror.
 *
 * Walks a list of artefacts in `.agent-src.uncondensed/` and:
 *   1. Inserts the 5 ADR-013 frontmatter keys (workspaces, packs, lifecycle,
 *      trust, install) before the closing `---`, deterministically.
 *   2. Mirrors the new keys into the matching `dist/agent-src/` counterpart so
 *      the condensed projection stays consistent (body preserved).
 *
 * Idempotent: re-runs leave already-annotated files untouched.
 *
 * Mapping table (`PACK_DEFAULTS`) is the council-locked authority. No
 * behaviour changes — historical quirks preserved (consumers pin the exact behaviour).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/annotate_discovery.py → parents[2] == repo root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const SRC = path.join(ROOT, '.agent-src.uncondensed');
export const DST = path.join(ROOT, 'dist/agent-src');

// Pack → [workspace_id, trust_level, default_install, removable, lifecycle].
export const PACK_DEFAULTS: Record<string, [string, string, boolean, boolean, string]> = {
    'engineering-base': ['engineering', 'core', true, false, 'active'],
    php: ['engineering', 'professional', false, true, 'active'],
    laravel: ['engineering', 'professional', false, true, 'active'],
    symfony: ['engineering', 'professional', false, true, 'active'],
    javascript: ['engineering', 'professional', false, true, 'active'],
    typescript: ['engineering', 'professional', false, true, 'active'],
    react: ['engineering', 'professional', false, true, 'active'],
    nextjs: ['engineering', 'professional', false, true, 'active'],
    python: ['engineering', 'professional', false, true, 'active'],
    'product-basic': ['product', 'professional', true, true, 'active'],
    'product-discovery': ['product', 'professional', false, true, 'active'],
    'finance-basic': ['finance', 'professional', true, true, 'active'],
    'finance-advanced': ['finance', 'core', false, true, 'active'],
    'gtm-sales': ['gtm', 'professional', true, true, 'active'],
    'gtm-marketing': ['gtm', 'professional', true, true, 'active'],
    'ops-people': ['ops', 'professional', true, true, 'active'],
    'founder-strategy': ['founder', 'core', true, true, 'active'],
    'small-business': ['small-business', 'professional', true, true, 'active'],
    construction: ['construction', 'professional', true, true, 'active'],
    'ai-video': ['small-business', 'experimental', false, true, 'experimental'],
    meta: ['agent-config-maintainer', 'core', true, false, 'active'],
};

// re.compile(r"^(---\n)(.*?)(\n---\n)", re.DOTALL) — anchored at start, .match.
const _FM_RE = /^(---\n)([\s\S]*?)(\n---\n)/;
// re.compile(r"^(workspaces|packs|lifecycle|trust|install):", re.MULTILINE)
const _HAS_NEW_KEYS_RE = /^(workspaces|packs|lifecycle|trust|install):/m;

function _renderBlock(pack: string): string {
    const [ws, level, def, removable, lifecycle] = PACK_DEFAULTS[pack] as [
        string,
        string,
        boolean,
        boolean,
        string,
    ];
    return (
        `workspaces:\n` +
        `  - ${ws}\n` +
        `packs:\n` +
        `  - ${pack}\n` +
        `lifecycle: ${lifecycle}\n` +
        `trust:\n` +
        `  level: ${level}\n` +
        `  confidence: high\n` +
        `  human_review_required: false\n` +
        `install:\n` +
        `  default: ${def ? 'true' : 'false'}\n` +
        `  removable: ${removable ? 'true' : 'false'}`
    );
}

/** Python str.rstrip() — strip all trailing whitespace (incl. \n, \t, spaces). */
function _rstrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

function _annotate(p: string, pack: string): boolean {
    const text = fs.readFileSync(p, 'utf-8');
    const m = _FM_RE.exec(text);
    if (!m) {
        process.stderr.write(`  skip (no frontmatter): ${_relPosix(p, ROOT)}\n`);
        return false;
    }
    const bodyFm = m[2] as string;
    if (_HAS_NEW_KEYS_RE.test(bodyFm)) {
        return false; // idempotent
    }
    const block = _renderBlock(pack);
    const newFm = _rstrip(bodyFm) + '\n' + block;
    const newText = (m[1] as string) + newFm + (m[3] as string) + text.slice(m[0].length);
    fs.writeFileSync(p, newText, 'utf-8');
    return true;
}

function _mirrorToCondensed(rel: string, pack: string): void {
    const dst = path.join(DST, rel);
    if (!_isFile(dst)) {
        return; // no condensed counterpart yet (e.g. new file)
    }
    const text = fs.readFileSync(dst, 'utf-8');
    const m = _FM_RE.exec(text);
    if (!m) {
        return;
    }
    const bodyFm = m[2] as string;
    if (_HAS_NEW_KEYS_RE.test(bodyFm)) {
        return;
    }
    const block = _renderBlock(pack);
    const newFm = _rstrip(bodyFm) + '\n' + block;
    const newText = (m[1] as string) + newFm + (m[3] as string) + text.slice(m[0].length);
    fs.writeFileSync(dst, newText, 'utf-8');
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _relPosix(p: string, base: string): string {
    return path.relative(base, p).split(path.sep).join('/');
}

/** Mirror Path.is_relative_to(Path(".agent-src.uncondensed")) for a relative path. */
function _isRelativeToSrc(rel: string): boolean {
    const parts = rel.split(path.sep);
    return parts[0] === '.agent-src.uncondensed';
}

interface Args {
    pack: string;
    paths: string[];
}

export function parseArgs(argv: string[]): Args {
    let pack: string | null = null;
    const paths: string[] = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--pack') {
            const v = argv[++i];
            if (v === undefined) {
                process.stderr.write('argument --pack: expected one argument\n');
                process.exit(2);
            }
            pack = v;
        } else if (a.startsWith('--pack=')) {
            pack = a.slice('--pack='.length);
        } else {
            paths.push(a);
        }
    }
    const choices = Object.keys(PACK_DEFAULTS).sort();
    if (pack === null) {
        process.stderr.write('the following arguments are required: --pack\n');
        process.exit(2);
    }
    if (!choices.includes(pack)) {
        process.stderr.write(
            `argument --pack: invalid choice: '${pack}' (choose from ${choices
                .map((c) => `'${c}'`)
                .join(', ')})\n`,
        );
        process.exit(2);
    }
    if (paths.length === 0) {
        process.stderr.write('the following arguments are required: paths\n');
        process.exit(2);
    }
    return { pack, paths };
}

export function main(argv: string[] | null = null): number {
    const args = parseArgs(argv ?? process.argv.slice(2));

    let changed = 0;
    for (const raw of args.paths) {
        let rel = raw;
        if (path.isAbsolute(raw)) {
            rel = path.relative(ROOT, raw);
        }
        if (!_isRelativeToSrc(rel)) {
            process.stderr.write(`  skip (not under .agent-src.uncondensed/): ${rel}\n`);
            continue;
        }
        // rel.relative_to(".agent-src.uncondensed")
        const inner = rel.split(path.sep).slice(1).join(path.sep);
        const srcFile = path.join(SRC, inner);
        if (!_isFile(srcFile)) {
            process.stderr.write(`  skip (missing): ${rel}\n`);
            continue;
        }
        if (_annotate(srcFile, args.pack)) {
            changed += 1;
        }
        _mirrorToCondensed(inner, args.pack);
    }
    process.stdout.write(`annotated ${changed} files with pack=${args.pack}\n`);
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

const _isMain = _isCliEntry();
if (_isMain) {
    process.exitCode = main();
}

export { _renderBlock, _annotate as annotate };
