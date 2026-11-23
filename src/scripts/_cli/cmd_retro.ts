#!/usr/bin/env node
/**
 * `agent-config retro` — the `/retro` fact reader and recorder, reachable in a
 * consumer install.
 *
 * The `<retro-queue>` line tells the agent to run `/retro`, and `/retro` reads
 * its facts through `src/scripts/retro.ts`. A consumer has neither `./scripts-run`
 * nor `tsx`, and `exec_ts` only finds a precompiled bundle for `_cli/cmd_*`
 * entries — so the documented path could not run there and the queue never
 * cleared (#2994). This entry adds no behaviour: it forwards argv to
 * `retro.ts`'s `main`, so the bundle and the dev-tree script answer the same way.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { main as retroMain } from '../retro.js';

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    return retroMain(argv);
}

// `--splitting` moves this body into a shared chunk whose `import.meta.url` is
// never `argv[1]`, so inside the delegate bundle the invoked file name decides
// (the cmd_migrate.ts note); elsewhere the URL / realpath comparison does.
declare const __AGENT_CONFIG_CLI_DELEGATE__: boolean | undefined;
function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (
        typeof __AGENT_CONFIG_CLI_DELEGATE__ !== 'undefined' &&
        __AGENT_CONFIG_CLI_DELEGATE__ &&
        path.basename(process.argv[1], '.js') === 'cmd_retro'
    ) {
        return true;
    }
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (isCliEntry()) {
    process.exitCode = main();
}
