#!/usr/bin/env node
/**
 * R3 Phase 4 mass-annotator — discovery frontmatter helper.
 *
 * TypeScript twin of `src/scripts/annotate_discovery.py` (ADR-096 —
 * Python→TS migration, Phase 8 / Wave 8g). Mirrors the Python CLI contract
 * EXACTLY — the `--pack` choice flag + positional `paths`, exit code (0),
 * the stdout/stderr split, byte-identical messages, and byte-identical
 * frontmatter rewrites of the source, the dist/agent-src mirror, and the
 * condensation-hash file.
 *
 * Walks a list of artefacts in `.agent-src.uncondensed/` and:
 *   1. Inserts the 5 ADR-013 frontmatter keys (workspaces, packs, lifecycle,
 *      trust, install) before the closing `---`, deterministically.
 *   2. Mirrors the new keys into the matching `dist/agent-src/` counterpart so
 *      the condensed projection stays consistent (body preserved).
 *   3. Refreshes `internal/.condensation-hashes.json` for each touched source
 *      path so `task check-condensation` stays green.
 *
 * Idempotent: re-runs leave already-annotated files untouched.
 *
 * Mapping table (`PACK_DEFAULTS`) is the council-locked authority. No
 * behaviour changes — latent Python quirks replicated.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/annotate_discovery.py → parents[2] == repo root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const SRC = path.join(ROOT, '.agent-src.uncondensed');
export const DST = path.join(ROOT, 'dist/agent-src');
export const HASH_FILE = path.join(ROOT, 'internal', '.condensation-hashes.json');

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

function _refreshHash(rel: string, hashes: Record<string, string>): void {
    const src = path.join(SRC, rel);
    // rel.as_posix() — POSIX separators for the JSON key, regardless of OS.
    const key = rel.split(path.sep).join('/');
    hashes[key] = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex');
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

    const hashes: Record<string, string> = _isFile(HASH_FILE)
        ? (JSON.parse(fs.readFileSync(HASH_FILE, 'utf-8')) as Record<string, string>)
        : {};
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
        _refreshHash(inner, hashes);
    }
    // json.dumps(hashes, indent=2, sort_keys=True) + "\n"
    fs.mkdirSync(path.dirname(HASH_FILE), { recursive: true });
    fs.writeFileSync(HASH_FILE, _dumpsSorted(hashes) + '\n', 'utf-8');
    process.stdout.write(`annotated ${changed} files with pack=${args.pack}\n`);
    return 0;
}

// --- json.dumps(indent=2, sort_keys=True) for a flat string→string map -------

function _pyJsonStr(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (code < 0x20) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else if (code < 0x7f) {
            out += ch;
        } else if (code <= 0xffff) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
        }
    }
    return out + '"';
}

function _dumpsSorted(obj: Record<string, string>): string {
    const keys = Object.keys(obj).sort();
    if (keys.length === 0) {
        return '{}';
    }
    const parts = keys.map((k) => `  ${_pyJsonStr(k)}: ${_pyJsonStr(obj[k] as string)}`);
    return `{\n${parts.join(',\n')}\n}`;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    process.exitCode = main();
}

export { _renderBlock, _annotate as annotate };
