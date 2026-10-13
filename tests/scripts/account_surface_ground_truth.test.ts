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

/**
 * The path predicate `road-to-account-surface-detector` step 2.1 declares. The
 * corpus is checked against it here because a planted file the predicate never
 * opens scores recall zero for its class however good the lexical pattern is.
 */
const PREDICATE_WORDS = [
  "login",
  "register",
  "signup",
  "password",
  "reset",
  "verify",
  "session",
  "oauth",
  "callback",
  "mfa",
  "otp",
  "passkey",
];

type Finding = {
  id: string;
  class: string;
  stack: string;
  file: string;
  line: number;
  anchor: string;
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

/** Every file in the corpus, repo-relative to `account-surface/`, in posix form. */
function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, acc);
    } else {
      acc.push(path.relative(root, full).split(path.sep).join("/"));
    }
  }
  return acc;
}

const corpus = walk(root).sort();
const metaFiles = new Set(["ground-truth.json", "README.md"]);
const sampleFiles = corpus.filter((f) => !metaFiles.has(f));
const unsafeFiles = sampleFiles.filter((f) => f.includes("/unsafe/")).sort();
const safeFiles = new Set(sampleFiles.filter((f) => f.includes("/safe/")));

/**
 * The Threat column of `threats.csv`, parsed as a column rather than matched as
 * a substring: a `csv.includes(',<cell>,')` check also matches a cell's text
 * appearing inside another row's quoted Required Controls, and it fails OPEN —
 * a cell wrongly reported present would leave the pending set and let Phase 2
 * cite a row that is not there.
 */
function threatColumn(): Set<string> {
  const csv = readFileSync(
    path.join(repoRoot, "src", "skills", "threat-modeling", "data", "threats.csv"),
    "utf8",
  );
  const cells = new Set<string>();

  for (const line of csv.split("\n").slice(1)) {
    if (line.trim() === "") continue;

    // Fields are comma-separated with `"`-quoted fields that may contain commas.
    const fields: string[] = [];
    let current = "";
    let quoted = false;

    for (const ch of line) {
      if (ch === '"') {
        quoted = !quoted;
      } else if (ch === "," && !quoted) {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current);

    if (fields.length >= 2) cells.add((fields[1] ?? "").trim());
  }

  return cells;
}

describe("account-surface corpus shape", () => {
  it("names an entry for every unsafe file, and only those", () => {
    // A set, not an array: a file carrying two genuine classes gets two
    // entries, and array equality would make that unrepresentable.
    const claimed = new Set(truth.findings.map((f) => f.file));

    expect([...claimed].sort()).toEqual(unsafeFiles);
  });

  it("names no safe twin and no decoy", () => {
    const claimed = new Set(truth.findings.map((f) => f.file));

    for (const file of sampleFiles) {
      if (file.includes("/safe/") || file.startsWith("decoys/")) {
        expect(claimed.has(file)).toBe(false);
      }
    }
  });

  it("gives every unsafe file a safe twin at the same path under the safe root", () => {
    // Basename equality is weaker than the property the corpus relies on: it
    // lets a node file be satisfied by a php one, and lets a twin that moved
    // within its own stack still pass.
    for (const finding of truth.findings) {
      const twin = finding.file.replace("/unsafe/", "/safe/");

      expect(safeFiles.has(twin), `no safe twin at ${twin}`).toBe(true);
    }
  });

  it("puts every planted file on a path the declared predicate opens", () => {
    for (const finding of truth.findings) {
      const matched = PREDICATE_WORDS.some((w) => finding.file.toLowerCase().includes(w));

      expect(
        matched,
        `${finding.file} matches none of the predicate words, so its class would score recall 0`,
      ).toBe(true);
    }
  });

  it("lists every decoy that exists, and every listed decoy exists", () => {
    const onDisk = sampleFiles.filter((f) => f.startsWith("decoys/")).sort();

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
  it("points each finding at the planted line, not merely at a line that exists", () => {
    // Existence plus non-blankness would stay green after any edit that shifts
    // the planted construct onto a different non-blank line, and the `line`
    // values are what Phase 3 scores detector output against.
    for (const finding of truth.findings) {
      const lines = readFileSync(path.join(root, finding.file), "utf8").split("\n");
      const cited = lines[finding.line - 1] ?? "";

      expect(
        cited.includes(finding.anchor),
        `${finding.file}:${finding.line} does not carry ${JSON.stringify(finding.anchor)}`,
      ).toBe(true);
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
    const present = threatColumn();
    const pending = new Set(truth.pending_threat_rows.cells);

    for (const finding of truth.findings) {
      expect(
        present.has(finding.threat_row) || pending.has(finding.threat_row),
        `threat row "${finding.threat_row}" is neither in threats.csv nor declared pending`,
      ).toBe(true);
    }
  });

  it("holds no pending cell that threats.csv already carries", () => {
    // The instrument that lets the Phase-2 gate report itself satisfied.
    // Without it `present OR pending` passes in both directions for ever: the
    // list never shrinks, and a cell whose wording was reconciled differently
    // keeps passing because it is still listed as pending.
    const present = threatColumn();

    for (const cell of truth.pending_threat_rows.cells) {
      expect(
        present.has(cell),
        `"${cell}" is now in threats.csv — remove it from pending_threat_rows and ` +
          `reconcile the cited wording; when this list empties, Phase 2 is unblocked`,
      ).toBe(false);
    }
  });

  it("names the roadmap the pending rows come from", () => {
    expect(truth.pending_threat_rows.source_roadmap).toBe(
      "road-to-account-lifecycle-threat-rows",
    );
  });
});
