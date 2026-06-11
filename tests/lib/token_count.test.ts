/**
 * Tests for `src/scripts/_lib/token_count.ts`.
 *
 * The Python module has no dedicated pytest suite, so this is a focused
 * differential suite (ADR-088 Phase 2 / Wave 1): unit checks for the
 * proxy math plus a differential block that drives the Python original
 * via `python3 -c` (with tiktoken import blocked so both runtimes take
 * the deterministic proxy path) and asserts identical output.
 */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

import {
  TIKTOKEN_AVAILABLE,
  TokenCount,
  claude_tokens,
  gpt_tokens,
  measure,
  method_note,
} from "../../src/scripts/_lib/token_count.js";

describe("token_count unit behaviour", () => {
  it("TIKTOKEN_AVAILABLE is false in the TS twin (proxy-only)", () => {
    expect(TIKTOKEN_AVAILABLE).toBe(false);
  });

  it("gpt_tokens uses the chars/4 proxy, flagged inexact", () => {
    const tc = gpt_tokens("a".repeat(40));
    expect(tc).toBeInstanceOf(TokenCount);
    expect(tc.tokens).toBe(10);
    expect(tc.exact).toBe(false);
  });

  it("claude_tokens uses the chars/3.6 proxy, flagged inexact", () => {
    const tc = claude_tokens("a".repeat(36));
    expect(tc.tokens).toBe(10);
    expect(tc.exact).toBe(false);
  });

  it("TokenCount instances are frozen (dataclass frozen=True parity)", () => {
    const tc = gpt_tokens("abc");
    expect(Object.isFrozen(tc)).toBe(true);
  });

  it("rounding is banker's rounding (Python round() parity)", () => {
    // len 2 → 2/4 = 0.5 → rounds to 0 (ties to even), not 1.
    expect(gpt_tokens("ab").tokens).toBe(0);
    // len 6 → 6/4 = 1.5 → rounds to 2.
    expect(gpt_tokens("abcdef").tokens).toBe(2);
    // len 10 → 10/4 = 2.5 → rounds to 2 (ties to even).
    expect(gpt_tokens("a".repeat(10)).tokens).toBe(2);
  });

  it("chars counts code points, not UTF-16 units", () => {
    // "🎉" is one code point but two UTF-16 units.
    expect(measure("🎉").chars).toBe(1);
  });

  it("measure returns the five documented keys", () => {
    expect(measure("hello world")).toEqual({
      chars: 11,
      tokens_gpt: 3,
      tokens_gpt_exact: false,
      tokens_claude: 3,
      tokens_claude_exact: false,
    });
  });

  it("method_note names both proxies when tiktoken is unavailable", () => {
    expect(method_note()).toBe(
      "tokens_gpt: proxy (chars/4.0, tiktoken not installed); " +
        "tokens_claude: proxy (chars/3.6)",
    );
  });
});

// ---------------------------------------------------------------------------
// Differential block — Python module is the reference implementation.
// tiktoken import is blocked in the driver so the Python module always
// takes the same proxy path the TS twin implements.
// ---------------------------------------------------------------------------

const PY_DRIVER = `
import json, os, sys
sys.path.insert(0, os.path.join(os.getcwd(), "src"))
# Force the proxy path: block the optional tiktoken import so the
# differential comparison is deterministic regardless of the local env.
sys.modules["tiktoken"] = None
from scripts._lib import token_count as tc

texts = json.load(sys.stdin)
out = {
    "measures": [tc.measure(t) for t in texts],
    "method_note": tc.method_note(),
    "tiktoken_available": tc.TIKTOKEN_AVAILABLE,
}
print(json.dumps(out))
`;

interface PyResult {
  measures: Array<Record<string, unknown>>;
  method_note: string;
  tiktoken_available: boolean;
}

describe("differential vs Python reference (proxy path)", () => {
  it("measure() and method_note() match Python byte-for-byte", () => {
    const texts = [
      "",
      "a",
      "ab", // /4 tie → banker's rounding
      "abcdef",
      "a".repeat(10),
      "hello world",
      "Grüße ☃ naïve", // non-ASCII BMP
      "🎉🎉🎉 emoji party", // astral code points
      "line\nbreak\ttab and a markdown # heading\n- bullet\n",
      "x".repeat(1234),
    ];
    const stdout = execFileSync("python3", ["-c", PY_DRIVER], {
      input: JSON.stringify(texts),
      encoding: "utf-8",
    });
    const py = JSON.parse(stdout) as PyResult;

    expect(py.tiktoken_available).toBe(false);
    texts.forEach((text, i) => {
      expect(measure(text), `text #${i}: ${JSON.stringify(text)}`).toEqual(
        py.measures[i],
      );
    });
    expect(method_note()).toBe(py.method_note);
  });
});
