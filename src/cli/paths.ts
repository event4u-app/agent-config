/**
 * Package-root and script-path resolution for the TS CLI shell.
 *
 * PACKAGE_ROOT is derived from this file's location at runtime. After
 * compilation the layout is `dist/cli/paths.js`, so two parent hops
 * land on the package root regardless of how the binary was invoked
 * (npm-global, vendor/bin symlink, npx, …).
 *
 * CONSUMER_ROOT is `process.cwd()` at entry — the Bash entry kept it
 * stable for downstream Python scripts; we preserve that invariant.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, realpathSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the package root (where package.json lives). */
export const PACKAGE_ROOT = realpathSync(resolve(here, '..', '..'));

/** Absolute path to the consumer's repo root (CWD on entry). */
export const CONSUMER_ROOT = process.cwd();

/**
 * Absolute path to the legacy Bash dispatcher.
 *
 * Phase 5 moved the dispatcher to `scripts/_dispatch.bash` so the
 * public-facing `scripts/agent-config` could become a 30-line
 * deprecation shim that forwards to the compiled TS binary. The
 * dispatcher is invoked directly here to avoid an infinite loop
 * (shim → TS → shim → …).
 */
export const BASH_ENTRY = resolve(PACKAGE_ROOT, 'scripts', '_dispatch.bash');

/**
 * Absolute path to the public-facing Bash deprecation shim.
 * Retained as a path constant for `doctor-shell` and future tooling
 * that needs to detect "is the shim still present?".
 */
export const BASH_SHIM = resolve(PACKAGE_ROOT, 'scripts', 'agent-config');

/** Absolute path to the package.json. */
export const PACKAGE_JSON = resolve(PACKAGE_ROOT, 'package.json');

/**
 * Absolute path to the release-time discovery manifest.
 *
 * Release-only artefact — built by `scripts/build_discovery_manifest.py`
 * into `dist/discovery/discovery-manifest.json` and shipped inside the
 * published tarball. Never present in PR working trees; absence at
 * runtime is operator error, not a crash (see Roadmap R3 Phase 3).
 */
export const DISCOVERY_MANIFEST = resolve(PACKAGE_ROOT, 'dist', 'discovery', 'discovery-manifest.json');

/**
 * Absolute path to the profiles-as-views directory (6.0.0-D Step 14).
 * Each `src/profiles/<id>.yaml` declares a profile's curated command view +
 * the packs whose full set `--expanded` adds. Read by `commands ls --profile`.
 */
export const PROFILES_DIR = resolve(PACKAGE_ROOT, 'src', 'profiles');

/**
 * Resolve a script that may live in either the package root or one
 * of the projected template paths. Mirrors `resolve_script` in the
 * Bash dispatcher.
 */
export function resolveScript(...candidates: string[]): string | null {
    for (const rel of candidates) {
        const abs = resolve(PACKAGE_ROOT, rel);
        if (existsSync(abs)) return abs;
    }
    return null;
}
