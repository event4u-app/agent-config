import { describe, expect, it } from "vitest";

import {
    aggregatePytestCoverage,
    aggregateVitestCoverage,
    diffCoverage,
    type CoverageAggregate,
} from "../../src/scripts/parity/coverage_diff.js";

function pytestJson(files: Record<string, { covered: number; total: number; bCovered: number; bTotal: number }>): string {
    const out: Record<string, unknown> = {};
    for (const [filePath, m] of Object.entries(files)) {
        out[filePath] = {
            summary: {
                covered_lines: m.covered,
                num_statements: m.total,
                covered_branches: m.bCovered,
                num_branches: m.bTotal,
                percent_covered: m.total === 0 ? 100 : (m.covered / m.total) * 100,
            },
        };
    }
    return JSON.stringify({ files: out, totals: {} });
}

function vitestJson(files: Record<string, { covered: number; total: number; bCovered: number; bTotal: number }>): string {
    const out: Record<string, unknown> = {
        total: { lines: { covered: 0, total: 0 }, branches: { covered: 0, total: 0 } },
    };
    for (const [filePath, m] of Object.entries(files)) {
        out[filePath] = {
            lines: { covered: m.covered, total: m.total, pct: m.total === 0 ? 100 : (m.covered / m.total) * 100 },
            branches: { covered: m.bCovered, total: m.bTotal, pct: m.bTotal === 0 ? 100 : (m.bCovered / m.bTotal) * 100 },
            statements: { covered: m.covered, total: m.total },
            functions: { covered: 0, total: 0 },
        };
    }
    return JSON.stringify(out);
}

const ROOT = "/repo";

describe("coverage_diff", () => {
    it("passes when vitest coverage matches or exceeds the pytest baseline", () => {
        const pytest = aggregatePytestCoverage(
            pytestJson({ "src/scripts/_lib/a.py": { covered: 80, total: 100, bCovered: 8, bTotal: 10 } }),
            undefined,
            ROOT,
        );
        const vitest = aggregateVitestCoverage(
            vitestJson({ "/repo/src/scripts/_lib/a.ts": { covered: 90, total: 100, bCovered: 9, bTotal: 10 } }),
            undefined,
            ROOT,
        );
        const cmp = diffCoverage(pytest, vitest);
        expect(cmp.ok).toBe(true);
        expect(cmp.linePctPytest).toBeCloseTo(80);
        expect(cmp.linePctVitest).toBeCloseTo(90);
    });

    it("fails when vitest line coverage is below the pytest baseline", () => {
        const pytest: CoverageAggregate = { linesCovered: 90, linesTotal: 100, branchesCovered: 10, branchesTotal: 10 };
        const vitest: CoverageAggregate = { linesCovered: 70, linesTotal: 100, branchesCovered: 10, branchesTotal: 10 };
        const cmp = diffCoverage(pytest, vitest);
        expect(cmp.ok).toBe(false);
    });

    it("fails when only branch coverage regresses", () => {
        const pytest: CoverageAggregate = { linesCovered: 80, linesTotal: 100, branchesCovered: 9, branchesTotal: 10 };
        const vitest: CoverageAggregate = { linesCovered: 95, linesTotal: 100, branchesCovered: 5, branchesTotal: 10 };
        const cmp = diffCoverage(pytest, vitest);
        expect(cmp.ok).toBe(false);
    });

    it("treats zero-total metrics as 100% (no branch baseline => no branch gate)", () => {
        const pytest: CoverageAggregate = { linesCovered: 50, linesTotal: 100, branchesCovered: 0, branchesTotal: 0 };
        const vitest: CoverageAggregate = { linesCovered: 60, linesTotal: 100, branchesCovered: 0, branchesTotal: 0 };
        expect(diffCoverage(pytest, vitest).ok).toBe(true);
    });

    it("scope prefix filters both sides and strips the repo root from vitest paths", () => {
        const pytestRaw = pytestJson({
            "src/scripts/_lib/a.py": { covered: 10, total: 10, bCovered: 0, bTotal: 0 },
            "src/scripts/other/b.py": { covered: 0, total: 100, bCovered: 0, bTotal: 0 },
        });
        const vitestRaw = vitestJson({
            "/repo/src/scripts/_lib/a.ts": { covered: 10, total: 10, bCovered: 0, bTotal: 0 },
            "/repo/src/scripts/other/b.ts": { covered: 0, total: 100, bCovered: 0, bTotal: 0 },
        });
        const pytest = aggregatePytestCoverage(pytestRaw, "src/scripts/_lib", ROOT);
        const vitest = aggregateVitestCoverage(vitestRaw, "src/scripts/_lib", ROOT);
        expect(pytest.linesTotal).toBe(10);
        expect(vitest.linesTotal).toBe(10);
        expect(diffCoverage(pytest, vitest).ok).toBe(true);
    });

    it("throws when no files match the scope", () => {
        const raw = pytestJson({ "src/scripts/_lib/a.py": { covered: 1, total: 1, bCovered: 0, bTotal: 0 } });
        expect(() => aggregatePytestCoverage(raw, "src/nothing", ROOT)).toThrow(/no files match scope/);
    });
});
