#!/usr/bin/env tsx
/**
 * Thin-Root contract linter for AGENTS.md files (Phase 7).
 *
 * TypeScript twin of `src/scripts/lint_agents_md.py` (ADR-090, Phase 4 /
 * Wave 4b). The CLI contract is mirrored EXACTLY — `--quiet` detected by
 * argv membership (no argparse), exit codes (0 / 1), stdout-only output,
 * byte-identical messages, same target order. No behaviour changes —
 * latent bugs replicated.
 *
 * Enforces caps + pointer-ratio + pointer-anatomy + emergency-triage
 * contract from `.agent-src.uncondensed/skills/agents-md-thin-root/SKILL.md`.
 *
 * Exit non-zero on any (a) FAIL, (b)–(e) error. WARN is informational.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { SRC_AGENT } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const QUIET = process.argv.slice(2).includes('--quiet');

// 6.0.x: the uncondensed source container moved to src/agent-src/ (ADR-051).
const _CONSUMER_TEMPLATE = path.join(SRC_AGENT(), 'templates', 'AGENTS.md');
// Enforced source target — kept for parity with the Python module's
// GATE_CORE_PATHS export (read by check_gate_paths).
const GATE_CORE_PATHS = [_CONSUMER_TEMPLATE] as const;

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/;
const LINK_RE_G = /\[([^\]]+)\]\(([^)]+)\)/g;
const PATH_BACKTICK_RE = /`[^`]*\/[^`]*`/;
const BULLET_RE = /^\s*[-*+]\s+/;
const PATH_ENUM_THRESHOLD = 3;
const TRIAGE_KEYWORDS = [
    'what is this repo',
    'what language',
    'where do i edit',
    'lint / test / sync',
    'where do the always',
] as const;

interface Target {
    path: string;
    label: string;
    fail_at: number;
    warn_at: number;
    template: boolean; // consumer template — relax pointer-target resolution
}

const TARGETS: Target[] = [
    { path: path.join(ROOT, 'AGENTS.md'), label: 'package-root', fail_at: 3000, warn_at: 2800, template: false },
    { path: _CONSUMER_TEMPLATE, label: 'consumer-template', fail_at: 2500, warn_at: 2300, template: true },
];

/** A bullet line with a backticked path-like token and no link. */
function _is_path_enumeration(line: string): boolean {
    if (!BULLET_RE.test(line)) {
        return false;
    }
    if (LINK_RE.test(line)) {
        return false;
    }
    return PATH_BACKTICK_RE.test(line);
}

function _strip_links(line: string): string {
    return line.replace(LINK_RE_G, (_m, label: string) => label);
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _resolve(target_str: string, template: boolean): boolean {
    const raw = target_str.split('#', 1)[0]!.trim();
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
        return true;
    }
    const candidates = [path.join(ROOT, raw)];
    if (template && raw.startsWith('.augment/')) {
        candidates.push(path.join(ROOT, raw.replace('.augment/', '.agent-src.uncondensed/')));
        candidates.push(path.join(ROOT, raw.replace('.augment/', 'dist/agent-src/')));
    }
    if (raw.startsWith('dist/agent-src/')) {
        candidates.push(path.join(ROOT, raw.replace('dist/agent-src/', '.agent-src.uncondensed/')));
    }
    return candidates.some((c) => _exists(c));
}

