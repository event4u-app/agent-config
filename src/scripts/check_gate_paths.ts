#!/usr/bin/env tsx
/**
 * Gate path-integrity check (R2 of road-to-test-and-gate-integrity).
 *
 * TypeScript twin of `src/scripts/check_gate_paths.py` (ADR-094,
 * Phase 4 / Wave 4c). CLI contract mirrored EXACTLY — no flags, exit
 * codes (0 all resolve, 1 missing / out-of-tree, 2 a gate failed to
 * import / lacks GATE_CORE_PATHS), byte-identical messages, stdout/stderr
 * split, same gate list / source-tree roots.
 *
 * The Python original reads each gate's ACTUAL enforced paths via that
 * module's `GATE_CORE_PATHS` attribute (`importlib.import_module`) — it
 * does NOT re-declare a copy of the path strings. The gates in `GATES`
 * are mostly still Python-only modules in this migration window, so this
 * twin introspects them by spawning `python3` with the same `sys.path`
 * shim the Python original uses (`REPO_ROOT/src/scripts`). That keeps the
 * "read the gate's real paths, never copy them" property regardless of
 * which gates are ported, and reproduces the ImportError → exit-2 and
 * AttributeError → exit-2 behaviour. No behaviour changes.
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
 * Import each gate (via python3, mirroring the Python original's
 * `importlib.import_module` + `sys.path` shim) and read its declared
 * `GATE_CORE_PATHS`. Throws a {kind, message} on ImportError /
 * missing-or-empty GATE_CORE_PATHS — surfaced as exit 2 by `main`.
 */
function collect_gate_paths(gate_modules: readonly string[]): Map<string, string[]> {
    // One python3 introspection process: replicate the Python body so the
    // exact AttributeError / ImportError messages propagate. Output is a JSON
    // map {gate: [abs paths...]} on success; on the first failing gate it
    // prints `ERR\t<kind>\t<message>` and exits 1.
    const scriptLines = [
        'import importlib, json, sys',
        'sys.path.insert(0, sys.argv[1])',
        'gates = sys.argv[2:]',
        'out = {}',
        'for name in gates:',
        '    try:',
        '        mod = importlib.import_module(name)',
        '    except ImportError as exc:',
        '        sys.stdout.write("ERR\\tImportError\\t%s" % exc)',
        '        sys.exit(1)',
        '    paths = getattr(mod, "GATE_CORE_PATHS", None)',
        '    if not paths:',
        '        msg = ("%s has no non-empty GATE_CORE_PATHS — gate cannot be "',
        '               "checked. Declare the source targets it enforces." % name)',
        '        sys.stdout.write("ERR\\tAttributeError\\t%s" % msg)',
        '        sys.exit(1)',
        '    out[name] = [str(p) for p in paths]',
        'sys.stdout.write(json.dumps(out))',
    ];
    const proc = spawnSync(
        'python3',
        ['-c', scriptLines.join('\n'), path.join(REPO_ROOT, 'src', 'scripts'), ...gate_modules],
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
        // python3 unavailable or crashed before producing JSON — treat as an
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
