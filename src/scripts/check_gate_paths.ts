#!/usr/bin/env tsx
/**
 * Gate path-integrity check (R2 of road-to-test-and-gate-integrity).
 *
 * TypeScript twin of `src/scripts/check_gate_paths.py` (ADR-200,
 * Phase 4 / Wave 4c). CLI contract mirrored EXACTLY — no flags, exit
 * codes (0 all resolve, 1 missing / out-of-tree, 2 a gate failed to
 * import / lacks GATE_CORE_PATHS), byte-identical messages, stdout/stderr
 * split, same gate list / source-tree roots.
 *
 * The Python original read each gate's ACTUAL enforced paths via that
 * module's `GATE_CORE_PATHS` attribute (`importlib.import_module`) — it
 * did NOT re-declare a copy of the path strings. The gate `.py` modules are
 * gone (ADR-200); the ported `.ts` twins each export `GATE_CORE_PATHS`, so
 * this twin introspects them by spawning `tsx` to dynamically `import()` each
 * gate `.ts` under `REPO_ROOT/src/scripts` and read the exported constant.
 * That keeps the "read the gate's real paths, never copy them" property and
 * reproduces the ImportError → exit-2 and AttributeError → exit-2 behaviour.
 * A subprocess (not an in-process dynamic import) keeps `collect_gate_paths`
 * synchronous. No behaviour changes.
 *
 * Exit codes: 0 = all enforced targets resolve under the source tree ·
 * 1 = at least one missing / out-of-tree target · 2 = a gate failed to import.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// Active source tree roots a gate target may legitimately resolve under.
const _SOURCE_TREE_ROOTS = [path.join(REPO_ROOT, 'src'), path.join(REPO_ROOT, 'packages')];

// Single-root gates that enforce against a fixed source target and expose it
// via a module-level GATE_CORE_PATHS tuple. Adding a gate here is the only
// manual step; its paths are read from the gate, never copied.
const GATES = [
    'inventory_abstraction_budget',
    'audit_command_surface',
    'lint_agents_md',
    'audit_initial_context',
] as const;

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _is_under_source_tree(p: string): boolean {
    const rp = path.resolve(p);
    for (const root of _SOURCE_TREE_ROOTS) {
        const rroot = path.resolve(root);
        const rel = path.relative(rroot, rp);
        if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
            return true;
        }
    }
    return false;
}

/**
 * Import each gate (via a `tsx` subprocess that dynamically `import()`s the
 * gate's `.ts` twin under `src/scripts/`) and read its exported
 * `GATE_CORE_PATHS`. Throws a {kind, message} on ImportError /
 * missing-or-empty GATE_CORE_PATHS — surfaced as exit 2 by `main`.
 *
 * The gate `.py` modules are gone (ADR-200); the `.ts` twins each export a
 * module-level `GATE_CORE_PATHS`. The Python original read the gate's REAL
 * paths via `importlib` + `getattr` and never copied them — this keeps that
 * property by importing the twin and reading its exported constant. A `tsx`
 * subprocess (not an in-process dynamic `import()`) is used so this function
 * stays synchronous: callers and tests rely on a sync `Map` return / a
 * synchronous `throw`. The subprocess emits the same protocol — a JSON map
 * `{gate: [abs paths...]}` on success, or `ERR\t<kind>\t<message>` + exit 1 on
 * the first failing gate — with byte-identical ImportError / AttributeError
 * messages.
 */
