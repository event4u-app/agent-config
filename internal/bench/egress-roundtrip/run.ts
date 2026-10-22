#!/usr/bin/env tsx
/**
 * PREREG endpoint (c), identifier half, of
 * `internal/bench/egress-placeholders-PREREG.md`. Before any reading counts the
 * scorer must reject two planted defects: a restore that drops one byte per
 * restored value, and a replacer whose second pass alters its own output.
 *
 *   node_modules/.bin/tsx internal/bench/egress-roundtrip/run.ts [--json <out>]
 */
import * as fs from 'node:fs';

import { loadW1, W1X_PER_TYPE, W1X_SEED, w1x } from './corpus.js';
import { droppingRestore, nonIdempotentReplace, passesBar, realReplace, scoreRoundTrip, type TypeReading } from './scorer.js';

function table(m: ReadonlyMap<string, TypeReading>): Record<string, TypeReading> {
    return Object.fromEntries([...m].sort(([a], [b]) => a.localeCompare(b)));
}

function main(argv: readonly string[]): number {
    const w1 = loadW1();
    const extended = w1x();

    const dropped = scoreRoundTrip(w1, realReplace, droppingRestore);
    const droppedExact = [...dropped.values()].reduce((n, r) => n + r.exactRestore, 0);
    const grown = scoreRoundTrip(w1, nonIdempotentReplace);
    const grownMismatches = [...grown.values()].reduce((n, r) => n + r.idempotenceMismatches, 0);
    if (passesBar(dropped) || passesBar(grown) || grownMismatches === 0) {
        process.stderr.write('egress-roundtrip bench: a scorer did not reject its planted defect — no reading taken\n');
        return 2;
    }

    const readingW1 = scoreRoundTrip(w1);
    const readingW1x = scoreRoundTrip(extended);
    const result = {
        corpora: {
            w1: { source: 'tests/fixtures/egress-detection/w1-identifiers.json', seed: 20261019, documents: w1.length },
            w1x: { generated: true, seed: W1X_SEED, per_type: W1X_PER_TYPE, documents: extended.length },
        },
        falsification: {
            dropping_restore: { documents: w1.length, exact_restores: droppedExact, passes_bar: passesBar(dropped) },
            non_idempotent_replace: { documents: w1.length, idempotence_mismatches: grownMismatches, passes_bar: passesBar(grown) },
        },
        w1: table(readingW1),
        w1x: table(readingW1x),
        verdict: { w1: passesBar(readingW1), w1x: passesBar(readingW1x) },
        node: process.version,
        platform: `${process.platform}-${process.arch}`,
    };
    const i = argv.indexOf('--json');
    if (i !== -1 && argv[i + 1] !== undefined) fs.writeFileSync(argv[i + 1] as string, `${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
}

process.exit(main(process.argv.slice(2)));
