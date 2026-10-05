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
 * Re-measured 2026-10-06 by `report_installed_rule_links`, DOWN from the
 * 136 / 73 / 235 / 248 pinned on 2026-10-03, which were themselves down from
 * the 160 / 97 / 260 / 273 first pinned on 2026-10-02.
 *
 * The repair that moved them this time is the `docs/` group: 21 links into
 * `../docs/contracts/` across 16 non-kernel rules are now code spans naming
 * the same path. `docs/` is produced by no projection and resolves on NONE of
 * the 18 host rows, so unlike the `templates/` case below there was no working
 * link to lose — and the arithmetic says so rather than the intent: total
 * links 523 → 502 (−21) while `resolved` stayed at 387 on every host. A repair
 * that moved `resolved` would have been the templates mistake happening again.
 *
 * The decision to repair rather than keep holding them was routed to the AI
 * council on 2026-10-06 (degraded, 1 of 2 seats — the second failed on API
 * credit, not on judgement) and is recorded as D7 on
 * `road-to-rule-triggers-and-links-that-hold`. It is REVERSIBLE on purpose: if
 * `docs/contracts/` is ever projected, each code span becomes a link again by
 * the same mechanical edit that produced it, so the owner's option is intact.
 *
 * The earlier 2026-10-03 repair was the repo-tree link form: 22 links that
 * named a path no install has ever held — `../../scripts/`,
 * `../../src/scripts/`, `../../../LEGAL_NOTICE.md`, `../../docs/`,
 * `agents/settings/policies/media/` — became code spans carrying the path the
 * repository actually has. FIVE of them resolved nowhere in the repository
 * either: three `scripts/*.ts` naming files that live under `src/scripts/`,
 * and `../../../LEGAL_NOTICE.md` twice, which climbs above the repository
 * root. Those were dead in both trees.
 *
 * One link that LOOKS like the same defect is deliberately untouched, and it
 * is the one an independent review caught being repaired: the `templates/`
 * link in `ui-audit-gate.md`. `GLOBAL_DEPLOY_SOURCES.augment` maps
 * `dist/agent-src/templates` → `templates` beside `rules`, so from an
 * installed augment rule that link RESOLVES. Turning it into a code span
 * traded a working link for a dead repo path, which no gate here can see —
 * this ratchet bounds unresolved links, and nothing bounds RESOLVED links from
 * shrinking. Before repairing a link that reads as repo-tree, check whether
 * some host's deploy plan already carries its first segment.
 *
 * The count is structural, not filesystem-dependent: every unresolved link
 * here is `directory-not-deployed` or `outside-install-root`, verdicts decided
 * from the deploy plan alone, and `file-missing` is 0. A worktree and CI read
 * the same number. That is what allows the baseline to sit at the exact
 * reading rather than above it — and the consequence is worth naming: there is
 * now ZERO headroom, so one ordinary new `](../contexts/…)` or
 * `](../guidelines/…)` link in any rule reds all 18 host rows at once. That is
 * the ratchet working, not a misconfiguration, and the fix is to re-measure
 * and state what the link buys, never to add slack back.
 *
 * What `claude-code`'s 115 is made of, because the parts have different answers:
 *
 *   · **112 into `contexts/` and `guidelines/`** — the deployable ones. The
 *     repair is adding two rows to the deploy plan, which is part of the frozen
 *     install ABI (`docs/contracts/install-layout.md`), so it owes an
 *     `install_layout_version` bump and a deprecation window. That is an owner
 *     decision, held as the `rule-link-targets-change-the-frozen-install-abi`
 *     blocker on `road-to-rule-triggers-and-links-that-hold`.
 *   · **1 into `docs/`** — was 22; 21 became code spans on 2026-10-06 (above).
 *     `dist/agent-src/` carries no `docs/` at all, by a decision several rules
 *     state in their own text ("`docs/contracts/` is unprojected ...
 *     maintainer-reachable only"), so deploying cannot fix a directory the
 *     projection does not produce. The ONE that stays is in
 *     `ask-when-uncertain.md`, and it stays for the same reason as the
 *     climb-out below and for no reason about the link: `ask-when-uncertain`
 *     is a kernel rule, so its edit ships in its own PR with a 24 h soak.
 *     Those two links are now the whole kernel-held remainder and should ride
 *     the same kernel PR.
 *   · **1 climbing out of the install root** — the `../../tests/golden/`
 *     fixture link in `direct-answers.md`. It is the same defect as the 22
 *     repo-tree links repaired on 2026-10-03 and is left alone for one reason
 *     only: `direct-answers` is
 *     a kernel rule, and a kernel-rule edit ships in its own PR with a 24 h
 *     soak (`scope-control` § Kernel-rule edits). One link does not justify
 *     spending that window; the next kernel PR can carry it.
 *   · **1 into `templates/`** — the augment-resolving link above. It is
 *     unresolved for this host and for every other host that does not deploy
 *     `templates/`, and the honest repair is a deploy row, not a code span:
 *     1.7 MB for one link, against 1.6 MB for the 112 the ABI blocker covers.
 *
 * `cline` is the outlier at 227 because it installs rules at the install ROOT,
 * so a `../x` link climbs out of the tree by construction — a layout decision,
 * not a missing directory. Its other 275 links are siblings and resolve; an
 * earlier version of this file read them as undeployed and pinned cline at 550,
 * which is the maximum possible value and could never have caught a regression.
 */
const UNRESOLVED_BASELINE: Record<string, number> = {
  "claude-code": 115,
  augment: 52,
  cursor: 214,
  windsurf: 227,
  cline: 227,
  "gemini-cli": 115,
  codex: 115,
  continue: 115,
  roocode: 115,
  kilocode: 115,
  qoder: 115,
  opencode: 115,
  trae: 115,
  antigravity: 115,
  codebuddy: 115,
  droid: 115,
  warp: 115,
  kiro: 227,
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
    // 112 of the 115 would resolve by adding two directories to the deploy
    // plan; the other 3 would not, and that split is what the blocker's
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

  it("the remainder is the two populations a deploy entry cannot reach", () => {
    // The other half of the split above, pinned in the same way and for the
    // same reason. 22 repo-tree links left this set on 2026-10-03 and 21
    // `docs/` links left it on 2026-10-06; what stays is THREE links, and two
    // of the three are held by the same thing — a kernel rule's own-PR-plus-
    // soak window, not anything about the link itself: ONE `docs/` link in
    // `ask-when-uncertain.md` and ONE climb-out in `direct-answers.md`. The
    // third is the `templates/` link that already resolves on augment and must
    // not be "repaired" into a code span. A new `scripts` row, or a second
    // `outside-install-root` row, is a rule author reaching for a path form
    // the install has never held — which is exactly the direction this pin
    // exists to refuse. The `templates` row is pinned at 1 in BOTH directions:
    // it may not grow, and it may not silently disappear either, because the
    // way it disappears is by destroying a link augment resolves.
    const pairs = GLOBAL_DEPLOY_SOURCES["claude-code"];
    expect(pairs).toBeDefined();
    const report = auditInstalledRuleLinks(deployPlanFrom(pairs!), REPO_ROOT);
    const remainder = report.by_directory.filter(
      (d) => d.directory !== "contexts" && d.directory !== "guidelines",
    );
    expect(remainder.map((d) => [d.directory, d.count, d.verdict])).toEqual([
      ["../../tests/golden/outcomes/", 1, "outside-install-root"],
      ["docs", 1, "directory-not-deployed"],
      ["templates", 1, "directory-not-deployed"],
    ]);
  });

  it("augment resolves the templates link the other hosts cannot", () => {
    // The regression an independent review caught on 2026-10-03, pinned so it
    // cannot be made twice. `ui-audit-gate.md` links into `../templates/`, and
    // augment is the one rules-carrying host whose deploy plan writes that
    // directory beside `rules/`. For every OTHER host the same link is
    // unresolved — which is what makes it look like a repo-tree link form and
    // is why it was briefly turned into a code span.
    const pairs = GLOBAL_DEPLOY_SOURCES["augment"];
    expect(pairs).toBeDefined();
    const report = auditInstalledRuleLinks(deployPlanFrom(pairs!), REPO_ROOT);
    const templatesLink = report.audits.find(
      (a) => a.rule === "ui-audit-gate" && a.target.startsWith("../templates/"),
    );
    expect(templatesLink, "ui-audit-gate no longer links into ../templates/").toBeDefined();
    expect(templatesLink!.verdict).toBe("resolved");
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
