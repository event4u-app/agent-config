/**
 * Coverage-diff gate — compares a pytest coverage baseline against vitest
 * coverage for a ported cluster and fails when TypeScript coverage is lower.
 *
 * CLI:
 *   tsx src/scripts/parity/coverage_diff.ts \
 *     --pytest <coverage.json from `pytest --cov --cov-report=json`> \
 *     --vitest <coverage-summary.json from `vitest --coverage` (json-summary reporter)> \
 *     [--scope <path-prefix>] [--allow-missing]
 *
 * Compares line and branch coverage percentage for the given scope. Exits 1
 * if vitest < pytest on either metric, printing both values. A missing input
 * file is an error unless --allow-missing is given (then warn + exit 0).
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

export interface CoverageAggregate {
    linesCovered: number;
    linesTotal: number;
    branchesCovered: number;
    branchesTotal: number;
}

export interface CoverageComparison {
    pytest: CoverageAggregate;
    vitest: CoverageAggregate;
    linePctPytest: number;
    linePctVitest: number;
    branchPctPytest: number;
    branchPctVitest: number;
    /** True when vitest >= pytest on both line and branch percentage. */
    ok: boolean;
}

const EPSILON = 1e-9;

function asRecord(value: unknown, context: string): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`${context}: expected an object`);
    }
    return value as Record<string, unknown>;
}

