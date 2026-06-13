#!/usr/bin/env tsx
/**
 * Validate condensed-output paths in `dist/agent-src/rules/*.md`.
 *
 * TypeScript twin of `src/scripts/check_condensed_paths.py` (ADR-092). Mirrors
 * the Python CLI contract EXACTLY — same `--quiet` flag, same exit codes
 * (0 clean, 1 violations, 3 internal error), same stdout/stderr split, same
 * finding text, same forbidden-substring set, same frontmatter parsing, same
 * scan order. No behaviour changes; latent bugs are replicated and flagged as
 * divergence candidates.
 *
 * Runs after `scripts/condense.py` projects sources to `dist/agent-src/`. The
 * rewriter in `condense.py` is the load-bearing primitive (road-to-path-fixes
 * P1.2); this script is the post-condition gate (P5.1) — every `load_context:`
 * entry in `dist/agent-src/rules/*.md` must resolve relative to the rule file's
 * directory to an existing file, and forbidden substrings must not survive
 * the rewrite (unless declared in `validator_ignore`).
 *
 * Forbidden substrings (load_context + body):
 *   - `.agent-src.uncondensed/`            unless declared in validator_ignore
 *   - `../../docs/`                         body-link two-up form (rewriter
 *                                            collapses to single-up)
 *   - `../../agents/`                       same shape, different root
 *
 * Body-link checks (Council Decision 2, 2026-05-06):
 *   - `load_context:` entries MUST resolve to an existing file under
 *     `dist/agent-src/`.
 *   - Body markdown links to `../contexts/...md` MUST resolve.
 *   - Body markdown links to `../docs/guidelines/...md` are NOT checked
 *     (P3.1 was cancelled; resolution is intentionally out of scope, the
 *     Copilot suppression floor in P6 is the silencer).
 *
 * `validator_ignore:` frontmatter primitive:
 *   - Per-rule allowlist for rules that *describe* a forbidden substring as
 *     their subject matter (e.g. `augment-edit-discipline` documents the
 *     `.agent-src.uncondensed/` boundary). Each entry: `{type, pattern,
 *     reason}`. The validator emits an audit line per matched ignore so
 *     drift cannot hide.
 *
 * Exit codes: 0 = clean, 1 = violations found, 3 = internal error.
 */

import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ESM-standard `require` shim. The bare `require` global is present when this
// module is *imported* (tsx injects it) but absent when the module is the
// directly-executed CLI entry, so resolve it explicitly here to mirror the
// Python original's lazy `import yaml` in both execution modes.
const _require = createRequire(import.meta.url);

const QUIET = process.argv.includes('--quiet');

const _HERE = path.dirname(fileURLToPath(import.meta.url));
// _HERE === <repo>/src/scripts ; the Python original derives ROOT from
// Path(__file__).resolve().parent.parent.parent which is the repo root
// (src/scripts/check_condensed_paths.py → up three dirs).
const ROOT = path.resolve(_HERE, '..', '..');
const RULES_DIR = path.join(ROOT, 'dist/agent-src', 'rules');

const FORBIDDEN_SUBSTRINGS = ['.agent-src.uncondensed/', '../../docs/', '../../agents/'];

