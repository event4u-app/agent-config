// The `dispatch-role` marker: the structural field the hook's own comment named
// as the route away from reading prose. Hunters, readers and implementers are
// fan-out by declaration; verifier and judge dispatches are counted as before.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXIT_BLOCK as DISPATCHER_BLOCK } from "../../src/scripts/hooks/dispatch_hook.js";
import { decide, FAN_OUT_ROLE, run } from "../../src/scripts/hooks/evidence_independence.js";

let tmp: string;
let out: string[];

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "evidence-role-"));
  out = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
    out.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function dispatch(prompt: string): number {
  return run(
    JSON.stringify({
      event: "pre_tool_use",
      session_id: "s1",
      payload: { tool_name: "Agent", tool_input: { prompt } },
    }),
    { consumer_root: tmp },
  );
}

const warns = (): number => out.filter((l) => l.includes('"decision":"warn"')).length;

describe("FAN_OUT_ROLE", () => {
  it("matches only the exact first-line form and only fan-out roles", () => {
    expect(FAN_OUT_ROLE.test("<!-- dispatch-role: hunter -->\nReview my change.")).toBe(true);
    expect(FAN_OUT_ROLE.test("<!-- dispatch-role: implementer -->\nx")).toBe(true);
    expect(FAN_OUT_ROLE.test("<!-- dispatch-role: verifier -->\nx")).toBe(false);
    expect(FAN_OUT_ROLE.test("Review my change.\n<!-- dispatch-role: hunter -->")).toBe(false);
    expect(FAN_OUT_ROLE.test("\uFEFF  <!-- dispatch-role: reader -->\nx")).toBe(true);
  });
});

describe("declared roles", () => {
  it("five hunters reviewing my change raise no warn and are not counted", () => {
    for (let i = 0; i < 5; i += 1) {
      expect(dispatch(`<!-- dispatch-role: hunter -->\nReview my change in surface ${i} and report findings.`)).toBe(0);
    }
    expect(warns()).toBe(0);
  });

  it("a hunter prompt that pre-loads its verdict is still blocked", () => {
    expect(
      decide("Agent", "<!-- dispatch-role: hunter -->\nReview my change. NO-FINDINGS is expected and welcome.", 0).exit,
    ).toBe(DISPATCHER_BLOCK);
  });

  it("two verifier dispatches on my change still warn twice", () => {
    expect(dispatch("<!-- dispatch-role: verifier -->\nReview my change and report findings.")).toBe(0);
    expect(dispatch("<!-- dispatch-role: verifier -->\nReview my change again and report findings.")).toBe(0);
    expect(warns()).toBe(2);
  });
});
