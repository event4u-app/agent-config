// Tests for the throughput extension of src/scripts/probe_turnaround.ts —
// road-to-agent-throughput-recovery step 1.1.
//
// Each classifier rule gets a case that only that rule can satisfy, so
// neutralising one rule turns exactly its case red.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkSum,
  classifyTurnEnd,
  isUsageLimitPause,
  isUsageLimitReset,
  median,
  nightKey,
  readyAtZero,
  standingRules,
  tallyExclusive,
  tallyNights,
  TURN_END_CLASSES,
} from "../../src/scripts/_lib/turnaround_throughput.js";
import { isGitPushCall, main, measureDetailed, parseWindows } from "../../src/scripts/probe_turnaround.js";

describe("classifyTurnEnd", () => {
  it("reads numbered options plus a recommendation line as a structured ask", () => {
    const text = "Two ways:\n\n1. Ship it\n2. Park it\n\n**Recommendation: 1** — smaller.";
    expect(classifyTurnEnd(text)).toBe("structured-ask");
  });

  it("reads the German recommendation label too", () => {
    expect(classifyTurnEnd("1. A\n2. B\n\nEmpfehlung: 2")).toBe("structured-ask");
  });

  it("does not read numbered options without a recommendation line as structured", () => {
    expect(classifyTurnEnd("Steps done:\n1. sync\n2. build")).toBe("other");
  });

  it("does not read a lone recommendation line without two options as structured", () => {
    expect(classifyTurnEnd("1. Ship it\n\nRecommendation: ship it.")).toBe("other");
  });

  it("reads a closing question as a plain-text ask", () => {
    expect(classifyTurnEnd("Done with the sync.\n\nShall I open the PR now?")).toBe("plain-ask");
  });

  it("ignores a question mark inside a trailing code fence", () => {
    expect(classifyTurnEnd("Ran it.\n\n```\nwhy?\n```")).toBe("other");
  });

  it("reads a summary as other", () => {
    expect(classifyTurnEnd("PR #12 is green.\nhttps://example.invalid/pr/12")).toBe("other");
  });
});

describe("usage-limit events", () => {
  it("recognises the host's pause and reset banners and nothing else", () => {
    expect(isUsageLimitPause({ type: "system", subtype: "informational", content: "Usage limit reached · continuing automatically at 2:50am" })).toBe(true);
    expect(isUsageLimitPause({ type: "system", subtype: "informational", content: "Usage limit reached again after you continued · continuing" })).toBe(true);
    expect(isUsageLimitPause({ type: "user", content: "Usage limit reached" })).toBe(false);
    expect(isUsageLimitReset({ type: "system", subtype: "informational", content: "Usage limit reset · continuing automatically" })).toBe(true);
    expect(isUsageLimitReset({ type: "system", subtype: "informational", content: "Usage limit reached · x" })).toBe(false);
  });
});

describe("nightKey", () => {
  it("assigns 22:00-08:00 Europe/Berlin to the evening it started", () => {
    // 2026-10-02T23:30 Berlin (CEST, UTC+2) = 21:30Z
    expect(nightKey(Date.parse("2026-10-02T21:30:00Z"))).toBe("2026-10-02");
    // 2026-10-03T03:00 Berlin = 01:00Z belongs to the night of 10-02
    expect(nightKey(Date.parse("2026-10-03T01:00:00Z"))).toBe("2026-10-02");
    // 2026-10-03T12:00 Berlin is day
    expect(nightKey(Date.parse("2026-10-03T10:00:00Z"))).toBeNull();
  });

  it("follows the winter offset", () => {
    // 2026-12-01T22:30 Berlin (CET, UTC+1) = 21:30Z; 21:30Z in summer would be 23:30
    expect(nightKey(Date.parse("2026-12-01T21:30:00Z"))).toBe("2026-12-01");
    // 2026-12-01T21:30 Berlin = 20:30Z is still evening, not night
    expect(nightKey(Date.parse("2026-12-01T20:30:00Z"))).toBeNull();
  });
});

