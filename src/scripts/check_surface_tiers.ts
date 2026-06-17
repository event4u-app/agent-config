#!/usr/bin/env tsx
/**
 * Surface-tier boundary guard (road-to-install-contract-stability Phase 2).
 *
 * TypeScript twin of `src/scripts/check_surface_tiers.py` (ADR-200). The CLI
 * contract is mirrored EXACTLY — the `--skip-imports` flag + the
 * `AGENT_CONFIG_SKIP_SURFACE_TIER_CHECK` env kill-switch, exit codes (0 clean,
 * 1 violation(s), 2 argparse usage error), byte-identical finding + summary
 * messages on stdout, the same registry-load + exhaustiveness logic, and the
 * same core→lab import boundary check. No behaviour changes — latent bugs
 * replicated.
 *
 * The Python original parses each `.py` under `src/scripts/` with the stdlib
 * `ast` module to find imports and the line numbers of imports lexically inside
 * a guarding `try/except`. This twin replicates that with a focused Python
 * import + try/except line scanner: it tracks each statement's START line (the
 * lineno `ast` reports), the dotted module names, and the indentation-bounded
 * try-body / matching-except-body regions. Constructs not exercised by the real
 * repo (backslash-continued imports, `import` as a non-leading token) are
 * documented divergence candidates, not observed in the tree under guard.
 *
 * Two assertions:
 *   1. **Exhaustive registry.** Every `src/scripts/*\/` cluster directory must
 *      be classified in `src/scripts/surface-tiers.yml`.
 *   2. **No core → lab hard import.** A `core`-tier module must not import a
 *      `lab`-tier module at module scope. A guarded optional import (inside a
 *      `try/except (ModuleNotFoundError | ImportError | Exception)` or bare
 *      except) is ALLOWED.
 *
 * Kill-switch: `--skip-imports` or `AGENT_CONFIG_SKIP_SURFACE_TIER_CHECK=1`
 * disables assertion 2 (exhaustiveness still runs).
 *
 * Exit 0 = clean; 1 = violation(s); 2 = argparse usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPTS = path.join(ROOT, 'src', 'scripts');
const REGISTRY = path.join(SCRIPTS, 'surface-tiers.yml');

// Cluster dirs that are not first-class clusters (generated / dunder).
const _IGNORE_DIRS: ReadonlySet<string> = new Set(['__pycache__']);
const _GUARD_HANDLERS: ReadonlySet<string> = new Set([
    'ModuleNotFoundError',
    'ImportError',
    'Exception',
]);

const _PROG = 'check_surface_tiers.py';

interface Registry {
    clusters: Map<string, string>;
    lab_modules: Set<string>;
}

function _load_registry(): Registry {
    // version '1.1' matches PyYAML safe_load semantics.
    const data =
        (parseYaml(fs.readFileSync(REGISTRY, 'utf-8'), { version: '1.1' }) as Record<
            string,
            unknown
        > | null) ?? {};
    const clusters = new Map<string, string>();
    const rawClusters = (data['clusters'] as Record<string, unknown> | null) ?? {};
    // Mirror Python dict insertion order (yaml preserves mapping order).
    for (const [k, v] of Object.entries(rawClusters)) {
        clusters.set(String(k), String(v));
    }
    const lab_modules = new Set<string>();
    const rawLab = (data['lab_modules'] as unknown[] | null) ?? [];
    for (const m of rawLab) {
        lab_modules.add(String(m));
    }
    return { clusters, lab_modules };
}

function check_exhaustive(clusters: Map<string, string>): string[] {
    // Every src/scripts/*/ dir must be classified.
    const errors: string[] = [];
    let children: fs.Dirent[];
    try {
        children = fs.readdirSync(SCRIPTS, { withFileTypes: true });
    } catch {
        return errors;
    }
    // sorted(SCRIPTS.iterdir()) — sort by the full path string (component-wise).
    const names = children
        .map((c) => c.name)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const name of names) {
        const child = path.join(SCRIPTS, name);
        if (!_isDir(child) || _IGNORE_DIRS.has(name)) {
            continue;
        }
        if (!clusters.has(name)) {
            errors.push(
                `cluster '${name}' missing from surface-tiers.yml — ` +
                    `add it under clusters: as 'core' or 'lab'.`,
            );
        }
    }
    return errors;
}