// Markdown links: `[text](path)` — capture path. Skip URLs and anchors.
const _LINK_RE = /\[[^\]]*\]\(([^)#\s]+)(?:#[^)]*)?\)/g;

// Body-link prefixes whose resolution is intentionally out of scope.
// Council Decision 2 (2026-05-06): P3.1 was cancelled, so guideline links
// under `dist/agent-src/rules/` cannot resolve in the projected tree. Copilot
// suppression (P6) is the silencer for the noise. `docs/contracts/` shares
// the same shape as `docs/guidelines/` — both live at repo root and the
// rewriter collapses `../../docs/{contracts,guidelines}/...` to a
// `../docs/...` form that cannot resolve under `dist/agent-src/`.
const UNCHECKED_LINK_PREFIXES = [
    '../docs/guidelines/',
    '../../docs/guidelines/',
    '../docs/contracts/',
    '../../docs/contracts/',
    // Consumer-layout root-escaping links (ADR-058): since the condensed
    // output moved to `dist/agent-src/` the projected tree sits one level
    // deeper than the consumer install (`.augment/rules/` — 2 deep), so the
    // two-up forms below are authored for the consumer layout and cannot
    // resolve in the package repo by construction. Same rationale as the
    // docs/guidelines carve-out above; `validator_ignore` still audits the
    // substring hits per rule.
    '../../docs/',
    '../../agents/',
    '../../src/',
];

interface Violation {
    file: string;
    line: number;
    kind: string;
    detail: string;
}

interface IgnoreEntry {
    kind: string; // "substring" | "link"
    pattern: string; // exact substring or link prefix to ignore
    reason: string; // human-readable rationale (audited)
}

type Frontmatter = Record<string, unknown>;

/** Mirror Python's `str.splitlines()` (no trailing empty element). */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const parts = normalised.split('\n');
    if (parts.length > 0 && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/**
 * Split YAML frontmatter from a markdown document.
 *
 * Mirrors `_split_frontmatter`: returns `[null, text]` when the document does
 * not open with `---\n` or has no closing `\n---\n`, or when the YAML is
 * unparseable or not a mapping. Otherwise `[frontmatter_dict, body]`.
 */
function _split_frontmatter(text: string): [Frontmatter | null, string] {
    if (!text.startsWith('---\n')) {
        return [null, text];
    }
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) {
        return [null, text];
    }
    const fmText = text.slice(4, end);
    const body = text.slice(end + '\n---\n'.length);
    let YAML: typeof import('yaml');
    try {
        YAML = _require('yaml') as typeof import('yaml');
    } catch {
        return [null, text];
    }
    let fm: unknown;
    try {
        // version '1.1' matches PyYAML's safe_load semantics used by the
        // Python original (yaml.safe_load).
        fm = YAML.parse(fmText, { version: '1.1' });
    } catch {
        return [null, text];
    }
    if (fm !== null && typeof fm === 'object' && !Array.isArray(fm)) {
        return [fm as Frontmatter, body];
    }
    // Python: `return fm if isinstance(fm, dict) else {}, body`
    return [{}, body];
}

function _parse_ignores(fm: Frontmatter): IgnoreEntry[] {
    const entries = fm.validator_ignore ?? [];
    if (!Array.isArray(entries)) {
        return [];
    }
    const out: IgnoreEntry[] = [];
    for (const raw of entries) {
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
            continue;
        }
        const rec = raw as Record<string, unknown>;
        const kind = String(rec.type ?? '').trim();
        const pattern = String(rec.pattern ?? '').trim();
        const reason = String(rec.reason ?? '').trim();
        if ((kind === 'substring' || kind === 'link') && pattern && reason) {
            out.push({ kind, pattern, reason });
        }
    }
    return out;
}

function _ignored(needle: string, ignores: IgnoreEntry[], kind: string): IgnoreEntry | null {
    for (const ig of ignores) {
        if (ig.kind === kind && ig.pattern === needle) {
            return ig;
        }
    }
    return null;
}

/** POSIX-relative path of `child` under `ROOT` (mirrors `relative_to(ROOT)`). */
function _relToRoot(child: string): string {
    const rel = path.relative(ROOT, child);
    return rel.split(path.sep).join('/');
}

function _check_load_context(
    ruleFile: string,
    fm: Frontmatter,
    viols: Violation[],
    ignores: IgnoreEntry[],
    audited: Array<[string, IgnoreEntry]>,
): void {
    const ruleDir = path.dirname(ruleFile);
    for (const key of ['load_context', 'load_context_eager']) {
        const entries = fm[key] ?? [];
        if (!Array.isArray(entries)) {
            continue;
        }
        for (const entry of entries) {
            if (typeof entry !== 'string') {
                continue;
            }
            let blocked = false;
            for (const needle of FORBIDDEN_SUBSTRINGS) {
                if (entry.includes(needle)) {
                    const ig = _ignored(needle, ignores, 'substring');
                    if (ig) {
                        audited.push([_relToRoot(ruleFile), ig]);
                        continue;
                    }
                    viols.push({
                        file: _relToRoot(ruleFile),
                        line: 0,
                        kind: `${key}-forbidden`,
                        detail: `forbidden substring ${_pyRepr(needle)} in entry ${_pyRepr(entry)}`,
                    });
                    blocked = true;
                    break;
                }
            }
            if (blocked) {
                continue;
            }
            const target = path.resolve(ruleDir, entry);
            if (!_isFile(target)) {
                viols.push({
                    file: _relToRoot(ruleFile),
                    line: 0,
                    kind: `${key}-missing`,
                    detail: `${_pyRepr(entry)} does not resolve to an existing file`,
                });
            }
        }
    }
}

function _check_body(
    ruleFile: string,
    body: string,
    viols: Violation[],
    ignores: IgnoreEntry[],
    audited: Array<[string, IgnoreEntry]>,
): void {
    const ruleDir = path.dirname(ruleFile);
    const lines = _splitlines(body);
    for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
        const line = lines[lineNum - 1] as string;
        for (const needle of FORBIDDEN_SUBSTRINGS) {
            if (line.includes(needle)) {
                const ig = _ignored(needle, ignores, 'substring');
                if (ig) {
                    audited.push([`${_relToRoot(ruleFile)}:${lineNum}`, ig]);
                    continue;
                }
                viols.push({
                    file: _relToRoot(ruleFile),
                    line: lineNum,
                    kind: 'body-forbidden',
                    detail: `forbidden substring ${_pyRepr(needle)}`,
                });
            }
        }
        _LINK_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = _LINK_RE.exec(line)) !== null) {
            const link = m[1] as string;
            if (
                link.startsWith('http://') ||
                link.startsWith('https://') ||
                link.startsWith('mailto:') ||
                link.startsWith('#')
            ) {
                continue;
            }
            if (!link.endsWith('.md')) {
                continue;
            }
            if (UNCHECKED_LINK_PREFIXES.some((p) => link.startsWith(p))) {
                continue;
            }
            const target = path.resolve(ruleDir, link);
            if (!_isFile(target)) {
                viols.push({
                    file: _relToRoot(ruleFile),
                    line: lineNum,
                    kind: 'body-link-missing',
                    detail: `link target ${_pyRepr(link)} does not resolve`,
                });
            }
        }
    }
}

