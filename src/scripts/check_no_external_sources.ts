#!/usr/bin/env tsx
/**
 * check_no_external_sources — block readable inspiration/harvest source names.
 *
 * TypeScript twin of `src/scripts/check_no_external_sources.py` (ADR-092). The
 * CLI contract is mirrored EXACTLY — the `--json` flag, exit codes (0 = clean,
 * 1 = at least one denied token in a non-skipped tracked file, 2 = usage /
 * config error), the stdout split, byte-identical text + JSON report
 * (`json.dumps(..., indent=2)`), the denylist load from
 * `external_sources_denylist.json`, the `git ls-files` tracked-tree walk, the
 * binary-extension skip set, the `fnmatch` skip-path globs, the
 * case-insensitive regex search, and the `line.strip()[:160]` excerpt.
 *
 * Backstop for the source-confidentiality policy (rule: source-confidentiality;
 * the 2026-06-13 sweep). Scans the **tracked** tree for a denylist of external
 * inspiration / harvest / comparison source slugs so they cannot re-enter the
 * repo by accident. Recommending an integrated tool is allowed; recording that
 * we copied / derived / were-inspired-by a named external source is not.
 *
 * Carve-outs (see external_sources_denylist.json):
 * - Vendored Apache/MIT code keeps its license-required attribution.
 * - Recommendation/registry docs may name registries (Smithery/Glama).
 * - A retained source link must be stored encrypted via
 *   src/scripts/_lib/link_crypto.py, never in plaintext.
 *
 * Exit codes: 0 = clean, 1 = at least one denied token in a non-skipped tracked
 * file, 2 = usage / config error.
 *
 * Usage:
 *     node scripts/check_no_external_sources.ts [--json]
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// parents[2] of src/scripts/<file> is the repo root.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
// `Path(__file__).with_name(...)` — sibling of this script.
const CONFIG = path.join(path.dirname(_HERE), 'external_sources_denylist.json');

// Scan only text-ish files; skip binaries / lockfiles / images.
const _SKIP_EXT = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz',
    '.woff', '.woff2', '.ttf', '.mp3', '.mp4', '.wav', '.lock',
]);

interface DenyConfig {
    deny: string[];
    skip_paths?: string[];
    [k: string]: unknown;
}

interface Hit {
    file: string;
    line: number;
    token: string;
    text: string;
}

/** Thrown to mirror Python `raise SystemExit(msg)` (exit code derived by caller). */
class ExitError extends Error {}

/** Mirror `_tracked_files` — `git ls-files` in ROOT, non-empty lines. */
function _tracked_files(): string[] {
    const res = spawnSync('git', ['ls-files'], {
        cwd: ROOT,
        encoding: 'utf-8',
        maxBuffer: 256 * 1024 * 1024,
    });
    if (res.status !== 0) {
        // subprocess.run(check=True) raises CalledProcessError — surfaces as a crash.
        throw new Error(`git ls-files failed (status ${res.status}): ${res.stderr ?? ''}`);
    }
    return (res.stdout ?? '').split('\n').filter((line) => line);
}

/** Mirror `_load_config`. */
function _load_config(): DenyConfig {
    const data = JSON.parse(fs.readFileSync(CONFIG, 'utf-8')) as DenyConfig;
    if (!data.deny || data.deny.length === 0) {
        throw new ExitError('config error: empty deny list');
    }
    return data;
}

/** Python `.suffix.lower()` — last extension incl. the dot, lowercased; '' when none. */
function _suffixLower(rel: string): string {
    const base = rel.split('/').pop() as string;
    const dot = base.lastIndexOf('.');
    // pathlib: a leading-dot-only name (".env") has no suffix.
    if (dot <= 0) {
        return '';
    }
    return base.slice(dot).toLowerCase();
}

/**
 * Translate a Python `fnmatch` glob to a RegExp. fnmatch semantics: `*` matches
 * anything (including `/`), `?` matches one char, `[seq]` a set. CI is Linux →
 * case-sensitive (no os.path.normcase folding). Mirrors `fnmatch.translate`
 * for the glob shapes used in the denylist (`prefix/*`, exact paths).
 */
function _fnmatchToRegExp(glob: string): RegExp {
    let re = '';
    for (let i = 0; i < glob.length; i += 1) {
        const c = glob[i] as string;
        if (c === '*') {
            re += '.*';
        } else if (c === '?') {
            re += '.';
        } else if (c === '[') {
            let j = i + 1;
            if (glob[j] === '!') {
                j += 1;
            }
            if (glob[j] === ']') {
                j += 1;
            }
            while (j < glob.length && glob[j] !== ']') {
                j += 1;
            }
            if (j >= glob.length) {
                re += '\\['; // unterminated → literal '['
            } else {
                let stuff = glob.slice(i + 1, j).replace(/\\/g, '\\\\');
                i = j;
                if (stuff.startsWith('!')) {
                    stuff = '^' + stuff.slice(1);
                } else if (stuff.startsWith('^')) {
                    stuff = '\\' + stuff;
                }
                re += `[${stuff}]`;
            }
        } else {
            re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
    }
    // fnmatch.translate anchors with full-match semantics.
    return new RegExp(`^(?:${re})$`);
}

/** Mirror `_skipped` — any skip-glob fnmatches the path. */
function _skipped(p: string, skipGlobs: string[]): boolean {
    return skipGlobs.some((g) => _fnmatchToRegExp(g).test(p));
}

/** Python `str.splitlines()` over the file body (no trailing-empty element). */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    const lines: string[] = [];
    let current = '';
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i] as string;
        const code = text.charCodeAt(i);
        if (ch === '\r') {
            lines.push(current);
            current = '';
            if (text[i + 1] === '\n') {
                i += 1;
            }
            continue;
        }
        if (
            ch === '\n' ||
            code === 0x0b ||
            code === 0x0c ||
            code === 0x1c ||
            code === 0x1d ||
            code === 0x1e ||
            code === 0x85 ||
            code === 0x2028 ||
            code === 0x2029
        ) {
            lines.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    if (current !== '') {
        lines.push(current);
    }
    return lines;
}

