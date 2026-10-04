#!/usr/bin/env tsx
/**
 * Report what a host actually loads, per host rule directory (step 0.1).
 *
 * REPORT-ONLY, AND THE NAME SAYS SO. Phase 0 of
 * `road-to-a-rule-carrier-that-works-outside-the-repo` makes no behavior
 * change, so this never fails on a number: exit 0 whenever it could read, 2 on
 * usage. It is also deliberately NOT named `check_*` or `lint_*` —
 * `_lib/gate_population.ts` enters any script with those prefixes into the gate
 * population and the ledger then owes it a per-target accounting, which is the
 * wrong contract for an instrument. A later ceiling over this measurement is a
 * different script with a `check_` name.
 *
 * `--home` and `--project` exist so this can be pointed at a temporary `HOME`,
 * which is the step's own framing and the thing that refutes
 * `check_standing_rule_delivery`'s "no CI workflow performs a user-scope
 * install": the installer reads `HOME` from the environment, so a runner can
 * stage one and measure it. The library behind this takes the same two as
 * parameters, which is what keeps CI, `doctor` and the upgrade receipt from
 * each growing their own reader.
 */

import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';

import { hostVersion } from './cache_realization_report.js';
import { manifest_path } from './_lib/installed_tools.js';
import {
    buildInstalledLayerReport,
    renderInstalledLayerReport,
    type InstalledLayerReport,
} from './_lib/installed_layer.js';

const PROG = 'installed_layer_report';

interface Args {
    home: string;
    project: string;
    json: boolean;
}

export function parseArgs(argv: readonly string[]): Args | null {
    let home = process.env['HOME'] ?? os.homedir();
    let project = process.cwd();
    let json = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--json') {
            json = true;
        } else if (a === '--home') {
            i += 1;
            const v = argv[i];
            if (v === undefined) return null;
            home = v;
        } else if (a === '--project') {
            i += 1;
            const v = argv[i];
            if (v === undefined) return null;
            project = v;
        } else if (a === '--quiet') {
            // Accepted and ignored: this prints one block either way, and a flag
            // that silences a report leaves nothing to have run it for.
        } else {
            return null;
        }
    }
    return { home, project, json };
}

/** Build the report for one machine, resolving the manifest from the project root. */
export function reportFor(args: Args): InstalledLayerReport {
    return buildInstalledLayerReport({
        home: args.home,
        projectRoot: args.project,
        manifestPath: manifest_path(args.project),
        hostVersion: hostVersion(),
    });
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const args = parseArgs(argv);
    if (args === null) {
        process.stderr.write(`usage: ${PROG} [--home <dir>] [--project <dir>] [--json]\n`);
        return 2;
    }
    const report = reportFor(args);
    if (args.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
        process.stdout.write(`${renderInstalledLayerReport(report).join('\n')}\n`);
    }
    // One machine-readable line, in the shape every reporting script here uses.
    // It counts FILES across every layer read, which is the denominator the
    // character total is over — a reader comparing two runs needs both.
    process.stdout.write(`scanned: ${String(report.totals.files)}\n`);
    return 0;
}

const _entry = process.argv[1];
if (_entry !== undefined && path.resolve(_entry) === path.resolve(new URL(import.meta.url).pathname)) {
    process.exit(main());
}