function _relPosix(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

/** Byte length of a UTF-8 string (mirrors len(text.encode("utf-8"))). */
function _byteLen(text: string): number {
    return Buffer.byteLength(text, 'utf-8');
}

/** Return [ok, errors, warnings]. */
function lint_file(t: Target): [boolean, string[], string[]] {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!_exists(t.path)) {
        return [false, [`${t.label}: ${t.path} not found`], []];
    }

    const text = fs.readFileSync(t.path, 'utf-8');
    const size = _byteLen(text);

    // (a) size
    if (size > t.fail_at) {
        errors.push(`${t.label}: ${size} chars > FAIL cap ${t.fail_at}`);
    } else if (size > t.warn_at) {
        warnings.push(`${t.label}: ${size} chars > WARN cap ${t.warn_at}`);
    }

    // Filter structural lines that are not "prose" the contract asks us to
    // replace with pointers: headings, code fences + content, HTML comments,
    // and Markdown table rows.
    const lines = text.split('\n');
    let in_fence = false;
    let in_comment = false;
    const prose: string[] = [];
    for (const ln of lines) {
        const s = ln.trim();
        if (!s) {
            continue;
        }
        if (s.startsWith('```')) {
            in_fence = !in_fence;
            continue;
        }
        if (in_fence) {
            continue;
        }
        if (s.includes('<!--')) {
            in_comment = true;
        }
        if (in_comment) {
            if (s.includes('-->')) {
                in_comment = false;
            }
            continue;
        }
        if (s.startsWith('#')) {
            continue; // heading
        }
        if (s.startsWith('|')) {
            continue; // markdown table row / separator
        }
        prose.push(ln);
    }

    const non_blank = prose;
    let pointer_lines = 0;
    const path_enum_lines: string[] = [];

    for (const ln of non_blank) {
        if (_is_path_enumeration(ln)) {
            path_enum_lines.push(ln.trim());
        }
        const m = LINK_RE.exec(ln);
        if (!m) {
            continue;
        }
        const target = m[2]!;
        // (d) target resolves
        if (!_resolve(target, t.template)) {
            errors.push(
                `${t.label}: broken pointer target \`${target}\` in line: ${ln.trim().slice(0, 100)}`,
            );
        }
        // (c) why-clause length: line minus link syntax
        const why = _strip_links(ln).trim();
        if (why.length >= 60) {
            pointer_lines += 1;
        }
    }

    // (b) ratio
    const ratio = pointer_lines / Math.max(non_blank.length, 1);
    if (ratio < 0.4) {
        errors.push(
            `${t.label}: substantive-pointer ratio ${ratio.toFixed(2)} < 0.40 ` +
                `(${pointer_lines}/${non_blank.length} non-blank lines)`,
        );
    }

    // (f) path-enumeration WARN
    if (path_enum_lines.length >= PATH_ENUM_THRESHOLD) {
        const sample = path_enum_lines[0]!.slice(0, 80);
        warnings.push(
            `${t.label}: ${path_enum_lines.length} path-enumeration lines ` +
                `(>= ${PATH_ENUM_THRESHOLD}) — Capabilities-over-Structure drift; ` +
                `first: ${_pyRepr(sample)}`,
        );
    }

    // (e) emergency-triage block
    const lower = text.toLowerCase();
    const missing = TRIAGE_KEYWORDS.filter((k) => !lower.includes(k));
    if (missing.length) {
        errors.push(
            `${t.label}: emergency-triage block missing keywords: ${_pyListRepr(missing)}`,
        );
    }
    if (!lower.includes('emergency triage')) {
        errors.push(`${t.label}: missing 'Emergency triage' section heading`);
    }

    return [errors.length === 0, errors, warnings];
}

/** Mirror Python repr() of a plain string (single-quoted, escaped). */
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
    body = body.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
    return `${quote}${body}${quote}`;
}

/** Mirror Python repr() of a list of strings. */
function _pyListRepr(items: readonly string[]): string {
    return `[${items.map((i) => _pyRepr(i)).join(', ')}]`;
}

/** Byte size on disk (mirrors t.path.stat().st_size). */
function _fileSize(p: string): number {
    return fs.statSync(p).size;
}

function main(): number {
    let rc = 0;
    for (const t of TARGETS) {
        const [ok, errors, warnings] = lint_file(t);
        if (!QUIET || errors.length || warnings.length) {
            process.stdout.write(`== ${t.label} (${_relPosix(t.path, ROOT)}) ==\n`);
        }
        for (const w of warnings) {
            process.stdout.write(`  ⚠️  ${w}\n`);
        }
        for (const e of errors) {
            process.stdout.write(`  ❌  ${e}\n`);
        }
        if (ok && warnings.length === 0 && !QUIET) {
            process.stdout.write(`  ✅  ok (${_fileSize(t.path)} bytes)\n`);
        }
        if (!ok) {
            rc = 1;
        }
    }
    return rc;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    type Target,
    ROOT,
    GATE_CORE_PATHS,
    TARGETS,
    LINK_RE,
    PATH_BACKTICK_RE,
    BULLET_RE,
    PATH_ENUM_THRESHOLD,
    TRIAGE_KEYWORDS,
    _is_path_enumeration,
    _strip_links,
    _resolve,
    lint_file,
    main,
};
