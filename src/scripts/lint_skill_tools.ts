#!/usr/bin/env tsx
/**
 * Block D · D1 meta-linter for `src/scripts/skill_tools/*.ts` (ADR-006).
 *
 * ## Why this gate changed shape (2026-08-05)
 *
 * ADR-006 piloted these tools in Python and this gate enforced five invariants
 * over `skill_tools/*.py`. ADR-200 migrated the corpus to `.ts` without
 * mentioning ADR-006, so the glob matched nothing: for ~7 weeks the gate printed
 * `✅ scripts/skill_tools/ — all tools clean.` over **zero** tools on every CI
 * run, and nobody noticed that two ADR-006 invariants had quietly gone unmet on
 * the TS surface (`--help` in 0 of 6 files; `_SAMPLE` in 3 of 5).
 *
 * Repointing the glob and keeping all five checks was measured and rejected: the
 * TS ports are 2.4–4.0× their Python originals (92–142 LOC → 253–470), so the
 * 200-LOC cap reds 5 of 5 tools, and the only way to green it is raising the cap
 * to ≥ 470 — threshold-lowering, which this gate's own ratchet exists to
 * prevent. AI council 2026-08-05 resolved it as extract-the-checkable:
 *
 * - **KEPT** (pure regex over filename + text, no analyser): `snake_case_verb_noun`
 *   naming, a registered `--json` flag, and an embedded `_SAMPLE` or CLI-entry guard.
 * - **DROPPED, recorded in ADR-006's Status**: the 200-LOC cap (cannot pass
 *   without weakening its own threshold); the `argparse` import and
 *   `add_help=False` checks (no TypeScript analogue); and the stdlib-only import
 *   scan (a Python `ast`-shaped scanner — re-implementing it for TS specifiers
 *   would be a new analyser, not a port, and the council drew that line
 *   explicitly for the sibling `lint_workspace_boundary` decision).
 *
 * The gate now asserts its scan scope, so an emptied or moved corpus fails
 * loudly instead of certifying nothing. No `allowEmpty`: "no tools" must never
 * read as "all tools clean" again.
 *
 * CLI contract unchanged — `--json` / `--quiet` / `--tools-dir`, exit codes
 * (0 clean, 1 violations, 2 usage / missing-dir / dead scope), stdout split.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/lint_skill_tools.ts → parents[2] is the repo root.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const TOOLS_DIR = path.join(ROOT, 'src', 'scripts', 'skill_tools');
const NAME_RE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+\.ts$/;

function _violations_for(p: string): string[] {
    const out: string[] = [];
    const name = path.basename(p);
    if (!NAME_RE.test(name)) {
        out.push(`naming: \`${name}\` is not snake_case_verb_noun.ts`);
    }

    const text = fs.readFileSync(p, 'utf-8');

    // Machine-readable output — the tool must register a `--json` flag.
    if (!/['"]--json['"]/.test(text)) {
        out.push('cli: missing `--json` flag');
    }

    // Embedded sample data — an exported-or-bare `_SAMPLE` constant, or the
    // CLI-entry guard that replaced Python's `__main__` block.
    const hasSample = /^\s*(?:export\s+)?(?:const|let)?\s*_SAMPLE\s*[:=]/m.test(text);
    const hasEntry = text.includes('import.meta.url');
    if (!(hasSample || hasEntry)) {
        out.push('sample: no `_SAMPLE` constant or CLI-entry guard');
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
    const toolFiles = entries
        .filter((n) => n.endsWith('.ts') && !n.endsWith('.d.ts') && !n.endsWith('.test.ts'))
        .map((n) => path.join(resolved, n))
        .filter((p) => {
            try {
                return fs.statSync(p).isFile();
            } catch {
                return false;
            }
        })
        .sort();
    let linted = 0;
    for (const p of toolFiles) {
        // `index.ts` is the package marker — the `__init__.py` analogue. It is a
        // re-export barrel, not a tool, so the per-tool invariants do not apply.
        if (path.basename(p) === 'index.ts') {
            continue;
        }
        linted += 1;
        const viols = _violations_for(p);
        if (viols.length > 0) {
            // Mirror Python's `str(path.relative_to(ROOT))` with ValueError fallback.
            const key = _isUnder(p, ROOT) ? _relTo(p, ROOT) : p;
            findings[key] = viols;
        }
    }
    _lintedCount = linted;
    return [Object.keys(findings).length > 0 ? 1 : 0, findings];
}

/**
 * Tools actually inspected by the last `lint()` call.
 *
 * Kept out of `lint()`'s return value on purpose: 13 unit tests drive `lint()`
 * directly and assert its `[code, findings]` shape, and the scan-scope assertion
 * must fire once per process in `main()` — not inside a function the tests call
 * with temp dirs, where an empty fixture is legitimate.
 */
let _lintedCount = 0;

export function lintedCount(): number {
    return _lintedCount;
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
    // Scan-scope assertion. Deliberately after `lint()` (which computes the
    // count) and before the report, so a moved or emptied corpus fails loudly
    // instead of printing "all tools clean" over zero tools — which is exactly
    // what this gate did for ~7 weeks after ADR-200 deleted its `.py` corpus.
    // No `allowEmpty`: an empty tools dir here is blindness, not success.
    try {
        assertScanned({
            gate: 'lint_skill_tools',
            scanned: lintedCount(),
            units: 'tool(s)',
            roots: ['src/scripts/skill_tools'],
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 2; // the gate's existing "internal / usage" code
        }
        throw e;
    }
    if (args.json) {
        process.stdout.write(_json_dumps_ascii({ exit_code: code, findings }));
        process.stdout.write('\n');
    } else if (Object.keys(findings).length > 0 || !args.quiet) {
        _print_human(findings);
    }
    return code;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { ROOT, TOOLS_DIR, NAME_RE, lint, main };
