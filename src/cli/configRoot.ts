/**
 * Host-supplied config-root resolution (reciprocal-ecosystem Phase 2).
 *
 * A host that spawns `agent-config` per profile needs AC to read/write
 * its own config/settings/state under a host-chosen directory instead of
 * the shared `~/.event4u/agent-config/` default — otherwise two profiles
 * silently collide on the same files.
 *
 * The seam is the existing single source of truth `event4u_root()`
 * (`scripts/_lib/user_global_paths.ts`), which already honours the
 * `EVENT4U_CONFIG_HOME` environment variable. This module layers a
 * documented CLI flag on top and wires both into one precedence:
 *
 *   flag (`--config-root <path>`)  >  env (`EVENT4U_CONFIG_HOME`)  >  default
 *
 * The flag is applied by exporting its value into `EVENT4U_CONFIG_HOME`
 * once at CLI entry (`applyConfigRootFromArgv`), so every downstream
 * resolver — the scripts family via `event4u_root()`, the server family
 * via the same seam, and every Bash-delegated subprocess (which inherits
 * `process.env`) — observes the override through the same variable.
 *
 * With no flag and no env, this module has zero side effects and AC's
 * behaviour is byte-identical to before.
 */

import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { event4u_root, EVENT4U_HOME_ENV } from '../scripts/_lib/user_global_paths.js';

/** The documented CLI flag a host passes on spawn. */
export const CONFIG_ROOT_FLAG = '--config-root';

/**
 * The environment variable the flag maps onto — the established
 * config-home override honoured by `event4u_root()`. Reused (rather than
 * introducing a second name) so there is exactly one override variable.
 */
export const CONFIG_ROOT_ENV = EVENT4U_HOME_ENV;

/** Expand a leading `~` / `~/` like a shell would. */
function expandHome(p: string): string {
    if (p === '~') return homedir();
    if (p.startsWith('~/')) return join(homedir(), p.slice(2));
    return p;
}

export interface ResolveConfigRootOptions {
    /** Explicit `--config-root` value (highest precedence). */
    flag?: string | null;
    /** Environment map to read `EVENT4U_CONFIG_HOME` from. Defaults to `process.env`. */
    env?: Record<string, string | undefined> | null;
}

/**
 * Resolve the effective config root for the given inputs, applying the
 * `flag > env > default` precedence. Pure — no filesystem writes.
 *
 * The flag is expanded (`~`) and resolved to an absolute path; the env /
 * default path is delegated to `event4u_root()` so there is a single
 * source of truth for the non-flag branches.
 */
export function resolveConfigRoot(opts: ResolveConfigRootOptions = {}): string {
    const flag = opts.flag?.trim();
    if (flag !== undefined && flag.length > 0) {
        return resolve(expandHome(flag));
    }
    return event4u_root(opts.env ?? null);
}

/**
 * Validate and materialise a host-supplied config root: expand `~`,
 * resolve to an absolute path, and create the directory (mode 0700) if
 * missing. Throws on an empty value. Returns the absolute path.
 */
export function ensureConfigRoot(rawPath: string): string {
    const trimmed = rawPath.trim();
    if (trimmed.length === 0) {
        throw new Error(`${CONFIG_ROOT_FLAG} requires a non-empty path`);
    }
    const abs = resolve(expandHome(trimmed));
    mkdirSync(abs, { recursive: true, mode: 0o700 });
    return abs;
}

export interface ApplyConfigRootResult {
    /** `argv` with the `--config-root` flag (and its value) removed. */
    argv: string[];
    /** The absolute config root that was applied, or `null` when no flag was present. */
    configRoot: string | null;
}

/**
 * Extract the first `--config-root <path>` / `--config-root=<path>` from
 * `argv`, apply it (validate → mkdir 0700 → set `EVENT4U_CONFIG_HOME`),
 * and return the cleaned `argv`.
 *
 * When the flag is absent this is a pure passthrough: a copy of `argv`,
 * `configRoot: null`, and no environment or filesystem mutation — so the
 * default behaviour is byte-identical.
 *
 * Throws (a clear message) when the flag is present without a value.
 */
export function applyConfigRootFromArgv(
    argv: readonly string[],
    env: NodeJS.ProcessEnv = process.env,
): ApplyConfigRootResult {
    const out: string[] = [];
    let value: string | null = null;

    for (let i = 0; i < argv.length; i++) {
        const token = argv[i] as string;
        if (value === null && token === CONFIG_ROOT_FLAG) {
            const next = argv[i + 1];
            if (next === undefined || next.startsWith('-')) {
                throw new Error(`${CONFIG_ROOT_FLAG} requires a path argument`);
            }
            value = next;
            i += 1; // consume the value token
            continue;
        }
        if (value === null && token.startsWith(`${CONFIG_ROOT_FLAG}=`)) {
            value = token.slice(CONFIG_ROOT_FLAG.length + 1);
            continue;
        }
        out.push(token);
    }

    if (value === null) {
        return { argv: out, configRoot: null };
    }

    const configRoot = ensureConfigRoot(value);
    env[CONFIG_ROOT_ENV] = configRoot;
    return { argv: out, configRoot };
}
