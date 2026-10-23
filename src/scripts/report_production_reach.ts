#!/usr/bin/env tsx
/**
 * Print the production entries and the size and digest of their import closure
 * (road-to-a-tick-the-shipped-path-earns 3.1). Two runs over one tree print the
 * same digest; a moved entry or a new edge changes it.
 *
 * Usage: ./scripts-run src/scripts/report_production_reach [--entries]
 */
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { productionReach, worktreeOf } from './_lib/production_reach.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function main(argv: readonly string[]): number {
    const reach = productionReach(worktreeOf(REPO_ROOT));
    const digest = createHash('sha256')
        .update([...reach.modules].sort().join('\n'))
        .update('\0')
        .update([...reach.symbols].sort().join('\n'))
        .digest('hex')
        .slice(0, 16);
    if (argv.includes('--entries')) for (const e of reach.entries) process.stdout.write(`${e}\n`);
    process.stdout.write(
        `production reach: ${reach.entries.size} entries · ${reach.modules.size} modules · ` +
            `${reach.symbols.size} reached symbols · digest ${digest}\n`,
    );
    return 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(main(process.argv.slice(2)));
}
