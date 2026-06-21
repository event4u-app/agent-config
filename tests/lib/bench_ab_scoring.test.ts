/**
 * Tests for `src/scripts/_lib/bench_ab_scoring.ts`.
 *
 * The Python module `src/scripts/_lib/bench_ab_scoring.py` has no dedicated
 * pytest suite, so this is a focused differential suite (ADR-088 Phase 2 /
 * Wave 2a): unit checks for each criterion branch over temp-dir clones, plus
 * a differential block that drives the Python original via `python3 -c` on
 * shared fixtures and asserts JSON-identical scoring output (ADR-088 parity
 * gate 2, golden replay).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { score_task } from "../../src/scripts/_lib/bench_ab_scoring.js";

const __dirname_ts = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname_ts, "..", "..");

let clone_root: string;

beforeEach(() => {
  clone_root = fs.mkdtempSync(path.join(os.tmpdir(), "bench-ab-scoring-"));
});

afterEach(() => {
  fs.rmSync(clone_root, { recursive: true, force: true });
});

function writeFile(rel: string, body: string): void {
  const full = path.join(clone_root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body);
}

describe("score_task — individual criteria", () => {
  it("target_file_modified passes when the file changed", () => {
    const res = score_task(
      { success_criteria: { target_file_modified: "app/x.ts" } },
      {
        pre_snapshot: { "app/x.ts": "old" },
        post_snapshot: { "app/x.ts": "new" },
        clone_root,
        transcript: "",
      },
    );
    expect(res.passed).toBe(true);
    expect(res.checks).toEqual([
      { name: "target_file_modified", ok: true, reason: "file: app/x.ts" },
    ]);
  });

  it("target_file_modified fails when unchanged", () => {
    const res = score_task(
      { success_criteria: { target_file_modified: "app/x.ts" } },
      {
        pre_snapshot: { "app/x.ts": "same" },
        post_snapshot: { "app/x.ts": "same" },
        clone_root,
        transcript: "",
      },
    );
    expect(res.passed).toBe(false);
    expect(res.checks[0]!.ok).toBe(false);
  });

  it("regex_in_target reads the target file body, case-insensitive", () => {
    writeFile("app/x.ts", "export const FOO = 1;");
    const res = score_task(
      {
        success_criteria: {
          target_file_modified: "app/x.ts",
          regex_in_target: "export const foo",
        },
      },
      {
        pre_snapshot: { "app/x.ts": "old" },
        post_snapshot: { "app/x.ts": "new" },
        clone_root,
        transcript: "",
      },
    );
    expect(res.passed).toBe(true);
    const check = res.checks.find((c) => c.name === "regex_in_target")!;
    expect(check.ok).toBe(true);
    expect(check.reason).toBe("pattern='export const foo' in 'app/x.ts'");
  });

  it("regex_in_any scans only modified files", () => {
    writeFile("a.ts", "needle here");
    writeFile("b.ts", "nothing");
    const res = score_task(
      { success_criteria: { regex_in_any: "needle" } },
      {
        // a.ts changed, b.ts unchanged
        pre_snapshot: { "a.ts": "old", "b.ts": "nothing" },
        post_snapshot: { "a.ts": "needle here", "b.ts": "nothing" },
        clone_root,
        transcript: "",
      },
    );
    expect(res.passed).toBe(true);
    const check = res.checks.find((c) => c.name === "regex_in_any")!;
    expect(check.reason).toBe("pattern='needle' across 1 modified files");
  });

  it("new_test_file_exists requires the file present AND absent from pre-snapshot", () => {
    writeFile("tests/new.test.ts", "test('x', () => {})");
    const res = score_task(
      { success_criteria: { new_test_file_exists: "tests/new.test.ts" } },
      {
        pre_snapshot: {},
        post_snapshot: { "tests/new.test.ts": "test('x', () => {})" },
        clone_root,
        transcript: "",
      },
    );
    expect(res.passed).toBe(true);
  });

  it("new_test_file_exists fails when the file already existed pre-run", () => {
    writeFile("tests/new.test.ts", "x");
    const res = score_task(
      { success_criteria: { new_test_file_exists: "tests/new.test.ts" } },
      {
        pre_snapshot: { "tests/new.test.ts": "x" },
        post_snapshot: { "tests/new.test.ts": "x" },
        clone_root,
        transcript: "",
      },
    );
    expect(res.checks[0]!.ok).toBe(false);
  });

  it("test_assertion_added detects assert/expect/test/it", () => {
    writeFile("t.ts", "describe('x', () => { expect(1).toBe(1); })");
    const res = score_task(
      { success_criteria: { test_assertion_added: "t.ts" } },
      { pre_snapshot: {}, post_snapshot: {}, clone_root, transcript: "" },
    );
    expect(res.passed).toBe(true);
  });

  it("one_of_files_modified passes when any path changed", () => {
    const res = score_task(
      { success_criteria: { one_of_files_modified: ["a.ts", "b.ts"] } },
      {
        pre_snapshot: { "a.ts": "1", "b.ts": "2" },
        post_snapshot: { "a.ts": "1", "b.ts": "CHANGED" },
        clone_root,
        transcript: "",
      },
    );
    expect(res.passed).toBe(true);
    expect(res.checks[0]!.reason).toBe("any of: ['a.ts', 'b.ts']");
  });

  it("preserves_public_api flags missing names", () => {
    writeFile("api.ts", "export function keep() {}");
    const res = score_task(
      {
        success_criteria: {
          target_file_modified: "api.ts",
          preserves_public_api: ["keep", "gone"],
        },
      },
      {
        pre_snapshot: { "api.ts": "old" },
        post_snapshot: { "api.ts": "new" },
        clone_root,
        transcript: "",
      },
    );
    const check = res.checks.find((c) => c.name === "preserves_public_api")!;
    expect(check.ok).toBe(false);
    expect(check.reason).toBe("missing: ['gone']");
  });

  it("transcript_contains_one_of is case-insensitive", () => {
    const res = score_task(
      { success_criteria: { transcript_contains_one_of: ["AUDIT", "scan"] } },
      {
        pre_snapshot: {},
        post_snapshot: {},
        clone_root,
        transcript: "ran the audit step",
      },
    );
    expect(res.passed).toBe(true);
  });

  it("no_file_write_before_audit passes when audit precedes write", () => {
    const res = score_task(
      { success_criteria: { no_file_write_before_audit: true } },
      {
        pre_snapshot: {},
        post_snapshot: {},
        clone_root,
        transcript: "first existing-ui-audit then save-file later",
      },
    );
    expect(res.passed).toBe(true);
  });

  it("no_file_write_before_audit fails when write precedes audit", () => {
    const res = score_task(
      { success_criteria: { no_file_write_before_audit: true } },
      {
        pre_snapshot: {},
        post_snapshot: {},
        clone_root,
        transcript: "save-file first, then audit",
      },
    );
    expect(res.checks[0]!.ok).toBe(false);
  });

  it("min_test_count counts test/it/describe", () => {
    writeFile(
      "tests/n.test.ts",
      "describe('a', () => { it('b', () => {}); test('c', () => {}); })",
    );
    const res = score_task(
      {
        success_criteria: {
          new_test_file_exists: "tests/n.test.ts",
          min_test_count: 3,
        },
      },
      {
        pre_snapshot: {},
        post_snapshot: { "tests/n.test.ts": "x" },
        clone_root,
        transcript: "",
      },
    );
    const check = res.checks.find((c) => c.name === "min_test_count")!;
    expect(check.ok).toBe(true);
    expect(check.reason).toBe("found=3, required=3");
  });

  it("empty success_criteria yields passed=false (no checks)", () => {
    const res = score_task(
      { success_criteria: {} },
      { pre_snapshot: {}, post_snapshot: {}, clone_root, transcript: "" },
    );
    expect(res.passed).toBe(false);
    expect(res.checks).toEqual([]);
  });
});

// ─── differential parity vs the Python original ──────────────────────────────

function python_available(): boolean {
  try {
    execFileSync("python3", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Drive the Python `score_task` over a JSON envelope from stdin describing
 * the task, the snapshots, and on-disk files, and print the result JSON.
 */
