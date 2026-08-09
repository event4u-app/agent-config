// Tests for src/scripts/hooks/delegation_nudge_hook.ts — the F3-lite
// conditional delegation nudge (road-to-orchestrator-discipline-carriers
// Phase 4). Two layers:
//
//   1. Direct-import unit tests for the pure signal-extraction helpers,
//      `classifyPrompt`, and `buildNudgeLine` — fast, precise, and (for the
//      classifier-error case) able to mock a dependency to force the catch
//      path without touching the shipped module for every other test.
//   2. spawnSync end-to-end tests for `main()` via the real tsx entry point,
//      mirroring `session_canary_hook.test.ts`'s harness — feeds a stdin
//      envelope against a temp workspace + isolated user-global root and
//      asserts exit code + stdout shape, covering the four Phase-4.4 cases
//      literally: (a) matching prompt → injected verdict line, (b) ordinary
//      prompt → silence, (c) classifier error → silence, (d) activation gate
//      closed (no known host) → silence.
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as AutoDispatchModule from "../../src/scripts/_lib/auto_dispatch.js";
import {
  buildNudgeLine,
  classifyPrompt,
  detectEnumeratedFiles,
  detectExplicitSliceCount,
  detectForEachShape,
  detectMultiDeliverableConjunction,
  detectOrderedPlan,
  extractTaskSignals,
  recommendSliceTier,
  resolveActivation,
} from "../../src/scripts/hooks/delegation_nudge_hook.js";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const TS_SCRIPT = path.join(
  REPO_ROOT,
  "src",
  "scripts",
  "hooks",
  "delegation_nudge_hook.ts",
);
const TSX_BIN = path.join(
  REPO_ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx",
);

const tmpDirs: string[] = [];

function makeWorkspace(settingsYaml: string | null): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "delegation-nudge-"));
  tmpDirs.push(dir);
  if (settingsYaml !== null) {
    fs.writeFileSync(path.join(dir, ".agent-settings.yml"), settingsYaml, "utf-8");
  }
  return dir;
}

function makeGlobalRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "delegation-nudge-global-"));
  tmpDirs.push(dir);
  fs.mkdirSync(path.join(dir, "settings"), { recursive: true });
  return dir;
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

function run(envelope: unknown): { stdout: string; stderr: string; status: number | null } {
  const r = spawnSync(TSX_BIN, [TS_SCRIPT], {
    encoding: "utf8",
    cwd: REPO_ROOT,
    input: typeof envelope === "string" ? envelope : JSON.stringify(envelope),
    // Pin the user-global root so the dev machine's real
    // ~/.event4u/agent-config/ never leaks into these tests.
    env: { ...process.env, EVENT4U_CONFIG_HOME: makeGlobalRoot() },
  });
  expect(r.status).not.toBeNull();
  return { stdout: r.stdout as string, stderr: r.stderr as string, status: r.status };
}

// ── Layer 1 — pure signal-extraction helpers ──────────────────────────────

describe("detectEnumeratedFiles", () => {
  it("counts unique file-like tokens", () => {
    expect(
      detectEnumeratedFiles(
        "fix the failing tests in these 6 files: a.ts b.ts c.ts d.ts e.ts f.ts",
      ),
    ).toBe(6);
  });

  it("does not double-count a repeated filename", () => {
    expect(detectEnumeratedFiles("touch a.ts, then re-check a.ts again")).toBe(1);
  });

  it("a prose question with no file tokens counts zero", () => {
    expect(detectEnumeratedFiles("why does X happen?")).toBe(0);
  });
});

describe("detectExplicitSliceCount", () => {
  it("reads an explicit English count", () => {
    expect(detectExplicitSliceCount("update these 3 modules")).toBe(3);
  });

  it("reads an explicit German count", () => {
    expect(detectExplicitSliceCount("aktualisiere diese 5 Dateien")).toBe(5);
  });

  it("no explicit count phrase → null", () => {
    expect(detectExplicitSliceCount("why does X happen?")).toBeNull();
  });
});

describe("detectForEachShape", () => {
  it.each([
    "for each file in the list, run the linter",
    "alle Dateien im Ordner prüfen",
    "jeden Endpunkt einzeln testen",
  ])("matches %s", (text) => {
    expect(detectForEachShape(text)).toBe(true);
  });

  it("a plain question does not match", () => {
    expect(detectForEachShape("why does X happen?")).toBe(false);
  });
});

