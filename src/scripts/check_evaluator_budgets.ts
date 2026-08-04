#!/usr/bin/env tsx
/**
 * check_evaluator_budgets — enforce the outside-in evaluator budgets
 * (road-to-credible-install Phase 6) against a measurements JSON.
 *
 * Three failure modes per metric:
 *   1. absolute:   measured > budgets[metric].max
 *   2. regression: measured > last_measured * (1 + regression_pct/100)
 *      — fails EVEN WHEN still under the absolute budget (the >10%
 *      creep rule), so slow rot cannot hide under a generous cap.
 *   3. drift:      a DETERMINISTIC metric disagrees with the committed
 *      measurement record the nightly publishes. `cli_help_command_count`
 *      drifted 74 → 80 against a value frozen at 79 with nobody seeing it;
 *      the record makes the day a number moves the day it shows in a diff
 *      (road-to-gates-that-can-fail Phase 5).
 *
 * ## Posture — warn on main, fail on release
 *
 * A hard fail on `main` turns every legitimate command addition into a
 * blocked merge, which is how budgets get quietly raised with a cushion
 * instead of consciously. So budget / regression / drift findings are
 * ADVISORY outside a release context and BLOCKING inside one. This is not a
 * weakening: before the Phase-4 path triggers, the umbrella ran on release
 * PRs and the nightly only — the surfaces that now warn never saw the gate
 * at all. The posture IS the delivery route the council adopted for nightly
 * visibility, not a second mechanism beside it.
 *
 * Structural findings (a metric with NO measurement supplied) are ALWAYS
 * blocking, in either posture: that is a harness reporting green on nothing,
 * which is the whole class this roadmap exists to end.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_evaluator_budgets --measurements <file.json>
 *       [--recorded <file.json>] [--posture warn|fail]
 *   (measurements: flat { metric: number } — produced by evaluator_umbrella.sh)
 *
 * Exit codes: 0 green (or advisory findings only) · 1 blocking finding · 2 internal error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const BUDGETS_PATH = path.join(REPO_ROOT, 'src', 'config', 'evaluator-budgets.json');

/** Committed measurement record the nightly refreshes (Phase 5 step 1). */
export const RECORD_REL = path.join('agents', 'evidence', 'metrics', 'evaluator-measurements.json');

interface BudgetEntry {
    max: number;
    last_measured: number;
    method: string;
    /** Per-metric creep override — wall-clock timings get a loose one
     * (absolute cap is their real gate); sizes/counts keep the tight
     * global default. */
    regression_pct?: number;
    /** `false` for wall-clock metrics: they cannot be compared run-to-run,
     * so they are excluded from the drift check. Missing = deterministic. */
    deterministic?: boolean;
}
interface BudgetsDoc {
    regression_pct: number;
    budgets: Record<string, BudgetEntry>;
}

/** Shape of the committed measurement record. */
export interface MeasurementRecord {
    schema_version: number;
    recorded_at: string;
    git_sha?: string;
    run_url?: string;
    conditions?: string;
    measurements: Record<string, number | string>;
}

export type Severity =
    /** Always blocks — the harness itself is broken. */
    | 'structural'
    /** Blocks only under the `fail` posture. */
    | 'advisory';

export interface Finding {
    metric: string;
    severity: Severity;
    message: string;
}

export function evaluateFindings(
    budgetsDoc: BudgetsDoc,
    measurements: Record<string, number>,
): Finding[] {
    const findings: Finding[] = [];
    for (const [metric, entry] of Object.entries(budgetsDoc.budgets)) {
        const measured = measurements[metric];
        if (measured === undefined || Number.isNaN(measured)) {
            findings.push({
                metric,
                severity: 'structural',
                message: `${metric}: no measurement supplied (method: ${entry.method})`,
            });
            continue;
        }
        if (measured > entry.max) {
            findings.push({
                metric,
                severity: 'advisory',
                message: `${metric}: measured ${measured} exceeds budget ${entry.max}`,
            });
            continue;
        }
        const pct = entry.regression_pct ?? budgetsDoc.regression_pct;
        const ceiling = entry.last_measured * (1 + pct / 100);
        if (entry.last_measured > 0 && measured > ceiling) {
            findings.push({
                metric,
                severity: 'advisory',
                message:
                    `${metric}: measured ${measured} regressed >${pct}% vs ` +
                    `last_measured ${entry.last_measured} (ceiling ${ceiling.toFixed(2)}) — ` +
                    'fails even under the absolute budget',
            });
        }
    }
    return findings;
}

/**
 * Back-compat surface: the flat message list. Kept because the budget shape
 * and the per-metric rules are pinned by tests through this function.
 */
export function evaluate(budgetsDoc: BudgetsDoc, measurements: Record<string, number>): string[] {
    return evaluateFindings(budgetsDoc, measurements).map((f) => f.message);
}

/**
 * Compare a fresh measurement set against the committed record.
 *
 * Only DETERMINISTIC metrics participate: comparing wall-clock timings
 * run-to-run produces noise, and a noisy comparison gets ignored — which
 * reproduces the failure the record exists to fix. A metric absent from
 * either side is skipped (a missing measurement is already a structural
 * finding above; a metric absent from the record is simply not recorded yet).
 */
