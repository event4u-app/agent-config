/**
 * Write-root resolution.
 *
 * Decides where `.agent-settings.yml`, `.agent-user.md`,
 * `.agent-config/wizard-state.json` and the 2PC intent markers live for
 * the current server invocation.
 *
 *   - Inside the `@event4u/agent-config` package (CWD's `package.json#name`
 *     matches): `<cwd>/agents/` — package-sandbox mode. The maintainer's
 *     in-repo `.agent-settings.yml` (and `.agent-user.md`) at `<cwd>/` is
 *     surfaced as `legacyReadRoot` so the wizard pre-populates from the
 *     existing file; the next finish writes under `agents/` and the
 *     wizard route deletes the legacy file (auto-migration, opt-in via
 *     `setup` without `--dry-run`).
 *   - Anywhere else: `~/.event4u/agent-config/` — global mode. The wizard
 *     produces user-scope state, not project-scope. CWD is also surfaced
 *     as `legacyReadRoot` for consumer projects that already shipped a
 *     local `.agent-settings.yml` from an earlier release.
 *
 * Legacy-read-fallback semantics: reads check `writeRoot` first; on
 * ENOENT they fall back to `legacyReadRoot`. Auto-delete of the legacy
 * file happens only in the wizard finish handler after a successful
 * 2PC commit (see `src/server/routes/wizard.ts`).
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { event4u_root, EVENT4U_HOME_ENV } from '../scripts/_lib/user_global_paths.js';

export type WriteRootMode = 'package-sandbox' | 'global';

export interface WriteRootResolution {
    /** Absolute path — every write resolves under this directory. */
    writeRoot: string;
    /**
     * Absolute path that reads fall back to when `writeRoot` is missing
     * a file. `null` when no fallback applies (CWD coincides with
     * `writeRoot`, or explicit `override`).
     */
    legacyReadRoot: string | null;
    /**
     * Absolute path of the consumer-project root the wizard may opt to
     * scope the write to (road-to-global-only-install § Phase 2.3). The
     * wizard surfaces a "scope to this project only" checkbox in Review
     * when this is non-null; ticking it routes the finish-handler commit
     * to `<projectScopeRoot>/settings/` instead of the global write root.
     *
     *   - global mode with a real CWD → CWD (the consumer project).
     *   - package-sandbox mode → `null` (maintainer is editing the
     *     package itself; the writeRoot already lives inside the repo so
     *     a project-scope opt-in would be a no-op).
     *   - explicit `override` → `null` (the operator pinned the root).
     */
    projectScopeRoot: string | null;
    /** Which branch was taken — surfaced in the ping response for the UI. */
    mode: WriteRootMode;
}

const GLOBAL_REL = join('.event4u', 'agent-config');
const PACKAGE_SANDBOX_SUBDIR = 'agents';
const PACKAGE_NAME = '@event4u/agent-config';

/** True when `cwd/package.json#name === '@event4u/agent-config'`. */
export function isInsidePackage(cwd: string): boolean {
    const pkgPath = join(cwd, 'package.json');
    if (!existsSync(pkgPath)) return false;
    try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: unknown };
        return pkg.name === PACKAGE_NAME;
    } catch {
        return false;
    }
}

/**
 * Absolute path to the user-scope global config directory.
 *
 * Honours a host-supplied config root (`EVENT4U_CONFIG_HOME`, set by the
 * `--config-root` flag) first, so the GUI wizard writes profile-scoped
 * settings under the same override as the scripts family — routed through
 * the single source of truth `event4u_root()`. With no override, falls
 * back to `<home>/.event4u/agent-config` (byte-identical to before; the
 * `home` param is still honoured for tests and callers that pass it).
 */
export function globalWriteRoot(home: string = homedir()): string {
    const override = process.env[EVENT4U_HOME_ENV];
    if (override !== undefined && override.length > 0) {
        return event4u_root();
    }
    return join(home, GLOBAL_REL);
}

/**
 * Read-only user-global fallback for package-sandbox mode
 * (road-to-setup-experience follow-up): when the maintainer runs the GUI
 * inside the package repo (or a worktree), reads seed from the REAL
 * `~/.event4u/agent-config/` config — name, IDE, installed packs — so a
 * local/dry-run test prefills like a consumer machine. Writes still land
 * in the sandbox, never here. `EVENT4U_CONFIG_HOME` overrides the path
 * (tests + power users, mirroring `user_global_paths.ts`). Returns `null`
 * outside sandbox mode (global mode already reads the real config).
 */
export function userGlobalReadRoot(mode: WriteRootMode, writeRoot: string): string | null {
    if (mode !== 'package-sandbox') return null;
    const envHome = process.env['EVENT4U_CONFIG_HOME'];
    const root = envHome !== undefined && envHome.length > 0 ? resolve(envHome) : globalWriteRoot();
    return root === writeRoot ? null : root;
}

export interface ResolveOptions {
    /** Override CWD (tests + explicit --project-root). */
    cwd?: string;
    /**
     * Explicit override — when set, used as `writeRoot` verbatim;
     * `legacyReadRoot` is suppressed. CLI flag `--project-root` lands here.
     */
    override?: string;
    /** Override home directory (tests only). */
    home?: string;
}

export function resolveWriteRoot(opts: ResolveOptions = {}): WriteRootResolution {
    const cwd = resolve(opts.cwd ?? process.cwd());
    if (opts.override !== undefined) {
        return {
            writeRoot: resolve(opts.override),
            legacyReadRoot: null,
            projectScopeRoot: null,
            mode: 'global',
        };
    }
    if (isInsidePackage(cwd)) {
        const writeRoot = join(cwd, PACKAGE_SANDBOX_SUBDIR);
        // Surface the repo root as legacy fallback so the wizard reads
        // the maintainer's existing `<cwd>/.agent-settings.yml` and
        // migrates it under `agents/` on finish. Auto-delete is gated
        // by the finish handler — never the resolver.
        return {
            writeRoot,
            legacyReadRoot: cwd,
            projectScopeRoot: null,
            mode: 'package-sandbox',
        };
    }
    const writeRoot = globalWriteRoot(opts.home);
    const legacyReadRoot = cwd !== writeRoot ? cwd : null;
    // CWD doubles as the project-scope target when the user opts into
    // local-only persistence. Suppressed when CWD coincides with the
    // global writeRoot (the rare case where the user runs the wizard
    // from inside `~/.event4u/agent-config/`).
    const projectScopeRoot = cwd !== writeRoot ? cwd : null;
    return { writeRoot, legacyReadRoot, projectScopeRoot, mode: 'global' };
}

/** Create the write-root directory tree if missing. Mode 0700 for global. */
export function ensureWriteRoot(writeRoot: string): void {
    mkdirSync(writeRoot, { recursive: true, mode: 0o700 });
}