describe("detectMultiDeliverableConjunction", () => {
  it("counts a three-item English Oxford-comma list", () => {
    expect(
      detectMultiDeliverableConjunction("update the docs, the changelog, and the README"),
    ).toBe(3);
  });

  it("counts a German Oxford-comma-style list closed with und", () => {
    expect(
      detectMultiDeliverableConjunction("aktualisiere Docs, Changelog, und README"),
    ).toBe(3);
  });

  it("a two-item list with no closing conjunction shape returns 0", () => {
    expect(detectMultiDeliverableConjunction("update the docs and the README")).toBe(0);
  });

  it("a German list WITHOUT the comma before und is a known gap (returns 0)", () => {
    expect(
      detectMultiDeliverableConjunction("aktualisiere Docs, Changelog und README"),
    ).toBe(0);
  });
});

describe("detectOrderedPlan", () => {
  it("two or more 'Step N' markers count as an ordered plan", () => {
    const r = detectOrderedPlan("Step 1: read the file. Step 2: apply the fix.");
    expect(r).toEqual({ ordered: true, stepCount: 2 });
  });

  it("German 'Schritt N' markers count too", () => {
    const r = detectOrderedPlan("Schritt 1: lesen. Schritt 2: schreiben. Schritt 3: testen.");
    expect(r.ordered).toBe(true);
    expect(r.stepCount).toBe(3);
  });

  it("numbered list lines count as an ordered plan", () => {
    const r = detectOrderedPlan("1. open the file\n2. edit the header\n3. save it");
    expect(r.ordered).toBe(true);
    expect(r.stepCount).toBe(3);
  });

  it("a single numbered reference is not a plan shape", () => {
    const r = detectOrderedPlan("see step 3 of the guide for details");
    expect(r).toEqual({ ordered: false, stepCount: 1 });
  });

  it("no numbered shape at all", () => {
    expect(detectOrderedPlan("why does X happen?")).toEqual({ ordered: false, stepCount: 0 });
  });

  it("F7: a bare 2-line numbered list is NOT an ordered plan (common prose, not a work plan)", () => {
    const r = detectOrderedPlan("1. rename a.ts\n2. rename b.ts");
    expect(r).toEqual({ ordered: false, stepCount: 2 });
  });

  it("F7: a bare 3-line numbered list IS an ordered plan (the raised floor)", () => {
    const r = detectOrderedPlan("1. open a.ts\n2. edit b.ts\n3. save c.ts");
    expect(r).toEqual({ ordered: true, stepCount: 3 });
  });

  it("a 2-count 'Step N' WORD marker keeps its own, lower floor (unaffected by F7)", () => {
    const r = detectOrderedPlan("Step 1: touch a.ts. Step 2: touch b.ts.");
    expect(r).toEqual({ ordered: true, stepCount: 2 });
  });
});

describe("extractTaskSignals", () => {
  it("an enumerated file list yields a parallel, files-tagged signal", () => {
    const { signals, sliceCountForLine } = extractTaskSignals(
      "fix the failing tests in these 6 files: a.ts b.ts c.ts d.ts e.ts f.ts",
    );
    expect(signals.parallelizable).toBe("files");
    expect(signals.independent_slices).toBe(6);
    expect(signals.size_estimate).toBeGreaterThan(1);
    expect(sliceCountForLine).toBe(6);
  });

  it("an ordered-plan shape wins over any slice count and yields no independent_slices", () => {
    const { signals } = extractTaskSignals(
      "Step 1: touch a.ts. Step 2: touch b.ts. Step 3: touch c.ts.",
    );
    expect(signals.ordered_plan).toBe(true);
    expect(signals.independent_slices).toBe(0);
  });

  it("a plain question has no signal and stays at/below the size floor", () => {
    const { signals, sliceCountForLine } = extractTaskSignals("why does X happen?");
    expect(signals.independent_slices).toBe(0);
    expect(signals.ordered_plan).toBe(false);
    expect(signals.size_estimate).toBe(0);
    expect(sliceCountForLine).toBe(0);
  });

  it("F7: naming exactly 2 files (a rename) is NOT a delegable file signal", () => {
    const { signals, sliceCountForLine } = extractTaskSignals("rename a.ts to b.ts");
    expect(signals.parallelizable).toBeNull();
    expect(signals.independent_slices).toBe(0);
    expect(signals.size_estimate).toBe(0);
    expect(sliceCountForLine).toBe(0);
  });

  it("F7: naming 3 files DOES signal delegable work (the raised floor)", () => {
    const { signals, sliceCountForLine } = extractTaskSignals("touch a.ts, b.ts, and c.ts");
    expect(signals.parallelizable).toBe("files");
    expect(signals.independent_slices).toBe(3);
    expect(sliceCountForLine).toBe(3);
  });
});

