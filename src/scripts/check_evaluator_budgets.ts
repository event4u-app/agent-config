#!/usr/bin/env tsx
/**
 * check_evaluator_budgets — enforce the outside-in evaluator budgets
 * (road-to-credible-install Phase 6) against a measurements JSON.
 *
 * Two failure modes per metric:
 *   1. absolute:   measured > budgets[metric].max
 *   2. regression: measured > last_measured * (1 + regression_pct/100)
 *      — fails EVEN WHEN still under the absolute budget (the >10%
 *      creep rule), so slow rot cannot hide under a generous cap.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_evaluator_budgets --measurements <file.json>
 *   (measurements: flat { metric: number } — produced by evaluator_umbrella.sh)
 *
 * Exit codes: 0 green · 1 budget/regression exceeded · 2 internal error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const BUDGETS_PATH = path.join(REPO_ROOT, 'src', 'config', 'evaluator-budgets.json');

interface BudgetEntry {
    max: number;
    last_measured: number;
    method: string;
    /** Per-metric creep override — wall-clock timings get a loose one
     * (absolute cap is their real gate); sizes/counts keep the tight
     * global default. */
    regression_pct?: number;
}
interface BudgetsDoc {
    regression_pct: number;
    budgets: Record<string, BudgetEntry>;
}

export function evaluate(
    budgetsDoc: BudgetsDoc,
    measurements: Record<string, number>,
): string[] {
    const errors: string[] = [];
    for (const [metric, entry] of Object.entries(budgetsDoc.budgets)) {
        const measured = measurements[metric];
        if (measured === undefined || Number.isNaN(measured)) {
            errors.push(`${metric}: no measurement supplied (method: ${entry.method})`);
            continue;
        }
        if (measured > entry.max) {
            errors.push(`${metric}: measured ${measured} exceeds budget ${entry.max}`);
            continue;
        }
        const pct = entry.regression_pct ?? budgetsDoc.regression_pct;
        const ceiling = entry.last_measured * (1 + pct / 100);
        if (entry.last_measured > 0 && measured > ceiling) {
            errors.push(
                `${metric}: measured ${measured} regressed >${pct}% vs ` +
                    `last_measured ${entry.last_measured} (ceiling ${ceiling.toFixed(2)}) — ` +
                    'fails even under the absolute budget',
            );
        }
    }
    return errors;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const idx = argv.indexOf('--measurements');
    if (idx < 0 || argv[idx + 1] === undefined) {
        process.stderr.write('usage: check_evaluator_budgets --measurements <file.json>\n');
        return 2;
    }
    let budgetsDoc: BudgetsDoc;
    let measurements: Record<string, number>;
    try {
        budgetsDoc = JSON.parse(fs.readFileSync(BUDGETS_PATH, 'utf-8')) as BudgetsDoc;
        measurements = JSON.parse(fs.readFileSync(argv[idx + 1] as string, 'utf-8')) as Record<
            string,
            number
        >;
    } catch (e) {
        process.stderr.write(`check_evaluator_budgets: ${(e as Error).message}\n`);
        return 2;
    }
    const errors = evaluate(budgetsDoc, measurements);
    if (errors.length > 0) {
        for (const e of errors) process.stderr.write(`❌  evaluator budget: ${e}\n`);
        return 1;
    }
    process.stdout.write(
        `✅  evaluator budgets met (${Object.keys(budgetsDoc.budgets).length} metrics)\n`,
    );
    return 0;
}

const _selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_selfPath)) {
    process.exit(main());
}
