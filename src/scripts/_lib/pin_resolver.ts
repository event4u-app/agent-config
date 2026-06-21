/**
 * Pin-aware version resolver for the `agent-config` dispatcher.
 *
 * TypeScript twin of `src/scripts/_lib/pin_resolver.py` (ADR-200,
 * Phase 2 / Wave 1 batch B). The dispatcher consults this module
 * **before** doing any work. If `.agent-settings.yml` carries a
 * non-empty `agent_config_version` pin and the currently running
 * package version does not match, the process re-execs via
 * `npx @event4u/agent-config@<pin> <argv>`.
 *
 * Determinism is the goal: a consumer's `npx` cache may resolve to a
 * different version than the project pinned to, and the resolver
 * guarantees the pinned version is the one that actually runs.
 *
 * Escape hatch: `AGENT_CONFIG_NO_PIN_REEXEC=1` disables the re-exec
 * entirely (used for local development of the package itself and for
 * the recursion guard described below).
 *
 * Recursion guard: the parent sets `AGENT_CONFIG_PIN_REEXEC_DEPTH=1`
 * on the child env so the re-exec'd child does not loop if the freshly
 * spawned `npx` resolves to a still-mismatched version. One re-exec
 * per process, full stop.
 *
 * Port notes (intentional TS adaptations, semantics preserved):
 * - `read_pin` / `maybe_reexec` are async because the default settings
 *   loader is loaded via dynamic `import()` (Python uses a deferred
 *   local import of `scripts._lib.agent_settings`).
 * - `maybe_reexec` accepts injectable `pin_reader` / `which` seams —
 *   the test points the pytest suite reaches via `monkeypatch`.
 * - Node has no `os.execvpe` (true process replacement). The default
 *   runner spawns the child synchronously with inherited stdio and
 *   exits with its status — flagged as a divergence candidate.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { EnvMap } from './user_global_paths';

export const PACKAGE_NAME = '@event4u/agent-config';
export const PIN_KEY = 'agent_config_version';
export const NO_REEXEC_ENV = 'AGENT_CONFIG_NO_PIN_REEXEC';
export const REEXEC_DEPTH_ENV = 'AGENT_CONFIG_PIN_REEXEC_DEPTH';

/** Settings-loader shape — mirrors `agent_settings.load_agent_settings(cwd=...)`. */
export type SettingsLoader = (options: {
    cwd: string;
}) => Record<string, unknown> | Promise<Record<string, unknown>>;

/** Injectable re-exec runner — mirrors the pytest `runner=` seam. */
export type ReexecRunner = (npx: string, argv: string[], env: EnvMap) => number;

function _normalize(version: string): string {
    return version.trim().replace(/^v+/, '');
}

/**
 * Return the pinned version from the cascaded settings, or `null`.
 *
 * Empty string and missing key both yield `null`. Any loader failure
 * (including a missing `agent_settings` TS twin while the migration is
 * in flight) yields `null` — mirroring the Python `except Exception`.
 */
export async function read_pin(
    cwd: string,
    options: { settings_loader?: SettingsLoader } = {},
): Promise<string | null> {
    let settings: Record<string, unknown>;
    try {
        let loader = options.settings_loader;
        if (loader === undefined) {
            // Deferred local import, mirroring the Python test-override
            // pattern. Specifier kept dynamic so tsc does not resolve it
            // eagerly while the agent_settings twin is still being ported.
            const specifier = './agent_settings';
            const mod = (await import(specifier)) as {
                load_agent_settings?: SettingsLoader;
            };
            if (typeof mod.load_agent_settings !== 'function') {
                return null;
            }
            loader = mod.load_agent_settings;
        }
        settings = await loader({ cwd });
    } catch {
        return null;
    }
    const raw = settings[PIN_KEY];
    if (typeof raw !== 'string') {
        return null;
    }
    const pin = raw.trim();
    return pin || null;
}

/** Pure predicate: do we need to re-exec under the pinned version? */
export function should_reexec(
    pin: string | null | undefined,
    installed: string,
    options: { env?: EnvMap | null } = {},
): boolean {
    const env = options.env ?? process.env;
    if (env[NO_REEXEC_ENV] === '1') {
        return false;
    }
    if (env[REEXEC_DEPTH_ENV] === '1') {
        return false;
    }
    if (!pin) {
        return false;
    }
    if (!installed) {
        return false;
    }
    return _normalize(pin) !== _normalize(installed);
}

/** Build the `npx` argv that re-execs at the pinned version. */
export function build_reexec_argv(pin: string, argv: string[]): string[] {
    return ['npx', '--yes', `${PACKAGE_NAME}@${_normalize(pin)}`, ...argv];
}

