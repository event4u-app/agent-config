#!/usr/bin/env tsx
/**
 * showcase_replay — re-grade the artifacts committed showcase bundles kept, at
 * 0 USD (road-to-a-baseline-that-has-to-catch-up step 5.1; logic in
 * `_lib/showcase_replay.ts`).
 *
 * Usage: showcase_replay [--bundles DIR] [--corpus YAML] [--allow-fixture] [--json]
 *   --bundles        bundle root (default internal/bench/showcase)
 *   --allow-fixture  accept bundles marked "fixture": true — for a fixture root
 *                    such as tests/fixtures/showcase, never the evidence tree
 *
 * Exit: 0 reproduced, or INDETERMINATE (nothing re-gradable — printed as such,
 * never as a pass) · 1 a re-grade disagrees with its bundle · 2 a bundle,
 * corpus or usage error.
 */
import * as path from 'node:path';
import process from 'node:process';

import { REPO_ROOT } from './_lib/bench_artifact_graders.js';
import { renderReplay, replayBundles, type ReplayOptions } from './_lib/showcase_replay.js';

export function defaultReplayOptions(): ReplayOptions {
    return {
        bundles: path.join(REPO_ROOT, 'internal', 'bench', 'showcase'),
        corpus: path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'ab-artifact-v2.yaml'),
        allowFixture: false,
    };
}

const USAGE = 'usage: showcase_replay [--bundles DIR] [--corpus YAML] [--allow-fixture] [--json]\n';

export function main(argv: string[] = process.argv.slice(2)): number {
    const opts = defaultReplayOptions();
    let json = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '-h' || a === '--help') {
            process.stdout.write(USAGE);
            return 0;
        } else if (a === '--allow-fixture') opts.allowFixture = true;
        else if (a === '--json') json = true;
        else if ((a === '--bundles' || a === '--corpus') && argv[i + 1] !== undefined) {
            const v = path.resolve(argv[(i += 1)] as string);
            if (a === '--bundles') opts.bundles = v;
            else opts.corpus = v;
        } else {
            process.stderr.write(USAGE);
            return 2;
        }
    }
    const report = replayBundles(opts);
    process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : renderReplay(report));
    if (report.problems.length > 0) return 2;
    return report.verdict === 'mismatch' ? 1 : 0;
}

if (process.argv[1] !== undefined && /showcase_replay\.(ts|js)$/.test(process.argv[1])) {
    process.exitCode = main();
}
