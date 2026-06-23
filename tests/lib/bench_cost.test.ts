/**
 * Tests for `src/scripts/_lib/bench_cost.ts`.
 *
 * The Python module `src/scripts/_lib/bench_cost.py` has no dedicated pytest
 * suite, so this is a focused differential suite (ADR-088 Phase 2 / Wave 2a):
 *
 * - unit checks over temp pricing.yaml + sessions.jsonl files (missing-file
 *   unavailable block, per-tier aggregation, recompute-from-rates fallback,
 *   unknown-tier coalescing, 6-decimal rounding, oldest-sourced-on);
 * - a differential block that drives the Python `aggregate_sessions` over the
 *   same temp files and asserts JSON-identical cost-block output (ADR-088
 *   parity gate 2, golden replay).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  aggregate_sessions,
  load_pricing,
  unavailable_block,
} from "../../src/scripts/_lib/bench_cost.js";

const __dirname_ts = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname_ts, "..", "..");

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bench-cost-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const PRICING_YAML = `version: 1
models:
  - tier: haiku
    sourced_on: 2026-05-14
    input: 0.25
    output: 1.25
    cache_write: 0.30
    cache_read: 0.03
  - tier: sonnet
    sourced_on: 2026-04-01
    input: 3.0
    output: 15.0
    cache_write: 3.75
    cache_read: 0.30
`;

function writePricing(): string {
  const p = path.join(tmp, "pricing.yaml");
  fs.writeFileSync(p, PRICING_YAML);
  return p;
}

function writeSessions(lines: object[]): string {
  const p = path.join(tmp, "sessions.jsonl");
  fs.writeFileSync(p, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  return p;
}

describe("load_pricing", () => {
  it("returns empty rates + null when the file is missing", () => {
    const [rates, oldest] = load_pricing(path.join(tmp, "nope.yaml"));
    expect(rates).toEqual({});
    expect(oldest).toBeNull();
  });

  it("parses rates and picks the oldest sourced_on (date → ISO string)", () => {
    const [rates, oldest] = load_pricing(writePricing());
    expect(rates["haiku"]).toEqual({
      input: 0.25,
      output: 1.25,
      cache_write: 0.3,
      cache_read: 0.03,
    });
    expect(rates["sonnet"]!.output).toBe(15.0);
    expect(oldest).toBe("2026-04-01");
  });
});

describe("unavailable_block", () => {
  it("matches the schema sentinel shape", () => {
    const block = unavailable_block("sessions_jsonl_missing", "/x/y.jsonl", "2026-04-01");
    expect(block.source).toBe("unavailable");
    expect(block.reason).toBe("sessions_jsonl_missing");
    expect(block.scanned_path).toBe("/x/y.jsonl");
    expect(block.sessions_scanned).toBe(0);
    expect(block.totals.total_cost_usd).toBe(0.0);
    expect(Object.keys(block.per_tier).sort()).toEqual(
      ["haiku", "opus", "sonnet", "unknown"].sort(),
    );
    expect(block.pricing_sourced_on).toBe("2026-04-01");
  });
});

describe("aggregate_sessions", () => {
  it("returns the unavailable block when sessions.jsonl is missing", () => {
    const block = aggregate_sessions(path.join(tmp, "none.jsonl"), writePricing());
    expect(block.source).toBe("unavailable");
    expect(block.reason).toBe("sessions_jsonl_missing");
    expect(block.pricing_sourced_on).toBe("2026-04-01");
  });

  it("trusts upstream cost when nonzero and aggregates per tier", () => {
    const sessions = writeSessions([
      {
        byModel: {
          "claude-haiku": {
            tier: "haiku",
            input_tokens: 1000,
            output_tokens: 500,
            cache_read_input_tokens: 200,
            cache_creation_input_tokens: 100,
            messages: 4,
            cost_usd: 0.123456,
          },
        },
      },
    ]);
    const block = aggregate_sessions(sessions, writePricing());
    expect(block.sessions_scanned).toBe(1);
    expect(block.totals.input_tokens).toBe(1000);
    expect(block.totals.output_tokens).toBe(500);
    expect(block.totals.total_cost_usd).toBe(0.123456);
    expect(block.per_tier["haiku"]).toEqual({ messages: 4, cost_usd: 0.123456 });
  });

  it("recomputes cost from rates when upstream cost is zero", () => {
    const sessions = writeSessions([
      {
        byModel: {
          "claude-haiku": {
            tier: "haiku",
            input_tokens: 1_000_000,
            output_tokens: 1_000_000,
            cache_creation_input_tokens: 1_000_000,
            cache_read_input_tokens: 1_000_000,
            messages: 1,
            cost_usd: 0,
          },
        },
      },
    ]);
    const block = aggregate_sessions(sessions, writePricing());
    // 1M each → 0.25 + 1.25 + 0.30 + 0.03 = 1.83
    expect(block.totals.total_cost_usd).toBe(1.83);
    expect(block.per_tier["haiku"]!.cost_usd).toBe(1.83);
  });

  it("coalesces an unknown tier into the 'unknown' bucket", () => {
    const sessions = writeSessions([
      {
        byModel: {
          "weird-model": {
            tier: "gpt-9",
            input_tokens: 10,
            messages: 2,
            cost_usd: 0.5,
          },
        },
      },
    ]);
    const block = aggregate_sessions(sessions, writePricing());
    expect(block.per_tier["unknown"]).toEqual({ messages: 2, cost_usd: 0.5 });
    expect(block.per_tier["gpt-9"]).toBeUndefined();
  });

  it("defaults a missing tier key to 'unknown'", () => {
    const sessions = writeSessions([
      { byModel: { m: { input_tokens: 5, messages: 1, cost_usd: 0.1 } } },
    ]);
    const block = aggregate_sessions(sessions, writePricing());
    expect(block.per_tier["unknown"]!.messages).toBe(1);
  });

  it("skips blank and malformed jsonl lines but still counts valid ones", () => {
    const p = path.join(tmp, "sessions.jsonl");
    fs.writeFileSync(
      p,
      [
        "",
        "{ not json",
        JSON.stringify({ byModel: { m: { tier: "sonnet", messages: 3, cost_usd: 0.2 } } }),
        "   ",
      ].join("\n"),
    );
    const block = aggregate_sessions(p, writePricing());
    // Blank lines are skipped before the counter; the malformed line is counted
    // then `continue`d (Python increments sessions_scanned before json.loads?
    // No — Python json.loads is BEFORE the increment via try/except continue).
    expect(block.sessions_scanned).toBe(1);
    expect(block.per_tier["sonnet"]!.messages).toBe(3);
  });
});

interface CostFixture {
  name: string;
  sessions: object[];
}

const FIXTURES: CostFixture[] = [
  {
    name: "mixed tiers, trusted cost",
    sessions: [
      {
        byModel: {
          a: { tier: "haiku", input_tokens: 1234, output_tokens: 56, messages: 2, cost_usd: 0.001234 },
          b: { tier: "sonnet", input_tokens: 9000, output_tokens: 800, messages: 5, cost_usd: 0.045678 },
        },
      },
      {
        byModel: {
          c: { tier: "opus", input_tokens: 100, messages: 1, cost_usd: 0.009999 },
        },
      },
    ],
  },
  {
    name: "zero cost recompute from rates",
    sessions: [
      {
        byModel: {
          a: {
            tier: "haiku",
            input_tokens: 333333,
            output_tokens: 77777,
            cache_creation_input_tokens: 11111,
            cache_read_input_tokens: 222222,
            messages: 3,
            cost_usd: 0,
          },
          b: {
            tier: "sonnet",
            input_tokens: 50000,
            output_tokens: 20000,
            messages: 2,
            cost_usd: 0,
          },
        },
      },
    ],
  },
  {
    name: "unknown + missing tier coalescing",
    sessions: [
      { byModel: { x: { tier: "gpt-9", input_tokens: 10, messages: 1, cost_usd: 0.5 } } },
      { byModel: { y: { input_tokens: 20, messages: 4, cost_usd: 0.25 } } },
    ],
  },
  {
    name: "rounding-sensitive accumulation",
    sessions: [
      { byModel: { a: { tier: "haiku", messages: 1, cost_usd: 0.1111115 } } },
      { byModel: { b: { tier: "haiku", messages: 1, cost_usd: 0.1111115 } } },
      { byModel: { c: { tier: "haiku", messages: 1, cost_usd: 0.0000005 } } },
    ],
  },
];

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "-");
}

/** Recursively sort object keys so structural compare ignores field order. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonical((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}
