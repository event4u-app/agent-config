#!/usr/bin/env tsx
/**
 * Block D · D1 meta-linter for `scripts/skill_tools/*.py`.
 *
 * TypeScript twin of `src/scripts/lint_skill_tools.py` (ADR-089,
 * Phase 4 / Wave 4b). The CLI contract is mirrored EXACTLY — `--json`
 * / `--quiet` / `--tools-dir` flags, exit codes (0 clean, 1 violations,
 * 2 usage / missing-dir), stdout split (JSON or human), byte-identical
 * violation strings, same glob + sort order, same `_SAMPLE`/`__main__`
 * detection.
 *
 * The Python original parses each tool with `ast` to find imports and
 * syntax errors. We replicate the import discovery with a focused
 * Python-import line scanner (handles `import a, b.c`, `from x.y import z`,
 * relative `from . import x`). It covers the real tools and the test
 * fixtures; an `import`/`from` keyword appearing as the first token of a
 * line inside a multi-line string literal would be a false positive the
 * `ast` walk avoids — flagged as a divergence candidate, not observed in
 * the corpus.
 *
 * No behaviour changes.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/lint_skill_tools.ts → parents[2] is the repo root.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const TOOLS_DIR = path.join(ROOT, 'src', 'scripts', 'skill_tools');
const NAME_RE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+\.py$/;
const SIZE_CAP = 200;

const STDLIB: ReadonlySet<string> = new Set([
    '__future__', 'abc', 'argparse', 'ast', 'base64', 'collections', 'configparser',
    'contextlib', 'copy', 'csv', 'dataclasses', 'datetime', 'decimal', 'difflib',
    'enum', 'errno', 'fnmatch', 'functools', 'glob', 'gzip', 'hashlib', 'heapq',
    'html', 'http', 'importlib', 'inspect', 'io', 'ipaddress', 'itertools', 'json',
    'logging', 'math', 'mimetypes', 'os', 'pathlib', 'pickle', 'platform', 'posixpath',
    'pprint', 'queue', 'random', 're', 'shlex', 'shutil', 'signal', 'socket',
    'sqlite3', 'ssl', 'stat', 'string', 'struct', 'subprocess', 'sys', 'tempfile',
    'textwrap', 'threading', 'time', 'tomllib', 'traceback', 'types', 'typing',
    'unicodedata', 'unittest', 'urllib', 'uuid', 'venv', 'warnings', 'weakref',
    'xml', 'zipfile', 'zlib',
]);
const PROJECT_PACKAGES: ReadonlySet<string> = new Set(['scripts', 'skill_tools']);

interface ParsedImport {
    kind: 'import';
    modules: string[]; // dotted module names from `import a, b.c as d`
}
interface ParsedFromImport {
    kind: 'from';
    module: string | null; // None for `from . import x` (level > 0)
    level: number;
}
type ImportNode = ParsedImport | ParsedFromImport;

/**
 * Scan a Python source for top-of-line `import` / `from … import` statements.
 * Mirrors what `ast.walk` surfaces for `Import` / `ImportFrom` nodes (the
 * linter only reads `.names`, `.module`, `.level`). Continuation lines inside
 * a parenthesised `from x import (...)` do not affect the module name (which
 * sits before `import` on the opening line), so they need no special handling.
 */
