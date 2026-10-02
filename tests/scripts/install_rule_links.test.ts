/**
 * Every link inside an installed rule resolves from the directory the install
 * writes it to (`road-to-rule-triggers-and-links-that-hold` step 1.2).
 *
 * The rule bodies are authored against the package tree, where every sibling
 * directory is present. The installer copies a subset. Nothing joined the two,
 * so a rule could ship a link into a directory no consumer has — and did, 137
 * times before this file existed.
 */
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  type DeployPlan,
  auditInstalledRuleLinks,
  auditLink,
  deployPlanFrom,
  relativeLinkTargets,
  rewriteOptionCost,
} from "../../src/install/installedRuleLinks.js";
import { GLOBAL_DEPLOY_SOURCES } from "../../src/scripts/install.js";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

/** Hosts whose deploy plan carries a rules directory — every one is audited. */
const RULE_HOSTS = Object.entries(GLOBAL_DEPLOY_SOURCES).filter(([, pairs]) =>
  pairs.some(([source]) => source.endsWith("/rules")),
);

describe("relativeLinkTargets", () => {
  it("keeps tree paths and drops what is not one", () => {
    const md = [
      "See [a](../guidelines/x.md) and [b](./y.md#frag).",
      "Not [c](https://example.com/z), not [d](#anchor), not [e](/abs/p).",
    ].join("\n");
    expect(relativeLinkTargets(md)).toEqual([
      "../guidelines/x.md",
      "./y.md#frag",
    ]);
  });
});

describe("auditLink — the verdict names what to do about it", () => {
  const plan: DeployPlan = deployPlanFrom([
    ["dist/agent-src/rules", "rules"],
    ["dist/agent-src/skills", "skills"],
  ]);

  it("resolves a link into a deployed directory that holds the file", () => {
    const a = auditLink("r", "../skills/docker/SKILL.md", "rules", plan, REPO_ROOT);
    expect(a.verdict).toBe("resolved");
    expect(a.resolved_to).toBe("skills/docker/SKILL.md");
  });

  it("names a directory the plan does not write", () => {
    const a = auditLink("r", "../guidelines/x.md", "rules", plan, REPO_ROOT);
    expect(a.verdict).toBe("directory-not-deployed");
    expect(a.resolved_to).toBe("guidelines/x.md");
  });

  it("names a link that climbs out of the install root", () => {
    const a = auditLink("r", "../../LEGAL_NOTICE.md", "rules", plan, REPO_ROOT);
    expect(a.verdict).toBe("outside-install-root");
    expect(a.resolved_to).toBeNull();
  });

  it("separates a missing file from a missing directory", () => {
    const a = auditLink("r", "../skills/no-such-skill/SKILL.md", "rules", plan, REPO_ROOT);
    expect(a.verdict).toBe("file-missing");
  });

  it("drops the anchor before resolving", () => {
    const a = auditLink("r", "../skills/docker/SKILL.md#gotchas", "rules", plan, REPO_ROOT);
    expect(a.verdict).toBe("resolved");
  });
});

describe("rewriteOptionCost — the measurement behind the 1.2 decision", () => {
  it("charges the absolute prefix minus the climb it replaces", () => {
    const report = {
      audits: [
        { rule: "r", target: "../guidelines/x.md", resolved_to: "guidelines/x.md", verdict: "directory-not-deployed" as const },
        { rule: "r", target: "../../LEGAL_NOTICE.md", resolved_to: null, verdict: "outside-install-root" as const },
        { rule: "r", target: "../skills/a/SKILL.md", resolved_to: "skills/a/SKILL.md", verdict: "resolved" as const },
      ],
      counts: { resolved: 1, "outside-install-root": 1, "directory-not-deployed": 1, "file-missing": 0 },
      by_directory: [],
    };
    // 40-char prefix: (40 + 1 - 3) + (40 + 1 - 6) = 38 + 35 = 73. The resolved
    // link is not rewritten and costs nothing.
    expect(rewriteOptionCost(report, 40)).toBe(73);
  });
});

