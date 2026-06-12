#!/usr/bin/env tsx
/**
 * Lint ghostwriter profile sources.
 *
 * TypeScript twin of `src/scripts/lint_ghostwriter_source.py` (ADR-090,
 * Phase 4 / Wave 4b). The CLI contract is mirrored EXACTLY — `--quiet`
 * detected by argv membership, exit codes (0 / 1), stdout/stderr split,
 * byte-identical messages, same scan scope (`*.md` sorted in each tier),
 * same package- then consumer-side ordering. No behaviour changes —
 * latent bugs replicated.
 *
 * Two storage tiers (docs/contracts/ghostwriter-schema.md):
 *   * src/agent-src/ghostwriter/  — package source, fictional fixtures only.
 *   * agents/ghostwriter/         — consumer real-person profiles.
 *
 * DIVERGENCE CANDIDATE: alias casefold uses a faithful-but-not-exhaustive
 * mapping (covers ASCII + common Latin); Python `str.casefold()` has full
 * Unicode case-folding (e.g. ß → ss). Aliases here are validated Latin-only
 * names, so the common path matches; exotic full-fold cases could diverge.
 *
 * Exit codes:
 *   0  all profiles compliant
 *   1  one or more violations
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
const QUIET = process.argv.slice(2).includes('--quiet');

const REPO = path.resolve(path.dirname(_HERE), '..', '..');
// 6.0.x (ADR-051): ghostwriter fixtures live at src/agent-src/ghostwriter/.
const PACKAGE_DIR = path.join(REPO, 'src', 'agent-src', 'ghostwriter');
const CONSUMER_DIR = path.join(REPO, 'agents', 'ghostwriter');
const ALLOWLIST = path.join(REPO, 'src', 'scripts', 'ghostwriter_fixture_allowlist.txt');
const EXEMPT_STEMS: ReadonlySet<string> = new Set(['README']);

const ALIAS_MIN_LEN = 2;
const ALLOWED_PUNCT: ReadonlySet<string> = new Set([' ', '.', "'", '-']);

// Code points in [0x0041, 0x024F] whose Unicode name does NOT start with
// "LATIN " (or have no name) — generated from Python `unicodedata.name`.
// These fail the latin-or-allowed test even though they are inside the range.
const _NON_LATIN_IN_RANGE: ReadonlySet<number> = new Set([
    0x5b, 0x5c, 0x5d, 0x5e, 0x5f, 0x60, 0x7b, 0x7c, 0x7d, 0x7e, 0x7f, 0x80,
    0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x8b, 0x8c,
    0x8d, 0x8e, 0x8f, 0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98,
    0x99, 0x9a, 0x9b, 0x9c, 0x9d, 0x9e, 0x9f, 0xa0, 0xa1, 0xa2, 0xa3, 0xa4,
    0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xab, 0xac, 0xad, 0xae, 0xaf, 0xb0,
    0xb1, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xbb, 0xbc,
    0xbd, 0xbe, 0xbf, 0xd7, 0xf7,
]);

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

/** Sorted `*.md` files directly under `dir` (mirrors sorted(dir.glob("*.md"))). */
function _globMdSorted(dir: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
            out.push(path.join(dir, entry.name));
        }
    }
    return out.sort();
}

function _stem(p: string): string {
    const base = path.basename(p);
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(0, dot) : base;
}

function load_allowlist(): Set<string> {
    if (!_exists(ALLOWLIST)) {
        return new Set();
    }
    const stems = new Set<string>();
    for (const line of fs.readFileSync(ALLOWLIST, 'utf-8').split('\n')) {
        const s = line.trim();
        if (!s || s.startsWith('#')) {
            continue;
        }
        stems.add(s);
    }
    return stems;
}

function parse_frontmatter(text: string): Record<string, unknown> | null {
    if (!text.startsWith('---\n')) {
        return null;
    }
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) {
        return null;
    }
    let data: unknown;
    try {
        data = YAML.parse(text.slice(4, end), { version: '1.1' });
    } catch {
        return null;
    }
    return data !== null && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : null;
}