export function driftFindings(
    budgetsDoc: BudgetsDoc,
    measurements: Record<string, number>,
    record: MeasurementRecord | null,
): Finding[] {
    if (record === null) return [];
    const findings: Finding[] = [];
    for (const [metric, entry] of Object.entries(budgetsDoc.budgets)) {
        if (entry.deterministic === false) continue;
        const fresh = measurements[metric];
        const recorded = record.measurements[metric];
        if (fresh === undefined || recorded === undefined) continue;
        if (typeof recorded !== 'number') continue;
        if (fresh === recorded) continue;
        findings.push({
            metric,
            severity: 'advisory',
            message:
                `${metric}: measured ${fresh} but the committed record says ${recorded} ` +
                `(recorded ${record.recorded_at}` +
                `${record.git_sha ? ` @ ${record.git_sha.slice(0, 8)}` : ''}) — refresh ` +
                `${RECORD_REL} in the PR that moves the number, or explain the move`,
        });
    }
    return findings;
}

export type Posture = 'warn' | 'fail';

/**
 * Where are we, and does a budget finding block?
 *
 * Release context → `fail`. Local (no CI env) → `fail`, deliberately: a
 * maintainer running this by hand — including `release.ts` — wants the strict
 * answer, and a local run blocks nobody else. Everything else (main, the
 * nightly, a feature PR) → `warn`.
 */
export function detectPosture(
    env: NodeJS.ProcessEnv = process.env,
    override?: string,
): { posture: Posture; reason: string } {
    if (override === 'warn' || override === 'fail') {
        return { posture: override, reason: `--posture ${override}` };
    }
    const head = env['GITHUB_HEAD_REF'] ?? '';
    const base = env['GITHUB_BASE_REF'] ?? '';
    const ref = env['GITHUB_REF'] ?? '';
    if (head.startsWith('release/')) {
        return { posture: 'fail', reason: `release PR (head ${head})` };
    }
    if (base.startsWith('release/')) {
        return { posture: 'fail', reason: `PR into a release branch (base ${base})` };
    }
    if (ref.startsWith('refs/heads/release/') || ref.startsWith('refs/tags/')) {
        return { posture: 'fail', reason: `release ref (${ref})` };
    }
    if (!env['GITHUB_ACTIONS']) {
        return { posture: 'fail', reason: 'local run (no CI env) — strict by default' };
    }
    return { posture: 'warn', reason: `non-release CI context (${ref || 'unknown ref'})` };
}

function argValue(argv: string[], flag: string): string | undefined {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const measurementsPath = argValue(argv, '--measurements');
    if (measurementsPath === undefined) {
        process.stderr.write(
            'usage: check_evaluator_budgets --measurements <file.json> ' +
                '[--recorded <file.json>] [--posture warn|fail]\n',
        );
        return 2;
    }
    let budgetsDoc: BudgetsDoc;
    let measurements: Record<string, number>;
    try {
        budgetsDoc = JSON.parse(fs.readFileSync(BUDGETS_PATH, 'utf-8')) as BudgetsDoc;
        measurements = JSON.parse(fs.readFileSync(measurementsPath, 'utf-8')) as Record<
            string,
            number
        >;
    } catch (e) {
        process.stderr.write(`check_evaluator_budgets: ${(e as Error).message}\n`);
        return 2;
    }

    // The budget document IS the corpus: every finding below is produced by
    // iterating it, so a budgets file that parses to no entries reports
    // "✅ evaluator budgets met (0 metrics)" — green over nothing, the exact
    // shape this harness exists to end. A missing `budgets` key counts as 0 for
    // the same reason. Exit 2 (documented internal error — the gate could not
    // run), never 1, which means a metric actually breached.
    try {
        assertScanned({
            gate: 'check_evaluator_budgets',
            scanned: Object.keys(budgetsDoc.budgets ?? {}).length,
            units: 'budgeted metric(s)',
            roots: ['src/config/evaluator-budgets.json (budgets)'],
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 2;
        }
        throw e;
    }

    // The committed record is optional: a fresh checkout before the first
    // nightly has none, and a missing record must not fake a green drift check.
    const recordPath = argValue(argv, '--recorded') ?? path.join(REPO_ROOT, RECORD_REL);
    let record: MeasurementRecord | null = null;
    try {
        record = JSON.parse(fs.readFileSync(recordPath, 'utf-8')) as MeasurementRecord;
    } catch {
        process.stdout.write(
            `ℹ️  no measurement record at ${recordPath} — drift check skipped ` +
                '(the nightly publishes it)\n',
        );
    }

    const { posture, reason } = detectPosture(process.env, argValue(argv, '--posture'));
    const findings = [
        ...evaluateFindings(budgetsDoc, measurements),
        ...driftFindings(budgetsDoc, measurements, record),
    ];
    const blocking = findings.filter((f) => f.severity === 'structural' || posture === 'fail');
    const advisory = findings.filter((f) => !blocking.includes(f));

    for (const f of advisory) {
        process.stderr.write(`⚠️  evaluator budget (advisory, posture=${posture}): ${f.message}\n`);
    }
    for (const f of blocking) {
        process.stderr.write(`❌  evaluator budget: ${f.message}\n`);
    }
    if (blocking.length > 0) {
        process.stderr.write(
            `check_evaluator_budgets: ${blocking.length} blocking finding(s) — ` +
                `posture ${posture} (${reason})\n`,
        );
        return 1;
    }
    process.stdout.write(
        `✅  evaluator budgets met (${Object.keys(budgetsDoc.budgets).length} metrics` +
            `${advisory.length > 0 ? `, ${advisory.length} advisory finding(s)` : ''}) — ` +
            `posture ${posture} (${reason})\n`,
    );
    return 0;
}

const _selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_selfPath)) {
    process.exit(main());
}
