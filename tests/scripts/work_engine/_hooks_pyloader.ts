// Shared python3 importlib loader for the work_engine.hooks subpackage
// (ADR-094 py2ts parity harness). NOT a test file — the vitest include glob is
// `*.test.{ts,tsx}`, so this `_`-prefixed helper is never collected.
//
// The hooks `.py` modules use relative imports (`from ..registry import …`,
// `from ...delivery_state import …`). To exec a single hook module in python3
// without importing the whole `work_engine` package (whose `__init__` pulls in
// unported siblings), we synthesise namespace-package stubs for
// `work_engine`, `work_engine.hooks`, and `work_engine.hooks.builtin`, then
// load each requested submodule under its fully-qualified name BEFORE the
// importer runs — exactly the "register deps in sys.modules before exec_module"
// pattern the merged hook tests use.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
export const WE_DIR = path.join(
    REPO_ROOT,
    'src',
    'agent-src',
    'templates',
    'scripts',
    'work_engine',
);
export const HOOKS_DIR = path.join(WE_DIR, 'hooks');
export const BUILTIN_DIR = path.join(HOOKS_DIR, 'builtin');

export function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/**
 * Build a python3 prelude that registers namespace stubs and loads the named
 * foundation submodules. After the prelude, each loaded module is bound to a
 * short local name (the submodule's leaf, e.g. `registry`, `runner`).
 *
 * `foundation` — leaf names under `work_engine.hooks` to load (order matters:
 * dependencies first). `builtin` — leaf names under
 * `work_engine.hooks.builtin`. `we` — leaf names under `work_engine` itself
 * (e.g. `delivery_state`, `state`, `scoring.decision_engine`).
 */
export function pyHooksLoader(opts: {
    we?: string[];
    foundation?: string[];
    builtin?: string[];
}): string {
    const we = opts.we ?? [];
    const foundation = opts.foundation ?? [];
    const builtin = opts.builtin ?? [];
    const lines: string[] = [
        'import sys, json, types, importlib.util, os',
        `WE_DIR = ${JSON.stringify(WE_DIR)}`,
        `HOOKS_DIR = ${JSON.stringify(HOOKS_DIR)}`,
        `BUILTIN_DIR = ${JSON.stringify(BUILTIN_DIR)}`,
        'def _mkpkg(name, p):',
        '    pkg = types.ModuleType(name)',
        '    pkg.__path__ = [p]',
        '    pkg.__package__ = name',
        '    sys.modules[name] = pkg',
        '    return pkg',
        'def _load(modname, filepath):',
        '    spec = importlib.util.spec_from_file_location(modname, filepath)',
        '    mod = importlib.util.module_from_spec(spec)',
        '    sys.modules[modname] = mod',
        '    spec.loader.exec_module(mod)',
        '    return mod',
        '_mkpkg("work_engine", WE_DIR)',
        '_mkpkg("work_engine.scoring", os.path.join(WE_DIR, "scoring"))',
        '_mkpkg("work_engine._lib", os.path.join(WE_DIR, "_lib"))',
        '_mkpkg("work_engine.hooks", HOOKS_DIR)',
        '_mkpkg("work_engine.hooks.builtin", BUILTIN_DIR)',
    ];
    for (const leaf of we) {
        const sub = leaf.split('.').join('/');
        lines.push(
            `_load("work_engine.${leaf}", os.path.join(WE_DIR, ${JSON.stringify(`${sub}.py`)}))`,
        );
    }
    for (const leaf of foundation) {
        lines.push(
            `${leaf} = _load("work_engine.hooks.${leaf}", os.path.join(HOOKS_DIR, ${JSON.stringify(`${leaf}.py`)}))`,
        );
    }
    for (const leaf of builtin) {
        // Bind under the exact leaf name (Python allows leading-underscore
        // local names, e.g. `_chat_history_base`).
        lines.push(
            `${leaf} = _load("work_engine.hooks.builtin.${leaf}", os.path.join(BUILTIN_DIR, ${JSON.stringify(`${leaf}.py`)}))`,
        );
    }
    return lines.join('\n');
}

/** Run a python3 snippet with the hooks namespace pre-loaded. */
export function runPyHooks(
    opts: { we?: string[]; foundation?: string[]; builtin?: string[] },
    body: string,
): SpawnSyncReturns<string> {
    const code = `${pyHooksLoader(opts)}\n${body}`;
    return spawnSync('python3', ['-c', code], { encoding: 'utf8' });
}
