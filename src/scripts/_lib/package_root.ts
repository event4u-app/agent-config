/**
 * Layout-independent package-root resolution for the `_cli` delegate commands.
 *
 * `src/scripts/_cli/*.ts` sits three levels below the package root, so every
 * delegate command derived the root with three hard-coded parent hops. Then the
 * delegate precompile (`fa51c5a54`) started bundling those same modules into
 * `dist/cli-delegate/*.js` — **two** levels below the root. Fixed hop counts are
 * correct in exactly one of the two layouts, and nothing failed loudly: three
 * hops from the bundle lands on `<pkg>/..`, which for a scoped install is
 * `node_modules/@event4u`. `conformance` then reported `dist/router.json` and
 * `src/scripts/hook_manifest.yaml` as missing — files that ship fine — and the
 * 9.11.0 release PR's `tarball E2E` went red on both Node majors.
 *
 * The fix is to stop counting hops. Anchor on the marker that actually defines
 * the root: the `package.json` whose `name` is this package. That answer holds
 * for the source tree, for any bundle depth, for npm-global, npx, and
 * vendor/bin symlink invocations — and it keeps holding if either directory
 * ever moves.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/** `name` in this package's own package.json — the root marker. */
export const PACKAGE_NAME = '@event4u/agent-config';

/**
 * Bound on the upward walk. Deep enough for any real install path, finite so a
 * malformed start value can never spin.
 */
const MAX_ASCENT = 16;

/**
 * Absolute package root for the module at `fromUrlOrPath` (pass
 * `import.meta.url`).
 *
 * Walks up looking for the package.json whose `name` is {@link PACKAGE_NAME}.
 * A consumer's own package.json encountered on the way is skipped by that name
 * check, so an install nested under another project resolves correctly.
 *
 * `legacyHops` is the pre-existing hop count for the *source* layout and is
 * used only if no marker is found. Falling back beats throwing during CLI
 * startup: a wrong path yields one actionable "missing file" message, while an
 * exception takes down every command in the delegate.
 */
export function resolvePackageRoot(fromUrlOrPath: string, legacyHops = 3): string {
    const start = fromUrlOrPath.startsWith('file:') ? fileURLToPath(fromUrlOrPath) : fromUrlOrPath;
    const startDir = path.dirname(start);

    let dir = startDir;
    for (let i = 0; i < MAX_ASCENT; i++) {
        const manifest = path.join(dir, 'package.json');
        if (fs.existsSync(manifest)) {
            try {
                const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8')) as { name?: unknown };
                if (parsed.name === PACKAGE_NAME) {
                    return dir;
                }
            } catch {
                // Unreadable / unparseable manifest — not our marker; keep ascending.
            }
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            break; // filesystem root
        }
        dir = parent;
    }

    return path.resolve(startDir, ...(Array.from({ length: legacyHops }, () => '..') as string[]));
}
