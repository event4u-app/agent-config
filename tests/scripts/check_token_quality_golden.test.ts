/**
 * Tests for the token-quality golden-set validator's pure logic
 * (`src/scripts/check_token_quality_golden.ts`).
 */
import { describe, expect, it } from "vitest";

import {
  router_rule_ids,
  validate,
} from "../../src/scripts/check_token_quality_golden.js";

const RULES = new Set(["commit-policy", "scope-control", "ask-when-uncertain"]);

function corpus(tasks: unknown[]) {
  return { version: 1, corpus_id: "token-quality-golden", tasks };
}

const labelled = {
  id: "tq-commit-01",
  rules: ["commit-policy"],
  scenario: "single",
  prompt: "wrap it up",
  expected: { rubric: "answer must not commit unsolicited", must_include: ["no commit"], must_not: [] },
  label_status: "labelled",
  notes: "x",
};

const stub = {
  id: "tq-scope-01",
  rules: ["scope-control"],
  scenario: "multi-turn",
  prompt: "two turns",
  expected: { rubric: "TODO-operator", must_include: [], must_not: [] },
  label_status: "stub",
  notes: "x",
};

describe("router_rule_ids", () => {
  it("collects kernel strings + tier_* object ids", () => {
    const ids = router_rule_ids({
      kernel: ["a", "b"],
      tier_1: [{ id: "c", triggers: [] }],
      tier_2: [{ id: "d" }],
    });
    expect([...ids].sort()).toEqual(["a", "b", "c", "d"]);
  });
});

describe("token-quality-golden validate()", () => {
  it("accepts a valid mix and counts coverage/labels", () => {
    const r = validate(corpus([labelled, stub]), RULES);
    expect(r.ok).toBe(true);
    expect(r.labelled).toBe(1);
    expect(r.stubs).toBe(1);
    expect(r.covered).toBe(2); // commit-policy + scope-control
    expect(r.uncovered).toEqual(["ask-when-uncertain"]);
    expect(r.scenarios).toMatchObject({ single: 1, "multi-turn": 1 });
  });

  it("flags an unknown rule id", () => {
    const bad = { ...stub, id: "tq-x-01", rules: ["not-a-rule"] };
    const r = validate(corpus([bad]), RULES);
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/unknown rule id/);
  });

  it("flags a bad scenario enum", () => {
    const bad = { ...stub, id: "tq-x-02", scenario: "freeform" };
    expect(validate(corpus([bad]), RULES).ok).toBe(false);
  });

  it("flags a malformed id", () => {
    const bad = { ...stub, id: "commit01" };
    expect(validate(corpus([bad]), RULES).errors.join("\n")).toMatch(/tq-<area>-NN/);
  });

  it("flags a duplicate id", () => {
    const r = validate(corpus([labelled, { ...labelled }]), RULES);
    expect(r.errors.join("\n")).toMatch(/duplicate id/);
  });

  it("a labelled task with a TODO rubric is an error", () => {
    const bad = { ...labelled, id: "tq-x-03", expected: { rubric: "TODO", must_include: ["x"], must_not: [] } };
    expect(validate(corpus([bad]), RULES).errors.join("\n")).toMatch(/TODO\/empty rubric/);
  });

  it("a labelled task with no anchors is an error", () => {
    const bad = { ...labelled, id: "tq-x-04", expected: { rubric: "real rubric", must_include: [], must_not: [] } };
    expect(validate(corpus([bad]), RULES).errors.join("\n")).toMatch(/must_include anchor/);
  });

  it("a stub task is exempt from the rubric/anchor requirement", () => {
    expect(validate(corpus([stub]), RULES).ok).toBe(true);
  });

  it("reports missing required scenarios", () => {
    const r = validate(corpus([labelled]), RULES); // only 'single'
    expect(r.missing_scenarios).toEqual(["multi-turn", "conflicting-rule", "corner-case"]);
  });

  it("rejects a non-list tasks field", () => {
    expect(validate({ corpus_id: "token-quality-golden", tasks: 5 }, RULES).ok).toBe(false);
  });
});

// ── Scope-aware coverage + prompt↔trigger falsifiability (Phases 0 + 3) ──

import {
  scoped_rule_ids,
  task_fires_rule,
} from "../../src/scripts/check_token_quality_golden.js";

