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
