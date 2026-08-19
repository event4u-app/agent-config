// Emission-shaping policy tests (road-to-standing-context-40k Phase 4).
//
// Every case here is a PAIRED fixture: a positive that must drop and a
// near-miss that must not. A shaping layer whose job is to delete output is
// only trustworthy if the not-dropping half is pinned as hard as the dropping
// half — the dangerous failure is a silenced safety warning, not a surviving
// advisory.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  RC_ALLOW,
  RC_WARN,
  evictionOrder,
  isExempt,
  readTurnSpend,
  recordTurnSpend,
  resolveVolumeCap,
  shapeAndRecord,
  shapeEmissions,
  turnSpendPath,
  turnSpendKey,
  TURN_SPEND_DIR_REL,
  TURN_SPEND_MAX_FILES,
  type EmissionCandidate,
} from "../../../src/scripts/hooks/injection_budget.js";

/** Package root — the shipped budget row lives under it. */
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

function candidate(over: Partial<EmissionCandidate> = {}): EmissionCandidate {
  return {
    concern: "some-advisory",
    severity: "advisory",
    failClosed: false,
    rc: RC_ALLOW,
    bytes: 100,
    nudgeRank: null,
    ...over,
  };
}

describe("isExempt", () => {
  it("exempts a blocking concern", () => {
    expect(isExempt(candidate({ severity: "blocking" }))).toBe(true);
  });

  it("exempts a fail_closed concern even when it declares advisory", () => {
    expect(isExempt(candidate({ severity: "advisory", failClosed: true }))).toBe(true);
  });

  it("does not exempt a plain advisory — the near-miss", () => {
    expect(isExempt(candidate())).toBe(false);
  });

  it("treats severity case-insensitively and ignores surrounding space", () => {
    expect(isExempt(candidate({ severity: " BLOCKING " }))).toBe(true);
    expect(isExempt(candidate({ severity: " advisory " }))).toBe(false);
  });
});

describe("nudge exclusivity", () => {
  it("keeps the lowest nudge_rank and drops the rest", () => {
    const result = shapeEmissions(
      [
        candidate({ concern: "skill-route", nudgeRank: 2, bytes: 300 }),
        candidate({ concern: "delegation-nudge", nudgeRank: 1, bytes: 400 }),
      ],
      { capBytes: null },
    );
    expect(result.kept).toEqual(["delegation-nudge"]);
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0]?.concern).toBe("skill-route");
    expect(result.dropped[0]?.reason).toBe("nudge_interference");
    // The detail promises a comparison, so it must carry BOTH ranks. It used to
    // print the loser's rank followed by the literal text "vs the winner's".
    expect(result.dropped[0]?.detail).toContain("1 beats 2");
  });

  it("near-miss — a single nudge is never suppressed", () => {
    const result = shapeEmissions(
      [candidate({ concern: "skill-route", nudgeRank: 2 })],
      { capBytes: null },
    );
    expect(result.kept).toEqual(["skill-route"]);
    expect(result.dropped).toEqual([]);
  });

  it("near-miss — unranked advisories are not nudge-class and coexist freely", () => {
    const result = shapeEmissions(
      [
        candidate({ concern: "language-mirror" }),
        candidate({ concern: "session-canary" }),
      ],
      { capBytes: null },
    );
    expect(result.kept).toEqual(["language-mirror", "session-canary"]);
    expect(result.dropped).toEqual([]);
  });

  it("never suppresses an exempt concern that happens to carry a rank", () => {
    const result = shapeEmissions(
      [
        candidate({ concern: "guard", nudgeRank: 1, severity: "blocking" }),
        candidate({ concern: "advisory-nudge", nudgeRank: 2 }),
      ],
      { capBytes: null },
    );
    // The guard is out of the policy's population entirely, so the remaining
    // nudge is a single nudge and survives.
    expect(result.kept).toEqual(["guard", "advisory-nudge"]);
    expect(result.dropped).toEqual([]);
  });

  it("breaks a rank tie deterministically on concern name", () => {
    const forward = shapeEmissions(
      [
        candidate({ concern: "zulu", nudgeRank: 1 }),
        candidate({ concern: "alpha", nudgeRank: 1 }),
      ],
      { capBytes: null },
    );
    const reversed = shapeEmissions(
      [
        candidate({ concern: "alpha", nudgeRank: 1 }),
        candidate({ concern: "zulu", nudgeRank: 1 }),
      ],
      { capBytes: null },
    );
    expect(forward.kept).toEqual(["alpha"]);
    expect(reversed.kept).toEqual(["alpha"]);
  });
});

