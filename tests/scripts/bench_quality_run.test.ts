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
  judge_prompt,
  load_golden,
  parse_verdict,
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
