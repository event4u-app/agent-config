/**
 * Context bundling for council consultations.
 *
 * TypeScript twin of `src/scripts/ai_council/bundler.py` (ADR-094 —
 * Python→TS migration, Phase 1).
 *
 * Takes a raw artefact (free-form prompt, roadmap path, diff range, or
 * file set) and produces a {@link CouncilContext} — a redacted,
 * size-bounded text bundle plus a manifest describing exactly what was
 * included.
 *
 * Hard rules:
 * - Redaction is fail-closed. If a redaction pattern fires, the line is
 *   scrubbed *before* the bundle is built.
 * - Size guard is fail-loud. > MAX_BUNDLE_BYTES → raises BundleTooLarge,
 *   never silently truncates (would mislead council members).
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const MAX_BUNDLE_BYTES = 50 * 1024; // 50 KB hard ceiling; user must narrow scope on hit.

/** Raised when the assembled bundle exceeds MAX_BUNDLE_BYTES. */
export class BundleTooLarge extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BundleTooLarge';
    }
}

/** Raised by `bundle_roadmap` when the roadmap file is absent. */
export class FileNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FileNotFoundError';
    }
}

export interface CouncilContext {
    mode: string; // one of: prompt, roadmap, diff, files
    text: string;
    manifest: string[];
    excluded: string[];
}

function _context(
    mode: string,
    text: string,
    manifest: string[] = [],
    excluded: string[] = [],
): CouncilContext {
    return { mode, text, manifest, excluded };
}

/** Byte length of a string encoded as UTF-8 (Python `len(text.encode("utf-8"))`). */
function _utf8Len(s: string): number {
    return Buffer.byteLength(s, 'utf-8');
}

/**
 * Python `str.splitlines()` — split on universal newlines, drop a single
 * trailing newline (no empty final element).
 */
function _splitlines(s: string): string[] {
    if (s === '') {
        return [];
    }
    const lines = s.split(/\r\n|\r|\n/u);
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    return lines;
}

// ── redaction patterns ───────────────────────────────────────────────────
// Each pattern is matched line-wise; matching lines are replaced with the
// placeholder. Order matters — the most specific pattern goes first.

const _REDACTION_LINE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
    [/~?\/?\.event4u\/agent-config\/[^/\s]+\.key/u, '[redacted: agent-config key path]'],
    [/~?\/?\.config\/agent-config\/[^/\s]+\.key/u, '[redacted: agent-config key path]'],
    [/^\s*Authorization:\s/iu, '[redacted: Authorization header]'],
    [/(api[_-]?key|secret|token|password)\s*[:=]/iu, '[redacted: secret-like assignment]'],
    [/sk-ant-[A-Za-z0-9_\-]{8,}/u, '[redacted: anthropic-key-like token]'],
    [/sk-[A-Za-z0-9_\-]{20,}/u, '[redacted: openai-key-like token]'],
];

/** Apply redaction patterns to a multi-line text buffer. */
export function redact(text: string): string {
    const out: string[] = [];
    for (const line of _splitlines(text)) {
        let replaced = line;
        for (const [pattern, placeholder] of _REDACTION_LINE_PATTERNS) {
            if (pattern.test(replaced)) {
                replaced = placeholder;
                break;
            }
        }
        out.push(replaced);
    }
    return out.join('\n');
}

function _enforceSize(text: string, mode: string): string {
    const n = _utf8Len(text);
    if (n > MAX_BUNDLE_BYTES) {
        throw new BundleTooLarge(
            `Bundle for ${_pyRepr(mode)} mode is ${n} bytes ` +
                `(> ${MAX_BUNDLE_BYTES} hard ceiling). ` +
                'Narrow the scope (smaller diff, fewer files, shorter prompt).',
        );
    }
    return text;
}