function _module_tier(
    dotted: string,
    clusters: Map<string, string>,
    lab_modules: Set<string>,
): string {
    // Resolve an imported module's tier. Default core (stdlib / core libs).
    let segments = dotted.split('.').filter((s) => s.length > 0);
    if (segments.length > 0 && segments[0] === 'scripts') {
        segments = segments.slice(1);
    }
    if (segments.length === 0) {
        return 'core';
    }
    const head = segments[0]!;
    if (clusters.has(head)) {
        return clusters.get(head)!;
    }
    if (lab_modules.has(head)) {
        return 'lab';
    }
    return 'core';
}

function _file_tier(
    p: string,
    clusters: Map<string, string>,
    lab_modules: Set<string>,
): string {
    // Tier of a source file under src/scripts/.
    const rel = path.relative(SCRIPTS, p);
    const parts = rel.split(path.sep);
    if (parts.length >= 2) {
        // under a cluster dir
        return clusters.get(parts[0]!) ?? 'core';
    }
    const stem = parts[0]!.replace(/\.py$/, '');
    return lab_modules.has(stem) ? 'lab' : 'core';
}

// ── Python import + try/except line scanner ────────────────────────────────
//
// Replicates the subset of `ast` behaviour `check_imports` depends on: for each
// `import` / `from … import` statement, its START lineno and dotted module
// names; and the set of import START linenos lexically inside a guarding
// try/except (try body OR matching-except body).

interface ImportStmt {
    lineno: number; // 1-based start line of the statement
    modules: string[]; // dotted names: `import a, b.c` → [a, b.c]; `from m import x` → [m]
}

interface ParsedPy {
    imports: ImportStmt[];
    guarded: Set<number>; // import START linenos inside a guarding try/except
}

/** Leading-whitespace width, tabs counted as a single column (only for relative depth). */
function _indent(line: string): number {
    let n = 0;
    for (const ch of line) {
        if (ch === ' ' || ch === '\t') {
            n += 1;
        } else {
            break;
        }
    }
    return n;
}

/** Strip a trailing `# comment` not inside a string (best-effort for import lines). */
function _stripComment(s: string): string {
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i]!;
        if (c === "'" && !inDouble) {
            inSingle = !inSingle;
        } else if (c === '"' && !inSingle) {
            inDouble = !inDouble;
        } else if (c === '#' && !inSingle && !inDouble) {
            return s.slice(0, i);
        }
    }
    return s;
}

function _parse_py(text: string): ParsedPy {
    const rawLines = text.split('\n');
    // Logical lines: collapse parenthesised / explicit-backslash continuations
    // onto the START line so a `from x import (\n a,\n b,\n)` is one statement
    // anchored at the opening line (matching ast's node.lineno).
    const lines = rawLines;
    const imports: ImportStmt[] = [];

    // Track try-guard regions by indentation. Each open try/except handler is a
    // frame: {bodyIndent, isGuard}. An import line whose indent is > the frame's
    // header indent and is inside a guard frame's body counts as guarded.
    interface Frame {
        headerIndent: number;
        kind: 'try' | 'guard-handler' | 'nonguard-handler' | 'try-pending';
    }
    const frames: Frame[] = [];
    const guarded = new Set<number>();

    let i = 0;
    let parenDepth = 0;
    let stmtStartLine = 0;
    let stmtBuf = '';
    let collecting = false;

    const flushStmt = (startLineno: number, joined: string): void => {
        const stripped = joined.trim();
        const noComment = _stripComment(stripped).trim();
        // import a, b.c as d  → modules [a, b.c]
        const importM = /^import\s+(.+)$/.exec(noComment);
        if (importM) {
            const rest = importM[1]!;
            const mods: string[] = [];
            for (const part of rest.split(',')) {
                const name = part.trim().split(/\s+as\s+/)[0]!.trim();
                if (name) {
                    mods.push(name);
                }
            }
            imports.push({ lineno: startLineno, modules: mods });
            return;
        }
        // from .pkg.mod import x  → module 'pkg.mod' (level handled by ast as the
        // dotted name after the dots). `from . import x` → module None (skip).
        const fromM = /^from\s+(\.*)([A-Za-z0-9_.]*)\s+import\b/.exec(noComment);
        if (fromM) {
            const dotted = fromM[2]!;
            if (dotted) {
                imports.push({ lineno: startLineno, modules: [dotted] });
            }
            // `from . import x` (no dotted) → ast module is None → no entry.
            return;
        }
    };

    // Pre-scan logical statements (handle parenthesised continuation) to find
    // import statements + their start linenos.
    while (i < lines.length) {
        const raw = lines[i]!;
        const lineNo = i + 1;
        if (!collecting) {
            stmtStartLine = lineNo;
            stmtBuf = raw;
            // Count unclosed parens on this line (ignoring those in strings/comments).
            parenDepth = _netParen(_stripComment(raw));
            if (parenDepth > 0 || /\\\s*$/.test(raw)) {
                collecting = true;
                i += 1;
                continue;
            }
            flushStmt(stmtStartLine, raw);
        } else {
            stmtBuf += '\n' + raw;
            parenDepth += _netParen(_stripComment(raw));
            if (parenDepth <= 0 && !/\\\s*$/.test(raw)) {
                collecting = false;
                // Join continuation: replace newlines with spaces for the matcher.
                flushStmt(stmtStartLine, stmtBuf.replace(/\n/g, ' '));
            }
        }
        i += 1;
    }
    if (collecting) {
        flushStmt(stmtStartLine, stmtBuf.replace(/\n/g, ' '));
    }

    // Second pass: indentation-based try/except guard tracking. Determine which
    // *physical* lines lie inside a guarding try-body or matching-except-body,
    // then mark any import whose start lineno falls in such a region.
    const guardLines = _guardedLineSet(lines);
    for (const imp of imports) {
        if (guardLines.has(imp.lineno)) {
            guarded.add(imp.lineno);
        }
    }
    // `frames` is unused beyond clarity of intent; the guard set is computed by
    // _guardedLineSet which models the same lexical nesting `ast` walks.
    void frames;

    return { imports, guarded };
}