/**
 * Unresolved links a host still ships, as a shrink-only ratchet.
 *
 * Measured 2026-10-02 after step 1.2 added `contexts/` and `guidelines/` to the
 * plans below; `claude-code` went 160 -> 47. What is left is NOT more of the
 * same defect, and the distinction is why this is a ratchet rather than a zero:
 *
 *   · **22 into `docs/`** — `dist/agent-src/` carries no `docs/` at all, by a
 *     decision several rules state in their own text ("`docs/contracts/` is
 *     unprojected ... maintainer-reachable only"). Deploying cannot fix a
 *     directory the projection does not produce.
 *   · **23 climbing out of the install root** — `../../tests/`, `../../src/`,
 *     `agents/settings/policies/`. These name the repository, not the package;
 *     no install has ever held them.
 *   · **2 one-off targets** — `scripts/hooks/evidence_independence.ts`, which
 *     is not in the projection either, and one file under `templates/`, whose
 *     directory is 1.7 MB for a single link.
 *
 * Closing those is an authoring change in rule prose (make them code spans),
 * not an install change, and this roadmap's step 1.2 is explicitly the install
 * half. The numbers stand here so the next person sees the remainder rather
 * than inheriting a green test over it.
 *
 * `cline` is the outlier at 550: it installs rules at the install ROOT, so
 * every `../x` link climbs out by construction. That is a layout decision, not
 * a missing directory.
 */
const UNRESOLVED_BASELINE: Record<string, number> = {
  "claude-code": 47,
  augment: 46,
  cursor: 147,
  windsurf: 160,
  cline: 550,
  "gemini-cli": 47,
  codex: 47,
  continue: 47,
  roocode: 47,
  kilocode: 47,
  qoder: 47,
  opencode: 47,
  trae: 47,
  antigravity: 47,
  codebuddy: 47,
  droid: 47,
  warp: 47,
  kiro: 160,
};

describe("the real install plan", () => {
  it("writes a rules directory for at least one host", () => {
    expect(RULE_HOSTS.length).toBeGreaterThan(0);
  });

  it("every rules-carrying host has a baseline, and every baseline a host", () => {
    expect(RULE_HOSTS.map(([h]) => h).sort()).toEqual(
      Object.keys(UNRESOLVED_BASELINE).sort(),
    );
  });

  for (const [host, pairs] of RULE_HOSTS) {
    it(`${host}: unresolved rule links do not grow`, () => {
      const report = auditInstalledRuleLinks(deployPlanFrom(pairs), REPO_ROOT);
      const unresolved = report.audits.length - report.counts.resolved;
      // The grouped list is the actionable part of a failure: which directory,
      // how many, and which verdict.
      expect(
        unresolved,
        `${host}: ${JSON.stringify(report.by_directory)}`,
      ).toBeLessThanOrEqual(UNRESOLVED_BASELINE[host] as number);
    });
  }

  it("no host that installs a rules directory links into an undeployed contexts/ or guidelines/", () => {
    // This is the repair step 1.2 actually shipped, pinned so it cannot be
    // undone by an edit to the deploy plan. `cline` is excluded on its own
    // terms: its rules live at the install root, so its links climb OUT of the
    // tree (`outside-install-root`) rather than into an undeployed directory,
    // and no entry in its plan could change that.
    for (const [host, pairs] of RULE_HOSTS) {
      const report = auditInstalledRuleLinks(deployPlanFrom(pairs), REPO_ROOT);
      const offenders = report.by_directory.filter(
        (d) =>
          d.verdict === "directory-not-deployed" &&
          (d.directory === "contexts" || d.directory === "guidelines"),
      );
      expect(offenders, `${host} still links into an undeployed directory`).toEqual([]);
    }
  });
});