describe("byte budget", () => {
  it("drops nothing when the input is already under the ceiling", () => {
    const result = shapeEmissions([candidate({ bytes: 100 })], { capBytes: 1000 });
    expect(result.dropped).toEqual([]);
    expect(result.keptBytes).toBe(100);
    expect(result.ceilingExceeded).toBe(false);
  });

  it("drops the ALLOW advisory before the WARN one", () => {
    const result = shapeEmissions(
      [
        candidate({ concern: "warned", rc: RC_WARN, bytes: 600 }),
        candidate({ concern: "quiet", rc: RC_ALLOW, bytes: 600 }),
      ],
      { capBytes: 700 },
    );
    expect(result.dropped.map((d) => d.concern)).toEqual(["quiet"]);
    expect(result.kept).toEqual(["warned"]);
    expect(result.dropped[0]?.reason).toBe("injection_budget");
  });

  it("frees the ceiling in the fewest drops — largest first within one rc", () => {
    const result = shapeEmissions(
      [
        candidate({ concern: "small", bytes: 100 }),
        candidate({ concern: "large", bytes: 900 }),
      ],
      { capBytes: 500 },
    );
    expect(result.dropped.map((d) => d.concern)).toEqual(["large"]);
    expect(result.kept).toEqual(["small"]);
  });

  it("counts bytes already spent earlier in the same turn", () => {
    const under = shapeEmissions([candidate({ bytes: 400 })], { capBytes: 1000 });
    expect(under.dropped).toEqual([]);
    const over = shapeEmissions([candidate({ bytes: 400 })], {
      capBytes: 1000,
      spentBytes: 900,
    });
    expect(over.dropped).toHaveLength(1);
  });

  // The R2 completion review found this pinned the WRONG behaviour: the module
  // header (and the contract doc, and the dispatcher's stderr) all promise
  // "nothing dropped" when the exempt set alone is over, and the loop dropped
  // every advisory anyway — for zero benefit, since no sequence of drops can get
  // under a floor that is already above the cap.
  it("drops NOTHING when dropping cannot help — the exempt floor is over the cap", () => {
    const result = shapeEmissions(
      [
        candidate({ concern: "guard", severity: "blocking", bytes: 5000 }),
        candidate({ concern: "noise", bytes: 200 }),
      ],
      { capBytes: 1000 },
    );
    expect(result.kept).toEqual(["guard", "noise"]);
    expect(result.dropped).toEqual([]);
    expect(result.ceilingExceeded).toBe(true);
    expect(result.ceilingCause).toBe("exempt-floor");
  });

  it("near-miss — an exempt floor UNDER the cap still lets advisories be dropped", () => {
    const result = shapeEmissions(
      [
        candidate({ concern: "guard", severity: "blocking", bytes: 400 }),
        candidate({ concern: "noise", bytes: 900 }),
      ],
      { capBytes: 1000 },
    );
    expect(result.dropped.map((d) => d.concern)).toEqual(["noise"]);
    expect(result.kept).toEqual(["guard"]);
    expect(result.ceilingExceeded).toBe(false);
    expect(result.ceilingCause).toBeNull();
  });

  it("attributes an overflow to carried spend when that alone is over the cap", () => {
    // No exempt concern at all. Dropping is futile for the same reason as the
    // exempt floor — the turn is already over before this dispatch's advisories
    // are counted — so nothing is dropped, but the cause must not read "exempt".
    const result = shapeEmissions([candidate({ concern: "noise", bytes: 200 })], {
      capBytes: 1000,
      spentBytes: 5000,
    });
    expect(result.dropped).toEqual([]);
    expect(result.kept).toEqual(["noise"]);
    expect(result.ceilingExceeded).toBe(true);
    expect(result.ceilingCause).toBe("carried-spend");
  });

  it("drops when carried spend is under the cap and this dispatch pushes it over", () => {
    // The case the budget exists for: the floor (900) is under the cap, so a
    // drop genuinely helps.
    const result = shapeEmissions([candidate({ concern: "noise", bytes: 300 })], {
      capBytes: 1000,
      spentBytes: 900,
    });
    expect(result.dropped.map((d) => d.concern)).toEqual(["noise"]);
    expect(result.ceilingExceeded).toBe(false);
  });

  it("skips the budget entirely when the cap is null (the session_start case)", () => {
    const result = shapeEmissions(
      [candidate({ bytes: 99999 }), candidate({ concern: "other", bytes: 99999 })],
      { capBytes: null },
    );
    expect(result.dropped).toEqual([]);
    expect(result.ceilingExceeded).toBe(false);
  });

  it("applies exclusivity before the budget, so the surviving nudge is the ranked one", () => {
    // Without exclusivity-first, the 900-byte rank-1 nudge would be the budget's
    // first victim and the policy would have made the relevance call by size.
    const result = shapeEmissions(
      [
        candidate({ concern: "delegation-nudge", nudgeRank: 1, bytes: 900 }),
        candidate({ concern: "skill-route", nudgeRank: 2, bytes: 100 }),
      ],
      { capBytes: 1000 },
    );
    expect(result.kept).toEqual(["delegation-nudge"]);
    expect(result.dropped.map((d) => d.reason)).toEqual(["nudge_interference"]);
  });
});

