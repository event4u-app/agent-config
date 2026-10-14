/**
 * `check_account_surface` against the frozen corpus of
 * `road-to-account-surface-detector` Phase 1 (steps 2.1 and 2.2).
 *
 * The expectations are read from `ground-truth.json`, which was frozen before
 * the detector existed, so these tests score the detector against the corpus
 * rather than restating what the detector happens to emit.
 */

import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  CLASSES,
  MAX_FILE_BYTES,
  REMEDIATION_BY_CLASS,
  onAccountSurface,
  scanAccountSurface,
} from "../../src/scripts/check_account_surface.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..");
const corpus = path.join(repoRoot, "tests", "fixtures", "account-surface");
const scriptPath = path.join(repoRoot, "src", "scripts", "check_account_surface.ts");

type Truth = {
  findings: {
    class: string;
    file: string;
    line: number;
    evidence: string;
    remediation: string;
    threat_row: string;
  }[];
  decoys: { file: string }[];
};

const truth = JSON.parse(readFileSync(path.join(corpus, "ground-truth.json"), "utf8")) as Truth;
const report = scanAccountSurface(corpus);

const key = (f: { class: string; file: string; line: number }) => `${f.class} ${f.file}:${f.line}`;

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tmpRepo(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "account-surface-"));
  scratch.push(dir);
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

describe("check_account_surface over the frozen corpus", () => {
  it("finds every planted defect at its cited line", () => {
    const found = new Set(report.findings.map(key));

    for (const expected of truth.findings) {
      expect(found.has(key(expected)), `missed ${key(expected)}`).toBe(true);
    }
  });

  it("reports nothing the ground truth does not list", () => {
    const expected = new Set(truth.findings.map(key));

    for (const finding of report.findings) {
      expect(expected.has(key(finding)), `unexpected ${key(finding)}`).toBe(true);
    }
  });

  it("stays silent on every safe twin and every decoy", () => {
    for (const finding of report.findings) {
      expect(finding.file.includes("/safe/")).toBe(false);
      expect(finding.file.startsWith("decoys/")).toBe(false);
    }
  });

  it("carries the evidence state, remediation and threat row the ground truth names", () => {
    for (const expected of truth.findings) {
      const got = report.findings.find((f) => key(f) === key(expected));

      expect(got?.evidence).toBe(expected.evidence);
      expect(got?.remediation).toBe(expected.remediation);
      expect(got?.threat_row).toBe(expected.threat_row);
    }
  });

  it("cites only Threat cells that exist in threats.csv", () => {
    const csv = readFileSync(
      path.join(repoRoot, "src", "skills", "threat-modeling", "data", "threats.csv"),
      "utf8",
    );

    for (const cls of CLASSES) {
      expect(csv.includes(`authentication,${cls.threat_row},`), cls.threat_row).toBe(true);
    }
  });

  it("states what it scanned and every class it cannot decide", () => {
    expect(report.scanned_files).toBeGreaterThan(0);
    expect(report.undecided.length).toBeGreaterThan(0);
    for (const item of report.undecided) expect(item.reason).not.toBe("");
  });

  it("labels its output unmeasured while the claim is unbacked", () => {
    expect(report.measured).toBe(false);
  });

  it("never echoes a planted secret literal", () => {
    expect(JSON.stringify(report)).not.toContain("changeme-pepper");
  });
});

describe("remediation classes (step 2.2)", () => {
  it("gives every class exactly one remediation value", () => {
    for (const cls of CLASSES) {
      expect(REMEDIATION_BY_CLASS[cls.id]).toBe(cls.remediation);
    }
    expect(new Set(CLASSES.map((c) => c.id)).size).toBe(CLASSES.length);
  });

  it("maps hash storage to migration and token verification to policy", () => {
    expect(REMEDIATION_BY_CLASS["fast-hash"]).toBe("migration");
    expect(REMEDIATION_BY_CLASS["pepper-literal"]).toBe("migration");
    expect(REMEDIATION_BY_CLASS["token-verify-off"]).toBe("policy");
  });

  it("routes every non-mechanical finding to note-and-ask with a leave-it option", () => {
    for (const finding of report.findings) {
      if (finding.remediation === "mechanical") {
        expect(finding.action).toBe("fix-now-candidate");
      } else {
        expect(finding.action).toBe("note-and-ask");
        expect(finding.options).toContain("leave it as is");
      }
    }
  });
});