/** Net paren balance contribution of a (comment-stripped, string-naive) line. */
function _netParen(s: string): number {
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i]!;
        if (c === "'" && !inDouble) {
            inSingle = !inSingle;
        } else if (c === '"' && !inSingle) {
            inDouble = !inDouble;
        } else if (!inSingle && !inDouble) {
            if (c === '(' || c === '[' || c === '{') {
                depth += 1;
            } else if (c === ')' || c === ']' || c === '}') {
                depth -= 1;
            }
        }
    }
    return depth;
}

/**
 * Physical line numbers (1-based) that are lexically inside a guarding try/except
 * — the try body or any matching-except handler body whose handler type is in
 * `_GUARD_HANDLERS` (or a bare except). Models ast's lexical nesting via Python's
 * indentation rule.
 */
function _guardedLineSet(lines: string[]): Set<number> {
    const guarded = new Set<number>();
    // Stack of active try blocks: {indent, guardActive}. guardActive flips true
    // once a qualifying except handler opens, so the handler body is also guarded
    // (mirroring the Python: try-body AND matching except-bodies both count).
    interface TryCtx {
        indent: number; // indent of the `try:` header
        inGuardedRegion: boolean; // currently scanning a guarded body region
    }
    const stack: TryCtx[] = [];

    const isHeader = (stripped: string, kw: string): boolean =>
        stripped === `${kw}:` || stripped.startsWith(`${kw} `) || stripped.startsWith(`${kw}:`);

    for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx]!;
        const lineNo = idx + 1;
        const noComment = _stripComment(line);
        if (noComment.trim() === '') {
            // Blank / comment-only line: still inside whatever region by indent.
            if (stack.length > 0 && stack[stack.length - 1]!.inGuardedRegion) {
                guarded.add(lineNo);
            }
            continue;
        }
        const indent = _indent(line);
        const stripped = noComment.trim();

        // Pop try-contexts whose block has ended (dedent to ≤ header indent on a
        // line that is NOT a continuation of try/except/else/finally).
        while (stack.length > 0) {
            const top = stack[stack.length - 1]!;
            if (indent <= top.indent) {
                // A sibling at the try's own indent: only try/except/else/finally
                // headers continue the construct; anything else closes it.
                if (
                    indent === top.indent &&
                    (stripped.startsWith('except') ||
                        isHeader(stripped, 'else') ||
                        isHeader(stripped, 'finally'))
                ) {
                    break;
                }
                stack.pop();
                continue;
            }
            break;
        }

        // Opening a try block.
        if (isHeader(stripped, 'try')) {
            stack.push({ indent, inGuardedRegion: true });
            // The `try:` header line itself is not an import; mark guarded region
            // active for deeper-indented body lines.
            continue;
        }

        if (stack.length > 0) {
            const top = stack[stack.length - 1]!;
            if (indent === top.indent && stripped.startsWith('except')) {
                // Determine if this handler guards import errors.
                top.inGuardedRegion = _handlerIsGuard(stripped);
                continue;
            }
            if (indent === top.indent && (isHeader(stripped, 'else') || isHeader(stripped, 'finally'))) {
                // else/finally bodies are NOT guarded import regions.
                top.inGuardedRegion = false;
                continue;
            }
            if (indent > top.indent && top.inGuardedRegion) {
                guarded.add(lineNo);
            }
        }
    }
    return guarded;
}