describe("evictionOrder", () => {
  it("is a total order — rc, then bytes descending, then name", () => {
    const sorted = [
      candidate({ concern: "b", rc: RC_WARN, bytes: 100 }),
      candidate({ concern: "a", rc: RC_ALLOW, bytes: 100 }),
      candidate({ concern: "c", rc: RC_ALLOW, bytes: 900 }),
    ].sort(evictionOrder);
    expect(sorted.map((c) => c.concern)).toEqual(["c", "a", "b"]);
  });
});

describe("resolveVolumeCap — the three preconditions", () => {
  const PACKAGE_ROOT = path.resolve(__dirname, "..", "..", "..");
  const base = {
    packageRoot: PACKAGE_ROOT,
    envelope: { session_id: "s1", workspace_root: "/tmp/x" } as Record<string, unknown>,
    platform: "claude",
    event: "user_prompt_submit",
  };

  it("resolves a cap on the shipped configuration", () => {
    // The happy path is asserted first so the negatives below cannot pass by
    // accident on a tree where the row or the binding went missing.
    expect(resolveVolumeCap(base)).toBeGreaterThan(0);
  });

  it("is null on an unverified platform — its emission carries nothing", () => {
    expect(resolveVolumeCap({ ...base, platform: "cursor" })).toBeNull();
  });

  it("is null without a real session_id — the fallback key is unreadable", () => {
    expect(resolveVolumeCap({ ...base, envelope: { workspace_root: "/tmp/x" } })).toBeNull();
  });

  it("is null on an excluded slot — session_start above all", () => {
    expect(resolveVolumeCap({ ...base, event: "session_start" })).toBeNull();
  });

  it("is null when the package root carries no budget row", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "no-budget-"));
    try {
      expect(resolveVolumeCap({ ...base, packageRoot: empty })).toBeNull();
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it("is null when the platform does not bind the turn-start event", () => {
    // windsurf has no `user_prompt_submit` row, so the counter would never reset
    // and every droppable advisory would be suppressed for the rest of the
    // session. Guarded here because this precondition is read from the compiled
    // manifest rather than through the dispatcher's resolver.
    expect(resolveVolumeCap({ ...base, platform: "windsurf" })).toBeNull();
  });
});

