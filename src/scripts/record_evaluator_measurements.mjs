#!/usr/bin/env node
/**
 * record_evaluator_measurements.mjs — write the committed measurement record.
 *
 * `cli_help_command_count` drifted 74 → 80 against a value frozen at 79 with
 * nobody seeing it, because the only place the real number existed was a
 * transient CI log. The fix (road-to-gates-that-can-fail Phase 5; council route
 * 2026-08-02) is a COMMITTED artifact: the nightly writes the measurement set
 * here, and `check_evaluator_budgets --recorded` compares a later fresh run
 * against it — a contradiction warns on `main` and fails on `release/*`. The
 * review surface that already exists carries the signal; no notification
 * channel a single maintainer would mute.
 *
 * Lives under `agents/evidence/` (the repo's committed-evidence tree), NOT
 * under `src/config/` which ships: this is maintainer evidence with nightly
 * churn, not consumer runtime config, and keeping it out of the tarball also
 * keeps `evaluator-budgets.json` — the policy — reviewable on its own.
 *
 * Sorted keys + 4-space indent + trailing newline: a moved number must be a
 * one-line diff, or the artifact is not reviewable.
 *
 * Usage:
 *   node src/scripts/record_evaluator_measurements.mjs \
 *     --measurements <file.json> [--out <file.json>]
 *     [--sha <git sha>] [--run-url <url>] [--conditions <text>]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

/** Default (repo-relative) home of the record. */
export const RECORD_REL = 'agents/evidence/metrics/evaluator-measurements.json';

const RECORD_COMMENT =
    'Written by src/scripts/record_evaluator_measurements.mjs, invoked from ' +
    'src/scripts/evaluator_umbrella.sh when UMBRELLA_RECORD=1 (the nightly). ' +
    'check_evaluator_budgets.ts --recorded compares a fresh measurement set against ' +
    'this file; a contradiction on a DETERMINISTIC metric warns on main and fails on ' +
    'release. Do not hand-edit — refresh it from a real run.';

/**
 * Build the record document. Pure — the caller owns the filesystem.
 *
 * @param {Record<string, unknown>} measurements
 * @param {{ recordedAt?: string, sha?: string, runUrl?: string, conditions?: string }} [meta]
 */
export function buildRecord(measurements, meta = {}) {
    const sorted = {};
    for (const key of Object.keys(measurements).sort()) {
        sorted[key] = measurements[key];
    }
    return {
        schema_version: 1,
        _comment: RECORD_COMMENT,
        recorded_at: meta.recordedAt ?? new Date().toISOString(),
        git_sha: meta.sha || null,
        run_url: meta.runUrl || null,
        conditions: meta.conditions || null,
        measurements: sorted,
    };
}

/** Canonical serialization — stable so an unchanged run produces no diff. */
export function serializeRecord(doc) {
    return `${JSON.stringify(doc, null, 4)}\n`;
}

function argValue(args, flag) {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
}

export function main(args = argv.slice(2)) {
    const measurementsPath = argValue(args, '--measurements');
    if (measurementsPath === undefined) {
        process.stderr.write(
            'usage: record_evaluator_measurements --measurements <file.json> ' +
                '[--out <file.json>] [--sha <sha>] [--run-url <url>] [--conditions <text>]\n',
        );
        return 2;
    }
    const out = resolve(argValue(args, '--out') ?? RECORD_REL);
    let measurements;
    try {
        measurements = JSON.parse(readFileSync(resolve(measurementsPath), 'utf8'));
    } catch (e) {
        process.stderr.write(`record_evaluator_measurements: ${e.message}\n`);
        return 2;
    }
    const doc = buildRecord(measurements, {
        sha: argValue(args, '--sha'),
        runUrl: argValue(args, '--run-url'),
        conditions: argValue(args, '--conditions'),
    });
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, serializeRecord(doc));
    stdout.write(
        `recorded ${Object.keys(doc.measurements).length} measurement(s) → ${out}\n`,
    );
    return 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]).endsWith('record_evaluator_measurements.mjs')) {
    exit(main());
}
