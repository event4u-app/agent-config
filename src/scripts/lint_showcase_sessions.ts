#!/usr/bin/env tsx
/**
 * Showcase-sessions linter.
 *
 * TypeScript twin of `src/scripts/lint_showcase_sessions.py` (ADR-094,
 * Phase 4 / Wave 4b). Gates `docs/showcase.md` ↔ `docs/showcase/sessions/`.
 * The CLI contract is mirrored EXACTLY — no flags (argv ignored), exit
 * codes (0 clean, 1 violations), stdout/stderr split, byte-identical
 * finding messages, same reference regex and the same hand-rolled
 * frontmatter parser (including the `_<key>_nested` mapping trick).
 *
 * Rules:
 *   1. Every referenced `<slug>.log` must exist.
 *   2. Each referenced file carries YAML frontmatter with `commit_sha` and
 *      a `metrics:` mapping containing the four required keys.
 *   3. No orphan session files (present on disk but unreferenced).
 *
 * No behaviour changes — `sorted(set)` is rendered as a Python list repr.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/lint_showcase_sessions.ts → parent.parent.parent is the repo root.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SHOWCASE_MD = path.join(ROOT, 'docs', 'showcase.md');
const SESSIONS_DIR = path.join(ROOT, 'docs', 'showcase', 'sessions');

const REQUIRED_METRICS: ReadonlySet<string> = new Set([
    'tool_call_count',
    'reply_chars_mean',
    'memory_hit_ratio',
    'verify_pass_rate',
]);

const REF_RE = /docs\/showcase\/sessions\/([A-Za-z0-9_\-]+)\.log/g;

// Frontmatter value is either a string or a nested mapping (string→string).
type FrontmatterValue = string | Record<string, string>;
type Frontmatter = Record<string, FrontmatterValue>;

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

/** POSIX relative path of `target` under `root`. */
function _relTo(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

/** Mirror Python `repr()` for a single string. */
function _pyReprStr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        const code = ch.codePointAt(0)!;
        if (ch === '\\') {
            out += '\\\\';
        } else if (ch === quote) {
            out += '\\' + quote;
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (code < 0x20 || code === 0x7f) {
            out += '\\x' + code.toString(16).padStart(2, '0');
        } else {
            out += ch;
        }
    }
    out += quote;
    return out;
}

/** Mirror Python `repr()` for a list of strings (the `sorted(missing)` repr). */
function _pyReprStrList(items: readonly string[]): string {
    return '[' + items.map(_pyReprStr).join(', ') + ']';
}

/** Mirror Python `str.partition(":")` — split on first occurrence. */
function _partition(s: string, sep: string): [string, string, string] {
    const idx = s.indexOf(sep);
    if (idx === -1) {
        return [s, '', ''];
    }
    return [s.slice(0, idx), sep, s.slice(idx + sep.length)];
}

function _parse_frontmatter(text: string): Frontmatter | null {
    if (!text.startsWith('---\n')) {
        return null;
    }
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) {
        return null;
    }
    const block: Frontmatter = {};
    let currentKey: string | null = null;
    let nested: Record<string, string> = {};
    const body = text.slice(4, end);
    for (const raw of body.split('\n')) {
        if (raw.trim() === '') {
            continue;
        }
        if (raw.startsWith('  ') && currentKey) {
            const [k, , v] = _partition(raw.trim(), ':');
            nested[k.trim()] = v.trim();
            continue;
        }
        if (!raw.includes(':')) {
            continue;
        }
        const [kRaw, , vRaw] = _partition(raw, ':');
        const v = vRaw.trim();
        if (v === '') {
            currentKey = kRaw.trim();
            nested = {};
            block[currentKey] = '';
            block[`_${currentKey}_nested`] = nested;
        } else {
            block[kRaw.trim()] = v;
            currentKey = null;
        }
    }
    return block;
}

function _validate_session(slug: string): string[] {
    const errors: string[] = [];
    const p = path.join(SESSIONS_DIR, `${slug}.log`);
    if (!_isFile(p)) {
        errors.push(`referenced session missing on disk: ${_relTo(p, ROOT)}`);
        return errors;
    }
    const text = fs.readFileSync(p, 'utf-8');
    const fm = _parse_frontmatter(text);
    if (fm === null) {
        errors.push(`${slug}.log: no YAML frontmatter block`);
        return errors;
    }
    const commitSha = fm['commit_sha'];
    if (!commitSha) {
        errors.push(`${slug}.log: missing or empty \`commit_sha\``);
    }
    const metrics = fm['_metrics_nested'];
    if (typeof metrics !== 'object' || metrics === null) {
        errors.push(`${slug}.log: missing \`metrics:\` mapping`);
    } else {
        const have = new Set(Object.keys(metrics));
        const missing = [...REQUIRED_METRICS].filter((k) => !have.has(k)).sort();
        if (missing.length > 0) {
            errors.push(`${slug}.log: metrics block missing keys: ${_pyReprStrList(missing)}`);
        }
    }
    return errors;
}

function main(): number {
    if (!_isFile(SHOWCASE_MD)) {
        process.stderr.write(`❌  ${_relTo(SHOWCASE_MD, ROOT)} not found\n`);
        return 1;
    }

    const text = fs.readFileSync(SHOWCASE_MD, 'utf-8');
    const referenced = new Set<string>();
    REF_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = REF_RE.exec(text)) !== null) {
        referenced.add(m[1]!);
    }

    const onDisk = new Set<string>();
    if (_isDir(SESSIONS_DIR)) {
        // Python uses `SESSIONS_DIR.glob("*.log")` which matches files AND
        // dirs ending in `.log` (then takes `.stem`); mirror that breadth.
        for (const entry of fs.readdirSync(SESSIONS_DIR)) {
            if (entry.endsWith('.log')) {
                onDisk.add(entry.slice(0, -'.log'.length));
            }
        }
    }

    const errors: string[] = [];

    for (const slug of [...referenced].sort()) {
        errors.push(..._validate_session(slug));
    }

    const orphans = [...onDisk].filter((s) => !referenced.has(s)).sort();
    for (const slug of orphans) {
        errors.push(
            `orphan session: docs/showcase/sessions/${slug}.log ` +
                'is not referenced from docs/showcase.md',
        );
    }

    if (errors.length > 0) {
        process.stderr.write(
            `❌  lint_showcase_sessions: ${errors.length} violation(s) ` +
                `(${referenced.size} referenced, ${onDisk.size} on disk)\n`,
        );
        for (const err of errors) {
            process.stderr.write(`    ${err}\n`);
        }
        return 1;
    }

    if (referenced.size === 0 && onDisk.size === 0) {
        process.stdout.write(
            '✅  lint_showcase_sessions: 0 sessions referenced, 0 on disk ' +
                '(Phase 1.3-1.5 deferred to manual host-agent runs)\n',
        );
    } else {
        process.stdout.write(
            `✅  lint_showcase_sessions: ${referenced.size} session(s) ` +
                `valid (${onDisk.size} on disk)\n`,
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

export {
    ROOT,
    SHOWCASE_MD,
    SESSIONS_DIR,
    REQUIRED_METRICS,
    REF_RE,
    main,
};