/**
 * Minimal `shutil.which` equivalent for locating `npx` on PATH.
 *
 * Like Python's `shutil.which`, the lookup uses the *real* process
 * environment's PATH (not the injected env map). On Windows, PATHEXT
 * extensions are tried (`.cmd`, `.exe`, ...).
 */
function _which(cmd: string): string | null {
    const path_var = process.env.PATH ?? '';
    const exts =
        process.platform === 'win32'
            ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';')
            : [''];
    for (const dir of path_var.split(path.delimiter)) {
        if (!dir) {
            continue;
        }
        for (const ext of exts) {
            const candidate = path.join(dir, cmd + ext.toLowerCase());
            try {
                const st = fs.statSync(candidate);
                if (st.isFile()) {
                    if (process.platform !== 'win32') {
                        fs.accessSync(candidate, fs.constants.X_OK);
                    }
                    return candidate;
                }
            } catch {
                // Not here — keep scanning.
            }
        }
    }
    return null;
}

/**
 * Default runner — closest Node equivalent of `os.execvpe`.
 *
 * Divergence candidate (flagged): Node cannot replace the current
 * process image, so the child runs as a synchronous subprocess with
 * inherited stdio and the parent exits with the child's status.
 */
function _exec_runner(npx: string, argv: string[], env: EnvMap): number {
    const result = spawnSync(npx, argv.slice(1), {
        env: env as NodeJS.ProcessEnv,
        stdio: 'inherit',
    });
    // Mirror "never returns on success": terminate with the child status.
    process.exit(result.status ?? 1);
}

/**
 * Re-exec at the pinned version if needed; return the child exit code.
 *
 * Returns `null` when no re-exec is performed (caller continues).
 * The injected `runner` covers the test path — the default runner
 * replaces the process (see `_exec_runner`).
 */
export async function maybe_reexec(
    installed: string,
    options: {
        cwd?: string | null;
        argv?: string[] | null;
        env?: EnvMap | null;
        runner?: ReexecRunner | null;
        /** Test seam mirroring `monkeypatch.setattr(pr, "read_pin", ...)`. */
        pin_reader?: (cwd: string) => string | null | Promise<string | null>;
        /** Test seam mirroring `monkeypatch.setattr(pr.shutil, "which", ...)`. */
        which?: (cmd: string) => string | null;
    } = {},
): Promise<number | null> {
    const cwd = options.cwd ?? process.cwd();
    const argv = options.argv ?? process.argv.slice(1);
    const env = options.env ?? process.env;
    const pin_reader = options.pin_reader ?? ((c: string) => read_pin(c));
    const which = options.which ?? _which;

    const pin = await pin_reader(cwd);
    if (!should_reexec(pin, installed, { env })) {
        return null;
    }

    if (pin == null) {
        // Unreachable — should_reexec only fires with a non-empty pin
        // (mirrors the Python `assert pin is not None`).
        throw new Error('maybe_reexec: pin narrowed to null after should_reexec');
    }
    const npx = which('npx');
    if (!npx) {
        // Cannot re-exec without npx — silently fall back to running
        // the locally-installed version. Better to do something than
        // to die because of a missing CLI.
        return null;
    }

    const new_argv = build_reexec_argv(pin, argv.length > 0 ? argv.slice(1) : []);
    const child_env: EnvMap = { ...env };
    child_env[REEXEC_DEPTH_ENV] = '1';

    const runner = options.runner ?? null;
    if (runner === null) {
        // Replaces the current process (exits); never returns on success.
        return _exec_runner(npx, new_argv, child_env);
    }
    return runner(npx, new_argv, child_env);
}

/** Parse the dispatcher-facing argv: `--cwd X --installed Y -- ARGS`. */
function _parse_cli(argv: string[]): { cwd: string; installed: string; forward: string[] } {
    let cwd = process.cwd();
    let installed = '';
    let forward: string[] = [];
    let i = 0;
    while (i < argv.length) {
        const token = argv[i];
        if (token === '--cwd' && i + 1 < argv.length) {
            cwd = argv[i + 1] as string;
            i += 2;
        } else if (token === '--installed' && i + 1 < argv.length) {
            installed = argv[i + 1] as string;
            i += 2;
        } else if (token === '--') {
            forward = argv.slice(i + 1);
            break;
        } else {
            i += 1;
        }
    }
    return { cwd, installed, forward };
}

// Script entry — mirrors the Python `if __name__ == "__main__"` block.
if (
    typeof process.argv[1] === 'string' &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    const { cwd, installed, forward } = _parse_cli(process.argv.slice(2));
    // Build the argv the child should see: `agent-config <forward...>`.
    const child_argv = ['agent-config', ...forward];
    await maybe_reexec(installed, { cwd, argv: child_argv });
}