describe("tallyNights", () => {
  it("counts merged changes, true merges, net ticks and archives per active night", () => {
    const night = Date.parse("2026-10-02T22:00:00Z"); // 00:00 Berlin, night of 10-02
    const day = Date.parse("2026-10-03T10:00:00Z");
    const next = Date.parse("2026-10-03T21:00:00Z"); // 23:00 Berlin, night of 10-03
    const r = tallyNights(
      [
        { epochMs: night, parents: 1, ticked: 5, archived: 1 },
        { epochMs: night + 60_000, parents: 2, ticked: -1, archived: 0 },
        { epochMs: day, parents: 1, ticked: 40, archived: 3 },
        { epochMs: next, parents: 1, ticked: 2, archived: 0 },
      ],
      "2026-10-01",
      "2026-10-03",
    );
    expect(r).toEqual({ nights: 2, commits: 3, trueMerges: 1, netTicked: 6, archived: 1 });
  });

  it("drops nights outside the window", () => {
    const r = tallyNights([{ epochMs: Date.parse("2026-09-30T22:00:00Z"), parents: 1, ticked: 9, archived: 0 }], "2026-10-01", "2026-10-03");
    expect(r.nights).toBe(0);
  });
});

describe("standing figures", () => {
  it("counts ready roadmaps and those with no ticked step", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "probe-estate-"));
    fs.writeFileSync(path.join(dir, "a.md"), "---\nstatus: ready\n---\n- [ ] one\n      blocked-by: x\n- [ ] two\n## H\nblocked-by: not a step\n");
    fs.writeFileSync(path.join(dir, "b.md"), "---\nstatus: ready\n---\n- [x] one\n- [ ] two\n");
    fs.writeFileSync(path.join(dir, "c.md"), "---\nstatus: draft\n---\n- [ ] one\n");
    expect(readyAtZero(dir)).toEqual({ ready: 2, atZero: 1, openSteps: 4, unblocked: 3 });
  });

  it("counts rule files without a frontmatter paths key as standing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "probe-rules-"));
    fs.writeFileSync(path.join(dir, "scoped.md"), "---\npaths:\n  - src/**\n---\nbody\n");
    fs.writeFileSync(path.join(dir, "always.md"), "---\ntype: always\n---\nbody mentions paths: here\n");
    fs.writeFileSync(path.join(dir, "bare.md"), "no frontmatter\n");
    expect(standingRules(dir)).toEqual({ files: 3, withoutPaths: 2 });
  });

  it("takes the median of odd and even lists, null when empty", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("reads a push behind a cd or a global git option, and nothing else", () => {
    expect(isGitPushCall("Bash", { command: "cd ../lane && git -C x push -u origin b" })).toBe(true);
    expect(isGitPushCall("Bash", { command: "git fetch origin" })).toBe(false);
    expect(isGitPushCall("Bash", { command: "git commit -m 'then git push'" })).toBe(false);
    expect(isGitPushCall("Read", { command: "git push" })).toBe(false);
  });
});

describe("parseWindows", () => {
  it("reads one or several windows and refuses a malformed one", () => {
    expect(parseWindows("2026-08-10..2026-08-23")).toEqual([["2026-08-10", "2026-08-23"]]);
    expect(parseWindows("2026-08-10..2026-08-23,2026-09-28..2026-10-13")).toHaveLength(2);
    expect(parseWindows("2026-08-10..2026-08-23,last-week")).toBeNull();
  });
});

describe("sum check", () => {
  it("passes when exclusive labels sum to the total", () => {
    const t = tallyExclusive(["a", "b", "c"], ["x", "y"], (s) => [s === "a" ? "x" : "y"]);
    expect(t.total).toBe(3);
    expect(checkSum("fixture", t.rows, t.total)).toBeNull();
  });

  it("fails when a labeller hands one row two labels", () => {
    const t = tallyExclusive(["a", "b"], ["x", "y"], (s) => (s === "a" ? ["x", "y"] : ["y"]));
    expect(checkSum("fixture", t.rows, t.total)).toMatch(/fixture: rows sum to 3, total is 2/);
  });

  it("counts a row with no label as unknown rather than dropping it", () => {
    const t = tallyExclusive(["a"], ["x"], () => []);
    expect(t.rows["unknown"]).toBe(1);
    expect(checkSum("fixture", t.rows, t.total)).toBeNull();
  });
});