/**
 * Mirror Python's `repr()` for the strings used in this script (`!r`).
 * Python prefers single quotes; switches to double quotes only when the string
 * contains a single quote but no double quote. None of the paths/needles here
 * contain quotes, so single-quote wrapping is faithful; the general rule is
 * implemented for completeness.
 */
function _pyRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const useDouble = hasSingle && !hasDouble;
    const quote = useDouble ? '"' : "'";
    let body = s.replace(/\\/g, '\\\\');
    if (useDouble) {
        body = body.replace(/"/g, '\\"');
    } else {
        body = body.replace(/'/g, "\\'");
    }
    body = body.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
    return `${quote}${body}${quote}`;
}

/** Sorted `*.md` immediate children of `RULES_DIR` (mirrors `sorted(glob('*.md'))`). */
function _globMdSorted(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out = names.filter((n) => n.endsWith('.md')).map((n) => path.join(dir, n));
    out.sort();
    return out;
}

function main(): number {
    if (!_isDir(RULES_DIR)) {
        process.stderr.write(`❌  ${RULES_DIR} not found — run condensation first\n`);
        return 3;
    }
    const viols: Violation[] = [];
    const audited: Array<[string, IgnoreEntry]> = [];
    for (const ruleFile of _globMdSorted(RULES_DIR)) {
        const text = fs.readFileSync(ruleFile, 'utf-8');
        const [fm, body] = _split_frontmatter(text);
        const ignores: IgnoreEntry[] = fm !== null ? _parse_ignores(fm) : [];
        if (fm !== null) {
            _check_load_context(ruleFile, fm, viols, ignores, audited);
        }
        _check_body(ruleFile, body, viols, ignores, audited);
    }
    if (audited.length > 0) {
        process.stdout.write('ℹ️   validator_ignore audit:\n');
        for (const [loc, ig] of audited) {
            process.stdout.write(`    ${loc} — [${ig.kind}] ${_pyRepr(ig.pattern)} → ${ig.reason}\n`);
        }
        process.stdout.write('\n');
    }
    if (viols.length > 0) {
        for (const v of viols) {
            const loc = v.line ? `${v.file}:${v.line}` : v.file;
            process.stdout.write(`❌  [${v.kind}] ${loc} — ${v.detail}\n`);
        }
        process.stdout.write(`\n${viols.length} violation(s) in dist/agent-src/rules/\n`);
        return 1;
    }
    const ruleCount = _globMdSorted(RULES_DIR).length;
    if (!QUIET) {
        process.stdout.write(
            `✅  condensed-path check clean (${ruleCount} rules, ${audited.length} ignore(s) audited)\n`,
        );
    }
    return 0;
}

// Run the CLI only when executed directly, not when imported by tests.
const isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
    process.exit(main());
}

export {
    type Violation,
    type IgnoreEntry,
    _split_frontmatter,
    _parse_ignores,
    _ignored,
    main,
    ROOT,
    RULES_DIR,
    FORBIDDEN_SUBSTRINGS,
    UNCHECKED_LINK_PREFIXES,
};
