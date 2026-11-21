#!/usr/bin/env tsx
/**
 * The reachability map: every surface a repo can run, derived from its files.
 *
 * A completion claim over a change to an app is only as good as the check that
 * drove the app. Before an agent can say what it did NOT verify, it needs to
 * know what there was to verify, and that list must not depend on anyone
 * writing it down: a hand-kept list goes stale the day a script is renamed,
 * and the owner asked for none (2026-11-21). So every entry here is read off a
 * file the repo already keeps, and names the file and line it came from.
 *
 * Read: `package.json` scripts `dev|start|preview|serve`, `tauri.conf.json`
 * windows (repo root or `src-tauri/`), `playwright.config.*` `baseURL`,
 * `docker-compose*.yml` / `compose*.yml` service ports, and Taskfile tasks
 * `dev|run|serve`. A repo whose app starts some other way reads as having no
 * surface, which is a miss the verify skill names rather than a pass.
 *
 * Writes `agents/state/live-surfaces.json` (gitignored) and regenerates it when
 * any input file is newer than the map.
 *
 * Usage:
 *   agent-config verify:surfaces [--root DIR] [--json] [--quiet]
 *
 * Exit 0 always on a readable root; 2 on a usage error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { LIVE_SURFACES_REL, derive, readText, rel, type LiveSurfaceMap } from './_lib/live_surfaces.js';

export {
    LIVE_SURFACES_REL,
    deriveLiveSurfaces,
    type LiveSurface,
    type LiveSurfaceMap,
    type SurfaceKind,
} from './_lib/live_surfaces.js';

const _HERE = fileURLToPath(import.meta.url);
const _PROG = 'derive_live_surfaces';

function mtime(file: string): number {
    try {
        return fs.statSync(file).mtimeMs;
    } catch {
        return Number.NaN;
    }
}

/**
 * The map, regenerated when it is missing, unreadable, or older than any input
 * it was derived from (or any input that now exists and did not then).
 */
export function ensureLiveSurfaces(root: string, force = false): LiveSurfaceMap {
    const out = path.join(root, LIVE_SURFACES_REL);
    if (!force) {
        const outAt = mtime(out);
        const cached = readText(out);
        if (cached !== null && Number.isFinite(outAt)) {
            try {
                const map = JSON.parse(cached) as LiveSurfaceMap;
                const fresh = derive(root).inputs;
                const stale = fresh.some((f) => !(mtime(f) <= outAt))
                    || fresh.length !== (map.inputs ?? []).length;
                if (!stale && Array.isArray(map.surfaces)) return map;
            } catch {
                // Unreadable map: regenerate below.
            }
        }
    }
    const { surfaces, inputs } = derive(root);
    const map: LiveSurfaceMap = {
        generated_at: new Date().toISOString(),
        inputs: inputs.map((f) => rel(root, f)),
        surfaces,
    };
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(map, null, 2)}\n`);
    return map;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    // The dispatcher strips a global `--root` and exports it here, so
    // `agent-config verify:surfaces --root X` reaches this default, not argv.
    let root = process.env['AGENT_CONFIG_PROJECT_ROOT'] || process.cwd();
    let quiet = false;
    let asJson = false;
    let force = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--root') {
            const next = argv[i + 1];
            if (next === undefined) {
                process.stderr.write(`${_PROG}: --root needs a path\n`);
                return 2;
            }
            root = path.resolve(next);
            i += 1;
        } else if (a === '--quiet') {
            quiet = true;
        } else if (a === '--json') {
            asJson = true;
        } else if (a === '--force') {
            force = true;
        } else {
            process.stderr.write('usage: verify:surfaces [--root DIR] [--json] [--force] [--quiet]\n');
            return 2;
        }
    }
    const map = ensureLiveSurfaces(root, force);
    if (quiet) return 0;
    if (asJson) {
        process.stdout.write(`${JSON.stringify(map, null, 2)}\n`);
        return 0;
    }
    if (map.surfaces.length === 0) {
        process.stdout.write(
            `no runnable surface derived under ${root} — a change here has no live check to owe, ` +
                'or the repo starts its app in a way this reader does not know (list it as not verified)\n',
        );
        return 0;
    }
    for (const s of map.surfaces) {
        const where = s.url ?? s.size ?? '';
        process.stdout.write(`${s.kind}\t${s.name}\t${s.start ?? '—'}\t${where}\t${s.derived_from}\n`);
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (!process.argv[1]) return false;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
