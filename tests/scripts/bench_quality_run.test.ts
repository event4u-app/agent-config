/**
 * Tests for the thin-vs-eager quality-run producer
 * (`src/scripts/bench_quality_run.ts`). The model is mocked — the live
 * Anthropic path is exercised only by an operator with an API key.
 */
import { describe, expect, it } from "vitest";

import {
  type AnswerFn,
  type GoldenTask,
  type ModelJudgeFn,
  assemble_contexts,
  blind_flip,
  build_blind_pair,
  judge_prompt,
  load_golden,
  parse_verdict,
  render_pair_file,
  run_golden_judge,
} from "../../src/scripts/bench_quality_run.js";

describe("parse_verdict", () => {
  it("maps VERDICT: A/B/TIE to order-relative verdicts", () => {
    expect(parse_verdict("reasoning…\nVERDICT: A")).toBe("first");
    expect(parse_verdict("VERDICT: B")).toBe("second");
    expect(parse_verdict("VERDICT: tie")).toBe("tie"); // case-insensitive
  });
  it("defaults to tie when no verdict line is present (inconclusive)", () => {
    expect(parse_verdict("I cannot decide.")).toBe("tie");
  });
});

describe("judge_prompt", () => {
  it("includes the rubric, anchors, both answers, and the length-neutral instruction", () => {
    const task: GoldenTask = {
      id: "t",
      rubric: "answer directly",
      prompt: "q",
      must_include: ["direct"],
      must_not: ["waffle"],
    };
    const p = judge_prompt(task, "AAA", "BBB");
    expect(p).toContain("answer directly");
    expect(p).toContain("direct");
    expect(p).toContain("AAA");
    expect(p).toContain("BBB");
    expect(p).toMatch(/IGNORE length/i);
  });
});

const task = (id: string): GoldenTask => ({ id, rubric: "r", prompt: "p", must_include: [], must_not: [] });

describe("run_golden_judge", () => {
  const contexts = { thin: "THIN-CTX", eager: "EAGER-CTX" };
  const answer: AnswerFn = (ctx) => (ctx.includes("THIN") ? "thin-answer" : "eager-answer");

  it("records a consistent thin win (survives the swap)", () => {
    const judge: ModelJudgeFn = (_t, first) => (first === "thin-answer" ? "first" : "second");
    const res = run_golden_judge([task("a")], contexts, answer, judge);
    expect(res[0]?.winner).toBe("thin");
  });

  it("records a consistent eager win", () => {
    const judge: ModelJudgeFn = (_t, first) => (first === "eager-answer" ? "first" : "second");
    expect(run_golden_judge([task("a")], contexts, answer, judge)[0]?.winner).toBe("eager");
  });

  it("a position-biased judge (always picks first) → inconsistent (rejected)", () => {
    const judge: ModelJudgeFn = () => "first";
    expect(run_golden_judge([task("a")], contexts, answer, judge)[0]?.winner).toBe("inconsistent");
  });

  it("passes the FULL task to the model judge (rubric/anchors available)", () => {
    let seenRubric = "";
    const judge: ModelJudgeFn = (t) => {
      seenRubric = t.rubric;
      return "tie";
    };
    run_golden_judge([{ ...task("a"), rubric: "be concise" }], contexts, answer, judge);
    expect(seenRubric).toBe("be concise");
  });
});

describe("load_golden + assemble_contexts (against the real repo files)", () => {
  it("loads only labelled golden tasks with rubric + prompt", () => {
    const tasks = load_golden();
    expect(tasks.length).toBeGreaterThan(0);
    for (const t of tasks) {
      expect(t.id).toMatch(/^tq-/);
      expect(t.rubric.length).toBeGreaterThan(0);
      expect(t.prompt.length).toBeGreaterThan(0);
    }
  });

  it("the eager context is larger than the thin context (bodies vs pointers)", () => {
    const { eager, thin } = assemble_contexts();
    expect(eager.length).toBeGreaterThan(thin.length);
    expect(thin).toContain("Routed rule"); // thin uses pointers
  });
});