/** True iff an `except …:` header names a guard handler (or is bare except). */
function _handlerIsGuard(stripped: string): boolean {
    // bare `except:` → guard (matches Python `h.type is None`).
    const m = /^except\b\s*(.*?)\s*:\s*$/.exec(stripped) ?? /^except\b\s*(.*)$/.exec(stripped);
    const spec = (m ? m[1]! : '').trim();
    if (spec === '') {
        return true; // bare except
    }
    // Strip `as e` binding and surrounding parens.
    let body = spec.replace(/\s+as\s+\w+\s*$/, '').trim();
    body = body.replace(/:$/, '').trim();
    if (body.startsWith('(') && body.endsWith(')')) {
        body = body.slice(1, -1);
    }
    const names = body.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    return names.some((n) => _GUARD_HANDLERS.has(n));
}

function check_imports(clusters: Map<string, string>, lab_modules: Set<string>): string[] {
    // No core module may hard-import a lab module.
    const errors: string[] = [];
    for (const py of _rglobPy(SCRIPTS)) {
        if (py.split(path.sep).includes('__pycache__')) {
            continue;
        }
        if (_file_tier(py, clusters, lab_modules) !== 'core') {
            continue;
        }
        let text: string;
        try {
            text = fs.readFileSync(py, 'utf-8');
        } catch {
            continue;
        }
        const parsed = _parse_py(text);
        for (const node of parsed.imports) {
            if (parsed.guarded.has(node.lineno)) {
                continue;
            }
            for (const m of node.modules) {
                if (_module_tier(m, clusters, lab_modules) === 'lab') {
                    const rel = path.relative(ROOT, py).split(path.sep).join('/');
                    errors.push(
                        `${rel}:${node.lineno} — core module hard-imports lab ` +
                            `module '${m}'. Guard it (try/except ModuleNotFoundError) ` +
                            `or extract the shared code into a core _lib module.`,
                    );
                }
            }
        }
    }
    return errors;
}

/** Recursive `*.py` glob, sorted component-wise (mirrors sorted(rglob)). */
function _rglobPy(dir: string): string[] {
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
            if (ent.isDirectory()) {
                walk(full);
            } else if (ent.isFile() && ent.name.endsWith('.py')) {
                out.push(full);
            }
        }
    };
    walk(dir);
    out.sort(_pathSort);
    return out;
}

function _pathSort(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let k = 0; k < n; k++) {
        if (pa[k] !== pb[k]) {
            return pa[k]! < pb[k]! ? -1 : 1;
        }
    }
    return pa.length - pb.length;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

interface ParsedArgs {
    skip_imports: boolean;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let skip_imports = false;
    for (const arg of argv) {
        if (arg === '--skip-imports') {
            skip_imports = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(`usage: ${_PROG} [-h] [--skip-imports]\n`);
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { skip_imports };
}

function _argparse_error(message: string): never {
    process.stderr.write(`usage: ${_PROG} [-h] [--skip-imports]\n`);
    process.stderr.write(`${_PROG}: error: ${message}\n`);
    process.exit(2);
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const envSkip = process.env['AGENT_CONFIG_SKIP_SURFACE_TIER_CHECK'];
    const skip_imports =
        args.skip_imports || envSkip === '1' || envSkip === 'true' || envSkip === 'yes';

    const { clusters, lab_modules } = _load_registry();
    const errors = check_exhaustive(clusters);
    if (skip_imports) {
        process.stdout.write('surface-tiers: import boundary check SKIPPED (kill-switch).\n');
    } else {
        errors.push(...check_imports(clusters, lab_modules));
    }

    if (errors.length) {
        process.stdout.write(`❌ surface-tier boundary: ${errors.length} violation(s)\n`);
        for (const e of errors) {
            process.stdout.write(`   ${e}\n`);
        }
        return 1;
    }
    process.stdout.write(
        `✅ surface-tiers: ${clusters.size} clusters classified, ` +
            'no unguarded core→lab imports.\n',
    );
    return 0;
}

const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    _load_registry,
    check_exhaustive,
    check_imports,
    _module_tier,
    _file_tier,
    parse_args,
    main,
};
