// road-to-admissible-council-seats 1.3 — the runtime carrier carries rung-3/4.
//
// `classifyPrompt` collapsed every non-`subagent` verdict into one `return
// null`, and its own comment named "rung-3/4 team/council" among what it
// discarded. So a RESOLVED council verdict produced no output on the only
// runtime carrier this package ships — recorded independently at
// `agents/evidence/analysis/council-intelligence-baseline.md:103-111`.
//
// The fix is a POINTER, never a spawn (this roadmap's Risk 2). Every case below
// asserts both halves: the line exists, AND it does not read as an
// authorisation to run the council or dispatch a subagent.

import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildNudgeLine,
  classifyPrompt,
} from "../../src/scripts/hooks/delegation_nudge_hook.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Matches `judgment_ladder.ts::DESIGN_DECISION_RE` — a decision verb inside 40
// chars of the artefact token, which is what separates a real contested
// judgment from "update the ADR index".
const RUNG4_PROMPT =
  "We need to record a design decision about the council transport layer and " +
  "challenge the ADR before accepting it.";

describe("1.3 — a rung-4 verdict reaches the carrier instead of being discarded", () => {
  it("classifyPrompt returns a result rather than null", () => {
    const r = classifyPrompt(RUNG4_PROMPT, REPO_ROOT, "claude");
    expect(r).not.toBeNull();
    expect(r?.rung).toBe(4);
  });

  it("the emitted line names the council entry point", () => {
    const r = classifyPrompt(RUNG4_PROMPT, REPO_ROOT, "claude");
    expect(r).not.toBeNull();
    const line = buildNudgeLine(
      r!.rung,
      r!.classification,
      r!.sliceCount,
      r!.tier,
    );
    expect(line).toContain("council_cli");
    expect(line).toContain("--input");
    // The reachability probe, because concluding "no council" from the project
    // tree is the failure `council-availability` exists to stop.
    expect(line).toContain("council:status");
  });

  it("the line is a pointer, not an authorisation to spend a seat", () => {
    const r = classifyPrompt(RUNG4_PROMPT, REPO_ROOT, "claude");
    const line = buildNudgeLine(r!.rung, r!.classification, r!.sliceCount, r!.tier);
    expect(line).toContain("Not a spawn, and not run for you");
    // `delegable` false + 0 slices: nothing downstream can read this as a
    // dispatch verdict with a slice count to fan out.
    expect(r?.classification.delegable).toBe(false);
    expect(r?.classification.action).not.toBe("dispatch");
    expect(r?.sliceCount).toBe(0);
    // And it must not carry the subagent-dispatch wording the rung-1/2 branch
    // uses, which IS a spawn recommendation.
    expect(line).not.toContain("Consider dispatching via");
  });
});

describe("1.3 — rung 3 carries the team pointer", () => {
  it("names the teams primitive and the bounded-question fallback", () => {
    const line = buildNudgeLine(
      3,
      { delegable: false, action: "ask", mode: null, reason: "cross-layer signal" },
      0,
      "lite",
    );
    expect(line).toContain("rung-3: team");
    expect(line).toContain("host teams primitive");
    expect(line).toContain("ask_transport");
    expect(line).toContain("Not a spawn, and not run for you");
  });
});

describe("1.3 — the rungs that must stay silent still are", () => {
  it("a bounded question produces no carrier output", () => {
    // Rung 0.5 stays SILENT on a user prompt by design (token-economy-dispatch
    // 4.3) — 1.3 widens the carrier to 3/4 only, and this pins that it did not
    // widen further by accident.
    expect(classifyPrompt("What is a monad?", REPO_ROOT, "claude")).toBeNull();
  });

  it("routine ADR maintenance does not become a council pointer", () => {
    // The bare-noun false positive `judgment_ladder.ts` documents: naming the
    // artefact without a decision verb must NOT route to rung 4.
    const r = classifyPrompt("Update the ADR index and regenerate it.", REPO_ROOT, "claude");
    expect(r?.rung).not.toBe(4);
  });
});