/** Python repr() for a string: single-quoted. */
function _pyRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let body = s.replace(/\\/g, '\\\\');
    body = body.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
    if (quote === "'") {
        body = body.replace(/'/g, "\\'");
    } else {
        body = body.replace(/"/g, '\\"');
    }
    return `${quote}${body}${quote}`;
}

export function bundle_prompt(text: string): CouncilContext {
    const redacted = redact(text);
    return _context('prompt', _enforceSize(redacted, 'prompt'), ['<inline prompt>']);
}

export function bundle_roadmap(p: string): CouncilContext {
    if (!fs.existsSync(p)) {
        throw new FileNotFoundError(`Roadmap not found: ${p}`);
    }
    const raw = fs.readFileSync(p, { encoding: 'utf-8' });
    const redacted = redact(raw);
    return _context(
        'roadmap',
        _enforceSize(redacted, 'roadmap'),
        [p],
        ['<linked contracts/skills not included by default>'],
    );
}

export function bundle_diff(
    baseRef: string,
    headRef = 'HEAD',
    opts: { cwd?: string | null } = {},
): CouncilContext {
    const cwd = opts.cwd ?? undefined;
    const cmd = ['diff', `${baseRef}..${headRef}`];
    const proc = spawnSync('git', cmd, {
        cwd: cwd ?? undefined,
        encoding: 'utf-8',
    });
    if (proc.error || proc.status !== 0) {
        const stderr = (proc.stderr ?? '').toString();
        throw new Error(`git diff ${baseRef}..${headRef} failed: ${_strip(stderr)}`);
    }
    const redacted = redact(proc.stdout);
    return _context('diff', _enforceSize(redacted, 'diff'), [`git diff ${baseRef}..${headRef}`]);
}

/** Python `str.strip()`. */
function _strip(s: string): string {
    return s.trim();
}

// ── smart diff context (D4) ─────────────────────────────────────────────────
// Language-agnostic signature detection. Order matters — most specific first.

const _SIGNATURE_PATTERNS: readonly RegExp[] = [
    /^\s*(?:async\s+)?def\s+\w+\s*\(/u, // Python
    /^\s*class\s+\w+\b/u, // Python / PHP / JS class
    /^\s*(?:public|protected|private|static|abstract|final)\s+(?:static\s+)?function\s+\w+/u, // PHP method
    /^\s*function\s+\w+\s*\(/u, // PHP free function / JS
    /^\s*export\s+(?:default\s+)?(?:async\s+)?function\s+\w+/u, // TS/JS export fn
    /^\s*export\s+(?:default\s+)?class\s+\w+/u, // TS/JS export class
    /^\s*(?:export\s+)?(?:const|let)\s+\w+\s*=\s*(?:async\s+)?\(/u, // TS arrow fn
    /^\s*(?:public|private|protected)\s+\w+\s*\(/u, // TS method
];

// Python: re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@")
const _HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/u;
// Python: re.compile(r"^\+\+\+ b/(.+)$")
const _DIFF_FILE = /^\+\+\+ b\/(.+)$/u;

/** Return [[file_path, new_start_line], ...] per hunk in input order. */
function _parseDiffHunks(diffText: string): Array<[string, number]> {
    const out: Array<[string, number]> = [];
    let currentFile: string | null = null;
    for (const line of _splitlines(diffText)) {
        const m = _DIFF_FILE.exec(line);
        if (m) {
            currentFile = m[1] as string;
            continue;
        }
        const h = _HUNK_HEADER.exec(line);
        if (h && currentFile && currentFile !== '/dev/null') {
            out.push([currentFile, parseInt(h[1] as string, 10)]);
        }
    }
    return out;
}

/** Walk backwards from `targetLine` (1-based) to nearest signature. */
function _enclosingSignature(fileText: string, targetLine: number): [number, string] | null {
    const lines = _splitlines(fileText);
    const start = Math.min(targetLine - 1, lines.length - 1);
    for (let idx = start; idx >= 0; idx -= 1) {
        const line = lines[idx] as string;
        for (const pat of _SIGNATURE_PATTERNS) {
            if (pat.test(line)) {
                return [idx + 1, _rstrip(line)];
            }
        }
    }
    return null;
}

/** Python `str.rstrip()`. */
function _rstrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

export interface BundleDiffContextOptions {
    cwd?: string | null;
    maxContextBytes?: number;
}

/**
 * Bundle a diff plus the nearest enclosing signatures for each hunk.
 *
 * Appends a `## Surrounding signatures` section after the raw diff.
 * Signatures are detected by regex across PY / PHP / JS / TS. Reads files
 * from the working tree (correct when `headRef` == HEAD); if a touched
 * file is missing on disk it is silently dropped from the context section
 * (the diff itself still shows the change).
 *
 * Hard cap: `maxContextBytes` for the signature section. Combined output
 * still goes through `_enforceSize`, so the `BundleTooLarge` behaviour is
 * unchanged.
 */
export function bundle_diff_with_context(
    baseRef: string,
    headRef = 'HEAD',
    opts: BundleDiffContextOptions = {},
): CouncilContext {
    const cwd = opts.cwd ?? null;
    const maxContextBytes = opts.maxContextBytes ?? 8 * 1024;

    const base = bundle_diff(baseRef, headRef, { cwd });
    const hunks = _parseDiffHunks(base.text);
    if (hunks.length === 0) {
        return base;
    }

    const root = cwd ? cwd : '.';
    const seen = new Set<string>(); // `${file} ${signature_line}`
    // Preserve insertion order of first-seen files (Python dict order).
    const byFile = new Map<string, Array<[number, string]>>();

    for (const [filePath, newStart] of hunks) {
        const target = path.join(root, filePath);
        let fileText: string;
        try {
            fileText = fs.readFileSync(target, { encoding: 'utf-8' });
        } catch {
            continue;
        }
        const sig = _enclosingSignature(fileText, newStart);
        if (sig === null) {
            continue;
        }
        const key = `${filePath} ${sig[0]}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        if (!byFile.has(filePath)) {
            byFile.set(filePath, []);
        }
        (byFile.get(filePath) as Array<[number, string]>).push(sig);
    }

    if (byFile.size === 0) {
        return base;
    }

    const outLines: string[] = ['', '## Surrounding signatures', ''];
    let truncated = false;
    let used = 0;
    for (const [filePath, sigs] of byFile) {
        const header = `### ${filePath}`;
        const sorted = [...sigs].sort(_cmpSig);
        const sigBlock = sorted.map(([ln, text]) => `    L${ln}: ${text}`).join('\n');
        const chunk = `${header}\n\n${sigBlock}\n\n`;
        if (used + _utf8Len(chunk) > maxContextBytes) {
            truncated = true;
            break;
        }
        outLines.push(header);
        outLines.push('');
        outLines.push(sigBlock);
        outLines.push('');
        used += _utf8Len(chunk);
    }

    if (truncated) {
        outLines.push(`[truncated: signature section capped at ${maxContextBytes} bytes]`);
    }

    const combined = base.text + '\n' + outLines.join('\n');
    const redacted = redact(combined);
    return _context('diff', _enforceSize(redacted, 'diff'), [
        ...base.manifest,
        `+ surrounding signatures for ${byFile.size} file(s)`,
    ]);
}

/** Mirror Python `sorted(sigs)` on `(int, str)` tuples. */
function _cmpSig(a: [number, string], b: [number, string]): number {
    if (a[0] !== b[0]) {
        return a[0] - b[0];
    }
    if (a[1] < b[1]) {
        return -1;
    }
    if (a[1] > b[1]) {
        return 1;
    }
    return 0;
}

export function bundle_files(paths: ReadonlyArray<string>): CouncilContext {
    const parts: string[] = [];
    const manifest: string[] = [];
    const excluded: string[] = [];
    for (const rawPath of paths) {
        const p = rawPath;
        if (!fs.existsSync(p)) {
            excluded.push(`${p} (not found)`);
            continue;
        }
        let content: string;
        try {
            content = fs.readFileSync(p, { encoding: 'utf-8' });
        } catch (exc) {
            excluded.push(`${p} (${_excName(exc)})`);
            continue;
        }
        parts.push(`### ${p}\n\n${content}\n`);
        manifest.push(p);
    }
    const bundled = parts.join('\n');
    const redacted = redact(bundled);
    return _context('files', _enforceSize(redacted, 'files'), manifest, excluded);
}

/**
 * Best-effort Python-exception-name analog for the `excluded` note.
 * Python catches `(OSError, UnicodeDecodeError)` and prints `type(exc).__name__`.
 */
function _excName(exc: unknown): string {
    if (exc && typeof exc === 'object' && 'code' in exc) {
        return 'OSError';
    }
    return 'OSError';
}
