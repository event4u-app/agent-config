#!/usr/bin/env tsx
/**
 * CLI-registry ↔ evaluator-budget sync gate.
 *
 * The evaluator budget `cli_help_command_count` (src/config/evaluator-budgets.json)
 * and the committed measurement record (agents/evidence/metrics/
 * evaluator-measurements.json) are derived from `src/cli/registry.ts`, but until
 * this gate nothing forced the PR that changes the registry to move them: the
 * breach only WARNED on main and BLOCKED the next release. That is how 9.15.0
 * went red — f02db54c2 registered `routing:doctor` (80 → 81 entries) and the
 * drift surfaced days later, at release time, on an unrelated branch.
 *
 * This gate runs on every PR (Static Checks + `task preflight`) and fails the
 * moment the three numbers disagree, so the registering PR carries the budget
 * move itself.
 *
 * The count uses the SAME pinned method as evaluator_umbrella.sh — the number
 * of `{ name: ` entry openers in src/cli/registry.ts (NOT --help prose
 * parsing; methods historically disagreed 74 vs 76 vs 79).
 *
 * Exit codes: 0 in sync · 1 out of sync · 2 a required file is missing or
 * unparseable (fail-closed: a gate that cannot read its inputs must not
 * certify them).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const REGISTRY_PATH = path.join(REPO_ROOT, 'src/cli/registry.ts');
const BUDGETS_PATH = path.join(REPO_ROOT, 'src/config/evaluator-budgets.json');
const RECORD_PATH = path.join(REPO_ROOT, 'agents/evidence/metrics/evaluator-measurements.json');

const METRIC = 'cli_help_command_count';

/** Pinned method — byte-for-byte the umbrella's CLI_COUNT probe. */
function count_registry_entries(source: string): number {
    return (source.match(/\{ name: /g) || []).length;
}

interface BudgetEntry {
    max?: unknown;
    last_measured?: unknown;
}

interface SyncInputs {
    count: number;
    budget: BudgetEntry | undefined;
    recorded: unknown;
}

const REMEDY =
    'Fix, in THIS PR (the one that moves src/cli/registry.ts):\n' +
    `  1. src/config/evaluator-budgets.json → budgets.${METRIC}: set max +\n` +
    '     last_measured to the new count, bump last_measured_at, and extend\n' +
    '     baseline_note naming the commit that moves the surface.\n' +
    '  2. Regenerate the committed record (never hand-edit):\n' +
    '       node src/scripts/record_evaluator_measurements.mjs \\\n' +
    '         --measurements <file with the re-measured metrics> \\\n' +
    '         --out agents/evidence/metrics/evaluator-measurements.json \\\n' +
    '         --sha "$(git rev-parse HEAD)"\n' +
    'Otherwise the drift stays invisible until the next release, where the\n' +
    'evaluator gate blocks it (the 9.15.0 failure mode this gate exists to stop).\n';

/** Pure comparison — the CLI owns the filesystem. */
function collect_findings(inputs: SyncInputs): string[] {
    const findings: string[] = [];
    const { count, budget, recorded } = inputs;

    if (budget === undefined) {
        findings.push(`budgets.${METRIC} is missing from evaluator-budgets.json`);
        return findings;
    }
    if (budget.last_measured !== count) {
        findings.push(
            `registry has ${count} entries but budgets.${METRIC}.last_measured says ` +
                `${String(budget.last_measured)}`,
        );
    }
    if (typeof budget.max !== 'number' || count > budget.max) {
        findings.push(
            `registry has ${count} entries but budgets.${METRIC}.max is ` +
                `${String(budget.max)}`,
        );
    }
    if (recorded === undefined) {
        findings.push(
            `measurements.${METRIC} is missing from the committed record ` +
                '(agents/evidence/metrics/evaluator-measurements.json)',
        );
    } else if (recorded !== count) {
        findings.push(
            `registry has ${count} entries but the committed record says ` +
                `${String(recorded)}`,
        );
    }
    return findings;
}

function _read_json(p: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
}

function main(): number {
    let registrySource: string;
    let budgetsDoc: Record<string, unknown>;
    let recordDoc: Record<string, unknown>;
    try {
        registrySource = fs.readFileSync(REGISTRY_PATH, 'utf-8');
        budgetsDoc = _read_json(BUDGETS_PATH);
        recordDoc = _read_json(RECORD_PATH);
    } catch (err) {
        process.stderr.write(
            `ERROR: cannot read a gate input: ${err instanceof Error ? err.message : String(err)}\n`,
        );
        return 2;
    }

    const count = count_registry_entries(registrySource);
    const budgets = budgetsDoc['budgets'] as Record<string, BudgetEntry> | undefined;
    const measurements = recordDoc['measurements'] as Record<string, unknown> | undefined;
    const findings = collect_findings({
        count,
        budget: budgets?.[METRIC],
        recorded: measurements?.[METRIC],
    });

    process.stdout.write('scanned: 3\n');
    if (findings.length > 0) {
        for (const f of findings) {
            process.stdout.write(`❌  ${METRIC} out of sync: ${f}\n`);
        }
        process.stdout.write('\n' + REMEDY);
        return 1;
    }
    process.stdout.write(
        `✅  ${METRIC} in sync — registry (${count}) == budget == committed record.\n`,
    );
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
    // Symlinked invocations (installed projections, macOS /var → /private/var)
    // make the raw URLs differ — compare realpaths so the entry guard fires.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argvPath = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argvPath;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { collect_findings, count_registry_entries, main };
