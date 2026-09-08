/**
 * "Was this module invoked as the command?" — one definition for the scripts
 * under `agents/scripts` that both run directly and are imported by siblings.
 *
 * Five of them carried a byte-identical copy of this logic, and the copies were
 * about to gain a sixth clause each. The interesting part is why the obvious
 * one-liner is not enough:
 *
 *  - `--splitting` in `build:agent-src-delegate` can move a module body into a
 *    shared chunk, where `import.meta.url` names the CHUNK. The URL comparison
 *    then never matches and the command exits 0 having done nothing — measured
 *    on `update_roadmap_progress` before this guard existed. Inside the bundle
 *    the invoked file name is the reliable signal, so the delegate branch runs
 *    first and a miss falls through rather than returning false.
 *  - A symlinked invocation (`.augment/scripts` → `dist/agent-src/scripts`, or
 *    macOS `/var` → `/private/var`) makes the raw URLs differ: `import.meta.url`
 *    is the resolved real path while `argv[1]` keeps the symlink. Hence the
 *    realpath comparison last.
 *
 * `moduleUrl` is the caller's own `import.meta.url` — it cannot be read from
 * here, which is why it is a parameter rather than a lookup.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Defined only by the esbuild delegate builds; `undefined` under tsx and node. */
declare const __AGENT_CONFIG_CLI_DELEGATE__: boolean | undefined;

export function isCliEntry(moduleUrl: string, name: string): boolean {
    const argv1 = process.argv[1];
    if (argv1 === undefined) {
        return false;
    }
    if (
        typeof __AGENT_CONFIG_CLI_DELEGATE__ !== 'undefined' &&
        __AGENT_CONFIG_CLI_DELEGATE__ &&
        path.basename(argv1, '.js') === name
    ) {
        return true;
    }
    const argvPath = path.resolve(argv1);
    if (moduleUrl === pathToFileURL(argvPath).href) {
        return true;
    }
    try {
        return fs.realpathSync(fileURLToPath(moduleUrl)) === fs.realpathSync(argvPath);
    } catch {
        return false;
    }
}