describe("shapeAndRecord — only charges bytes the host receives", () => {
  // The module already skipped an unverified platform, whose `emitFor` returns
  // empty stdout AND stderr. It did NOT skip a reduced verdict of ALLOW, whose
  // `emitFor` returns exactly the same empty emission on the verified platform
  // too — so the turn was charged for output nobody got, and a LATER dispatch
  // whose advisory would have been delivered got dropped for it.
  //
  // Measured against this module before the fix: a 9,000-byte rc-0 message
  // emitted 0 bytes and charged 9,000 against a 47,104-byte ceiling.
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "shape-and-record-"));
    delete process.env["AGENT_CONFIG_REPLAY"];
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const SESSION = "shape-and-record-session";
  function ctxAt(event: string) {
    return {
      packageRoot: REPO_ROOT,
      envelope: { workspace_root: root, session_id: SESSION } as Record<string, unknown>,
      platform: "claude",
      event,
    };
  }
  function message(bytes: number, rc: number) {
    return { rc, text: "x".repeat(bytes), def: { name: "noisy-advisory", severity: "advisory" } };
  }

  it("charges nothing when the reduced verdict is ALLOW", () => {
    const kept = shapeAndRecord(ctxAt("post_tool_use"), [message(9000, RC_ALLOW)], RC_ALLOW);
    expect(kept).toHaveLength(1); // nothing shaped away
    expect(readTurnSpend(root, SESSION)).toBe(0);
  });

  it("charges nothing for an ALLOW verdict on the turn-start slot either", () => {
    const kept = shapeAndRecord(ctxAt("user_prompt_submit"), [message(9000, RC_ALLOW)], RC_ALLOW);
    expect(kept).toHaveLength(1);
    expect(readTurnSpend(root, SESSION)).toBe(0);
  });

  it("DOES charge a WARN verdict, which the host does emit", () => {
    const kept = shapeAndRecord(ctxAt("post_tool_use"), [message(600, RC_WARN)], RC_WARN);
    expect(kept).toHaveLength(1);
    expect(readTurnSpend(root, SESSION)).toBe(600);
  });

  it("a crashed concern cannot eat the turn ceiling", () => {
    // The dispatcher fail-opens a non-fail_closed crash to ALLOW and its stderr
    // becomes the deciding message — usually the largest candidate in the set.
    // Five of these used to exhaust the ceiling on text nobody received.
    for (let i = 0; i < 6; i += 1) {
      shapeAndRecord(ctxAt("post_tool_use"), [message(9000, RC_ALLOW)], RC_ALLOW);
    }
    expect(readTurnSpend(root, SESSION)).toBe(0);

    // …and a real, deliverable advisory afterwards is still eligible in full.
    const kept = shapeAndRecord(ctxAt("post_tool_use"), [message(600, RC_WARN)], RC_WARN);
    expect(kept).toHaveLength(1);
    expect(readTurnSpend(root, SESSION)).toBe(600);
  });

  // REGRESSION. The first version of the ALLOW skip returned BEFORE
  // recordTurnSpend, so a quiet user_prompt_submit — which reduces to ALLOW
  // whenever no concern fires — stopped resetting the counter and the previous
  // turn's total survived into the next one. My own two tests were blind to it:
  // one ran on a fresh tmp root where a missing reset and a working one both read
  // 0, the other used a prompt that reduces to WARN. This one seeds the counter
  // first, which is what makes the reset observable.
  it("a quiet ALLOW turn-start still RESETS the previous turn's total", () => {
    recordTurnSpend(root, SESSION, 30_000);
    expect(readTurnSpend(root, SESSION)).toBe(30_000);

    // No deciding message at all: exactly the shape `_reduce([])` produces.
    shapeAndRecord(ctxAt("user_prompt_submit"), [], RC_ALLOW);
    expect(readTurnSpend(root, SESSION)).toBe(0);
  });

  it("a quiet ALLOW mid-turn slot leaves the carried total alone", () => {
    recordTurnSpend(root, SESSION, 5_000);
    shapeAndRecord(ctxAt("post_tool_use"), [], RC_ALLOW);
    // Not a boundary, so nothing to reset — and nothing charged either.
    expect(readTurnSpend(root, SESSION)).toBe(5_000);
  });

  it("records no drop for an emission that never left", () => {
    shapeAndRecord(ctxAt("post_tool_use"), [message(90_000, RC_ALLOW)], RC_ALLOW);
    const log = path.join(root, "agents", "runtime", "state", "dispatch-issues.jsonl");
    expect(fs.existsSync(log)).toBe(false);
  });
});

