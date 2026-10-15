/**
 * `agent-config ci:settle <pr>` — the CI waiter, reached through the package's
 * own executable.
 *
 * Shipped commands used to name `npx tsx node_modules/@event4u/agent-config/
 * src/scripts/ci_settle.ts`, which fails on a global or ephemeral install (no
 * such path) and pulls `tsx` from the registry on a cold cache. Living under
 * `_cli/` gets this file bundled into `dist/cli-delegate/`, so a consumer runs
 * it with plain `node` and no TypeScript runner at all.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { main } from '../ci_settle.js';

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main(process.argv.slice(2));
}