/** Python `str.strip()` — strip leading/trailing whitespace (Unicode). */
function _pyStrip(s: string): string {
    return s.replace(/^\s+/u, '').replace(/\s+$/u, '');
}

/** Mirror `json.dumps(obj, indent=2)` (ensure_ascii=True, key order preserved). */
function _jsonDumps2(obj: unknown): string {
    return _pyJson(obj, 2, 0);
}

function _pyJson(v: unknown, indent: number, depth: number): string {
    const pad = ' '.repeat(indent * (depth + 1));
    const padEnd = ' '.repeat(indent * depth);
    if (v === null) {
        return 'null';
    }
    if (typeof v === 'boolean') {
        return v ? 'true' : 'false';
    }
    if (typeof v === 'number') {
        return String(v);
    }
    if (typeof v === 'string') {
        return _pyJsonStr(v);
    }
    if (Array.isArray(v)) {
        if (v.length === 0) {
            return '[]';
        }
        const items = v.map((it) => pad + _pyJson(it, indent, depth + 1));
        return '[\n' + items.join(',\n') + '\n' + padEnd + ']';
    }
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) {
        return '{}';
    }
    const items = entries.map(([k, val]) => `${pad}${_pyJsonStr(k)}: ${_pyJson(val, indent, depth + 1)}`);
    return '{\n' + items.join(',\n') + '\n' + padEnd + '}';
}

/** Mirror Python json string encoding with ensure_ascii=True (\uXXXX escapes). */
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
        } else if (code < 0x20 || code > 0x7e) {
            // ensure_ascii=True — escape as \uXXXX (surrogate pair for astral).
            if (code > 0xffff) {
                const c = code - 0x10000;
                const hi = 0xd800 + (c >> 10);
                const lo = 0xdc00 + (c & 0x3ff);
                out += '\\u' + hi.toString(16).padStart(4, '0') + '\\u' + lo.toString(16).padStart(4, '0');
            } else {
                out += '\\u' + code.toString(16).padStart(4, '0');
            }
        } else {
            out += ch;
        }
    }
    return out + '"';
}

/** Mirror `main(argv)`. */
function main(argv: readonly string[]): number {
    const asJson = argv.includes('--json');
    const cfg = _load_config();
    const patterns: Array<[string, RegExp]> = cfg.deny.map((p) => [p, new RegExp(p, 'i')]);
    const skipGlobs = cfg.skip_paths ?? [];

    const hits: Hit[] = [];
    for (const rel of _tracked_files()) {
        if (_SKIP_EXT.has(_suffixLower(rel))) {
            continue;
        }
        if (_skipped(rel, skipGlobs)) {
            continue;
        }
        let text: string;
        try {
            const abs = path.join(ROOT, rel);
            // Mirror `(OSError, IsADirectoryError)` skip — a directory entry, gone, etc.
            if (!fs.statSync(abs).isFile()) {
                continue;
            }
            text = fs.readFileSync(abs, 'utf-8'); // errors="replace": Node substitutes U+FFFD
        } catch {
            continue;
        }
        const lines = _splitlines(text);
        for (let idx = 0; idx < lines.length; idx += 1) {
            const line = lines[idx] as string;
            for (const [raw, rx] of patterns) {
                if (rx.test(line)) {
                    hits.push({
                        file: rel,
                        line: idx + 1,
                        token: raw,
                        text: _pyStrip(line).slice(0, 160),
                    });
                }
            }
        }
    }

    if (asJson) {
        process.stdout.write(_jsonDumps2({ ok: hits.length === 0, hits }) + '\n');
    } else {
        if (hits.length > 0) {
            process.stdout.write(`❌  ${hits.length} external-source reference(s) in the tracked tree:\n\n`);
            for (const h of hits) {
                process.stdout.write(`  ${h.file}:${h.line}  [${h.token}]  ${h.text}\n`);
            }
            process.stdout.write(
                '\nThese name an external inspiration/harvest source. Remove the name,\n' +
                    'or — if a real source link must be retained — encrypt it via\n' +
                    'src/scripts/_lib/link_crypto.py. Legitimate carve-outs (vendored code,\n' +
                    'registry recommendations) belong in external_sources_denylist.json\n' +
                    'skip_paths. See rule: source-confidentiality.\n',
            );
        } else {
            process.stdout.write('✅  No external inspiration-source references in the tracked tree.\n');
        }
    }
    return hits.length > 0 ? 1 : 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry) {
    try {
        process.exit(main(process.argv.slice(2)));
    } catch (exc) {
        if (exc instanceof ExitError) {
            // Mirror `raise SystemExit("config error: empty deny list")` — a
            // SystemExit with a STRING arg prints the message to stderr and
            // exits with code 1 (NOT 2; the docstring's "2 = config error" is a
            // doc inaccuracy in the .py — the actual code path exits 1).
            process.stderr.write(`${exc.message}\n`);
            process.exit(1);
        }
        throw exc;
    }
}

export { main, _tracked_files, _load_config, _skipped, _fnmatchToRegExp, _suffixLower, ExitError };
