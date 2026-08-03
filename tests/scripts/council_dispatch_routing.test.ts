// Council-path routing invariants (road-to-tested-routing Phase 6).
//
// Pins the decision_resolution class dispatch deterministically: which
// question texts classify into which impact class, that high_impact /
// user_required are structurally LOCKED to user routing, that a user fence
// forces user_required over every other signal, and that the fast-path plan
// degrades to an explicit unavailable reason (never a silent guess) when no
// member opted in. Complements — does not duplicate — the per-module suites
// under tests/scripts/ai_council/ (fuzzy-corpus precedence, executor,
// intake); this file is the cross-cutting invariant surface the
// fast-path-marker-visibility and ask-when-uncertain rules lean on.
import { describe, expect, it } from "vitest";

import {
  LOCKED_IMPACT_CLASSES,
  classify_impact,
} from "../../src/scripts/ai_council/necessity.js";
import { plan_fast_path } from "../../src/scripts/ai_council/low_impact.js";
import type { LowImpactFastPathConfig } from "../../src/scripts/ai_council/config.js";

describe("classify_impact — class dispatch rows", () => {
  const rows: Array<{ prompt: string; expected: string }> = [
    // high_impact — security / tenancy / destructive / billing surfaces
    { prompt: "Should we change the authorization check on the tenant boundary?", expected: "high_impact" },
    { prompt: "Is it OK to drop table sessions in the production database?", expected: "high_impact" },
    { prompt: "Where should we store the API key and other credentials?", expected: "high_impact" },
    // low_impact — idiom / structure taste calls
    { prompt: "Service vs repository for this lookup — which idiom fits the codebase?", expected: "low_impact" },
    { prompt: "Should this be a DTO or a plain array between these two layers?", expected: "low_impact" },
    // trivial — naming / formatting
    { prompt: "What should I call this variable — is the snake_case fine?", expected: "trivial" },
    // medium_impact — contract shape
    { prompt: "This endpoint shape needs a contract change across the module boundary.", expected: "medium_impact" },
  ];

  for (const row of rows) {
    it(`"${row.prompt.slice(0, 60)}…" → ${row.expected}`, () => {
      expect(classify_impact(row.prompt).impact_class).toBe(row.expected);
    });
  }
});

describe("classify_impact — user fence wins over everything", () => {
  it("a fence marker forces user_required even on a trivial subject", () => {
    const v = classify_impact("Rename this variable, but ask me before deciding.");
    expect(v.impact_class).toBe("user_required");
  });

  it("a fence marker forces user_required even alongside high-impact triggers", () => {
    const v = classify_impact(
      "Review first: should we rotate the production secrets and change auth?",
    );
    expect(v.impact_class).toBe("user_required");
  });

  it("the German fence works too", () => {
    const v = classify_impact("Welche Queue-Strategie nehmen wir? Frag mich vor der Entscheidung.");
    expect(v.impact_class).toBe("user_required");
  });
});

describe("locked classes — the Iron Law surface", () => {
  it("exactly high_impact and user_required are locked to user routing", () => {
    expect([...LOCKED_IMPACT_CLASSES].sort()).toEqual(["high_impact", "user_required"]);
  });

  it("locked classes can never be members of a fast-path resolution input", () => {
    // The fast-path module documents it is consulted ONLY for low_impact;
    // the locked set is the structural guarantee the schema validator
    // enforces. This assertion pins the set so a future class addition
    // cannot silently unlock user routing.
    for (const cls of ["high_impact", "user_required"] as const) {
      expect(LOCKED_IMPACT_CLASSES.has(cls)).toBe(true);
    }
  });
});

describe("fast-path plan — unavailable degrades loudly, never silently", () => {
  const cfg: LowImpactFastPathConfig = {
    max_members: 2,
    max_rounds: 1,
    max_tokens: 2500,
    max_cost_usd: 0.05,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fuzzy_match: {} as any,
  };

  it("no opted-in members → empty plan with an explicit fall-back reason", () => {
    const plan = plan_fast_path(
      {
        a: { name: "a", enabled: true, participate_low_impact: false },
        b: { name: "b", enabled: false, participate_low_impact: true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      cfg,
    );
    expect(plan.members).toEqual([]);
    expect(plan.reason).toContain("participate_low_impact");
    expect(plan.reason).toContain("escalate to user");
  });

  it("opted-in members produce a transparency marker naming members and caps", () => {
    const plan = plan_fast_path(
      {
        a: { name: "a", enabled: true, participate_low_impact: true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      cfg,
    );
    expect(plan.members.length).toBe(1);
    expect(plan.marker).toContain("[fast-path: 1 member (a)");
  });
});
