/**
 * Cross-concern envelope isolation — road-to-per-turn-hook-economy risk 1.
 *
 * Step 1.1 proposed serialising the envelope once per event instead of once per
 * concern. The risk the roadmap registered against it is explicit: *"the current
 * per-concern re-serialisation is accidentally an isolation boundary; removing
 * it makes cross-concern contamination possible, and such a bug would be
 * intermittent and ordering-dependent."*
 *
 * **The hoist was measured and did not pay** (two A/B runs disagreeing in sign;
 * see `_run_concern_inproc`'s header), so the tree still re-serialises per
 * concern and the accidental boundary is still there. These cases keep it from
 * being accidental: they pin the property a re-attempt must preserve — what a
 * concern receives is TEXT, so nothing one concern touches can reach the next.
 *
 * A future change that shares a parsed object fails here, rather than in
 * production as an ordering-dependent bug. That is worth having whether or not
 * the optimisation ever lands.
 *
 * It deliberately tests the stdin surface the concerns actually read through,
 * not the dispatcher's internals: what a concern can observe is exactly what
 * `readHookStdin()` returns.
 */
import { describe, expect, it } from "vitest";

import {
  clearHookStdinOverride,
  readHookStdin,
  setHookStdinOverride,
} from "../../../src/scripts/hooks/hook_stdin.js";

/** What one concern does: read the shared stdin and parse its own view. */
function concernParse(): Record<string, unknown> {
  return JSON.parse(readHookStdin()) as Record<string, unknown>;
}

describe("dispatch — cross-concern envelope isolation (risk 1)", () => {
  it("a concern mutating its parsed envelope cannot affect the next concern", () => {
    const envelope = {
      schema_version: 1,
      platform: "claude",
      event: "post_tool_use",
      payload: { tool_name: "Read", tool_response: "original" },
    };
    setHookStdinOverride(JSON.stringify(envelope));
    try {
      // Concern A parses and mutates aggressively, the way a careless concern
      // would: it rewrites the payload and drops a field.
      const a = concernParse();
      (a["payload"] as Record<string, unknown>)["tool_response"] = "CLOBBERED";
      delete a["event"];
      (a as Record<string, unknown>)["injected"] = true;

      // Concern B must observe the envelope as it arrived.
      const b = concernParse();
      expect((b["payload"] as Record<string, unknown>)["tool_response"]).toBe("original");
      expect(b["event"]).toBe("post_tool_use");
      expect("injected" in b).toBe(false);
    } finally {
      clearHookStdinOverride();
    }
  });

  it("each read returns an independent object, not a shared reference", () => {
    setHookStdinOverride(JSON.stringify({ payload: { n: 1 } }));
    try {
      const a = concernParse();
      const b = concernParse();
      expect(a).not.toBe(b);
      expect(a["payload"]).not.toBe(b["payload"]);
    } finally {
      clearHookStdinOverride();
    }
  });

  it("the shared value is text, so there is nothing for a concern to mutate", () => {
    // The load-bearing assertion: readHookStdin hands back a primitive. If a
    // later change makes it hand back an object, this fails and the isolation
    // argument above has to be re-made rather than silently assumed.
    setHookStdinOverride(JSON.stringify({ payload: {} }));
    try {
      expect(typeof readHookStdin()).toBe("string");
    } finally {
      clearHookStdinOverride();
    }
  });

  it("clearing the override is honoured, so state does not leak across events", () => {
    setHookStdinOverride(JSON.stringify({ payload: { marker: "event-1" } }));
    expect(concernParse()["payload"]).toEqual({ marker: "event-1" });
    clearHookStdinOverride();
    setHookStdinOverride(JSON.stringify({ payload: { marker: "event-2" } }));
    try {
      expect(concernParse()["payload"]).toEqual({ marker: "event-2" });
    } finally {
      clearHookStdinOverride();
    }
  });
});