describe("turn spend accounting", () => {
  let root: string;
  const session = "sess-1";

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "injection-turn-"));
    delete process.env["AGENT_CONFIG_REPLAY"];
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    delete process.env["AGENT_CONFIG_REPLAY"];
  });

  it("returns 0 for a missing file", () => {
    expect(readTurnSpend(root, session)).toBe(0);
  });

  it("accumulates within one session and resets on request", () => {
    recordTurnSpend(root, session, 100);
    recordTurnSpend(root, session, 250);
    expect(readTurnSpend(root, session)).toBe(350);
    recordTurnSpend(root, session, 50, { reset: true });
    expect(readTurnSpend(root, session)).toBe(50);
  });

  it("does not carry a count across sessions", () => {
    recordTurnSpend(root, session, 400);
    expect(readTurnSpend(root, "other-session")).toBe(0);
  });

  // Strengthened with the per-session store. The assertion above is satisfied
  // by a SHARED file too — a foreign id reads 0 because the record was
  // clobbered, which is exactly the defect it failed to detect. These two pin
  // the isolation itself: both counts survive, and the paths differ.
  it("isolates two concurrent sessions instead of letting them clobber", () => {
    recordTurnSpend(root, session, 400);
    recordTurnSpend(root, "other-session", 90);
    expect(readTurnSpend(root, session)).toBe(400);
    expect(readTurnSpend(root, "other-session")).toBe(90);
    expect(turnSpendPath(root, session)).not.toBe(turnSpendPath(root, "other-session"));
  });

  it("keeps a hostile session id inside the counter directory", () => {
    const nasty = "../../../etc/passwd";
    expect(path.dirname(turnSpendPath(root, nasty))).toBe(
      path.join(root, TURN_SPEND_DIR_REL),
    );
    recordTurnSpend(root, nasty, 10);
    expect(readTurnSpend(root, nasty)).toBe(10);
  });

  it("never collides two different ids onto one counter", () => {
    // Both sanitise to the same characters; only the digest separates them.
    const a = "sess/one";
    const b = "sess:one";
    expect(turnSpendKey(a)).not.toBe(turnSpendKey(b));
    recordTurnSpend(root, a, 30);
    recordTurnSpend(root, b, 70);
    expect(readTurnSpend(root, a)).toBe(30);
    expect(readTurnSpend(root, b)).toBe(70);
  });

  it("bounds the counter directory rather than growing without limit", () => {
    for (let i = 0; i < TURN_SPEND_MAX_FILES + 12; i += 1) {
      recordTurnSpend(root, `session-${String(i)}`, 5);
    }
    const kept = fs
      .readdirSync(path.join(root, TURN_SPEND_DIR_REL))
      .filter((n) => n.endsWith(".json"));
    expect(kept.length).toBeLessThanOrEqual(TURN_SPEND_MAX_FILES);
  });

  it("leaves no temp file behind after an atomic write", () => {
    recordTurnSpend(root, session, 42);
    const leftovers = fs
      .readdirSync(path.join(root, TURN_SPEND_DIR_REL))
      .filter((n) => n.endsWith(".tmp"));
    expect(leftovers).toEqual([]);
  });

  it("returns 0 for a malformed file rather than throwing", () => {
    fs.mkdirSync(path.dirname(turnSpendPath(root, session)), { recursive: true });
    fs.writeFileSync(turnSpendPath(root, session), "not json at all");
    expect(readTurnSpend(root, session)).toBe(0);
  });

  it("returns 0 for a negative or non-numeric byte count", () => {
    fs.mkdirSync(path.dirname(turnSpendPath(root, session)), { recursive: true });
    fs.writeFileSync(turnSpendPath(root, session), JSON.stringify({ session, bytes: -5 }));
    expect(readTurnSpend(root, session)).toBe(0);
    fs.writeFileSync(turnSpendPath(root, session), JSON.stringify({ session, bytes: "40" }));
    expect(readTurnSpend(root, session)).toBe(0);
  });

  it("writes nothing under replay — fixture runs never mutate state", () => {
    process.env["AGENT_CONFIG_REPLAY"] = "1";
    recordTurnSpend(root, session, 500);
    expect(fs.existsSync(turnSpendPath(root, session))).toBe(false);
  });

  it("carries no field capable of holding content", () => {
    recordTurnSpend(root, session, 120);
    const parsed = JSON.parse(fs.readFileSync(turnSpendPath(root, session), "utf-8")) as Record<
      string,
      unknown
    >;
    expect(Object.keys(parsed).sort()).toEqual(["bytes", "session"]);
  });
});
