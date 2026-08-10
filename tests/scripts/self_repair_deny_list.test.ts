// Tests for the self-repair may-not-modify deny-list
// (road-to-feedback-9-29 Phase 4.4).
//
// The loop that fixes the agent's own defects must not become a channel through
// which the agent loosens the floors it is bound by. Detection stays untouched;
// for a record aimed at a denied surface the PATCH/PR path refuses with a named
// reason and egress degrades to report-only — an issue still ships, so the
// defect is never silently dropped.
//
// The kernel set is asserted against `kernel_rules.ts`, the same canonical
// source `block_kernel_rule_writes` resolves from, so a governance change to
// membership cannot leave a hardcoded copy here behind.
import { describe, expect, it } from "vitest";

import { KERNEL_RULE_IDS } from "../../src/scripts/_lib/kernel_rules.js";
import {
  type DefectRecord,
  patchDeniedReason,
  patchDeniedSurface,
} from "../../src/scripts/_lib/self_repair.js";
import {
  type Probe,
  planRelease,
  readClassCKeys,
} from "../../src/scripts/self_repair_cli.js";

const NOW = "2026-08-10T00:00:00.000Z";

function record(suggested_surface: string, evidence = "observed once"): DefectRecord {
  return {
    defect_class: "user-reported",
    source: "user-reported",
    evidence,
    suggested_surface,
    fingerprint: "deadbeefdeadbeef",
    first_seen: NOW,
    last_seen: NOW,
    occurrences: 1,
    status: "open",
  };
}

/** Full capability — upstream push rights, so the PR path is the one on offer. */
function fullProbe(): Probe {
  return {
    agentConfigCheckout: "/checkout",
    ghAuthenticated: true,
    canPushUpstream: true,
    canFork: true,
  };
}

describe("self-repair deny-list — which surfaces refuse a patch", () => {
  it("denies every kernel rule, resolved from the canonical set", () => {
    for (const id of KERNEL_RULE_IDS) {
      const d = patchDeniedSurface(record(`Tighten src/rules/${id}.md so the gate binds.`));
      expect(d?.surface, id).toBe("kernel-rule");
    }
  });

  it("denies a kernel rule named as a bare id, not only as a path", () => {
    expect(patchDeniedSurface(record("The commit-policy rule did not reach the decision."))?.surface).toBe(
      "kernel-rule",
    );
  });

  it("denies a trust/safety floor rule", () => {
    expect(
      patchDeniedSurface(record("Extend src/rules/engineering-safety-floor.md with the missing trigger."))
        ?.surface,
    ).toBe("safety-floor-rule");
  });

  it("denies a CI enforcement file", () => {
    expect(
      patchDeniedSurface(record("Add the step to .github/workflows/ci.yml so the gate runs."))?.surface,
    ).toBe("ci-enforcement");
  });

  // A workflow file is not the surface through which a gate is armed in this
  // repo — a new gate is registered in the taskfiles the workflow calls, and a
  // tool-call-time guard is bound in the hook manifest. All of these were
  // ALLOWED while only `.github/workflows/` was denied.
  it.each([
    ["taskfiles/ci-fast.yml", "Register the gate in taskfiles/ci-fast.yml."],
    ["Taskfile.yml", "Add the gate to Taskfile.yml so `task ci` runs it."],
    ["hook manifest", "Unbind the concern in src/scripts/hook_manifest.yaml."],
    ["a guard implementation", "Relax src/scripts/hooks/block_no_verify.ts."],
    ["a check_ gate script", "Raise the threshold in src/scripts/check_enforcement_coverage.ts."],
    ["a lint_ gate script", "Narrow the scan root in src/scripts/lint_persistence.ts."],
  ])("denies the surface that actually arms enforcement: %s", (_label, surface) => {
    expect(patchDeniedSurface(record(surface))?.surface).toBe("ci-enforcement");
  });

  it("still allows a non-gate script under src/scripts", () => {
    // The deny-list is the enforcement layer, not all of `src/scripts` — that
    // would refuse nearly every legitimate repair this loop exists to file.
    expect(patchDeniedSurface(record("Fix the renderer in src/scripts/routing_doctor.ts."))).toBeNull();
    expect(patchDeniedSurface(record("Extend src/scripts/_lib/kernel_rules.ts docs."))).toBeNull();
  });

  // `suggested_surface` is free-text the agent writes, and this repo's prose is
  // saturated with `**bold**` paths — so ordinary markdown decoration used to
  // walk a denied surface straight past the tokenizer.
  it.each([
    ["**bold** path", "Loosen **src/rules/scope-control.md** so the gate binds.", "kernel-rule"],
    ["**bold** bare id", "The **scope-control** rule is too strict.", "kernel-rule"],
    ["*italic* bare id", "The *commit-policy* rule blocked me.", "kernel-rule"],
    ["<autolink> path", "Loosen <src/rules/scope-control.md> please.", "kernel-rule"],
    ["~~strikethrough~~ id", "The ~~commit-policy~~ rule blocked me.", "kernel-rule"],
    ["__underscore__ path", "Loosen __src/rules/scope-control.md__ please.", "kernel-rule"],
    ["| table cell | id", "Row: |commit-policy| too strict.", "kernel-rule"],
    ["**bold** safety floor", "Fix **src/rules/engineering-safety-floor.md** trigger.", "safety-floor-rule"],
    ["**bold** workflow", "Add the step to **.github/workflows/ci.yml**.", "ci-enforcement"],
    ["**bold** taskfile", "Register it in **taskfiles/ci-fast.yml**.", "ci-enforcement"],
  ])("markdown decoration cannot smuggle a denied surface past the scan: %s", (_label, surface, expected) => {
    expect(patchDeniedSurface(record(surface))?.surface).toBe(expected);
  });

  it("markdown decoration cannot hide a class-C settings key either", () => {
    const classCKeys = new Set(["worktrees.mode"]);
    expect(
      patchDeniedSurface(record("Flip **worktrees.mode** so the prompt stops."), { classCKeys })?.surface,
    ).toBe("settings-class-c");
  });

  it("decoration stripping does not start denying ordinary surfaces", () => {
    expect(patchDeniedSurface(record("Add the trigger to **src/rules/icon-consistency.md**."))).toBeNull();
    expect(patchDeniedSurface(record("Extend **src/skills/design-review/SKILL.md** § Phase 3."))).toBeNull();
  });

  it("denies self-repair's own policy and code", () => {
    expect(patchDeniedSurface(record("Fix src/rules/self-repair-loop.md."))?.surface).toBe(
      "self-repair-policy",
    );
    expect(patchDeniedSurface(record("Widen src/scripts/_lib/self_repair.ts detection."))?.surface).toBe(
      "self-repair-policy",
    );
  });

  it("denies the settings-class contract itself, with or without a parsed key set", () => {
    const r = record("Reclassify the key in docs/contracts/settings-classes.md.");
    expect(patchDeniedSurface(r)?.surface).toBe("settings-class-c");
    expect(patchDeniedSurface(r, { classCKeys: null })?.surface).toBe("settings-class-c");
  });

  it("denies a class-C settings key, and a child of a class-C ancestor", () => {
    const classCKeys = new Set(["worktrees.mode", "decision_engine"]);
    expect(
      patchDeniedSurface(record("Flip worktrees.mode so the prompt stops."), { classCKeys })?.surface,
    ).toBe("settings-class-c");
    expect(
      patchDeniedSurface(record("Set decision_engine.on_block to skip."), { classCKeys })?.surface,
    ).toBe("settings-class-c");
  });

  it("allows an ordinary surface — a non-kernel rule, a skill, a doc", () => {
    expect(patchDeniedSurface(record("Add the missing trigger to src/rules/icon-consistency.md."))).toBeNull();
    expect(patchDeniedSurface(record("Extend src/skills/design-review/SKILL.md § Phase 3."))).toBeNull();
    expect(patchDeniedSurface(record("Correct the example in docs/guidelines/code-clarity.md."))).toBeNull();
  });

  it("does not deny a kernel-NAMED file outside a settings or rules context by accident", () => {
    // A dotted key shape only matches when a class-C set is supplied — with no
    // contract read, an ordinary dotted identifier stays allowed rather than
    // being denied on shape alone.
    expect(patchDeniedSurface(record("Rename foo.bar in the helper."), { classCKeys: null })).toBeNull();
  });

  it("names the surface and the matched token in the refusal reason", () => {
    const reason = patchDeniedReason(record("Loosen src/rules/scope-control.md."));
    expect(reason).toContain("kernel-rule");
    expect(reason).toContain("scope-control");
    expect(reason).toContain("report-only");
    expect(patchDeniedReason(record("Fix src/rules/icon-consistency.md."))).toBeNull();
  });
});

