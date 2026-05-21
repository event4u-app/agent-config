/**
 * Write-root resolution.
 *
 * Decides where `.agent-settings.yml`, `.agent-user.md`,
 * `.agent-config/wizard-state.json` and the 2PC intent markers live for
 * the current server invocation.
 *
 *   - Inside the `@event4u/agent-config` package (CWD's `package.json#name`
 *     matches): `<cwd>/agents/` — package-sandbox mode. Protects the
 *     maintainer's global config while iterating on the wizard itself.
 *   - Anywhere else: `~/.event4u/agent-config/` — global mode. The wizard
 *     produces user-scope state, not project-scope.
 *
 * Legacy-read-fallback: in global mode the CWD is also returned as
 * `legacyReadRoot`. Read paths check `writeRoot` first; on ENOENT they
 * fall back to `legacyReadRoot` so a project that already has a local
 * `.agent-settings.yml` from a previous release keeps working. The next
 * write lands in `writeRoot`, silently migrating the file.
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export type WriteRootMode = 'package-sandbox' | 'global';

export interface WriteRootResolution {
    /** Absolute path — every write resolves under this directory. */
    writeRoot: string;
    /**
     * Absolute path that reads fall back to when `writeRoot` is missing
     * a file. `null` when no fallback applies (package-sandbox mode, or
     * the CWD coincides with `writeRoot`).
     */
    legacyReadRoot: string | null;
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

/** Absolute path to the user-scope global config directory. */
export function globalWriteRoot(home: string = homedir()): string {
    return join(home, GLOBAL_REL);
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
            mode: 'global',
        };
    }
    if (isInsidePackage(cwd)) {
        return {
            writeRoot: join(cwd, PACKAGE_SANDBOX_SUBDIR),
            legacyReadRoot: null,
            mode: 'package-sandbox',
        };
    }
    const writeRoot = globalWriteRoot(opts.home);
    const legacyReadRoot = cwd !== writeRoot ? cwd : null;
    return { writeRoot, legacyReadRoot, mode: 'global' };
}

/** Create the write-root directory tree if missing. Mode 0700 for global. */
export function ensureWriteRoot(writeRoot: string): void {
    mkdirSync(writeRoot, { recursive: true, mode: 0o700 });
}
