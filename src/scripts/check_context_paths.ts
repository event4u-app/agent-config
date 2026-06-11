#!/usr/bin/env tsx
/**
 * Context-file path & orphan checker.
 *
 * TypeScript twin of `src/scripts/check_context_paths.py` (ADR-088,
 * Phase 4 / Wave 4c). CLI contract mirrored EXACTLY — `--format`
 * (text/json) and `--root` flags, exit codes (0 clean, 1 violations,
 * 3 internal error), byte-identical messages, stdout-only output, same
 * scan trees / order / locked sub-trees / grandfathered files, same
 * orphan self-reference subtraction (latent: substring replace).
 *
 * Validates that every `*.md` under `.agent-src.uncondensed/contexts/`:
 *   1. Lives in a locked sub-tree (or is a grandfathered root file).
 *   2. Does not collide on basename with another context in another sub-tree.
 *   3. Is referenced by at least one rule, skill, command, or other context.
 *
 * Contract: docs/contracts/context-paths.md
 * Exit codes: 0 = clean, 1 = violations, 3 = internal error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CONTEXTS_ROOT = path.join(ROOT, '.agent-src.uncondensed', 'contexts');
// Logical relpath of the contexts root under ROOT (e.g. ".agent-src.uncondensed/contexts").
const CONTEXTS_REL = path.relative(ROOT, CONTEXTS_ROOT).split(path.sep).join('/');

const LOCKED_SUBTREES = [
    'communication/rules-always',
    'communication/rules-auto',
    'judges',
    'analysis',
    'skills',
    'chat-history',
    'execution',
    'authority',
    'contracts',
] as const;

const GRANDFATHERED_ROOT_FILES: ReadonlySet<string> = new Set([
    'augment-infrastructure.md',
    'documentation-hierarchy.md',
    'model-recommendations.md',
    'override-system.md',
    'skills-and-commands.md',
    'subagent-configuration.md',
]);

const REFERENCE_SCAN_DIRS = [
    '.agent-src.uncondensed/rules',
    '.agent-src.uncondensed/skills',
    '.agent-src.uncondensed/commands',
    '.agent-src.uncondensed/contexts',
    'agents/roadmaps',
] as const;

interface Violation {
    file: string;
    kind: string; // "out-of-tree" | "root-not-grandfathered" | "collision" | "orphan"
    detail: string;
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** POSIX relative path of `child` under `root` (mirrors relative_to().as_posix). */
function _relToPosix(child: string, root: string): string {
    return path.relative(root, child).split(path.sep).join('/');
}

/** str(Path) — Python prints the path as constructed (here always absolute). */
function _str(p: string): string {
    return p;
}

/** Recursively list `*.md` under `dir`, SORTED (mirrors sorted(rglob)). */
function _rglobMdSorted(dir: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(current, ent.name);
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
                walk(full);
            } else if (ent.name.endsWith('.md')) {
                out.push(full);
            }
        }
    };
    walk(dir);
    out.sort();
    return out;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _collect_contexts(root: string): string[] {
    const ctxRoot = path.join(root, CONTEXTS_REL);
    if (!_exists(ctxRoot)) {
        return [];
    }
    return _rglobMdSorted(ctxRoot);
}

function _check_path(ctx: string, contexts_root: string): Violation | null {
    const rel = _relToPosix(ctx, contexts_root);
    const parts = rel.split('/');
    if (parts.length === 1) {
        if (!GRANDFATHERED_ROOT_FILES.has(parts[0]!)) {
            return {
                file: _str(ctx),
                kind: 'root-not-grandfathered',
                detail:
                    `new file at contexts/ root — must live in one of ` +
                    `${_pyListRepr([...LOCKED_SUBTREES].sort())} or be added to ` +
                    'GRANDFATHERED_ROOT_FILES via a roadmap revision',
            };
        }
        return null;
    }
    const subtree = parts.slice(0, -1).join('/');
    for (const allowed of LOCKED_SUBTREES) {
        if (subtree === allowed || subtree.startsWith(allowed + '/')) {
            return null;
        }
    }
    return {
        file: _str(ctx),
        kind: 'out-of-tree',
        detail:
            `sub-tree '${subtree}' is not in LOCKED_SUBTREES — see ` +
            'docs/contracts/context-paths.md to add a new sub-tree',
    };
}

