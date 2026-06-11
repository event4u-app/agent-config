#!/usr/bin/env tsx
/**
 * Lint guard: `module-management` SKILL must stay framework-neutral.
 *
 * TypeScript twin of `src/scripts/check_module_management_neutral.py`
 * (ADR-088, Phase 4 / Wave 4c). CLI contract mirrored EXACTLY — no
 * flags, exit codes (0 clean, 2 violation / missing file), byte-identical
 * messages and stdout/stderr split.
 *
 * Phase C Step 5 of road-to-configurable-modules. Refuses two regressions:
 *
 * 1. `framework:` frontmatter key is back (locks the skill to one stack
 *    again).
 * 2. `app/Modules/` literal appears outside the explicitly-labeled
 *    "Laravel HMVC carve-out" section (drift back to a Laravel-only body).
 *
 * Stack-specific paths inside their own carve-out sections (Laravel HMVC,
 * Symfony DDD-lite, Node monorepo, Python src layout, Go internal) are
 * allowed by construction — the section header is the carve-out boundary.
 *
 * Exit codes:
 *     0 — file clean
 *     2 — lint violation (regression)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SKILL_PATH = path.join(
    REPO_ROOT,
    'src',
    'skills',
    'module-management',
    'SKILL.md',
);

const CARVE_OUT_HEADER = '### Laravel HMVC carve-out';
const FRONTMATTER_BANNED_KEYS = ['framework:'] as const;
// `source` mirrors the Python `pattern.pattern` string byte-for-byte (used in
// violation messages). JS `RegExp.source` escapes `/` as `\/`, which would
// diverge from Python's `.pattern`, so the message text comes from `source`,
// not the compiled `re.source`.
interface BannedPattern {
    re: RegExp;
    source: string;
}
const BODY_BANNED_PATTERNS: readonly BannedPattern[] = [
    // Python pattern strings (re.Pattern.pattern), used verbatim in messages.
    // `\bapp/Modules/` → runtime "\bapp/Modules/" (one backslash before b).
    { re: /\bapp\/Modules\//, source: '\\bapp/Modules/' },
    // `App\\\\Modules\\\\` → runtime "App\\\\Modules\\\\" (four backslashes each).
    { re: /App\\\\Modules\\\\/, source: 'App\\\\\\\\Modules\\\\\\\\' },
];

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** POSIX relative path of `child` under `root` (mirrors relative_to().as_posix-ish for display). */
function _relToPosix(child: string, root: string): string {
    return path.relative(root, child).split(path.sep).join('/');
}

/** Python `repr()` of a single string — single-quoted, with escapes. */
function _pyRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        if (ch === '\\') {
            out += '\\\\';
        } else if (ch === quote) {
            out += '\\' + ch;
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else {
            out += ch;
        }
    }
    out += quote;
    return out;
}

/** Mirror Python `str.splitlines()` — splits on \n / \r\n / \r, drops trailing. */
function _splitlines(text: string): string[] {
    if (text === '') return [];
    const parts = text.split(/\r\n|\r|\n/);
    // Python splitlines drops a single trailing line terminator (no trailing '').
    if (parts.length > 0 && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

/** Return `[frontmatter, body]` — body starts after closing `---`. */
function _split_frontmatter(text: string): [string, string] {
    if (!text.startsWith('---\n')) {
        return ['', text];
    }
    const end = text.indexOf('\n---\n', 4);
    if (end < 0) {
        return ['', text];
    }
    return [text.slice(4, end), text.slice(end + 5)];
}

/**
 * Locate `### Laravel HMVC carve-out` and return `[start, end]` line indices.
 * `end` is exclusive and points at the next `### ` header (or EOF).
 * Returns `null` if the carve-out is missing.
 */
function _laravel_carveout_span(body: string): [number, number] | null {
    const lines = _splitlines(body);
    let start: number | null = null;
    for (let idx = 0; idx < lines.length; idx++) {
        if (lines[idx]!.trim() === CARVE_OUT_HEADER) {
            start = idx;
            break;
        }
    }
    if (start === null) {
        return null;
    }
    let end = lines.length;
    for (let idx = start + 1; idx < lines.length; idx++) {
        if (lines[idx]!.startsWith('### ')) {
            end = idx;
            break;
        }
    }
    return [start, end];
}

/** Return human-readable violations from the SKILL body. */
function _scan_body(body: string): string[] {
    const span = _laravel_carveout_span(body);
    if (span === null) {
        return [
            'Laravel HMVC carve-out section ' +
                `(${_pyRepr(CARVE_OUT_HEADER)}) missing — add it back before ` +
                'moving Laravel-specific prose around.',
        ];
    }
    const [carve_start, carve_end] = span;
    const lines = _splitlines(body);
    const violations: string[] = [];
    for (let idx = 0; idx < lines.length; idx++) {
        if (carve_start <= idx && idx < carve_end) {
            continue;
        }
        const line = lines[idx]!;
        for (const pattern of BODY_BANNED_PATTERNS) {
            if (pattern.re.test(line)) {
                violations.push(
                    `line ${idx + 1}: ${_pyRepr(pattern.source)} outside the ` +
                        'Laravel HMVC carve-out section ' +
                        `— ${_pyRepr(line.trim())}`,
                );
                break;
            }
        }
    }
    return violations;
}

function _scan_frontmatter(fm: string): string[] {
    const violations: string[] = [];
    for (const line of _splitlines(fm)) {
        const stripped = line.trim();
        for (const banned of FRONTMATTER_BANNED_KEYS) {
            if (stripped.startsWith(banned)) {
                violations.push(
                    `frontmatter has banned key ${_pyRepr(banned)} — ` +
                        'module-management is stack-agnostic; ' +
                        'stack hints live in body carve-outs',
                );
            }
        }
    }
    return violations;
}

function main(): number {
    if (!_isFile(SKILL_PATH)) {
        process.stderr.write(`error: SKILL.md not found at ${SKILL_PATH}\n`);
        return 2;
    }
    const text = fs.readFileSync(SKILL_PATH, 'utf-8');
    const [fm, body] = _split_frontmatter(text);
    const issues = [..._scan_frontmatter(fm), ..._scan_body(body)];
    const rel = _relToPosix(SKILL_PATH, REPO_ROOT);
    if (issues.length === 0) {
        process.stdout.write(`✅  ${rel} framework-neutral check: clean\n`);
        return 0;
    }
    process.stderr.write(`❌  ${rel} framework-neutral check: FAIL\n`);
    for (const issue of issues) {
        process.stderr.write(`   ${issue}\n`);
    }
    process.stderr.write(
        '   Fix: keep stack-specific prose inside its labeled ' +
            'carve-out section; do not put `framework:` back into ' +
            'frontmatter.\n',
    );
    return 2;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    REPO_ROOT,
    SKILL_PATH,
    CARVE_OUT_HEADER,
    FRONTMATTER_BANNED_KEYS,
    BODY_BANNED_PATTERNS,
    _split_frontmatter,
    _laravel_carveout_span,
    _scan_body,
    _scan_frontmatter,
    main,
};