describe("self-repair deny-list — the egress seam", () => {
  it("refuses the patch path for a kernel-rule target and degrades to report-only", () => {
    const plan = planRelease(record("Loosen src/rules/commit-policy.md."), fullProbe(), "/tmp");
    expect(plan.patch_denied).not.toBeNull();
    expect(plan.route).toBe("issue");
    expect(plan.pushVia).toBeNull();
    // The body must describe the rung actually taken, not the refused one.
    expect(plan.body).toContain("**Route:** issue");
  });

  it("allows the patch path for a normal target with the same capability", () => {
    const plan = planRelease(record("Add the missing trigger to src/rules/icon-consistency.md."), fullProbe(), "/tmp");
    expect(plan.patch_denied).toBeNull();
    expect(plan.route).toBe("pull-request");
    expect(plan.pushVia).toBe("upstream");
  });

  it("refuses the patch path for a class-C settings key when the contract is readable", () => {
    const plan = planRelease(record("Set worktrees.mode to always so the prompt stops."), fullProbe(), "/tmp", {
      classCKeys: new Set(["worktrees.mode"]),
    });
    expect(plan.patch_denied).toContain("settings-class-c");
    expect(plan.route).toBe("issue");
  });

  it("the privacy floor still wins — a refused record stays local, patch-denial is not consulted", () => {
    const plan = planRelease(
      record("Add the trigger to src/rules/icon-consistency.md.", "reach me at real.person@example-corp.de"),
      fullProbe(),
      "/tmp",
    );
    expect(plan.blocked).not.toBeNull();
    expect(plan.route).toBe("local-only");
    expect(plan.patch_denied).toBeNull();
  });

  it("reads the class-C key set off the real contract in this checkout", () => {
    const keys = readClassCKeys(process.cwd());
    expect(keys).not.toBeNull();
    expect(keys!.size).toBeGreaterThan(0);
  });

  it("returns null for the class-C key set when there is no checkout — static matches still apply", () => {
    expect(readClassCKeys(null)).toBeNull();
    expect(
      planRelease(record("Loosen src/rules/commit-policy.md."), fullProbe(), "/tmp", {
        classCKeys: readClassCKeys(null),
      }).patch_denied,
    ).not.toBeNull();
  });
});