const ROUTER_V2 = {
  schema_version: 2,
  kernel: ["commit-policy"],
  tier_1: [
    {
      id: "scope-control",
      triggers: [{ keyword: "branch" }, { phrase: "git operation" }],
      routes_to: [],
      workspaces: ["engineering"],
      packs: ["engineering-base"],
    },
  ],
  tier_2: [
    {
      id: "source-of-truth",
      triggers: [{ path_prefix: "dist/agent-src/" }],
      routes_to: [],
      workspaces: ["agent-config-maintainer"],
      packs: ["meta"],
    },
    {
      id: "roadmap-rule",
      triggers: [{ command: "/roadmap:process-phase" }, { file_pattern: "*.tf" }],
      routes_to: [],
      workspaces: ["engineering"],
      packs: ["meta"],
    },
  ],
};

describe("scoped_rule_ids (router v2 workspaces)", () => {
  it("consumer = kernel + non-maintainer-only rules", () => {
    const ids = scoped_rule_ids(ROUTER_V2, "consumer");
    expect(ids.has("commit-policy")).toBe(true); // kernel always consumer
    expect(ids.has("scope-control")).toBe(true);
    expect(ids.has("roadmap-rule")).toBe(true);
    expect(ids.has("source-of-truth")).toBe(false);
  });

  it("maintainer = exclusively-maintainer rules only", () => {
    const ids = scoped_rule_ids(ROUTER_V2, "maintainer");
    expect([...ids]).toEqual(["source-of-truth"]);
  });

  it("all = everything", () => {
    expect(scoped_rule_ids(ROUTER_V2, "all").size).toBe(4);
  });
});

describe("task_fires_rule (prompt↔trigger falsifiability)", () => {
  it("kernel rules always fire", () => {
    expect(task_fires_rule({ prompt: "anything" }, "commit-policy", ROUTER_V2)).toBe(true);
  });

  it("keyword substring fires; unrelated prompt does not (mis-tag fixture)", () => {
    expect(task_fires_rule({ prompt: "create a new Branch for this" }, "scope-control", ROUTER_V2)).toBe(true);
    expect(task_fires_rule({ prompt: "bake a cake" }, "scope-control", ROUTER_V2)).toBe(false);
  });

  it("intent = all alpha words >2 chars present", () => {
    expect(task_fires_rule({ prompt: "run this git operation now" }, "scope-control", ROUTER_V2)).toBe(true);
  });

  it("path_prefix satisfied via context_files", () => {
    expect(
      task_fires_rule(
        { prompt: "edit it", context_files: ["dist/agent-src/rules/x.md"] },
        "source-of-truth",
        ROUTER_V2,
      ),
    ).toBe(true);
    expect(task_fires_rule({ prompt: "edit it" }, "source-of-truth", ROUTER_V2)).toBe(false);
  });

  it("command + file_pattern triggers", () => {
    expect(
      task_fires_rule({ prompt: "go", command: "/roadmap:process-phase" }, "roadmap-rule", ROUTER_V2),
    ).toBe(true);
    expect(
      task_fires_rule({ prompt: "go", context_files: ["infra/main.tf"] }, "roadmap-rule", ROUTER_V2),
    ).toBe(true);
    expect(task_fires_rule({ prompt: "go" }, "roadmap-rule", ROUTER_V2)).toBe(false);
  });
});

describe("validate() with router — fires-check + no_fire", () => {
  const base = {
    scenario: "single",
    expected: { rubric: "TODO", must_include: [], must_not: [] },
    label_status: "stub",
    notes: "x",
  };

  it("a synthetic mis-tagged task is a structural error", () => {
    const rep = validate(
      corpus([{ ...base, id: "tq-mis-01", rules: ["scope-control"], prompt: "bake a cake" }]),
      new Set(["scope-control", "commit-policy"]),
      ROUTER_V2,
    );
    expect(rep.ok).toBe(false);
    expect(rep.errors.join(" ")).toContain("no router trigger");
  });

  it("no_fire inverts: firing rule is the error, silent rule passes", () => {
    const silent = validate(
      corpus([{ ...base, id: "tq-nf-01", rules: ["scope-control"], prompt: "bake a cake", no_fire: true }]),
      new Set(["scope-control"]),
      ROUTER_V2,
    );
    expect(silent.ok).toBe(true);
    const firing = validate(
      corpus([{ ...base, id: "tq-nf-02", rules: ["scope-control"], prompt: "switch the branch", no_fire: true }]),
      new Set(["scope-control"]),
      ROUTER_V2,
    );
    expect(firing.ok).toBe(false);
    expect(firing.errors.join(" ")).toContain("DOES fire");
  });

  it("no_fire on a kernel rule is invalid", () => {
    const rep = validate(
      corpus([{ ...base, id: "tq-nf-03", rules: ["commit-policy"], prompt: "x y z", no_fire: true }]),
      new Set(["commit-policy"]),
      ROUTER_V2,
    );
    expect(rep.ok).toBe(false);
    expect(rep.errors.join(" ")).toContain("kernel");
  });
});
