// Tests for the cause axis of src/scripts/probe_turnaround.ts —
// road-to-blocking-time-by-cause Phase 1.
//
// The fixture is one transcript with exactly one blocking call per cause, one
// call no rule matches, and one call under the threshold. Each blocking call
// waits a distinct number of seconds, so a per-cause total can only come out
// right if every call landed in its own row.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BLOCKING_CAUSES,
  classifyBlockingCall,
  main,
  measure,
} from "../../src/scripts/probe_turnaround.js";

const T0 = Date.parse("2026-10-01T10:00:00.000Z");
const at = (s: number): string => new Date(T0 + s * 1000).toISOString();

interface Call {
  name: string;
  input: Record<string, unknown>;
  seconds: number;
}

// One per cause, in BLOCKING_CAUSES order, then the short call.
const CALLS: readonly Call[] = [
  { name: "Bash", input: { command: "cd ../lane; ./scripts-run src/scripts/ci_settle 2206 --timeout-min 28" }, seconds: 601 },
  { name: "Agent", input: { description: "drain one roadmap", prompt: "…" }, seconds: 602 },
  { name: "Bash", input: { command: "npx vitest run tests/scripts/x.test.ts" }, seconds: 603 },
  { name: "Bash", input: { command: "task sync && task generate-tools" }, seconds: 604 },
  { name: "Bash", input: { command: "git push -u origin feature/x 2>&1" }, seconds: 605 },
  { name: "Bash", input: { command: "sleep 240; gh pr view 12" }, seconds: 606 },
  { name: "mcp__claude_ai_Atlassian_Rovo__search", input: { query: "x" }, seconds: 607 },
  { name: "Bash", input: { command: "perl -i -pe 's/a/b/' some/file.md" }, seconds: 608 },
  { name: "Bash", input: { command: "ls" }, seconds: 5 },
];

function writeFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "probe-causes-"));
  const rows: unknown[] = [
    { type: "user", timestamp: at(0), message: { role: "user", content: "do the thing" } },
  ];
  let clock = 1;
  CALLS.forEach((c, i) => {
    const id = `toolu_${String(i)}`;
    rows.push({
      type: "assistant",
      requestId: `req_${String(i)}`,
      timestamp: at(clock),
      message: {
        role: "assistant",
        usage: { input_tokens: 10, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0 },
        content: [{ type: "tool_use", id, name: c.name, input: c.input }],
      },
    });
    clock += c.seconds;
    rows.push({
      type: "user",
      timestamp: at(clock),
      message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: "ok" }] },
    });
    clock += 1;
  });
  fs.writeFileSync(path.join(dir, "session-a.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return dir;
}

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function captureMain(argv: string[]): { code: number; out: string } {
  let out = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    out += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const code = main(argv);
  vi.restoreAllMocks();
  return { code, out };
}

describe("classifyBlockingCall — 1.1", () => {
  it("is a closed set with unknown last", () => {
    expect(BLOCKING_CAUSES).toEqual([
      "ci-wait",
      "subagent-wait",
      "test",
      "build",
      "network",
      "sleep-poll",
      "mcp",
      "unknown",
    ]);
  });

  it("assigns each fixture call exactly its cause", () => {
    const got = CALLS.slice(0, 8).map((c) => classifyBlockingCall(c.name, c.input));
    expect(got).toEqual([...BLOCKING_CAUSES]);
  });

  it("looks past a cd / env-assignment prefix to the command that waited", () => {
    expect(classifyBlockingCall("Bash", { command: "SP=/tmp/x; cd /tmp/y && npx vitest run" })).toBe("test");
    expect(classifyBlockingCall("Bash", { command: "cd ../a; gh pr checks 12 --watch" })).toBe("ci-wait");
  });

  it("never invents a cause for an unmatched call", () => {
    expect(classifyBlockingCall("SomeNewTool", {})).toBe("unknown");
    expect(classifyBlockingCall("Bash", {})).toBe("unknown");
  });
});

describe("minutes per cause — 1.2", () => {
  it("sums blocking seconds into the right row and keeps every cause present", () => {
    const dir = writeFixture();
    dirs.push(dir);
    const t = measure([path.join(dir, "session-a.jsonl")]);
    expect(Object.keys(t.blockingByCause)).toEqual([...BLOCKING_CAUSES]);
    BLOCKING_CAUSES.forEach((cause, i) => {
      expect(t.blockingByCause[cause]).toEqual({ calls: 1, seconds: 601 + i });
    });
  });

  it("prints the unknown row even when it is zero", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "probe-causes-"));
    dirs.push(dir);
    const rows = [
      { type: "user", timestamp: at(0), message: { role: "user", content: "go" } },
      {
        type: "assistant",
        requestId: "req_0",
        timestamp: at(1),
        message: { role: "assistant", content: [{ type: "tool_use", id: "t0", name: "Agent", input: {} }] },
      },
      { type: "user", timestamp: at(100), message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t0" }] } },
    ];
    fs.writeFileSync(path.join(dir, "s.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
    const { out } = captureMain(["--store", dir, "--include-current"]);
    expect(out).toMatch(/^ {4}unknown +0 call\(s\), 0 min$/m);
  });

  it("leaves the four existing figures byte-identical", () => {
    const dir = writeFixture();
    dirs.push(dir);
    const { code, out } = captureMain(["--store", dir, "--include-current"]);
    expect(code).toBe(0);
    // Pinned from the probe BEFORE the cause axis existed, on this fixture.
    expect(out).toContain(
      [
        "  API calls per user request   9  (9 calls / 1 requests)",
        "  mean tool-call batch size    1  (9 tool calls / 9 tool-using requests)",
        "  blocking tail (>60s)        8 call(s), 81 min = 99.9 % of 81 min tool time",
      ].join("\n"),
    );
    expect(out).toContain("  first-call context floor     1010–1010 tokens");
  });

  it("does not change the --against-baseline verdict", () => {
    const dir = writeFixture();
    dirs.push(dir);
    // 0.999 blocking share is above the 0.6202 baseline → a regression, exit 1.
    expect(captureMain(["--store", dir, "--include-current", "--against-baseline"]).code).toBe(1);
  });
});
