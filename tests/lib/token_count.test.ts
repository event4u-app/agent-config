/**
 * Tests for `src/scripts/_lib/token_count.ts`.
 *
 * Two layers:
 *  1. The real-tokenizer path — `js-tiktoken` (cl100k_base) ships as a
 *     devDependency, so `TIKTOKEN_AVAILABLE` is true here and `gpt_tokens` /
 *     `measure` return EXACT BPE counts.
 *  2. The proxy fallback path — the `*_proxy` helpers implement the documented
 *     `chars / 4` (GPT) and `chars / 3.6` (Claude) estimates used when the
 *     tokenizer dependency is absent. A frozen differential block guards the
 *     proxy math against the original Python reference (tiktoken blocked in the
 *     driver so both runtimes take the deterministic proxy path).
 */

import { describe, expect, it } from "vitest";

import {
  TIKTOKEN_AVAILABLE,
  TokenCount,
  claude_tokens,
  gpt_tokens,
  gpt_tokens_proxy,
  measure,
  measure_proxy,
  method_note,
  method_note_proxy,
} from "../../src/scripts/_lib/token_count.js";
import { oracle2 } from "../_lib/parity_oracle.js";

describe("token_count real-tokenizer path (js-tiktoken cl100k_base)", () => {
  it("TIKTOKEN_AVAILABLE is true (js-tiktoken devDependency present)", () => {
    expect(TIKTOKEN_AVAILABLE).toBe(true);
  });

  it("gpt_tokens returns an exact BPE count, flagged exact", () => {
    const tc = gpt_tokens("hello world");
    expect(tc).toBeInstanceOf(TokenCount);
    // cl100k_base tokenises "hello world" as 2 tokens.
    expect(tc.tokens).toBe(2);
    expect(tc.exact).toBe(true);
  });

  it("the exact count differs from the chars/4 proxy (real tokenizer wired)", () => {
    // 40 repeated 'a' → chars/4 proxy = 10; cl100k merges the run far below 10.
    const text = "a".repeat(40);
    expect(gpt_tokens(text).tokens).toBeLessThan(gpt_tokens_proxy(text).tokens);
    expect(gpt_tokens(text).exact).toBe(true);
    expect(gpt_tokens_proxy(text).exact).toBe(false);
  });

  it("measure reports the exact GPT count + proxy Claude count", () => {
    expect(measure("hello world")).toEqual({
      chars: 11,
      tokens_gpt: 2, // exact (cl100k_base)
      tokens_gpt_exact: true,
      tokens_claude: 3, // proxy: round(11 / 3.6)
      tokens_claude_exact: false,
    });
  });

  it("TokenCount instances are frozen", () => {
    expect(Object.isFrozen(gpt_tokens("abc"))).toBe(true);
  });

  it("method_note names the exact tiktoken encoding", () => {
    expect(method_note()).toBe(
      "tokens_gpt: exact (tiktoken cl100k_base); tokens_claude: proxy (chars/3.6)",
    );
  });
});

describe("token_count proxy fallback math", () => {
  it("gpt_tokens_proxy uses the chars/4 proxy, flagged inexact", () => {
    const tc = gpt_tokens_proxy("a".repeat(40));
    expect(tc.tokens).toBe(10);
    expect(tc.exact).toBe(false);
  });

  it("claude_tokens uses the chars/3.6 proxy, flagged inexact", () => {
    const tc = claude_tokens("a".repeat(36));
    expect(tc.tokens).toBe(10);
    expect(tc.exact).toBe(false);
  });

  it("proxy rounding is banker's rounding (round half to even)", () => {
    // len 2 → 2/4 = 0.5 → rounds to 0 (ties to even), not 1.
    expect(gpt_tokens_proxy("ab").tokens).toBe(0);
    // len 6 → 6/4 = 1.5 → rounds to 2.
    expect(gpt_tokens_proxy("abcdef").tokens).toBe(2);
    // len 10 → 10/4 = 2.5 → rounds to 2 (ties to even).
    expect(gpt_tokens_proxy("a".repeat(10)).tokens).toBe(2);
  });

  it("chars counts code points, not UTF-16 units", () => {
    // "🎉" is one code point but two UTF-16 units.
    expect(measure_proxy("🎉").chars).toBe(1);
  });

  it("measure_proxy returns the five documented keys (proxy values)", () => {
    expect(measure_proxy("hello world")).toEqual({
      chars: 11,
      tokens_gpt: 3,
      tokens_gpt_exact: false,
      tokens_claude: 3,
      tokens_claude_exact: false,
    });
  });

  it("method_note_proxy names both proxies", () => {
    expect(method_note_proxy()).toBe(
      "tokens_gpt: proxy (chars/4.0, tiktoken not installed); " +
        "tokens_claude: proxy (chars/3.6)",
    );
  });
});

// ---------------------------------------------------------------------------
// Differential block — the original Python module is the reference for the
// PROXY math. tiktoken import is blocked in the driver so the Python module
// always takes the same proxy path the `*_proxy` helpers implement. The
// driver + input are unchanged, so the frozen oracle fixture still applies.
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
  it("measure_proxy() and method_note_proxy() match Python byte-for-byte", () => {
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
    // Oracle-routed (`kind: 'inline'`): replays the frozen Python proxy output;
    // the TS proxy helpers must match it byte-for-byte. Driver + input are
    // unchanged from the original suite, so the captured fixture still keys.
    const out = oracle2({
      kind: "inline",
      target: PY_DRIVER,
      input: JSON.stringify(texts),
    });
    expect(out.status, out.stderr).toBe(0);
    const py = JSON.parse(out.stdout) as PyResult;

    expect(py.tiktoken_available).toBe(false);
    texts.forEach((text, i) => {
      expect(
        measure_proxy(text),
        `text #${i}: ${JSON.stringify(text)}`,
      ).toEqual(py.measures[i]);
    });
    expect(method_note_proxy()).toBe(py.method_note);
  });
});