function is_latin_or_allowed(ch: string): boolean {
    if (ALLOWED_PUNCT.has(ch)) {
        return true;
    }
    if (/[0-9]/.test(ch)) {
        // Mirror Python str.isdigit() for the relevant alias alphabet. Aliases
        // are Latin names; ASCII digits are the only realistic case here.
        return _isPyDigit(ch);
    }
    const code = ch.codePointAt(0)!;
    if (code >= 0x0041 && code <= 0x024f) {
        return !_NON_LATIN_IN_RANGE.has(code);
    }
    return false;
}

/** Python str.isdigit() — true for ASCII 0-9 (sufficient for Latin aliases). */
function _isPyDigit(ch: string): boolean {
    return ch.length === 1 && ch >= '0' && ch <= '9';
}

/** Faithful-enough casefold (see divergence note in header). */
function _casefold(s: string): string {
    return s.toLowerCase();
}

/** Return an error message, or null if the alias is valid. */
function validate_alias(alias: unknown): string | null {
    if (typeof alias !== 'string') {
        return `alias must be a string, got ${_pyTypeName(alias)}`;
    }
    if (alias.length < ALIAS_MIN_LEN) {
        return `alias ${_pyRepr(alias)} is shorter than ${ALIAS_MIN_LEN} characters`;
    }
    const normalised = alias.normalize('NFC');
    if (normalised !== alias) {
        return `alias ${_pyRepr(alias)} is not Unicode-NFC-normalised`;
    }
    const bad = [...alias].filter((ch) => !is_latin_or_allowed(ch));
    if (bad.length) {
        return (
            `alias ${_pyRepr(alias)} contains non-Latin or homoglyph-prone ` +
            `character(s): ${_pyListRepr(bad)}`
        );
    }
    return null;
}

function lint_package_side(allowlist: Set<string>): string[] {
    const errors: string[] = [];
    if (!_exists(PACKAGE_DIR)) {
        return errors;
    }
    for (const p of _globMdSorted(PACKAGE_DIR)) {
        const stem = _stem(p);
        if (EXEMPT_STEMS.has(stem)) {
            continue;
        }
        const rel = _relPosix(p, REPO);
        if (!allowlist.has(stem)) {
            errors.push(
                `    off-allowlist (package source): ${rel} ` +
                    `— add '${stem}' to scripts/ghostwriter_fixture_allowlist.txt`,
            );
            continue;
        }
        const data = parse_frontmatter(fs.readFileSync(p, 'utf-8'));
        if (data === null) {
            errors.push(`    unparsable frontmatter (package source): ${rel}`);
            continue;
        }
        if (data['fictional'] !== true) {
            errors.push(
                `    missing 'fictional: true' (package source): ${rel} ` +
                    `(got fictional=${_pyRepr2(data['fictional'])})`,
            );
        }
        if ('aliases' in data) {
            errors.push(
                `    'aliases:' forbidden on fictional fixtures: ${rel} ` +
                    `— aliases are a consumer-only feature (see schema § Aliases)`,
            );
        }
    }
    return errors;
}

