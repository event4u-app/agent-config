/**
 * Executes the `verify:` line of `road-to-account-surface-detector` step 1.1
 * against the frozen corpus in `tests/fixtures/account-surface/`.
 *
 * It asserts the corpus is well-formed, never that a detector finds anything —
 * no detector exists at this point, and a test that pretended otherwise would
 * be the measurement-after-the-fact this roadmap's Phase 1 exists to prevent.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..");
const root = path.join(repoRoot, "tests", "fixtures", "account-surface");

type Finding = {
  id: string;
  class: string;
  stack: string;
  file: string;
  line: number;
  evidence: string;
  remediation: string;
  threat_row: string;
  why: string;
};

type GroundTruth = {
  pending_threat_rows: { source_roadmap: string; cells: string[] };
  findings: Finding[];
  decoys: { file: string; why_silent: string }[];
};

const truth = JSON.parse(
  readFileSync(path.join(root, "ground-truth.json"), "utf8"),
) as GroundTruth;

/** Every file in the corpus, repo-relative to `account-surface/`. */
function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, acc);
    } else {
      acc.push(path.relative(root, full));
    }
  }
  return acc;
}

const corpus = walk(root).sort();
const metaFiles = new Set(["ground-truth.json", "README.md"]);
const sampleFiles = corpus.filter((f) => !metaFiles.has(f));

describe("account-surface corpus shape", () => {
  it("names an entry for every unsafe file, and only those", () => {
    const unsafeFiles = sampleFiles.filter((f) => f.includes(`${path.sep}unsafe${path.sep}`)).sort();
    const claimed = truth.findings.map((f) => f.file.split("/").join(path.sep)).sort();

    expect(claimed).toEqual(unsafeFiles);
  });

  it("names no safe twin and no decoy", () => {
    const claimed = new Set(truth.findings.map((f) => f.file));

    for (const file of sampleFiles) {
      const posix = file.split(path.sep).join("/");
      if (posix.includes("/safe/") || posix.startsWith("decoys/")) {
        expect(claimed.has(posix)).toBe(false);
      }
    }
  });

  it("gives every unsafe file a safe twin at the same basename", () => {
    const safeBasenames = new Set(
      sampleFiles
        .filter((f) => f.includes(`${path.sep}safe${path.sep}`))
        .map((f) => path.basename(f)),
    );

    for (const finding of truth.findings) {
      expect(safeBasenames.has(path.basename(finding.file))).toBe(true);
    }
  });

  it("lists every decoy that exists, and every listed decoy exists", () => {
    const onDisk = sampleFiles
      .filter((f) => f.startsWith(`decoys${path.sep}`))
      .map((f) => f.split(path.sep).join("/"))
      .sort();

    expect(truth.decoys.map((d) => d.file).sort()).toEqual(onDisk);
  });

  it("carries both stacks", () => {
    const stacks = new Set(truth.findings.map((f) => f.stack));

    expect(stacks).toEqual(new Set(["php", "node"]));
  });

  it("names no fixture file `*.test.ts`", () => {
    // A fixture under this name would be collected as a suite and run.
    for (const file of corpus) {
      expect(file.endsWith(".test.ts")).toBe(false);
    }
  });
});

describe("account-surface ground truth", () => {
  it("points each finding at a line that exists and is not blank", () => {
    for (const finding of truth.findings) {
      const lines = readFileSync(path.join(root, finding.file), "utf8").split("\n");

      expect(lines.length).toBeGreaterThanOrEqual(finding.line);
      expect((lines[finding.line - 1] ?? "").trim()).not.toBe("");
    }
  });

  it("uses one remediation value per class", () => {
    const byClass = new Map<string, Set<string>>();

    for (const finding of truth.findings) {
      const seen = byClass.get(finding.class) ?? new Set<string>();
      seen.add(finding.remediation);
      byClass.set(finding.class, seen);
    }

    for (const [cls, values] of byClass) {
      expect(values.size, `class ${cls} carries more than one remediation value`).toBe(1);
    }
  });

  it("uses only the four declared evidence and remediation values", () => {
    for (const finding of truth.findings) {
      expect(["violated", "suspected", "unknown", "not-applicable"]).toContain(finding.evidence);
      expect(["mechanical", "policy", "migration", "informational"]).toContain(
        finding.remediation,
      );
    }
  });

  it("never calls a hash migration or a policy change mechanical", () => {
    for (const finding of truth.findings) {
      if (finding.class === "fast-hash" || finding.class === "pepper-literal") {
        expect(finding.remediation).toBe("migration");
      }
      if (finding.class === "token-verify-off") {
        expect(finding.remediation).toBe("policy");
      }
    }
  });

  it("resolves every cited threat row, or declares it pending", () => {
    const csv = readFileSync(
      path.join(repoRoot, "src", "skills", "threat-modeling", "data", "threats.csv"),
      "utf8",
    );
    const pending = new Set(truth.pending_threat_rows.cells);

    for (const finding of truth.findings) {
      const present = csv.includes(`,${finding.threat_row},`);
      expect(
        present || pending.has(finding.threat_row),
        `threat row "${finding.threat_row}" is neither in threats.csv nor declared pending`,
      ).toBe(true);
    }
  });

  it("names the roadmap the pending rows come from", () => {
    expect(truth.pending_threat_rows.source_roadmap).toBe(
      "road-to-account-lifecycle-threat-rows",
    );
  });
});
