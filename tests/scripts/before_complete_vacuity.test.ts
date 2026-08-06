// Tests for the non-vacuity guard added to src/scripts/before_complete_hook.ts
// (conformance audit 2026-08-06, failure class FC-3b).
//
// The measured failure this pins: a CI poll landing in the gap between `git push`
// and GitHub registering the checks returned `0 pass / 0 fail`, so the agent's
// exit condition `pending == 0` was trivially satisfied and "CI settled" was
// reported twice — on a run that had not started. The verification command ran,
// so the evidence gate felt satisfied.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  isVacuousOutput,
  isCiPoll,
  pendingCount,
  run,
  STATE_FILE,
} from "../../src/scripts/before_complete_hook.js";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vacuity-"));
});

function post(command: string, output: string): void {
  run(
    JSON.stringify({
      event: "post_tool_use",
      session_id: "s1",
      payload: { tool_name: "Bash", tool_input: { command }, tool_response: output },
    }),
    { consumer_root: tmp },
  );
}

function newTurn(): void {
  run(JSON.stringify({ event: "user_prompt_submit", session_id: "s1", payload: {} }), {
    consumer_root: tmp,
  });
}

function state(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(tmp, STATE_FILE), "utf8")) as Record<string, unknown>;
}

describe("isVacuousOutput", () => {
  it("treats an empty result set as vacuous", () => {
    for (const out of [
      "0 checks",
      "no tests ran",
      "No test files found",
      "0 passed, 0 failed",
      "Ran 0 tests",
      "no files matched",
      "0 files checked",
    ]) {
      expect(isVacuousOutput(out), out).toBe(true);
    }
  });

  // Changed deliberately in round 2: silence is the Unix convention for
  // success, so a clean `tsc --noEmit` / `eslint` / `phpstan` must still count.
  // Treating empty output as vacuity quietly stopped counting the most common
  // green signal in this repo.
  it("does NOT treat silent success as vacuity", () => {
    expect(isVacuousOutput("")).toBe(false);
    expect(isVacuousOutput("   ")).toBe(false);
  });

  it("does not let one empty sub-run poison a real one", () => {
    expect(
      isVacuousOutput("Test Files 40 passed (40)\n Tests 812 passed (812)\n[pkg-x] No test files found"),
    ).toBe(false);
  });

  it("treats a real result set as non-vacuous", () => {
    for (const out of ["385 passed, 1 skipped", "37 checks, 0 failing", "12 files checked, 2 problems"]) {
      expect(isVacuousOutput(out), out).toBe(false);
    }
  });
});

describe("isCiPoll / pendingCount", () => {
  it("recognises the CI poll commands", () => {
    expect(isCiPoll("gh pr checks 1188")).toBe(true);
    expect(isCiPoll("gh run watch 42")).toBe(true);
    expect(isCiPoll("npm test")).toBe(false);
  });

  it("reads a pending count in both shapes", () => {
    expect(pendingCount("10 pass, 0 fail, 34 pending")).toBe(34);
    expect(pendingCount("pending: 3")).toBe(3);
  });

  it("returns null on an unrecognised shape rather than implying settled", () => {
    expect(pendingCount("something entirely different")).toBeNull();
  });
});

describe("evidence gate", () => {
  it("a real test run counts as verification", () => {
    newTurn();
    post("npm test", "385 passed, 1 skipped");
    expect(state().verified_this_turn).toBe(true);
    expect(state().verifications_this_turn).toBe(1);
  });

  it("a vacuous test run does NOT count as verification", () => {
    newTurn();
    post("npm test", "no tests ran");
    expect(state().verified_this_turn).toBe(false);
    expect(state().verifications_this_turn).toBe(0);
    expect(state().nonevidence_this_turn).toBe(1);
  });

  // THE REGRESSION — the exact push→registration gap.
  it("a single CI poll returning zero checks is not a settle", () => {
    newTurn();
    post("gh pr checks 1188", "0 checks");
    expect(state().verified_this_turn).toBe(false);
  });

  it("a CI poll showing pending work is 'running', not 'settled'", () => {
    newTurn();
    post("gh pr checks 1188", "10 pass, 0 fail, 34 pending");
    expect(state().verified_this_turn).toBe(false);
    expect(state().ci_saw_pending).toBe(true);
  });

  it("a settle counts only after the run was observed in flight", () => {
    newTurn();
    post("gh pr checks 1188", "10 pass, 0 fail, 34 pending");
    post("gh pr checks 1188", "37 pass, 0 fail, 0 pending");
    expect(state().verified_this_turn).toBe(true);
  });

  it("the in-flight observation does not survive into the next turn", () => {
    newTurn();
    post("gh pr checks 1188", "10 pass, 0 fail, 34 pending");
    newTurn();
    expect(state().ci_saw_pending).toBe(false);
    post("gh pr checks 1188", "37 pass, 0 fail, 0 pending");
    expect(state().verified_this_turn).toBe(false);
  });

  it("an unrecognised poll shape is never read as settled", () => {
    newTurn();
    post("gh pr checks 1188", "some unparseable wall of text");
    expect(state().verified_this_turn).toBe(false);
  });

  // The guard must fire only where it can READ a result. Several platforms do
  // not surface tool output on post_tool_use; treating their silence as a
  // vacuous run would stop counting every verification everywhere — a blanket
  // regression dressed as a safety improvement.
  it("a payload with no output field at all keeps the pre-guard behaviour", () => {
    newTurn();
    run(
      JSON.stringify({
        event: "post_tool_use",
        session_id: "s1",
        payload: { tool_name: "Bash", tool_input: { command: "npm test" } },
      }),
      { consumer_root: tmp },
    );
    expect(state().verified_this_turn).toBe(true);
    expect(state().verifications_this_turn).toBe(1);
  });

  it("a CI poll with no readable output counts for nothing, as it did before", () => {
    newTurn();
    run(
      JSON.stringify({
        event: "post_tool_use",
        session_id: "s1",
        payload: { tool_name: "Bash", tool_input: { command: "gh pr checks 1188" } },
      }),
      { consumer_root: tmp },
    );
    expect(state().verified_this_turn).toBe(false);
  });
});