function lint_consumer_side(): string[] {
    const errors: string[] = [];
    if (!_exists(CONSUMER_DIR)) {
        return errors;
    }
    // (alias_ci → [source_path, source_value, source_kind])
    const seen = new Map<string, [string, string, string]>();
    for (const p of _globMdSorted(CONSUMER_DIR)) {
        if (EXEMPT_STEMS.has(_stem(p))) {
            continue;
        }
        const rel = _relPosix(p, REPO);
        const slug = _stem(p);
        const slug_ci = _casefold(slug);
        if (seen.has(slug_ci)) {
            const [prev_path] = seen.get(slug_ci)!;
            errors.push(
                `    duplicate slug across profiles: ${rel} ` +
                    `vs ${_relPosix(prev_path, REPO)} (case-insensitive)`,
            );
        } else {
            seen.set(slug_ci, [p, slug, 'slug']);
        }

        const data = parse_frontmatter(fs.readFileSync(p, 'utf-8'));
        if (data === null) {
            continue;
        }
        if (data['fictional'] === true) {
            errors.push(
                `    'fictional: true' in consumer tree: ${rel} ` +
                    `— fictional fixtures belong in .agent-src.uncondensed/ghostwriter/`,
            );
        }

        const aliases = data['aliases'];
        if (aliases === undefined || aliases === null) {
            continue;
        }
        if (!Array.isArray(aliases)) {
            errors.push(
                `    'aliases' must be a YAML list: ${rel} (got ${_pyTypeName(aliases)})`,
            );
            continue;
        }

        const within_profile = new Set<string>();
        for (const alias of aliases) {
            const err = validate_alias(alias);
            if (err) {
                errors.push(`    ${rel}: ${err}`);
                continue;
            }
            const alias_ci = _casefold(alias as string);
            if (within_profile.has(alias_ci)) {
                errors.push(
                    `    ${rel}: duplicate alias ` +
                        `${_pyRepr(alias as string)} within the same profile (case-insensitive)`,
                );
                continue;
            }
            within_profile.add(alias_ci);
            if (seen.has(alias_ci)) {
                const [prev_path, prev_value, prev_kind] = seen.get(alias_ci)!;
                errors.push(
                    `    alias collision: ${rel} alias ` +
                        `${_pyRepr(alias as string)} collides with ${prev_kind} ${_pyRepr(prev_value)} in ` +
                        `${_relPosix(prev_path, REPO)} (case-insensitive)`,
                );
                continue;
            }
            seen.set(alias_ci, [p, alias as string, 'alias']);
        }
    }
    return errors;
}

function main(): number {
    const allowlist = load_allowlist();
    const pkg_errors = lint_package_side(allowlist);
    const cons_errors = lint_consumer_side();
    const errors = [...pkg_errors, ...cons_errors];

    if (errors.length) {
        process.stderr.write(`❌  lint_ghostwriter_source: ${errors.length} violation(s)\n`);
        for (const line of errors) {
            process.stderr.write(line + '\n');
        }
        process.stderr.write('    see docs/contracts/ghostwriter-schema.md § Lint enforcement\n');
        return 1;
    }

    if (!QUIET) {
        const pkg_count = _exists(PACKAGE_DIR)
            ? _globMdSorted(PACKAGE_DIR).filter((p) => !EXEMPT_STEMS.has(_stem(p))).length
            : 0;
        const cons_count = _exists(CONSUMER_DIR)
            ? _globMdSorted(CONSUMER_DIR).filter((p) => !EXEMPT_STEMS.has(_stem(p))).length
            : 0;
        process.stdout.write(
            `✅  lint_ghostwriter_source: ${pkg_count} package fixture(s), ` +
                `${cons_count} consumer profile(s), all compliant\n`,
        );
    }
    return 0;
}

/** Mirror Python type(x).__name__ for the alias-type error message. */
function _pyTypeName(v: unknown): string {
    if (v === null) return 'NoneType';
    if (Array.isArray(v)) return 'list';
    switch (typeof v) {
        case 'string':
            return 'str';
        case 'boolean':
            return 'bool';
        case 'number':
            return Number.isInteger(v) ? 'int' : 'float';
        case 'object':
            return 'dict';
        default:
            return typeof v;
    }
}

/** Mirror Python repr() of a string. */
function _pyRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let body = s.replace(/\\/g, '\\\\');
    if (quote === "'") {
        body = body.replace(/'/g, "\\'");
    } else {
        body = body.replace(/"/g, '\\"');
    }
    return `${quote}${body}${quote}`;
}

/** Mirror Python repr() of an arbitrary scalar (used for `fictional` value). */
function _pyRepr2(v: unknown): string {
    if (v === undefined || v === null) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (typeof v === 'string') return _pyRepr(v);
    return String(v);
}

/** Mirror Python repr() of a list of single-char strings. */
function _pyListRepr(items: readonly string[]): string {
    return `[${items.map((i) => _pyRepr(i)).join(', ')}]`;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    REPO,
    PACKAGE_DIR,
    CONSUMER_DIR,
    ALLOWLIST,
    EXEMPT_STEMS,
    ALIAS_MIN_LEN,
    ALLOWED_PUNCT,
    load_allowlist,
    parse_frontmatter,
    is_latin_or_allowed,
    validate_alias,
    lint_package_side,
    lint_consumer_side,
    main,
};