const PY_DRIVER = `
import json, sys, pathlib, tempfile
sys.path.insert(0, "src")
from scripts._lib import bench_ab_scoring as scoring

payload = json.loads(sys.stdin.read())
clone_root = pathlib.Path(payload["clone_root"])
result = scoring.score_task(
    payload["task"],
    pre_snapshot=payload["pre_snapshot"],
    post_snapshot=payload["post_snapshot"],
    clone_root=clone_root,
    transcript=payload["transcript"],
)
print(json.dumps(result, sort_keys=True))
`;

interface Fixture {
  name: string;
  task: Record<string, unknown>;
  pre_snapshot: Record<string, string>;
  post_snapshot: Record<string, string>;
  transcript: string;
  files: Record<string, string>;
}

const FIXTURES: Fixture[] = [
  {
    name: "regex + api + new test",
    task: {
      success_criteria: {
        target_file_modified: "app/svc.ts",
        regex_in_target: "class\\s+Svc",
        preserves_public_api: ["Svc", "handle"],
        new_test_file_exists: "tests/svc.test.ts",
        min_test_count: 2,
      },
    },
    pre_snapshot: { "app/svc.ts": "old" },
    post_snapshot: {
      "app/svc.ts": "new",
      "tests/svc.test.ts": "test x",
    },
    transcript: "",
    files: {
      "app/svc.ts": "export class Svc { handle() {} }",
      "tests/svc.test.ts": "test('a', () => {}); it('b', () => {});",
    },
  },
  {
    name: "regex_in_any over modified files only",
    task: { success_criteria: { regex_in_any: "TODO|FIXME" } },
    pre_snapshot: { "a.ts": "x", "b.ts": "// FIXME" },
    post_snapshot: { "a.ts": "// TODO added", "b.ts": "// FIXME" },
    transcript: "",
    files: { "a.ts": "// TODO added", "b.ts": "// FIXME" },
  },
  {
    name: "audit-before-write heuristic + transcript match",
    task: {
      success_criteria: {
        no_file_write_before_audit: true,
        transcript_contains_one_of: ["existing-ui-audit"],
      },
    },
    pre_snapshot: {},
    post_snapshot: {},
    transcript: "step 1: existing-ui-audit\nstep 2: save-file foo",
    files: {},
  },
  {
    name: "missing api names + unchanged target → both fail",
    task: {
      success_criteria: {
        target_file_modified: "api.ts",
        preserves_public_api: ["alpha", "beta"],
        no_existing_test_removed: ["testKeep"],
      },
    },
    pre_snapshot: { "api.ts": "same" },
    post_snapshot: { "api.ts": "same" },
    transcript: "",
    files: { "api.ts": "export const alpha = 1;" },
  },
];

