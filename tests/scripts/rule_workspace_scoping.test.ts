/**
 * CI guard for consumer-scoped rule projection
 * (road-to-request-scoped-rule-load Phase 1).
 *
 * Consumer-shaped scope (`[engineering]`) must exclude every
 * exclusively-maintainer rule and keep the kernel + all consumer-relevant
 * rules; the maintainer/default (no scope) must keep all rules. Runs against
 * the REAL dist/agent-src/rules tree + dist/router.json so tag drift is
 * caught, not fixtured away.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { rule_in_scope } from "../../src/scripts/condense.js";
import {
  build_thin,
  id_in_scope,
  kernel_ids,
  rule_workspaces_map,
  RULES_SOURCE,
} from "../../src/scripts/project_thin_rules.js";

// The audited exclusively-maintainer set (2026-07-07 misclassification
// audit — agents/settings/contexts/consumer-scoping-audit-2026-07-07.md).
const MAINTAINER_ONLY = [
  "augment-edit-discipline",
  "domain-adoption-policy",
  "framework-neutrality-in-generic-skills",
  "low-impact-corpus-privacy-floor",
  "no-roadmap-references",
  "package-ci-checks",
  "persona-governance",
  "preservation-guard",
  "rule-type-governance",
  "size-enforcement",
  "skill-quality",
  "source-confidentiality",
  "source-of-truth",
  "telegraph-speak",
  "token-budget-discipline",
  "token-optimizer-maintenance",
];

const CONSUMER_SCOPE = ["engineering"];

function allRuleFiles(): string[] {
  return fs
    .readdirSync(RULES_SOURCE)
    .filter((n) => n.endsWith(".md"))
    .map((n) => path.join(RULES_SOURCE, n));
}

describe("consumer-shaped scope (engineering) — projector filter", () => {
  it("excludes every exclusively-maintainer rule", () => {
    const leaked = MAINTAINER_ONLY.filter((id) => {
      const p = path.join(RULES_SOURCE, `${id}.md`);
      return fs.existsSync(p) && rule_in_scope(p, CONSUMER_SCOPE);
    });
    expect(leaked).toEqual([]);
  });

  it("keeps kernel rules regardless of their tags", () => {
    for (const id of kernel_ids()) {
      const p = path.join(RULES_SOURCE, `${id}.md`);
      if (!fs.existsSync(p)) continue;
      expect(rule_in_scope(p, CONSUMER_SCOPE), id).toBe(true);
    }
  });

  it("keeps audited consumer-relevant rules (spot set incl. reclassified)", () => {
    for (const id of [
      "user-interaction",
      "context-hygiene",
      "token-efficiency",
      "architecture",
      "ui-audit-gate",
      "commit-policy",
      "non-destructive-by-default",
      "domain-safety-disclaimer",
    ]) {
      const p = path.join(RULES_SOURCE, `${id}.md`);
      expect(fs.existsSync(p), id).toBe(true);
      expect(rule_in_scope(p, CONSUMER_SCOPE), id).toBe(true);
    }
  });

  it("maintainer/default scope (null) keeps ALL rules", () => {
    for (const p of allRuleFiles()) {
      expect(rule_in_scope(p, null), p).toBe(true);
    }
  });
});

describe("pack scope — frontend-design deselection (Phase 3 e2e)", () => {
  // All pack ids except frontend-design → deselecting the pack.
  const NO_FRONTEND = [
    "engineering-base",
    "meta",
    "brand",
    "ai-image",
    "ai-video",
    "finance-basic",
    "founder-strategy",
    "legal-review-prep",
    "small-business",
  ];

  it("drops ui-audit-gate, keeps engineering-base rules", () => {
    // `ui-audit-gate` is frontend-design-only: it gates component creation
    // against an audit inventory that the design pack supplies.
    const gate = path.join(RULES_SOURCE, "ui-audit-gate.md");
    expect(rule_in_scope(gate, null, NO_FRONTEND), "ui-audit-gate").toBe(false);

    for (const id of ["commit-policy", "architecture", "downstream-changes"]) {
      const p = path.join(RULES_SOURCE, `${id}.md`);
      expect(rule_in_scope(p, null, NO_FRONTEND), id).toBe(true);
    }
  });

  it("KEEPS design-fidelity without the frontend-design pack", () => {
    // Deliberate change: `design-fidelity` is framework-neutral discipline —
    // honour a provided design, never swap fonts/controls/layout unconfirmed —
    // with no dependency on the design corpus. Gating it behind
    // `frontend-design` meant a consumer who installed only `laravel` or only
    // `react` never loaded it, which was the defect, not the design.
    const p = path.join(RULES_SOURCE, "design-fidelity.md");
    expect(rule_in_scope(p, null, NO_FRONTEND), "design-fidelity").toBe(true);
  });

  it("selecting frontend-design keeps both", () => {
    for (const id of ["ui-audit-gate", "design-fidelity"]) {
      const p = path.join(RULES_SOURCE, `${id}.md`);
      expect(rule_in_scope(p, null, [...NO_FRONTEND, "frontend-design"]), id).toBe(true);
    }
  });
});

describe("thin-pointer catalog honours the same scope", () => {
  it("scoped build_thin drops maintainer-only pointers AND bodies", () => {
    const scoped = build_thin(RULES_SOURCE, CONSUMER_SCOPE);
    for (const id of MAINTAINER_ONLY) {
      expect(scoped.has(`${id}.md`), id).toBe(false);
    }
    // Kernel still full-bodied, consumer rules still present as pointers.
    expect(scoped.has("direct-answers.md")).toBe(true);
    expect(scoped.has("user-interaction.md")).toBe(true);
  });

  it("unscoped build_thin keeps every rule (legacy-all)", () => {
    const all = build_thin(RULES_SOURCE, null);
    expect(all.size).toBe(allRuleFiles().length);
  });

  it("id_in_scope fails safe on unknown ids", () => {
    expect(id_in_scope("not-a-rule", CONSUMER_SCOPE, kernel_ids(), rule_workspaces_map())).toBe(
      true,
    );
  });
});
