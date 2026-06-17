#!/usr/bin/env tsx
/**
 * Workspace-boundary drift check — import-edge enforcement.
 *
 * TypeScript twin of `src/scripts/lint_workspace_boundary.py` (ADR-200,
 * Python→TypeScript migration). The CLI contract is mirrored EXACTLY — the
 * `--quiet` flag, the `sorted(repo.glob(WORKSPACE_GLOB))` scan order (pathlib
 * component-wise), the FORBIDDEN-pattern set (Python `re` → JS `RegExp`, all
 * ASCII so a 1:1 translation), the `# boundary-exception:` pragma skip, the
 * per-violation message shape, and the exit codes (0 holds · 1 forbidden
 * import · 2 internal). snake_case is kept on the public surface.
 *
 * Governed by `docs/contracts/workspace-boundary.md` + ADR-095. Fails when a
 * workspace module (`src/cli/python/workspace_*.py`) imports an owner-module of
 * a domain the workspace does NOT own: skill design, profile/pack semantics,
 * video-provider logic, MCP-registry policy, analytics product strategy.
 *
 * Scope (read this before trusting a green run): this enforces **import edges
 * only**. Semantic drift — a workspace module that encodes profile-semantics or
 * analytics-product-strategy judgement without importing anything forbidden — is
 * NOT catchable here and stays doc-governance, enforced in review against the
 * contract. A green run is a supplement to boundary thinking, not a substitute.
 *
 * Allowed: stdlib, third-party deps, intra-workspace imports (`workspace_*`),
 * and any import line carrying a `# boundary-exception: <reason>` pragma.
 *
 * Usage:  python3 src/scripts/lint_workspace_boundary.py [--quiet]
 * Exit:   0 = boundary holds · 1 = a forbidden import was found · 2 = internal.
 *
 * --- Parity notes (ADR-200) ---
 *
 * - The Python source uses `ast.walk` to find every `ast.Import` /
 *   `ast.ImportFrom` at any nesting level and records `node.lineno`. The twin
 *   reproduces that with a small line scanner that recognises top-level AND
 *   indented `import …` / `from … import …` statements (matching the only
 *   shapes Python's grammar admits for these node types), yielding the same
 *   `(module, lineno)` pairs — `lineno` is the line of the `import` / `from`
 *   keyword, exactly as `ast` reports it. A parenthesized multi-line
 *   `from x import (\n…\n)` records the `from` line, like `ast`.
 * - `Path.read_text(encoding="utf-8")` → `fs.readFileSync(p, "utf-8")`; a
 *   decode/read error surfaces as the `unparseable` violation line (the Python
 *   path only hits this on `SyntaxError`, marked `pragma: no cover`).
 * - `process.exitCode` is set; `process.exit()` is never called.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

const WORKSPACE_GLOB = 'src/cli/python/workspace_*.py';
const PRAGMA = 'boundary-exception:';

// Owner-modules of the NOT-owned domains. Matched against each dotted segment
// of an imported module name with segment boundaries, so `packaging` does not
// trip `pack` and `workspace_skills` is handled by the intra-workspace allow.
const FORBIDDEN: ReadonlyArray<readonly [RegExp, string]> = [
    [/(?:^|[._-])condense(?:$|[._-])/, 'skill design / condensation'],
    [/(?:^|[._-])skill_linter(?:$|[._-])/, 'skill design'],
    [/(?:^|[._-])skill_management(?:$|[._-])/, 'skill design'],
    [/(?:^|[._-])skill_writing(?:$|[._-])/, 'skill design'],
    [/(?:^|[._-])discovery_manifest(?:$|[._-])/, 'profile/pack semantics'],
    [/(?:^|[._-])(?:profiles?|packs?)(?:$|[._-])/, 'profile/pack semantics'],
    [/ai[_-]?video/, 'video-provider logic'],
    [/(?:^|[._-])mcp(?:$|[._-])/, 'MCP-registry policy'],
    [/(?:^|[._-])router(?:$|[._-])/, 'router / projection policy'],
    [/(?:^|[._-])persona/, 'persona / skill design'],
];

function _is_intra_workspace(module: string): boolean {
    const head = module.split('.', 1)[0] as string;
    return head === 'workspace' || head.startsWith('workspace_');
}

function _forbidden_reason(module: string): string | null {
    if (_is_intra_workspace(module)) {
        return null;
    }
    for (const [pat, reason] of FORBIDDEN) {
        if (pat.test(module)) {
            return reason;
        }
    }
    return null;
}

/**
 * Yield `[module_name, lineno]` for every import in `src`, mirroring
 * `ast.walk` over `ast.Import` / `ast.ImportFrom`.
 *
 * `ast` reports the keyword line as `lineno` (1-based). `ast.Import` for
 * `import a.b, c` yields one entry per alias, all on the same line; the module
 * name is the dotted path. `ast.ImportFrom` yields one entry: `node.module`
 * (the dotted module after `from`, `None` for `from . import x`).
 */
