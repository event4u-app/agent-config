#!/usr/bin/env tsx
/**
 * Scale-history bench scorer — SECONDARY verification layer
 * (internal/bench/corpora/scale-history-PREREG.md: the manual rubric in
 * rubric.md is PRIMARY; this script runs lint_persistence over an artifact
 * dir and emits per-class gate-defect counts so linter recall/precision vs
 * the rubric can be reported).
 *
 * Usage:
 *   score.ts --artifact <dir> [--arm A|B|C] [--family <model-family>]
 *   score.ts --dry            # runs on the committed sample-artifact
 *
 * The dry path is the ONLY thing that executes before the standing
 * benchmark-spend authorization clears (run gate, pre-registered).
 * Exit 0 always — scores are data.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { run_lint } from '../../../src/scripts/lint_persistence.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function main(argv: string[]): void {
    let artifact = '';
    let arm = 'dry';
    let family = 'none';
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--artifact') artifact = argv[++i] ?? '';
        else if (argv[i] === '--arm') arm = argv[++i] ?? 'dry';
        else if (argv[i] === '--family') family = argv[++i] ?? 'none';
        else if (argv[i] === '--dry') artifact = path.join(HERE, 'sample-artifact');
    }
    if (!artifact) {
        process.stderr.write('usage: score.ts --artifact <dir> | --dry\n');
        process.exit(2);
    }

    const report = run_lint(artifact, ['eloquent', 'raw-sql']);
    const by_class: Record<string, number> = {};
    for (const f of report.findings) {
        if (f.waived || f.tier !== 'gate') continue;
        by_class[f.failure_class] = (by_class[f.failure_class] ?? 0) + 1;
    }
    const out = {
        arm,
        family,
        artifact,
        gate_defects_total: report.gate_count,
        by_class,
        advice_count: report.advice_count,
        waived_count: report.waived_count,
        note: 'secondary scorer — manual rubric (rubric.md) is primary per pre-registration',
    };
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

main(process.argv.slice(2));