function asNumber(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizePath(filePath: string, root: string): string {
    const posix = filePath.replace(/\\/g, "/");
    const rootPosix = root.replace(/\\/g, "/").replace(/\/$/, "");
    const stripped = posix.startsWith(`${rootPosix}/`) ? posix.slice(rootPosix.length + 1) : posix;
    return stripped.replace(/^\.\//, "");
}

function inScope(filePath: string, scope: string | undefined, root: string): boolean {
    if (scope === undefined) {
        return true;
    }
    const normalizedScope = scope.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
    return normalizePath(filePath, root).startsWith(normalizedScope);
}

/**
 * Parse a pytest `coverage.json` (`pytest --cov --cov-report=json`) and
 * aggregate line + branch counts for files under the scope prefix.
 */
export function aggregatePytestCoverage(raw: string, scope: string | undefined, root: string): CoverageAggregate {
    const data = asRecord(JSON.parse(raw), "pytest coverage");
    const files = asRecord(data["files"] ?? {}, "pytest coverage.files");
    const agg: CoverageAggregate = { linesCovered: 0, linesTotal: 0, branchesCovered: 0, branchesTotal: 0 };
    let matched = 0;
    for (const [filePath, entryRaw] of Object.entries(files)) {
        if (!inScope(filePath, scope, root)) {
            continue;
        }
        matched += 1;
        const summary = asRecord(asRecord(entryRaw, `pytest entry ${filePath}`)["summary"] ?? {}, "summary");
        agg.linesCovered += asNumber(summary["covered_lines"], 0);
        agg.linesTotal += asNumber(summary["num_statements"], 0);
        agg.branchesCovered += asNumber(summary["covered_branches"], 0);
        agg.branchesTotal += asNumber(summary["num_branches"], 0);
    }
    if (matched === 0) {
        throw new Error(`pytest coverage: no files match scope ${scope ?? "<all>"}`);
    }
    return agg;
}

/**
 * Parse a vitest/istanbul `coverage-summary.json` (json-summary reporter) and
 * aggregate line + branch counts for files under the scope prefix.
 */
export function aggregateVitestCoverage(raw: string, scope: string | undefined, root: string): CoverageAggregate {
    const data = asRecord(JSON.parse(raw), "vitest coverage");
    const agg: CoverageAggregate = { linesCovered: 0, linesTotal: 0, branchesCovered: 0, branchesTotal: 0 };
    let matched = 0;
    for (const [filePath, entryRaw] of Object.entries(data)) {
        if (filePath === "total" || !inScope(filePath, scope, root)) {
            continue;
        }
        matched += 1;
        const entry = asRecord(entryRaw, `vitest entry ${filePath}`);
        const lines = asRecord(entry["lines"] ?? {}, "lines");
        const branches = asRecord(entry["branches"] ?? {}, "branches");
        agg.linesCovered += asNumber(lines["covered"], 0);
        agg.linesTotal += asNumber(lines["total"], 0);
        agg.branchesCovered += asNumber(branches["covered"], 0);
        agg.branchesTotal += asNumber(branches["total"], 0);
    }
    if (matched === 0) {
        throw new Error(`vitest coverage: no files match scope ${scope ?? "<all>"}`);
    }
    return agg;
}

function pct(covered: number, total: number): number {
    return total === 0 ? 100 : (covered / total) * 100;
}

/**
 * Compare a pytest baseline against vitest coverage. Reusable for CI gates.
 */
export function diffCoverage(pytest: CoverageAggregate, vitest: CoverageAggregate): CoverageComparison {
    const linePctPytest = pct(pytest.linesCovered, pytest.linesTotal);
    const linePctVitest = pct(vitest.linesCovered, vitest.linesTotal);
    const branchPctPytest = pct(pytest.branchesCovered, pytest.branchesTotal);
    const branchPctVitest = pct(vitest.branchesCovered, vitest.branchesTotal);
    const ok = linePctVitest >= linePctPytest - EPSILON && branchPctVitest >= branchPctPytest - EPSILON;
    return { pytest, vitest, linePctPytest, linePctVitest, branchPctPytest, branchPctVitest, ok };
}

export function formatComparison(cmp: CoverageComparison): string[] {
    const fmt = (n: number): string => n.toFixed(2);
    return [
        `lines:    pytest ${fmt(cmp.linePctPytest)}% (${cmp.pytest.linesCovered}/${cmp.pytest.linesTotal})  ` +
            `vitest ${fmt(cmp.linePctVitest)}% (${cmp.vitest.linesCovered}/${cmp.vitest.linesTotal})  ` +
            (cmp.linePctVitest >= cmp.linePctPytest - EPSILON ? "OK" : "REGRESSION"),
        `branches: pytest ${fmt(cmp.branchPctPytest)}% (${cmp.pytest.branchesCovered}/${cmp.pytest.branchesTotal})  ` +
            `vitest ${fmt(cmp.branchPctVitest)}% (${cmp.vitest.branchesCovered}/${cmp.vitest.branchesTotal})  ` +
            (cmp.branchPctVitest >= cmp.branchPctPytest - EPSILON ? "OK" : "REGRESSION"),
        `RESULT: ${cmp.ok ? "PASS — vitest coverage >= pytest baseline" : "FAIL — vitest coverage below pytest baseline"}`,
    ];
}

function main(): void {
    const { values } = parseArgs({
        options: {
            pytest: { type: "string" },
            vitest: { type: "string" },
            scope: { type: "string" },
            "allow-missing": { type: "boolean", default: false },
        },
        strict: true,
    });

    const pytestPath = values.pytest;
    const vitestPath = values.vitest;
    if (pytestPath === undefined || vitestPath === undefined) {
        process.stderr.write(
            "usage: coverage_diff.ts --pytest <coverage.json> --vitest <coverage-summary.json> [--scope <prefix>] [--allow-missing]\n",
        );
        process.exit(2);
    }

    const missing = [pytestPath, vitestPath].filter((p) => !existsSync(p));
    if (missing.length > 0) {
        if (values["allow-missing"] === true) {
            process.stderr.write(`warning: missing coverage input(s): ${missing.join(", ")} — skipping gate\n`);
            process.exit(0);
        }
        process.stderr.write(
            `error: missing coverage input(s): ${missing.join(", ")} (use --allow-missing to skip)\n`,
        );
        process.exit(1);
    }

    const root = process.cwd();
    try {
        const pytest = aggregatePytestCoverage(readFileSync(path.resolve(pytestPath), "utf8"), values.scope, root);
        const vitest = aggregateVitestCoverage(readFileSync(path.resolve(vitestPath), "utf8"), values.scope, root);
        const cmp = diffCoverage(pytest, vitest);
        process.stdout.write(`${formatComparison(cmp).join("\n")}\n`);
        process.exit(cmp.ok ? 0 : 1);
    } catch (err) {
        process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
    }
}

const isCliEntry =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
    main();
}