const T0 = Date.parse("2026-10-02T20:00:00.000Z"); // 22:00 Berlin
const at = (s: number): string => new Date(T0 + s * 1000).toISOString();

function writeStore(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "probe-throughput-"));
  const assistant = (rid: string, s: number, text: string): unknown => ({
    type: "assistant",
    requestId: rid,
    timestamp: at(s),
    message: { role: "assistant", content: [{ type: "text", text }] },
  });
  const user = (s: number, text: string): unknown => ({ type: "user", timestamp: at(s), message: { role: "user", content: text } });
  const rows = [
    user(0, "go"),
    assistant("r1", 10, "1. A\n2. B\n\nRecommendation: 1"),
    user(20, "1"),
    assistant("r2", 30, "Done. Open the PR?"),
    user(40, "ja"),
    { type: "system", subtype: "informational", timestamp: at(50), content: "Usage limit reached · continuing automatically at 2:50am" },
    { type: "system", subtype: "informational", timestamp: at(50 + 30 * 60), content: "Usage limit reset · continuing automatically" },
    {
      type: "assistant",
      requestId: "r3a",
      timestamp: at(55 + 30 * 60),
      message: { role: "assistant", content: [{ type: "tool_use", id: "tp1", name: "Bash", input: { command: "git push -u origin b" } }] },
    },
    { type: "user", timestamp: at(57 + 30 * 60), message: { role: "user", content: [{ type: "tool_result", tool_use_id: "tp1", content: "ok" }] } },
    assistant("r3", 60 + 30 * 60, "PR is green."),
    // a day-time pause: 2026-10-03T12:00 Berlin
    { type: "system", subtype: "informational", timestamp: "2026-10-03T10:00:00.000Z", content: "Usage limit reached · continuing automatically at 1:00pm" },
  ];
  fs.writeFileSync(path.join(dir, "s1.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n"));
  return dir;
}

describe("measureDetailed — throughput fields", () => {
  it("classifies each turn end once and splits pauses night/day", () => {
    const store = writeStore();
    const { throughput } = measureDetailed([path.join(store, "s1.jsonl")]);
    expect(throughput.turnEnds.total).toBe(3);
    expect(throughput.turnEnds.rows).toEqual({ "structured-ask": 1, "plain-ask": 1, other: 1, unknown: 0 });
    expect(throughput.pauses).toEqual({ total: 2, night: 1, day: 1, pausedMinutes: 30, unresolved: 1 });
    expect(throughput.push).toEqual({ calls: 1, medianSeconds: 2 });
    expect(TURN_END_CLASSES).toContain("unknown");
  });
});

describe("main — the new sections", () => {
  afterEach(() => vi.restoreAllMocks());

  it("prints asks, pauses and refusals, and exits 0 in report mode", () => {
    const store = writeStore();
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "probe-ws-"));
    const stateDir = path.join(workspace, "agents", "runtime", "state", "turn-end-gate");
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, "abc.json"),
      JSON.stringify({ refused_at: "2026-10-02T21:00:00Z", refused_turn: 4, detector: "language", counts: { language: 2, verification: 1 } }),
    );
    let out = "";
    vi.spyOn(process.stdout, "write").mockImplementation((s: string | Uint8Array) => {
      out += String(s);
      return true;
    });
    const rules = fs.mkdtempSync(path.join(os.tmpdir(), "probe-rules-"));
    fs.writeFileSync(path.join(rules, "r.md"), "---\ntype: always\n---\n");
    const code = main(["--store", store, "--include-current", "--workspace", workspace, "--rules-dir", rules]);
    expect(code).toBe(0);
    expect(out).toMatch(/turn ends\s+3/);
    expect(out).toMatch(/structured-ask\s+1/);
    expect(out).toMatch(/usage-limit pauses\s+2 \(night 1, day 1\)/);
    expect(out).toMatch(/turn-end refusals\s+3 in 1 session/);
    expect(out).toMatch(/language\s+2/);
    expect(out).toMatch(/git push\s+1 call\(s\), p50 2 s/);
    expect(out).toMatch(/standing rule files\s+1, 1 without/);
    expect(out).toMatch(/ready roadmaps at 0 ticked\s+\d+ of \d+/);
    expect(out).not.toMatch(/Open the PR/);
  });
});
