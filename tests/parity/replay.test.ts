import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { runReplay, type ReplayReport } from "../../src/scripts/parity/replay.js";

const FIXTURES = "tests/fixtures/parity";
const RUN_TIMEOUT = 60_000;

function fixture(name: string): { script: string; caseDirs: string[] } {
    return {
        script: `${FIXTURES}/${name}/script`,
        caseDirs: [`${FIXTURES}/${name}/cases/basic`],
    };
}

function channels(report: ReplayReport): string[] {
    return report.cases.flatMap((c) => c.diffs.map((d) => d.channel));
}

describe("replay golden runner", () => {
    const tempDirs: string[] = [];
    afterAll(() => {
        for (const dir of tempDirs) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it(
        "identical pair passes (argv + stdin + fixture file tree)",
        () => {
            const report = runReplay({ ...fixture("identical") });
            expect(report.cases[0]?.error).toBeUndefined();
            expect(report.cases[0]?.diffs).toEqual([]);
            expect(report.status).toBe("pass");
        },
        RUN_TIMEOUT,
    );

    it(
        "stdout mismatch fails with a stdout diff",
        () => {
            const report = runReplay({ ...fixture("stdout-mismatch") });
            expect(report.status).toBe("fail");
            expect(channels(report)).toContain("stdout");
        },
        RUN_TIMEOUT,
    );

    it(
        "mismatch with a matching divergence doc is pass-with-note",
        () => {
            const divergencesDir = mkdtempSync(path.join(tmpdir(), "parity-divergences-"));
            tempDirs.push(divergencesDir);
            writeFileSync(
                path.join(divergencesDir, "stdout-mismatch.md"),
                [
                    "# Divergence: greeting wording",
                    "",
                    `Script: ${FIXTURES}/stdout-mismatch/script.py`,
                    "",
                    "Verdict: documented improvement.",
                    "",
                ].join("\n"),
            );
            const report = runReplay({ ...fixture("stdout-mismatch"), divergencesDir });
            expect(report.status).toBe("pass-with-note");
            expect(report.divergenceDoc).toBe(path.resolve(divergencesDir, "stdout-mismatch.md"));
        },
        RUN_TIMEOUT,
    );

    it(
        "mismatch with a divergence doc for a DIFFERENT script stays a failure",
        () => {
            const divergencesDir = mkdtempSync(path.join(tmpdir(), "parity-divergences-"));
            tempDirs.push(divergencesDir);
            writeFileSync(
                path.join(divergencesDir, "other.md"),
                "Script: src/scripts/some/other/script\n",
            );
            const report = runReplay({ ...fixture("stdout-mismatch"), divergencesDir });
            expect(report.status).toBe("fail");
            expect(report.divergenceDoc).toBeUndefined();
        },
        RUN_TIMEOUT,
    );

    it(
        "exit-code mismatch fails with an exit-code diff",
        () => {
            const report = runReplay({ ...fixture("exit-mismatch") });
            expect(report.status).toBe("fail");
            expect(channels(report)).toContain("exit-code");
        },
        RUN_TIMEOUT,
    );

    it(
        "json key order: FAIL byte-exact, PASS under --normalize json",
        () => {
            const byteExact = runReplay({ ...fixture("json-order"), normalize: "none" });
            expect(byteExact.status).toBe("fail");
            expect(channels(byteExact)).toContain("stdout");

            const normalized = runReplay({ ...fixture("json-order"), normalize: "json" });
            expect(normalized.status).toBe("pass");
        },
        RUN_TIMEOUT,
    );

    it(
        "file-tree output: differing written file content fails on the file channel",
        () => {
            const report = runReplay({ ...fixture("file-write-mismatch") });
            expect(report.status).toBe("fail");
            expect(channels(report)).toContain("file:out.txt");
        },
        RUN_TIMEOUT,
    );

    it(
        "missing script is a hard error (never excusable by divergence docs)",
        () => {
            const divergencesDir = mkdtempSync(path.join(tmpdir(), "parity-divergences-"));
            tempDirs.push(divergencesDir);
            writeFileSync(path.join(divergencesDir, "ghost.md"), "Script: does/not/exist\n");
            const report = runReplay({
                script: "does/not/exist",
                caseDirs: [`${FIXTURES}/identical/cases/basic`],
                divergencesDir,
            });
            expect(report.status).toBe("fail");
            expect(report.cases[0]?.error).toMatch(/script not found/);
        },
        RUN_TIMEOUT,
    );
});
