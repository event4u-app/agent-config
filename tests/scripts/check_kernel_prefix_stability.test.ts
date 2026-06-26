/**
 * Tests for the kernel-prefix byte-stability guard's pure logic
 * (`src/scripts/check_kernel_prefix_stability.ts`).
 */
import { describe, expect, it } from "vitest";

import {
  compute_prefix,
  evaluate,
  kernel_ids,
} from "../../src/scripts/check_kernel_prefix_stability.js";

const bodies: Record<string, string> = {
  "agent-authority": "AA body",
  "commit-policy": "CP body",
  "direct-answers": "DA body",
};
const read = (id: string) => bodies[id] ?? "";

describe("kernel_ids", () => {
  it("reads string + object kernel entries in order", () => {
    expect(kernel_ids({ kernel: ["a", { id: "b" }, "c"] })).toEqual(["a", "b", "c"]);
  });
  it("tolerates a missing kernel", () => {
    expect(kernel_ids({})).toEqual([]);
  });
});

describe("compute_prefix", () => {
  const base = compute_prefix(["agent-authority", "commit-policy"], read);

  it("is deterministic for identical input", () => {
    expect(compute_prefix(["agent-authority", "commit-policy"], read).sha256).toBe(base.sha256);
  });

  it("changes when a body changes", () => {
    const edited = compute_prefix(["agent-authority", "commit-policy"], (id) =>
      id === "commit-policy" ? "CP body EDITED" : read(id),
    );
    expect(edited.sha256).not.toBe(base.sha256);
  });

  it("changes when the order changes (id-framed digest)", () => {
    const reordered = compute_prefix(["commit-policy", "agent-authority"], read);
    expect(reordered.sha256).not.toBe(base.sha256);
  });

  it("changes when a kernel rule is added", () => {
    const added = compute_prefix(["agent-authority", "commit-policy", "direct-answers"], read);
    expect(added.sha256).not.toBe(base.sha256);
  });
});

describe("evaluate", () => {
  const cur = compute_prefix(["agent-authority", "commit-policy"], read);

  it("warmup when no baseline", () => {
    expect(evaluate(cur, null)).toBe("warmup");
  });
  it("stable when sha + ids match", () => {
    expect(evaluate(cur, { kernel_ids: cur.kernel_ids, sha256: cur.sha256 })).toBe("stable");
  });
  it("drift when sha differs", () => {
    expect(evaluate(cur, { kernel_ids: cur.kernel_ids, sha256: "deadbeef" })).toBe("drift");
  });
  it("drift when the id list differs even if sha collided", () => {
    expect(evaluate(cur, { kernel_ids: ["agent-authority"], sha256: cur.sha256 })).toBe("drift");
  });
});