describe("buildNudgeLine", () => {
  it("renders the rung, mode, slice count, and tier verbatim", () => {
    const line = buildNudgeLine(
      2,
      { delegable: true, action: "dispatch", mode: "do-in-parallel", reason: "independent slices (6)" },
      6,
      "lite",
    );
    expect(line).toBe(
      "<delegation-nudge>rung-2: dispatch do-in-parallel " +
        "(6 slices, lite tier recommended). Consider dispatching via " +
        "subagent-orchestration instead of doing every slice in-session — " +
        "independent slices (6).</delegation-nudge>",
    );
  });

  it("uses the singular unit for exactly one slice", () => {
    const line = buildNudgeLine(
      2,
      { delegable: true, action: "ask", mode: "do-in-steps", reason: "ordered-plan structure" },
      1,
      "medium",
    );
    expect(line).toContain("(1 slice, medium tier recommended)");
  });

  it("rung 1 (no mode) renders as a single-slice dispatch", () => {
    const line = buildNudgeLine(
      1,
      { delegable: true, action: "dispatch", mode: null, reason: "single bounded read-heavy slice" },
      1,
      "lite",
    );
    expect(line).toContain("rung-1: dispatch single-slice (1 slice, lite tier recommended)");
  });

  it("an unresolved rung renders as rung-? (unreachable in production, kept total for direct callers)", () => {
    const line = buildNudgeLine(
      null,
      { delegable: true, action: "dispatch", mode: "do-in-parallel", reason: "independent slices (6)" },
      6,
      "lite",
    );
    expect(line).toContain("rung-?: dispatch do-in-parallel");
  });
});

describe("classifyPrompt — activation + verdict wiring", () => {
  it("a delegable prompt on a known host with the gate open returns a verdict", () => {
    const root = makeWorkspace(null);
    const result = classifyPrompt(
      "fix the failing tests in these 6 files: a.ts b.ts c.ts d.ts e.ts f.ts",
      root,
      "claude",
    );
    expect(result).not.toBeNull();
    expect(result?.classification.mode).toBe("do-in-parallel");
    expect(result?.rung).toBe(2);
    expect(result?.sliceCount).toBe(6);
    expect(result?.tier).toBe("lite");
  });

  it("an unknown host resolves the all-false safe default → gate closed → null", () => {
    const root = makeWorkspace(null);
    const result = classifyPrompt(
      "fix the failing tests in these 6 files: a.ts b.ts c.ts d.ts e.ts f.ts",
      root,
      "some-unrecognised-host",
    );
    expect(result).toBeNull();
  });

  it("a leftover subagents.host_capabilities override no longer applies (always-on: capability is probe/registry-only)", () => {
    const root = makeWorkspace(
      ["subagents:", "  host_capabilities:", "    subagent_spawn: false", ""].join("\n"),
    );
    const result = classifyPrompt(
      "fix the failing tests in these 6 files: a.ts b.ts c.ts d.ts e.ts f.ts",
      root,
      "claude",
    );
    // The stale key is ignored — claude's registry row still wins.
    expect(result).not.toBeNull();
    expect(result?.classification.mode).toBe("do-in-parallel");
  });

  it("emergency.orchestration_halt closes the gate even on a known, capable host", () => {
    const root = makeWorkspace(
      ["emergency:", "  orchestration_halt: true", ""].join("\n"),
    );
    const result = classifyPrompt(
      "fix the failing tests in these 6 files: a.ts b.ts c.ts d.ts e.ts f.ts",
      root,
      "claude",
    );
    expect(result).toBeNull();
  });

  it("a non-delegable prompt returns null even with the gate open", () => {
    const root = makeWorkspace(null);
    expect(classifyPrompt("why does X happen?", root, "claude")).toBeNull();
  });

  it("F7: a 2-file rename prompt returns null even with the gate open (negative test)", () => {
    const root = makeWorkspace(null);
    expect(classifyPrompt("rename a.ts to b.ts", root, "claude")).toBeNull();
  });

  // Regression (judgment_ladder rung-1 size-floor bypass): a short single-
  // slice read-heavy prompt matches rung 1's regex, but `extractTaskSignals`
  // gives it no multi-slice signal → `size_estimate: 0`, at/below
  // `SIZE_FLOOR`. Before the fix, rung 1 fired anyway and this prompt
  // injected a "1 slice, lite tier" nudge for what is, structurally, a
  // trivial ask.
  it("rung-1 size-floor regression: a short single-slice review prompt returns null (no injection)", () => {
    const root = makeWorkspace(null);
    expect(classifyPrompt("review this diff", root, "claude")).toBeNull();
  });
});

