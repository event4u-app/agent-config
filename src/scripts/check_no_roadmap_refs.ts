#!/usr/bin/env tsx
/**
 * No-roadmap-references checker.
 *
 * TypeScript twin of `src/scripts/check_no_roadmap_refs.py` (ADR-092,
 * Phase 4 / Wave 4a). The CLI contract is mirrored EXACTLY — `--format`
 * / `--root` flags, exit codes (0 clean, 1 violations, 3 internal error),
 * stdout/stderr split, byte-identical finding messages, same scan trees
 * and order, same fenced-code-block skipping, same self-documenting
 * allowlist. No behaviour changes — latent bugs replicated.
 *
 * Stable artifacts (rules, skills, commands, contexts, guidelines, AGENTS.md,
 * README, copilot-instructions) must NOT cite a specific roadmap file in
 * `agents/roadmaps/`. Roadmap files are transient — archived, skipped, or
 * deleted as work completes — and stable artifacts citing them rot.
 *
 * Allowed: directory mentions (`agents/roadmaps/`, `agents/roadmaps/archive/`,
 * `agents/roadmaps/skipped/`). Forbidden: specific `*.md` files inside those
 * directories.
 *
 * Contract: .agent-src.uncondensed/rules/no-roadmap-references.md
 *
 * Exit codes: 0 = clean, 1 = violations, 3 = internal error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// src/scripts/check_no_roadmap_refs.ts → three dirs up is the repo root.
// Mirrors the Python `Path(__file__).resolve().parent.parent.parent`.
const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// Stable artefact trees — every `*.md` below MUST be free of roadmap-file
// citations. Directory mentions stay allowed (the regex below excludes them).
const STABLE_TREES = [
    '.agent-src.uncondensed/rules',
    '.agent-src.uncondensed/skills',
    '.agent-src.uncondensed/commands',
    '.agent-src.uncondensed/contexts',
    '.agent-src.uncondensed/templates',
    '.agent-src.uncondensed/personas',
    'agents/settings/contexts',
    'docs/guidelines',
    'docs/contracts',
] as const;

// Stable single-file artefacts at well-known paths.
const STABLE_FILES = [
    'AGENTS.md',
    'README.md',
    'copilot-instructions.md',
    'docs/architecture.md',
    'docs/customization.md',
    'docs/getting-started.md',
    'docs/catalog.md',
] as const;

// Roadmap-file pattern: any `*.md` file under `agents/roadmaps/` at any
// depth (including `archive/`, `skipped/`, and nested topical subfolders
// like `agent-memory/`). Directory-only mentions (`agents/roadmaps/`
// with trailing slash, no filename) and placeholder mentions like
// `agents/roadmaps/<file>.md` (angle-bracket placeholder) do NOT match.
const ROADMAP_FILE_RE =
    /agents\/roadmaps\/(?:[a-z0-9][a-z0-9_-]*\/)*[a-z0-9][a-z0-9_-]*\.md/gi;

// Files that may legitimately quote forbidden patterns inside backticks for
// documentation purposes — the rule itself, the companion CI script docs,
// and the contract doc that names the rule.
const SELF_DOCUMENTING_ALLOWLIST: ReadonlySet<string> = new Set([
    '.agent-src.uncondensed/rules/no-roadmap-references.md',
    'docs/guidelines/agent-infra/no-roadmap-references.md',
]);

interface Violation {
    file: string;
    line: number;
    match: string;
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** POSIX relative path of `target` under `root` (str(Path.relative_to)). */
function _relTo(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

/** Recursively list `*.md` files under `dir`, sorted (mirrors sorted(rglob)). */
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

function _scan_file(p: string, root: string): Violation[] {
    const rel = _relTo(p, root);
    if (SELF_DOCUMENTING_ALLOWLIST.has(rel)) {
        return [];
    }
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        return [];
    }
    const out: Violation[] = [];
    let inFence = false;
    const lines = text.split('\n');
    for (let idx = 0; idx < lines.length; idx++) {
        const n = idx + 1;
        const line = lines[idx]!;
        // Skip fenced code blocks — path listings inside ``` are functional
        // constants (command contracts, runtime checks), not link rot.
        const stripped = line.replace(/^\s+/, '');
        if (stripped.startsWith('```')) {
            inFence = !inFence;
            continue;
        }
        if (inFence) {
            continue;
        }
        ROADMAP_FILE_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = ROADMAP_FILE_RE.exec(line)) !== null) {
            out.push({ file: rel, line: n, match: m[0] });
        }
    }
    return out;
}

function _collect_targets(root: string): string[] {
    const targets: string[] = [];
    for (const d of STABLE_TREES) {
        const base = path.join(root, d);
        if (!_exists(base)) {
            continue;
        }
        targets.push(..._rglobMdSorted(base));
    }
    for (const f of STABLE_FILES) {
        const p = path.join(root, f);
        if (_exists(p)) {
            targets.push(p);
        }
    }
    return targets;
}

function scan(root: string): Violation[] {
    const out: Violation[] = [];
    for (const p of _collect_targets(root)) {
        out.push(..._scan_file(p, root));
    }
    return out;
}

function format_text(violations: Violation[]): string {
    if (violations.length === 0) {
        return '✅  No roadmap-file references in stable artifacts.';
    }
    const lines: string[] = [
        `❌  Found ${violations.length} roadmap reference(s) in stable artifacts:\n`,
    ];
    for (const v of violations) {
        lines.push(`  🔴 ${v.file}:${v.line}  →  ${v.match}`);
    }
    lines.push(
        '\nPromote the durable conclusion to agents/settings/contexts/ and cite that ' +
            'instead. See .agent-src.uncondensed/rules/no-roadmap-references.md.',
    );
    return lines.join('\n');
}

/** Mirror Python `json.dumps(obj, indent=2)` with `ensure_ascii=True`. */
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
    root: string;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let format: 'text' | 'json' = 'text';
    let root = ROOT;
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
        } else if (arg === '--root') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --root: expected one argument');
            }
            root = v;
        } else if (arg.startsWith('--root=')) {
            root = arg.slice('--root='.length);
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: check_no_roadmap_refs [-h] [--format {text,json}] [--root ROOT]\n',
            );
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { format, root };
}

function _argparse_error(message: string): never {
    process.stderr.write(`check_no_roadmap_refs: error: ${message}\n`);
    process.exit(2);
}

function main(): number {
    const args = parse_args(process.argv.slice(2));
    let violations: Violation[];
    try {
        violations = scan(args.root);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        process.stderr.write(`Internal error: ${msg}\n`);
        return 3;
    }
    if (args.format === 'json') {
        process.stdout.write(_json_dumps_ascii(violations) + '\n');
    } else {
        process.stdout.write(format_text(violations) + '\n');
    }
    return violations.length ? 1 : 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    type Violation,
    ROOT,
    STABLE_TREES,
    STABLE_FILES,
    ROADMAP_FILE_RE,
    SELF_DOCUMENTING_ALLOWLIST,
    scan,
    format_text,
    main,
};
