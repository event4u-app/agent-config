// Tests for `--queue-root` on src/scripts/probe_turnaround.ts —
// road-to-agent-throughput-recovery step 1.3: a red `--against-baseline`
// reading reaches the self-repair queue as one dated record, and a run whose
// store resolves to an empty project directory is reported empty, never green.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { main } from "../../src/scripts/probe_turnaround.js";
import { listRecords } from "../../src/scripts/_lib/self_repair_store.js";

const T0 = Date.parse("2026-10-01T10:00:00.000Z");
const at = (s: number): string => new Date(T0 + s * 1000).toISOString();

/** One request, one tool call that waits `seconds`; 600 s is a regression, 5 s is not. */
function writeStore(seconds: number): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "probe-queue-store-"));
  const rows: unknown[] = [
    { type: "user", timestamp: at(0), message: { role: "user", content: "do the thing" } },
  ];
  const calls = [seconds, 1, 1];
  let clock = 1;
  calls.forEach((s, i) => {
    const id = `toolu_${String(i)}`;
    rows.push({
      type: "assistant",
      requestId: `req_${String(i)}`,
      timestamp: at(clock),
      message: {
        role: "assistant",
        usage: { input_tokens: 10, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0 },
        content: [
          { type: "tool_use", id, name: "Bash", input: { command: "ls" } },
          { type: "tool_use", id: `${id}b`, name: "Bash", input: { command: "ls" } },
        ],
      },
    });
    clock += s;
    rows.push({
      type: "user",
      timestamp: at(clock),
      message: {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: id, content: "ok" },
          { type: "tool_result", tool_use_id: `${id}b`, content: "ok" },
        ],
      },
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

function tmp(prefix: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  dirs.push(d);
  return d;
}

function run(argv: string[]): { code: number; err: string } {
  let err = "";
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    err += String(chunk);
    return true;
  });
  const code = main(argv);
  vi.restoreAllMocks();
  return { code, err };
}

describe("probe_turnaround --queue-root — 1.3", () => {
  it("routes a planted regression into the self-repair queue as one dated record", () => {
    const store = writeStore(600);
    dirs.push(store);
    const queue = tmp("probe-queue-root-");
    const { code } = run(["--store", store, "--include-current", "--against-baseline", "--queue-root", queue]);
    expect(code).toBe(1);
    const records = listRecords(queue);
    expect(records).toHaveLength(1);
    const rec = records[0]!;
    expect(rec.status).toBe("open");
    expect(rec.source).toBe("self-detected");
    expect(rec.evidence).toMatch(/^probe_turnaround regression \d{4}-\d{2}-\d{2}: /);
    expect(rec.evidence).toContain("blocking share");
    expect(rec.suggested_surface).toContain("road-to-agent-throughput-recovery");
  });

  it("folds a second red run on the same day into the same record", () => {
    const store = writeStore(600);
    dirs.push(store);
    const queue = tmp("probe-queue-root-");
    run(["--store", store, "--include-current", "--against-baseline", "--queue-root", queue]);
    run(["--store", store, "--include-current", "--against-baseline", "--queue-root", queue]);
    const records = listRecords(queue);
    expect(records).toHaveLength(1);
    expect(records[0]!.occurrences).toBe(2);
  });

  it("queues nothing when the reading is within the baseline", () => {
    const store = writeStore(5);
    dirs.push(store);
    const queue = tmp("probe-queue-root-");
    const { code } = run(["--store", store, "--include-current", "--against-baseline", "--queue-root", queue]);
    expect(code).toBe(0);
    expect(listRecords(queue)).toHaveLength(0);
  });

  it("queues nothing without --against-baseline, even over a red corpus", () => {
    const store = writeStore(600);
    dirs.push(store);
    const queue = tmp("probe-queue-root-");
    expect(run(["--store", store, "--include-current", "--queue-root", queue]).code).toBe(0);
    expect(listRecords(queue)).toHaveLength(0);
  });

  it("reports a worktree run without --store as an empty corpus, not green, and queues it as such", () => {
    const worktree = tmp("probe-queue-worktree-");
    const home = tmp("probe-queue-home-");
    const queue = tmp("probe-queue-root-");
    vi.stubEnv("HOME", home);
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(worktree);
    let err = "";
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      err += String(chunk);
      return true;
    });
    const code = main(["--against-baseline", "--queue-root", queue]);
    cwd.mockRestore();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    expect(code).toBe(1);
    expect(err).toContain("empty corpus");
    const records = listRecords(queue);
    expect(records).toHaveLength(1);
    expect(records[0]!.evidence).toContain("empty corpus");
  });

  it("rejects --queue-root without a value", () => {
    expect(run(["--against-baseline", "--queue-root"]).code).toBe(2);
  });
});