// ── --dump-answers export mode ──────────────────────────────────────────────

describe("blind_flip", () => {
  it("is deterministic for the same (task, seed) — a re-run reproduces the blinding", () => {
    expect(blind_flip("tq-a", 7)).toBe(blind_flip("tq-a", 7));
    expect(blind_flip("tq-b", 42)).toBe(blind_flip("tq-b", 42));
  });

  it("the seed actually changes the assignment for at least some tasks", () => {
    const ids = ["tq-a", "tq-b", "tq-c", "tq-d", "tq-e", "tq-f", "tq-g", "tq-h"];
    expect(ids.some((id) => blind_flip(id, 1) !== blind_flip(id, 2))).toBe(true);
  });

  it("does not assign every task to the same arm (would defeat blinding)", () => {
    const ids = Array.from({ length: 30 }, (_, i) => `tq-${i}`);
    const flips = ids.map((id) => blind_flip(id, 20260729));
    expect(flips.some(Boolean)).toBe(true);
    expect(flips.some((f) => !f)).toBe(true);
  });
});

describe("build_blind_pair", () => {
  const t = (id: string): GoldenTask => ({ id, rubric: "r", prompt: "p", must_include: [], must_not: [] });

  it("records the arm that produced ANSWER A, consistent with the answer it placed there", () => {
    const pair = build_blind_pair(t("tq-x"), "THIN_TEXT", "EAGER_TEXT", 7);
    const expectedA = pair.a_arm === "thin" ? "THIN_TEXT" : "EAGER_TEXT";
    const expectedB = pair.a_arm === "thin" ? "EAGER_TEXT" : "THIN_TEXT";
    expect(pair.answer_a).toBe(expectedA);
    expect(pair.answer_b).toBe(expectedB);
  });

  it("carries both answers exactly once — nothing dropped or duplicated", () => {
    const pair = build_blind_pair(t("tq-y"), "A_ONLY", "B_ONLY", 3);
    expect([pair.answer_a, pair.answer_b].sort()).toEqual(["A_ONLY", "B_ONLY"]);
  });
});

describe("render_pair_file — blinding invariant", () => {
  const task: GoldenTask = {
    id: "tq-blind",
    rubric: "Answers the request correctly.",
    prompt: "Do the task.",
    must_include: ["a required element"],
    must_not: ["a disqualifying error"],
  };

  it("the rendered file is arm-INDEPENDENT: a_arm cannot influence a single byte", () => {
    // The decisive structural check. If the template ever branched on a_arm,
    // these two renderings would differ and the operator could infer the arm.
    const base = { id: task.id, answer_a: "AAA", answer_b: "BBB" } as const;
    expect(render_pair_file(task, { ...base, a_arm: "thin" })).toBe(
      render_pair_file(task, { ...base, a_arm: "eager" }),
    );
  });

  it("never emits an arm label or the mapping key", () => {
    const out = render_pair_file(task, { id: task.id, a_arm: "thin", answer_a: "AAA", answer_b: "BBB" });
    expect(out).not.toMatch(/\b(thin|eager)\b/i);
    expect(out).not.toContain("a_arm");
  });

  it("presents both answers, A before B, with the rubric and anchors", () => {
    const out = render_pair_file(task, { id: task.id, a_arm: "eager", answer_a: "AAA", answer_b: "BBB" });
    expect(out.indexOf("AAA")).toBeGreaterThan(-1);
    expect(out.indexOf("AAA")).toBeLessThan(out.indexOf("BBB"));
    expect(out).toContain("Answers the request correctly.");
    expect(out).toContain("a required element");
    expect(out).toContain("a disqualifying error");
  });

  it("instructs the judge to ignore length and allows an explicit tie", () => {
    const out = render_pair_file(task, { id: task.id, a_arm: "thin", answer_a: "A", answer_b: "B" });
    expect(out).toMatch(/IGNORE length/);
    expect(out).toMatch(/tie` is a valid verdict/);
  });
});