function collect_gate_paths(gate_modules: readonly string[]): Map<string, string[]> {
    // tsx --eval transforms as CJS (no top-level await), so the dynamic
    // import()s live inside an async IIFE; a failure in the IIFE rejects and
    // is surfaced as a non-zero exit via the trailing .catch.
    const scriptLines = [
        'const { pathToFileURL } = require("node:url");',
        'const path = require("node:path");',
        '(async () => {',
        // With `tsx --eval`, positional args populate process.argv from
        // index 1 (there is no script-path slot): argv = [node, arg1, arg2, …].
        '    const scriptsDir = process.argv[1];',
        '    const gates = process.argv.slice(2);',
        '    const out = {};',
        '    for (const name of gates) {',
        '        let mod;',
        '        try {',
        '            mod = await import(pathToFileURL(path.join(scriptsDir, name + ".ts")).href);',
        '        } catch (exc) {',
        '            const m = exc && exc.message ? exc.message : String(exc);',
        '            process.stdout.write("ERR\\tImportError\\t" + m);',
        '            process.exit(1);',
        '        }',
        '        const paths = mod.GATE_CORE_PATHS;',
        '        if (!paths || paths.length === 0) {',
        '            const msg = name + " has no non-empty GATE_CORE_PATHS — gate cannot be "',
        '                + "checked. Declare the source targets it enforces.";',
        '            process.stdout.write("ERR\\tAttributeError\\t" + msg);',
        '            process.exit(1);',
        '        }',
        '        out[name] = Array.from(paths).map((p) => String(p));',
        '    }',
        '    process.stdout.write(JSON.stringify(out));',
        '})().catch((exc) => {',
        '    process.stderr.write(exc && exc.message ? exc.message : String(exc));',
        '    process.exit(1);',
        '});',
    ];
    const tsxBin = path.join(
        REPO_ROOT,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
    );
    const proc = spawnSync(
        tsxBin,
        [
            '--eval',
            scriptLines.join('\n'),
            path.join(REPO_ROOT, 'src', 'scripts'),
            ...gate_modules,
        ],
        { encoding: 'utf8' },
    );
    const stdout = proc.stdout ?? '';
    if (stdout.startsWith('ERR\t')) {
        const parts = stdout.split('\t');
        const kind = parts[1] ?? 'ImportError';
        const message = parts.slice(2).join('\t');
        const err = new Error(message) as Error & { kind: string };
        err.kind = kind;
        throw err;
    }
    if ((typeof proc.status === 'number' ? proc.status : 1) !== 0) {
        // tsx unavailable or crashed before producing JSON — treat as an
        // import failure (exit 2 path), matching the "a gate failed to import"
        // semantics of the Python original.
        const err = new Error(
            (proc.stderr ?? '').trim() || 'gate introspection failed',
        ) as Error & { kind: string };
        err.kind = 'ImportError';
        throw err;
    }
    const parsed = JSON.parse(stdout) as Record<string, string[]>;
    const out = new Map<string, string[]>();
    for (const name of gate_modules) {
        out.set(name, parsed[name] ?? []);
    }
    return out;
}

/**
 * Return [gate, reason, path] for every target that fails. Pure (no import
 * side effects). A target fails when it does not resolve under the source
 * tree (src/ or packages/) or does not exist on disk.
 */
function check_paths(named: Map<string, string[]>): Array<[string, string, string]> {
    const failures: Array<[string, string, string]> = [];
    for (const [gate, paths] of named) {
        for (const p of paths) {
            if (!_is_under_source_tree(p)) {
                failures.push([gate, 'not under the source tree (src/ or packages/)', p]);
            } else if (!_exists(p)) {
                failures.push([gate, 'target does not exist', p]);
            }
        }
    }
    return failures;
}

function main(): number {
    let named: Map<string, string[]>;
    try {
        named = collect_gate_paths(GATES);
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`❌  check-gate-paths: ${msg}\n`);
        return 2;
    }
    const failures = check_paths(named);
    if (failures.length > 0) {
        process.stdout.write(
            '❌  check-gate-paths: gate target(s) do not resolve under the source tree:\n',
        );
        for (const [gate, reason, p] of failures) {
            process.stdout.write(`    ${gate}: ${reason} → ${p}\n`);
        }
        process.stdout.write("\n  A source-tree move likely desynced a gate. Fix the gate's\n");
        process.stdout.write('  GATE_CORE_PATHS or the move.\n');
        return 1;
    }
    let total = 0;
    for (const v of named.values()) {
        total += v.length;
    }
    process.stdout.write(
        `✅  check-gate-paths: ${total} enforced target(s) across ` +
            `${named.size} gate(s) resolve under the source tree.\n`,
    );
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    REPO_ROOT,
    GATES,
    _is_under_source_tree,
    collect_gate_paths,
    check_paths,
    main,
};