describe.skipIf(!python_available())(
  "differential: TS twin vs Python original",
  () => {
    for (const fx of FIXTURES) {
      it(`scoring is JSON-identical: ${fx.name}`, () => {
        // Stage a shared clone dir for both runtimes.
        const diffRoot = fs.mkdtempSync(
          path.join(os.tmpdir(), "bench-ab-scoring-diff-"),
        );
        try {
          for (const [rel, body] of Object.entries(fx.files)) {
            const full = path.join(diffRoot, rel);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, body);
          }

          const inputs = {
            pre_snapshot: fx.pre_snapshot,
            post_snapshot: fx.post_snapshot,
            clone_root: diffRoot,
            transcript: fx.transcript,
          };

          const ts = score_task(fx.task, inputs);

          const envelope = JSON.stringify({
            task: fx.task,
            pre_snapshot: fx.pre_snapshot,
            post_snapshot: fx.post_snapshot,
            clone_root: diffRoot,
            transcript: fx.transcript,
          });
          const pyOut = execFileSync("python3", ["-c", PY_DRIVER], {
            cwd: ROOT,
            input: envelope,
            encoding: "utf-8",
            maxBuffer: 16 * 1024 * 1024,
          });
          const py = JSON.parse(pyOut);

          // Compare via canonical JSON (sorted keys) so field order is irrelevant.
          expect(canonical(ts)).toEqual(canonical(py));
        } finally {
          fs.rmSync(diffRoot, { recursive: true, force: true });
        }
      });
    }
  },
);

/** Recursively sort object keys so structural compare ignores field order. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonical((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}
