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

describe("auditLink — rules installed at the install ROOT", () => {
  // `cline` maps rules to `''`. A sibling link then has no directory segment
  // at all, so a first-segment lookup reads the FILE NAME as a directory and
  // calls a file the install writes right beside the rule undeployed.
  const rootPlan: DeployPlan = deployPlanFrom([["dist/agent-src/rules", ""]]);

  it("resolves a sibling link to the rule beside it", () => {
    const a = auditLink("r", "scope-control.md", "", rootPlan, REPO_ROOT);
    expect(a.verdict).toBe("resolved");
    expect(a.resolved_to).toBe("scope-control.md");
  });

  it("resolves an explicit ./ sibling the same way", () => {
    const a = auditLink("r", "./scope-control.md", "", rootPlan, REPO_ROOT);
    expect(a.verdict).toBe("resolved");
  });

  it("still names a sibling that is not there", () => {
    const a = auditLink("r", "no-such-rule.md", "", rootPlan, REPO_ROOT);
    expect(a.verdict).toBe("file-missing");
  });

  it("still names a link that climbs out of the root", () => {
    const a = auditLink("r", "../guidelines/x.md", "", rootPlan, REPO_ROOT);
    expect(a.verdict).toBe("outside-install-root");
  });

  it("prefers a named directory over the root when the plan has both", () => {
    // A plan that deploys rules at the root AND skills under `skills/` must
    // still read `skills/docker/SKILL.md` as the skills directory, not as a
    // path inside the rules source.
    const both: DeployPlan = deployPlanFrom([
      ["dist/agent-src/rules", ""],
      ["dist/agent-src/skills", "skills"],
    ]);
    const a = auditLink("r", "skills/docker/SKILL.md", "", both, REPO_ROOT);
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
 * Unresolved links a host ships today, as a shrink-only ratchet.
 *
 * Measured 2026-10-02 by `report_installed_rule_links`. These are the numbers
 * BEFORE the repair, and they stay that way on purpose: the repair that would
 * take `claude-code` from 160 to 47 is adding `contexts/` and `guidelines/` to
 * the deploy plan, and that plan is part of the frozen install ABI
 * (`docs/contracts/install-layout.md`), so changing it owes an
 * `install_layout_version` bump and a deprecation window. That is an owner
 * decision, held as the `rule-link-targets-change-the-frozen-install-abi`
 * blocker on `road-to-rule-triggers-and-links-that-hold`.
 *
 * What the 160 is made of, because the parts have different answers:
 *
 *   · **113 into `contexts/` and `guidelines/`** — the deployable ones, the
 *     blocker's subject.
 *   · **22 into `docs/`** — `dist/agent-src/` carries no `docs/` at all, by a
 *     decision several rules state in their own text ("`docs/contracts/` is
 *     unprojected ... maintainer-reachable only"). Deploying cannot fix a
 *     directory the projection does not produce.
 *   · **23 climbing out of the install root** — `../../tests/`, `../../src/`,
 *     `agents/settings/policies/`. These name the repository, not the package;
 *     no install has ever held them.
 *   · **2 one-off targets** — `scripts/hooks/evidence_independence.ts`, which
 *     is not in the projection either, and one file under `templates/`.
 *
 * `cline` is the outlier at 273 because it installs rules at the install ROOT,
 * so a `../x` link climbs out of the tree by construction — a layout decision,
 * not a missing directory. Its other 277 links are siblings and resolve; an
 * earlier version of this file read them as undeployed and pinned cline at 550,
 * which is the maximum possible value and could never have caught a regression.
 */
const UNRESOLVED_BASELINE: Record<string, number> = {
  "claude-code": 160,
  augment: 97,
  cursor: 260,
  windsurf: 273,
  cline: 273,
  "gemini-cli": 160,
  codex: 160,
  continue: 160,
  roocode: 160,
  kilocode: 160,
  qoder: 160,
  opencode: 160,
  trae: 160,
  antigravity: 160,
  codebuddy: 160,
  droid: 160,
  warp: 160,
  kiro: 273,
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

  it("the deployable share of claude-code's unresolved links is exactly the blocker's subject", () => {
    // 112 of the 158 would resolve by adding two directories to the deploy
    // plan; the other 46 would not, and that split is what the blocker's
    // recommendation rests on. Pinned so a future reader can tell the two
    // populations apart without re-deriving them — and so the blocker cannot
    // quietly stop describing the tree.
    //
    // Was 113 of 160 when this was first measured on 2026-10-02. The one that
    // left is a `docs/guidelines/design-fidelity-routing.md` link in
    // `design-fidelity.md`: road-to-rule-laws-that-can-stand step 1.4 moved
    // that rule's enforcement history out of the body and into a context, and
    // the link went with the prose. The pin moves DOWN with the tree — a
    // smaller deployable share is the blocker's subject shrinking, never the
    // ratchet loosening, and `UNRESOLVED_BASELINE` is untouched at 160.
    const pairs = GLOBAL_DEPLOY_SOURCES["claude-code"];
    expect(pairs).toBeDefined();
    const report = auditInstalledRuleLinks(deployPlanFrom(pairs!), REPO_ROOT);
    const deployable = report.by_directory.filter(
      (d) => d.directory === "contexts" || d.directory === "guidelines",
    );
    expect(deployable.map((d) => [d.directory, d.count, d.verdict])).toEqual([
      ["contexts", 62, "directory-not-deployed"],
      ["guidelines", 50, "directory-not-deployed"],
    ]);
  });

  it("cline's sibling links resolve — its unresolved share is the climb, not the siblings", () => {
    // The whole reason `auditLink` reads the plan's `''` key: cline installs
    // rules at the install root, so a sibling link has no directory segment.
    // Counting those as undeployed pinned cline at its maximum, where no
    // regression could ever move it.
    const pairs = GLOBAL_DEPLOY_SOURCES["cline"];
    expect(pairs).toBeDefined();
    const report = auditInstalledRuleLinks(deployPlanFrom(pairs!), REPO_ROOT);
    expect(report.counts.resolved).toBeGreaterThan(250);
    expect(report.counts["directory-not-deployed"]).toBe(0);
    expect(report.counts["outside-install-root"]).toBe(
      report.audits.length - report.counts.resolved,
    );
  });
});