function _check_collisions(contexts: string[], contexts_root: string): Violation[] {
    const by_name = new Map<string, string[]>();
    for (const ctx of contexts) {
        const name = path.basename(ctx);
        const list = by_name.get(name);
        if (list) {
            list.push(ctx);
        } else {
            by_name.set(name, [ctx]);
        }
    }
    const out: Violation[] = [];
    for (const [name, paths] of by_name) {
        if (paths.length <= 1) {
            continue;
        }
        const rels = paths.map((p) => _relToPosix(p, contexts_root)).sort();
        for (const p of paths) {
            const selfRel = _relToPosix(p, contexts_root);
            const others = rels.filter((r) => r !== selfRel);
            out.push({
                file: _str(p),
                kind: 'collision',
                detail: `basename '${name}' shared with: ${others.join(', ')}`,
            });
        }
    }
    return out;
}

function _build_reference_corpus(root: string): string {
    const chunks: string[] = [];
    for (const d of REFERENCE_SCAN_DIRS) {
        const base = path.join(root, d);
        if (!_exists(base)) {
            continue;
        }
        for (const f of _rglobMdSorted(base)) {
            try {
                chunks.push(fs.readFileSync(f, 'utf-8'));
            } catch {
                continue;
            }
        }
    }
    return chunks.join('\n');
}

function _replaceAll(haystack: string, needle: string): string {
    // Python str.replace replaces ALL non-overlapping occurrences.
    if (needle === '') {
        return haystack;
    }
    return haystack.split(needle).join('');
}

function _check_orphans(contexts: string[], corpus: string, root: string): Violation[] {
    const out: Violation[] = [];
    for (const ctx of contexts) {
        const rel_src = _relToPosix(ctx, root); // .agent-src.uncondensed/contexts/...
        const rel_short = rel_src.includes('contexts/')
            ? rel_src.slice(rel_src.indexOf('contexts/') + 'contexts/'.length)
            : rel_src;
        const candidates = [rel_src, `contexts/${rel_short}`, rel_short];
        let own_text = '';
        try {
            own_text = fs.readFileSync(ctx, 'utf-8');
        } catch {
            own_text = '';
        }
        const external_corpus = own_text ? _replaceAll(corpus, own_text) : corpus;
        if (!candidates.some((c) => external_corpus.includes(c))) {
            out.push({
                file: _str(ctx),
                kind: 'orphan',
                detail: 'not referenced by any rule, skill, command, or other context',
            });
        }
    }
    return out;
}

function scan(root: string): Violation[] {
    const contexts_root = path.join(root, CONTEXTS_REL);
    const contexts = _collect_contexts(root);
    const violations: Violation[] = [];
    for (const ctx of contexts) {
        const v = _check_path(ctx, contexts_root);
        if (v) {
            violations.push(v);
        }
    }
    violations.push(..._check_collisions(contexts, contexts_root));
    const corpus = _build_reference_corpus(root);
    violations.push(..._check_orphans(contexts, corpus, root));
    return violations;
}

function format_text(violations: Violation[]): string {
    if (violations.length === 0) {
        return '✅  No context-path violations.';
    }
    const lines = [`❌  Found ${violations.length} context-path violation(s):\n`];
    for (const v of violations) {
        lines.push(`  🔴 [${v.kind}] ${v.file}\n      ${v.detail}`);
    }
    return lines.join('\n');
}

/** Python repr() of a list of strings: ['a', 'b']. */
function _pyListRepr(items: readonly string[]): string {
    return '[' + items.map((s) => _pyStrRepr(s)).join(', ') + ']';
}

function _pyStrRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        if (ch === '\\') out += '\\\\';
        else if (ch === quote) out += '\\' + ch;
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else out += ch;
    }
    return out + quote;
}

/** Mirror Python `json.dumps(obj, indent=2)` with ensure_ascii=True. */
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

function _argparse_error(message: string): never {
    process.stderr.write(`check_context_paths: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let format: 'text' | 'json' = 'text';
    let root = ROOT;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--format') {
            const v = argv[++i];
            if (v === undefined) _argparse_error('argument --format: expected one argument');
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
            if (v === undefined) _argparse_error('argument --root: expected one argument');
            root = v;
        } else if (arg.startsWith('--root=')) {
            root = arg.slice('--root='.length);
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: check_context_paths [-h] [--format {text,json}] [--root ROOT]\n',
            );
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { format, root };
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
    CONTEXTS_ROOT,
    LOCKED_SUBTREES,
    GRANDFATHERED_ROOT_FILES,
    REFERENCE_SCAN_DIRS,
    scan,
    format_text,
    main,
};