describe("classifyPrompt — classifier error degrades to silence", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.doUnmock("../../src/scripts/_lib/auto_dispatch.js");
    vi.resetModules();
  });

  it("a throwing classifyTask never propagates — classifyPrompt returns null", async () => {
    vi.doMock("../../src/scripts/_lib/auto_dispatch.js", async () => {
      const actual = await vi.importActual<typeof AutoDispatchModule>(
        "../../src/scripts/_lib/auto_dispatch.js",
      );
      return {
        ...actual,
        classifyTask: () => {
          throw new Error("synthetic classifier failure");
        },
      };
    });
    const mod = await import("../../src/scripts/hooks/delegation_nudge_hook.js");
    const root = makeWorkspace(null);
    const result = mod.classifyPrompt(
      "fix the failing tests in these 6 files: a.ts b.ts c.ts d.ts e.ts f.ts",
      root,
      "claude",
    );
    expect(result).toBeNull();
  });
});

describe("resolveActivation + recommendSliceTier", () => {
  it("resolves subagent_spawn true for the known 'claude' host with no override", () => {
    const root = makeWorkspace(null);
    const { activation } = resolveActivation(root, "claude");
    expect(activation.subagent_spawn).toBe(true);
  });

  it("downshift default (no settings) recommends the lite tier", () => {
    const root = makeWorkspace(null);
    const { downshift, separate_quota_pool } = resolveActivation(root, "claude");
    expect(recommendSliceTier(downshift, separate_quota_pool)).toBe("lite");
  });

  it("downshift explicitly off recommends the session (high) tier", () => {
    const root = makeWorkspace(["subagents:", "  downshift: false", ""].join("\n"));
    const { downshift, separate_quota_pool } = resolveActivation(root, "claude");
    expect(recommendSliceTier(downshift, separate_quota_pool)).toBe("high");
  });
});

// ── Layer 2 — end-to-end through the real tsx entry point ────────────────

describe("delegation_nudge_hook — end-to-end (Phase 4.4)", () => {
  it("(a) a matching prompt shape injects the verdict line", () => {
    const root = makeWorkspace(null);
    const { stdout, status } = run({
      event: "user_prompt_submit",
      platform: "claude",
      workspace_root: root,
      prompt: "fix the failing tests in these 6 files: a.ts b.ts c.ts d.ts e.ts f.ts",
    });
    // The dispatcher-internal exit is EXIT_WARN (2) so `host_semantics.emitFor`
    // forwards `additional_context` on the verified `claude` platform — see
    // the hook's file-header proof. This raw tsx spawn bypasses the
    // dispatcher, so the process exit IS the dispatcher-internal code (2),
    // never the host-facing translated code (0).
    expect(status).toBe(2);
    const parsed = JSON.parse(stdout.trim()) as {
      decision: string;
      additional_context: string;
      reason: string;
    };
    expect(parsed.decision).toBe("warn");
    expect(parsed.additional_context).toContain("do-in-parallel");
    expect(parsed.additional_context).toContain("6 slices");
    expect(parsed.additional_context).toContain("lite tier");
    expect(parsed.reason).toContain("delegation-nudge");
  });

  it("(b) an ordinary prompt injects nothing", () => {
    const root = makeWorkspace(null);
    const { stdout, status } = run({
      event: "user_prompt_submit",
      platform: "claude",
      workspace_root: root,
      prompt: "why does X happen?",
    });
    expect(status).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  it("F7 (negative test): a 2-file rename prompt injects nothing", () => {
    const root = makeWorkspace(null);
    const { stdout, status } = run({
      event: "user_prompt_submit",
      platform: "claude",
      workspace_root: root,
      prompt: "rename a.ts to b.ts",
    });
    expect(status).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  it("rung-1 size-floor regression (negative test): 'review this diff' injects nothing", () => {
    const root = makeWorkspace(null);
    const { stdout, status } = run({
      event: "user_prompt_submit",
      platform: "claude",
      workspace_root: root,
      prompt: "review this diff",
    });
    expect(status).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  it("a malformed stdin envelope degrades to silence, never a crash (companion to (c))", () => {
    const { stdout, status } = run("{not valid json");
    expect(status).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  it("(d) activation gate closed (unrecognised host) → silence", () => {
    const root = makeWorkspace(null);
    const { stdout, status } = run({
      event: "user_prompt_submit",
      platform: "some-unrecognised-host",
      workspace_root: root,
      prompt: "fix the failing tests in these 6 files: a.ts b.ts c.ts d.ts e.ts f.ts",
    });
    expect(status).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  it("a session_start envelope is a no-op (this concern only reads user_prompt_submit)", () => {
    const root = makeWorkspace(null);
    const { stdout, status } = run({
      event: "session_start",
      platform: "claude",
      workspace_root: root,
      prompt: "fix the failing tests in these 6 files: a.ts b.ts c.ts d.ts e.ts f.ts",
    });
    expect(status).toBe(0);
    expect(stdout.trim()).toBe("");
  });
});