function* _imported_modules(src: string): Generator<[string, number]> {
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i] as string;
        const stripped = raw.replace(/^[ \t\f\v]+/, '');
        const lineno = i + 1;

        // from <module> import …  — module is the dotted path after `from`.
        // `from . import x` / `from .pkg import y` → ast.module is the part
        // after leading dots (or None). The leading-dot (relative) form has
        // module = the text after the dots; a bare `from . import` has
        // module=None and is skipped (no name to test).
        const fromMatch = /^from[ \t]+(\.*)([A-Za-z_][\w.]*)?[ \t]+import\b/.exec(stripped);
        if (fromMatch) {
            const mod = fromMatch[2];
            if (mod !== undefined) {
                yield [mod, lineno];
            }
            continue;
        }

        // import a, b.c, d as e  — one alias per dotted name; ast records the
        // dotted name (`alias.name`), all on this single keyword line.
        const importMatch = /^import[ \t]+(.+)$/.exec(stripped);
        if (importMatch) {
            // Strip a trailing comment, then split on commas; for each clause
            // take the dotted module name before any `as` alias.
            let body = importMatch[1] as string;
            const hash = body.indexOf('#');
            if (hash >= 0) {
                body = body.slice(0, hash);
            }
            for (const clause of body.split(',')) {
                const name = clause.trim().split(/[ \t]+as[ \t]+/)[0]?.trim();
                if (name) {
                    yield [name, lineno];
                }
            }
        }
    }
}

function check_file(p: string): string[] {
    let src: string;
    try {
        src = fs.readFileSync(p, { encoding: 'utf-8' });
    } catch (exc) {
        // pragma: no cover — mirrors the Python SyntaxError path.
        return [`${p}: unparseable (${(exc as Error).message})`];
    }
    const lines = src.split('\n');
    const out: string[] = [];
    for (const [module, lineno] of _imported_modules(src)) {
        const reason = _forbidden_reason(module);
        if (reason === null) {
            continue;
        }
        const line = lineno > 0 && lineno <= lines.length ? (lines[lineno - 1] as string) : '';
        if (line.includes(PRAGMA)) {
            continue; // reviewed, deliberate exception
        }
        out.push(
            `${path.basename(p)}:${lineno}: imports \`${module}\` ` +
                `(not-owned domain: ${reason})`,
        );
    }
    return out;
}

/** `sorted(repo.glob("src/cli/python/workspace_*.py"))` — pathlib order. */
function _globWorkspaceSorted(repo: string): string[] {
    const dir = path.join(repo, 'src', 'cli', 'python');
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const name of entries) {
        if (name.startsWith('workspace_') && name.endsWith('.py')) {
            const full = path.join(dir, name);
            try {
                if (fs.statSync(full).isFile()) {
                    out.push(full);
                }
            } catch {
                // ignore
            }
        }
    }
    out.sort();
    return out;
}

function main(argv: readonly string[]): number {
    const quiet = argv.includes('--quiet');
    // Path(__file__).resolve().parent.parent.parent — src/scripts → repo root.
    const repo = path.resolve(path.dirname(_HERE), '..', '..');
    const files = _globWorkspaceSorted(repo);
    if (files.length === 0) {
        process.stdout.write(
            `⚠️  lint-workspace-boundary: no files match ${WORKSPACE_GLOB}\n`,
        );
        return 0;
    }
    const violations: string[] = [];
    for (const f of files) {
        violations.push(...check_file(f));
    }
    if (violations.length) {
        process.stdout.write(
            '❌  Workspace-boundary violation(s) — a workspace module imports ' +
                'an owner-module of a domain the workspace does NOT own ' +
                '(docs/contracts/workspace-boundary.md):\n',
        );
        for (const v of violations) {
            process.stdout.write(`  🔴 ${v}\n`);
        }
        process.stdout.write(
            '\nFix: move the logic to the owning surface and consume its ' +
                'output, or add `# boundary-exception: <reason>` if the import is ' +
                'genuinely justified (reviewed like any boundary change).\n',
        );
        return 1;
    }
    if (!quiet) {
        process.stdout.write(
            `✅  Workspace boundary holds — ${files.length} module(s), ` +
                'no forbidden imports.\n',
        );
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main(process.argv.slice(2));
}

export {
    WORKSPACE_GLOB,
    PRAGMA,
    FORBIDDEN,
    _is_intra_workspace,
    _forbidden_reason,
    _imported_modules,
    check_file,
    main,
};
