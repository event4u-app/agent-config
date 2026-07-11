import { afterEach, describe, expect, it } from "vitest";
import { _check_humanizer_runtime } from "../../../src/scripts/_cli/cmd_doctor.js";

/**
 * Phase 2 fallback proof: the write-engine step-4b default-on path degrades
 * gracefully when no Node runtime is present. `_check_humanizer_runtime`
 * resolves the runtime via PATH at call time, so emptying PATH exercises the
 * runtime-absent branch for real (not a mock).
 */
describe("humanizer-runtime doctor check — graceful step-4b fallback", () => {
  const realPath = process.env["PATH"];
  afterEach(() => {
    process.env["PATH"] = realPath;
  });

  it("reports ok with the runtime present (mechanical detector pass)", () => {
    const r = _check_humanizer_runtime();
    expect(r["id"]).toBe("humanizer-runtime");
    expect(r["status"]).toBe("ok");
  });

  it("degrades to ok + prose-only fallback when no Node runtime is on PATH", () => {
    process.env["PATH"] = "";
    const r = _check_humanizer_runtime();
    // Never fails the run — the fallback is graceful by design.
    expect(r["status"]).toBe("ok");
    expect(String(r["message"])).toMatch(/prose-only|fallback/i);
  });
});