describe("scope and safety", () => {
  it("opens only code files on an account-surface path", () => {
    expect(onAccountSurface("app/Http/Controllers/Auth/LoginController.php")).toBe(true);
    expect(onAccountSurface("src/auth/verify-otp.ts")).toBe(true);
    expect(onAccountSurface("resources/views/auth/login.css")).toBe(false);
    expect(onAccountSurface("docs/password-policy.md")).toBe(false);
    expect(onAccountSurface("src/storage/checksum.ts")).toBe(false);
  });

  it("ignores a planted pattern that sits in a comment", () => {
    const dir = tmpRepo({ "src/auth/login.ts": "// md5(password) is what we never do\n" });

    expect(scanAccountSurface(dir).findings).toEqual([]);
  });

  it("does not follow a symlink out of the scanned root", () => {
    const outside = tmpRepo({ "src/auth/login.ts": "const h = md5(password);\n" });
    const dir = tmpRepo({ "README.md": "x\n" });
    symlinkSync(path.join(outside, "src"), path.join(dir, "src"));

    const result = scanAccountSurface(dir);

    expect(result.findings).toEqual([]);
    expect(result.skipped.some((s) => s.reason.includes("symlink"))).toBe(true);
  });

  it("skips and reports a file above the size cap rather than reading it", () => {
    const big = "const x = 1;\n".repeat(Math.ceil(MAX_FILE_BYTES / 13) + 10);
    const dir = tmpRepo({ "src/auth/login.ts": `${big}const h = md5(password);\n` });

    const result = scanAccountSurface(dir);

    expect(result.findings).toEqual([]);
    expect(result.skipped.some((s) => s.file === "src/auth/login.ts")).toBe(true);
  });

  it("finds the same defect in a consumer-shaped tree outside the corpus", () => {
    const dir = tmpRepo({
      "src/auth/login.ts": "const h = createHash('md5').update(password).digest('hex');\n",
    });

    expect(scanAccountSurface(dir).findings.map((f) => f.class)).toEqual(["fast-hash"]);
  });

  it("catches a token written to Web Storage by property assignment, and only a token", () => {
    const dir = tmpRepo({
      "src/auth/callback.ts": [
        "localStorage['access_token'] = token;",
        "sessionStorage.refreshToken = refresh;",
        "localStorage.setItem('theme', 'dark');",
        "if (localStorage.authToken === undefined) redirect();",
      ].join("\n"),
    });

    const hits = scanAccountSurface(dir).findings.filter((f) => f.class === "token-in-localstorage");

    expect(hits.map((f) => f.line)).toEqual([1, 2]);
  });

  it("keys secret comparison on whole identifier words, not substrings or a verify path", () => {
    const dir = tmpRepo({
      "src/session/index.ts": [
        "if (a.tokens_estimate !== b.tokens_estimate) return 1;",
        "if (resetToken === stored) return true;",
      ].join("\n"),
      "src/release_verify.ts": "if (left.name === right.name) return true;\n",
    });

    const hits = scanAccountSurface(dir).findings.filter((f) => f.class === "secret-compare");

    expect(hits.map((f) => `${f.file}:${f.line}`)).toEqual(["src/session/index.ts:2"]);
  });

  it("is read-only and spawns nothing", () => {
    const source = readFileSync(scriptPath, "utf8");

    expect(source).not.toMatch(/\b(writeFileSync|appendFileSync|writeFile|appendFile|mkdirSync|rmSync|unlinkSync|renameSync)\b/);
    expect(source).not.toMatch(/child_process|\bspawn\(|\bexec\(|fetch\(/);
  });

  it("scans this repository's src/ and reports a scanned-files count", () => {
    const result = scanAccountSurface(path.join(repoRoot, "src"));

    expect(result.scanned_files).toBeGreaterThan(0);
  });
});

describe("check_account_surface — wired into its callers (step 3.2)", () => {
  const callers = [
    path.join(repoRoot, "src", "subagents", "production-validator.md"),
    path.join(repoRoot, "src", "skills", "launch-readiness", "SKILL.md"),
  ];

  it.each(callers)("%s names the command and labels the output unmeasured", (file) => {
    const body = readFileSync(file, "utf8");

    expect(body).toContain("check_account_surface");
    expect(body).toMatch(/unmeasured/i);
    expect(body).toContain("account-surface-finds-planted");
  });

  it("a detector-sourced violated finding validates as an AC-AUTH prelaunch finding", async () => {
    const { load_areas, validate_report } = await import("../../src/scripts/prelaunch_diagnostics.js");
    const hit = scanAccountSurface(corpus).findings.find((f) => f.evidence === "violated");
    expect(hit).toBeDefined();
    if (hit === undefined) return;

    const report = {
      schema_version: "prelaunch-report-v1" as const,
      project: "demo",
      run_at: "2026-10-14T00:00:00Z",
      areas: { auth: { state: "finding" as const } },
      findings: [
        {
          id: "AC-AUTH-001",
          area: "auth",
          severity: "P1" as const,
          title: `${hit.class} (check_account_surface, unmeasured)`,
          evidence: `${hit.file}:${hit.line}`,
          status: "open" as const,
        },
      ],
    };

    expect(validate_report(report, load_areas())).toEqual([]);
  });
});
