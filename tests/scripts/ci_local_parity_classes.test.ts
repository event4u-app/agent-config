/**
 * The `verify:` lines of `road-to-local-gates-wired-while-they-are-green`.
 *
 * Two kinds of assertion live here, and the split is deliberate.
 *
 * 1. BEHAVIOUR of the two gate scripts the drain repaired. Neither exports
 *    anything — both are CLI entry points — so they are exercised as
 *    subprocesses against fixtures rather than by reaching into internals. A
 *    test that imported a helper would pass while the gate a workflow actually
 *    runs stayed broken.
 *
 * 2. STRUCTURE of the wiring: which gate has a caller, and in which kind of
 *    job. These read the workflow YAML, because "has a pull-request caller" is
 *    a property of the workflow file and of nothing else.
 *
 * There is deliberately NO `baseline-at-most-143` case yet. Roadmap step 2.1
 * asks for one, and the parity baseline has not moved: `gate-violation-
 * baselines.json` records a 165 -> 164 lowering attempted and reverted on
 * 2026-08-24 because it was taken on a local reading, and its conclusion is
 * that this baseline moves on a reading from the enforcing environment. A test
 * asserting a number nobody has measured there yet would assert a hope.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..");

function runGate(script: string, args: string[]): { code: number; out: string } {
  try {
    const out = execFileSync(path.join(repoRoot, "scripts-run"), [`src/scripts/${script}`, ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? -1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

const REQUIRED_EXPERIENCE_FIELDS = [
  "id",
  "scope",
  "trigger_context",
  "strategy",
  "falsifier",
  "confidence",
  "contradictions",
  "supersedes",
  "expiry",
  "epistemic_type",
];

function experienceCard(omit: string | null): string {
  const lines = ["kind: experience"];
  for (const f of REQUIRED_EXPERIENCE_FIELDS) {
    if (f === omit) continue;
    if (f === "trigger_context" || f === "contradictions" || f === "supersedes") {
      lines.push(`${f}:`, "  - a-value");
    } else if (f === "strategy" || f === "falsifier") {
      lines.push(`${f}: >-`, "  a block scalar whose value is on the following line");
    } else {
      lines.push(`${f}: a-value`);
    }
  }
  return `---\n${lines.join("\n")}\n---\n\n# A card\n\nBody.\n`;
}

describe("unowned-gates-wired", () => {
  it("checks an experience card against its own contract, not the external one", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "kcards-"));
    try {
      writeFileSync(path.join(dir, "experience-complete.md"), experienceCard(null), "utf8");
      const r = runGate("check_knowledge_cards", ["--dir", dir]);

      // The regression this repairs: C2 and C4 are EXTERNAL-arm checks. A
      // complete experience card declares none of `trust`, `links.authoritative`
      // or `type: anti-hallucination`, and must not be asked for them.
      expect(r.out).not.toMatch(/C4: missing 'trust'/);
      expect(r.out).not.toMatch(/C2:/);
      expect(r.code).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("still reports an experience card that omits a field its own contract requires", () => {
    // Sensitivity: dispatching on `kind` must not become "skip the arm". Each
    // required field is omitted in turn and must be named back.
    for (const omitted of REQUIRED_EXPERIENCE_FIELDS) {
      const dir = mkdtempSync(path.join(tmpdir(), "kcards-"));
      try {
        writeFileSync(path.join(dir, "experience-partial.md"), experienceCard(omitted), "utf8");
        const r = runGate("check_knowledge_cards", ["--dir", dir]);
        expect(r.code, `omitting ${omitted} should be a finding`).not.toBe(0);
        expect(r.out).toContain(`experience card missing required '${omitted}' field`);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("treats an underscore-prefixed subagent file as a partial, and one really exists", () => {
    const dir = path.join(repoRoot, "src", "subagents");
    const partials = readdirSync(dir).filter((f) => f.startsWith("_") && f.endsWith(".md"));

    // Without this the next assertion is vacuous: a green gate over a directory
    // with no partial in it says nothing about the skip.
    expect(partials.length, "no `_`-prefixed partial in src/subagents").toBeGreaterThan(0);

    // And the partial really is frontmatter-less, which is why the unfiltered
    // lint reported "no parseable frontmatter" against a correct file.
    const body = readFileSync(path.join(dir, partials[0] as string), "utf8");
    expect(body.startsWith("---")).toBe(false);

    expect(runGate("lint_subagent_determinism", []).code).toBe(0);
  });
});

describe("generated-docs-checks-wired", () => {
  const workflow = readFileSync(path.join(repoRoot, ".github", "workflows", "rule-backstops.yml"), "utf8");

  it("runs each generator's --check variant on a pull request", () => {
    for (const gate of ["generate_ownership_matrix", "generate_cookbook", "generate_role_experiences_catalog"]) {
      expect(workflow, `${gate} --check has no caller`).toContain(`src/scripts/${gate} --check`);
    }
  });

  it("never runs a generator's writing variant there", () => {
    // The reading that produced this batch was wrong once in exactly this way:
    // it ran writers instead of checkers and silently modified five tracked
    // files. A writer in a workflow would commit that mistake permanently.
    for (const gate of ["generate_ownership_matrix", "generate_cookbook", "generate_role_experiences_catalog"]) {
      const calls = workflow.match(new RegExp(`src/scripts/${gate}(?! --check)([^\\n]*)`, "g")) ?? [];
      expect(calls, `${gate} is called without --check`).toEqual([]);
    }
  });
});

describe("every-wire-class-gate-has-a-workflow-caller", () => {
  it("wires exactly the batch the council bounded, and every one of them is reachable", () => {
    const workflow = readFileSync(path.join(repoRoot, ".github", "workflows", "rule-backstops.yml"), "utf8");
    const job = workflow.slice(workflow.indexOf("local-only-drain:"));

    const wired = [
      "lint_pack_dependencies",
      "check_originality_freshness",
      "check_context_paths",
      "check_suppression_hygiene",
      "runtime_dispatcher",
      "bench_hook_injection",
      "audit_skill_overlap",
      "memory_replay",
      "lint_framework_leakage",
      "check_gate_paths",
      "smoke_quickstart",
      "compile_router",
      "validate_pack_yaml",
      "measure_augment_budget",
      "generate_ownership_matrix",
      "generate_cookbook",
      "generate_role_experiences_catalog",
      "check_knowledge_cards",
      "lint_subagent_determinism",
      "check_trigger_eval_presence",
    ];
    expect(wired).toHaveLength(20);

    for (const gate of wired) {
      expect(job, `${gate} is not called in the drain job`).toContain(`src/scripts/${gate}`);
      expect(existsSync(path.join(repoRoot, "src", "scripts", `${gate}.ts`)), `${gate}.ts does not exist`).toBe(true);
    }
  });

  it("runs on pull requests, which is the whole point of the drain", () => {
    const workflow = readFileSync(path.join(repoRoot, ".github", "workflows", "rule-backstops.yml"), "utf8");
    expect(workflow.slice(0, workflow.indexOf("jobs:"))).toMatch(/pull_request/);
  });
});

describe("calendar-gates-scheduled-not-required", () => {
  const canary = readFileSync(path.join(repoRoot, ".github", "workflows", "gate-canary.yml"), "utf8");
  const backstops = readFileSync(path.join(repoRoot, ".github", "workflows", "rule-backstops.yml"), "utf8");

  // The thirteen the reading classed `calendar` — they call `checkRatchet`,
  // where a baseline unchanged for STALE_AFTER_DAYS fails with no diff at all,
  // or they print an `as-of:` verdict line.
  const calendarGates = [
    "check_roadmap_trackable",
    "domain_soundness_status",
    "lint_artefact_frontmatter",
    "lint_handoffs",
    "lint_provenance_vocabulary",
    "lint_roadmap_blockers",
    "lint_roadmap_later_disposition",
    "skill_eval_coverage",
    "check_knowledge_pages",
    "check_reach_staleness",
    "lint_hook_manifest",
    "lint_one_off_age",
    "lint_symptom_intake",
  ];

  it("gives every calendar gate a scheduled caller", () => {
    for (const gate of calendarGates) {
      expect(canary, `${gate} has no scheduled caller`).toContain(`src/scripts/${gate}`);
    }
  });

  it("keeps every calendar gate out of the pull-request drain job", () => {
    const job = backstops.slice(backstops.indexOf("local-only-drain:"));
    for (const gate of calendarGates) {
      expect(job, `${gate} must not block a pull request`).not.toContain(`src/scripts/${gate}`);
    }
  });

  it("runs the scheduled job on a schedule and never on a pull request", () => {
    const header = canary.slice(0, canary.indexOf("jobs:"));
    expect(header).toMatch(/schedule:/);
    expect(header).not.toMatch(/pull_request/);
  });

  it("gives check_council_pin_staleness the caller it never had", () => {
    expect(canary).toContain("src/scripts/check_council_pin_staleness");
  });

  it("keeps the one slow gate off the pull-request path", () => {
    const job = backstops.slice(backstops.indexOf("local-only-drain:"));
    expect(canary).toContain("src/scripts/audit_command_surface");
    expect(job).not.toContain("src/scripts/audit_command_surface");
  });

  it("runs the scheduled gates in their own job, not beside the canary", () => {
    // `check_gate_coverage --canary` plants a declared violation per gate and
    // removes it in a `finally`. A gate sharing that job would read a planted
    // tree, or one a failed `finally` left dirty.
    expect(canary).toMatch(/^ {2}local-only-scheduled:/m);
    const scheduled = canary.slice(canary.indexOf("local-only-scheduled:"));
    expect(scheduled).not.toContain("--canary");
  });
});