function _parse_imports(text: string): ImportNode[] {
    const out: ImportNode[] = [];
    for (const raw of text.split('\n')) {
        const stripped = raw.replace(/^[ \t]+/, '');
        const importMatch = /^import\s+(.+)$/.exec(stripped);
        if (importMatch) {
            const rest = importMatch[1]!.replace(/#.*$/, '');
            const modules: string[] = [];
            for (const part of rest.split(',')) {
                // `a.b.c as d` → dotted name is the token before `as`.
                const name = part.trim().split(/\s+as\s+/)[0]!.trim();
                if (name) {
                    modules.push(name);
                }
            }
            out.push({ kind: 'import', modules });
            continue;
        }
        const fromMatch = /^from\s+(\.*)([A-Za-z0-9_.]*)\s+import\b/.exec(stripped);
        if (fromMatch) {
            const dots = fromMatch[1]!;
            const mod = fromMatch[2]!;
            const level = dots.length;
            // ast: `from . import x` → module is None when no dotted name follows.
            const module = mod === '' ? null : mod;
            out.push({ kind: 'from', module, level });
            continue;
        }
    }
    return out;
}

function _violations_for(p: string): string[] {
    const out: string[] = [];
    const name = path.basename(p);
    if (!NAME_RE.test(name)) {
        out.push(`naming: \`${name}\` is not snake_case_verb_noun.py`);
    }

    const text = fs.readFileSync(p, 'utf-8');
    let loc = 0;
    for (const ln of text.split('\n')) {
        if (ln.trim() && !ln.replace(/^[ \t]+/, '').startsWith('#')) {
            loc += 1;
        }
    }
    if (loc > SIZE_CAP) {
        out.push(`size: ${loc} LOC > ${SIZE_CAP} cap`);
    }

    // Imports — flag any non-stdlib, non-project top-level module + record argparse.
    const imported = new Set<string>();
    for (const node of _parse_imports(text)) {
        if (node.kind === 'import') {
            for (const dotted of node.modules) {
                const root = dotted.split('.')[0]!;
                imported.add(root);
                if (!STDLIB.has(root) && !PROJECT_PACKAGES.has(root)) {
                    out.push(`stdlib-only: imports \`${dotted}\` (third-party)`);
                }
            }
        } else {
            if (node.module === null || node.level > 0) {
                continue; // relative imports — package-internal
            }
            const root = node.module.split('.')[0]!;
            imported.add(root);
            if (!STDLIB.has(root) && !PROJECT_PACKAGES.has(root)) {
                out.push(`stdlib-only: imports from \`${node.module}\` (third-party)`);
            }
        }
    }

    // CLI flags — confirm argparse is imported and `--json` is registered.
    const hasArgparse = imported.has('argparse');
    const hasJsonFlag = /['"]--json['"]/.test(text);
    if (!hasArgparse) {
        out.push('cli: no `argparse` import detected');
    }
    if (!hasJsonFlag) {
        out.push('cli: missing `--json` flag');
    }
    if (/add_help\s*=\s*False/.test(text)) {
        out.push('cli: `add_help=False` disables --help');
    }

    // Embedded sample data — `_SAMPLE` constant or a `__main__` block.
    const hasSample = /^_SAMPLE\s*[:=]/m.test(text);
    const hasMain =
        text.includes('__name__ == "__main__"') || text.includes("__name__ == '__main__'");
    if (!(hasSample || hasMain)) {
        out.push('sample: no `_SAMPLE` constant or `__main__` block');
    }

    return out;
}

/** POSIX relative path of `target` under `root`. */
function _relTo(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _isUnder(child: string, root: string): boolean {
    const rel = path.relative(root, child);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function lint(toolsDir: string): [number, Record<string, string[]>] {
    const resolved = path.resolve(toolsDir);
    if (!_isDir(resolved)) {
        return [2, { _error: [`tools dir missing: ${resolved}`] }];
    }
    const findings: Record<string, string[]> = {};
    let entries: string[];
    try {
        entries = fs.readdirSync(resolved);
    } catch {
        entries = [];
    }
    const pyFiles = entries
        .filter((n) => n.endsWith('.py'))
        .map((n) => path.join(resolved, n))
        .filter((p) => {
            try {
                return fs.statSync(p).isFile();
            } catch {
                return false;
            }
        })
        .sort();
    for (const p of pyFiles) {
        if (path.basename(p) === '__init__.py') {
            continue;
        }
        const viols = _violations_for(p);
        if (viols.length > 0) {
            // Mirror Python's `str(path.relative_to(ROOT))` with ValueError fallback.
            const key = _isUnder(p, ROOT) ? _relTo(p, ROOT) : p;
            findings[key] = viols;
        }
    }
    return [Object.keys(findings).length > 0 ? 1 : 0, findings];
}

function _print_human(findings: Record<string, string[]>): void {
    if (Object.keys(findings).length === 0) {
        process.stdout.write('✅  scripts/skill_tools/ — all tools clean.\n');
        return;
    }
    process.stdout.write(
        `❌  scripts/skill_tools/ — ${Object.keys(findings).length} tool(s) with violations:\n`,
    );
    for (const [fp, viols] of Object.entries(findings)) {
        process.stdout.write(`  ${fp}:\n`);
        for (const v of viols) {
            process.stdout.write(`    - ${v}\n`);
        }
    }
}

interface ParsedArgs {
    json: boolean;
    quiet: boolean;
    toolsDir: string;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let json = false;
    let quiet = false;
    let toolsDir = TOOLS_DIR;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--json') {
            json = true;
        } else if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '--tools-dir') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --tools-dir: expected one argument');
            }
            toolsDir = v;
        } else if (arg.startsWith('--tools-dir=')) {
            toolsDir = arg.slice('--tools-dir='.length);
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: lint_skill_tools [-h] [--json] [--quiet] [--tools-dir TOOLS_DIR]\n');
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { json, quiet, toolsDir };
}

function _argparse_error(message: string): never {
    process.stderr.write(`lint_skill_tools: error: ${message}\n`);
    process.exit(2);
}

/** Mirror Python `json.dump(obj, sys.stdout, indent=2)` (ensure_ascii=True). */
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

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const [code, findings] = lint(args.toolsDir);
    if (args.json) {
        process.stdout.write(_json_dumps_ascii({ exit_code: code, findings }));
        process.stdout.write('\n');
    } else if (Object.keys(findings).length > 0 || !args.quiet) {
        _print_human(findings);
    }
    return code;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    ROOT,
    TOOLS_DIR,
    NAME_RE,
    SIZE_CAP,
    STDLIB,
    PROJECT_PACKAGES,
    lint,
    main,
};
