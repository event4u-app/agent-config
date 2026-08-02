#!/usr/bin/env tsx
/**
 * Emit the scoped-projection skill count — the number `docs/CLAIMS.md`
 * publishes for the default install
 * (road-to-reproducible-artefact-counts).
 *
 * The claim used to read "217 of 288 skills … with the counting method
 * pinned in the benchmark doc", while that benchmark doc said 215 of 286.
 * Both numbers were hand-typed, only one of them tracked the catalog, and
 * the gap grew by one on every skill added because no gate could compare
 * them. This script is the single derivation both now come from.
 *
 * It adds no counting mechanism of its own — that would be a second path
 * free to disagree with the first, which is the defect, not the fix:
 *
 *   - the file set is `update_counts.iter_skills()`, the exact walk behind
 *     the canonical `count('skills')`, so `projected + pruned === total`
 *     holds by construction;
 *   - the in/out predicate is `_lib/scoped_projection.is_pruned_under_scoped`,
 *     the exact function `install.ts` applies when it prunes a real user's
 *     tree, so the published number cannot describe a projection the
 *     installer does not perform.
 *
 * `runtime.active_packs` is deliberately empty here: the claim is about the
 * DEFAULT for a new install, and a fresh machine has no overlay. An operator
 * who activates extra packs gets more skills than the claim states — the
 * claim is a floor, and `--json` exposes `active_packs` so a reader can see
 * the assumption rather than infer it.
 *
 * Usage:
 *   ./scripts-run src/scripts/count_scoped_projection            # "217 of 288"
 *   ./scripts-run src/scripts/count_scoped_projection --json
 *   ./scripts-run src/scripts/count_scoped_projection --projected
 *
 * Exit codes: 0 ok · 1 the pack registry could not be read.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    scoped_projection_stats,
    type ScopedProjectionStats,
} from './_lib/scoped_projection.js';
import { iter_skills, REPO_ROOT } from './update_counts.js';

const _HERE = fileURLToPath(import.meta.url);

export type { ScopedProjectionStats };

/** Partition the canonical skill catalog with the installer's own predicate. */
export function stats(package_root: string = REPO_ROOT): ScopedProjectionStats {
    return scoped_projection_stats(package_root, iter_skills());
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let s: ScopedProjectionStats;
    try {
        s = stats();
    } catch (err) {
        process.stderr.write(
            `❌  scoped-projection count unavailable: ${(err as Error).message}\n` +
                '    (src/config/discovery/packs.yml must exist and parse to a list)\n',
        );
        return 1;
    }

    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(s, null, 2)}\n`);
        return 0;
    }
    if (argv.includes('--projected')) {
        process.stdout.write(`${s.projected}\n`);
        return 0;
    }
    if (argv.includes('--total')) {
        process.stdout.write(`${s.total}\n`);
        return 0;
    }
    process.stdout.write(`${s.projected} of ${s.total}\n`);
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main(process.argv.slice(2)));
}
