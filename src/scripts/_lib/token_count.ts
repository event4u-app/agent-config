/**
 * Real-tokenizer counting for the budget tooling
 * (roadmap 0B.1 → token-saving Phase 0, "real tokenizer into the bench path").
 *
 * `char != token`. Every budget in this suite is historically in characters;
 * this helper reports a token count *alongside* chars so chars stay the cheap
 * proxy and tokens become the truth where a real tokenizer is available.
 *
 * Design — optional dependency, graceful proxy fallback, **synchronous** API:
 *
 * - **GPT** — uses `js-tiktoken` (encoding `cl100k_base`) when the dependency
 *   is present, producing EXACT BPE counts flagged `exact: true`. `js-tiktoken`
 *   is a build/measurement-time **devDependency** (consumed by the bench /
 *   audit tooling, never shipped to a consumer runtime). When it is absent —
 *   e.g. a consumer that installed without devDependencies — the module falls
 *   back to the documented `chars / 4` proxy flagged `exact: false`. The
 *   optional load is a synchronous `createRequire(...)` inside a try/catch so
 *   the public `measure()` / `gpt_tokens()` API stays synchronous and never
 *   hard-fails on a missing dependency (no mandatory install, no network).
 * - **Claude** — no offline Claude tokenizer exists; documented `chars / 3.6`
 *   proxy, always `exact: false`. (Anthropic's exact count is API-only.)
 *
 * Both proxies are intentionally conservative ratios drawn from English-prose +
 * markdown samples; they are estimates, never gates.
 *
 * The `*_proxy` helpers (`gpt_tokens_proxy`, `measure_proxy`,
 * `method_note_proxy`) expose the fallback math directly — they are used by the
 * fallback regression guard in the test suite and by any report that wants to
 * record both the exact and the proxy count to flag the delta.
 *
 * Parity notes: "chars" counts Unicode code points (`len(str)` parity), not
 * UTF-16 units; proxy rounding is banker's rounding.
 */

import { createRequire } from "node:module";

// Proxy ratios (chars per token) for the no-tokenizer fallback. Tuned for
// English markdown rule/skill prose; deliberately conservative.
const _GPT_CHARS_PER_TOKEN = 4.0;
const _CLAUDE_CHARS_PER_TOKEN = 3.6;

// Roadmap (token-saving Phase 0) mandates the `cl100k_base` encoding. The
// dependency also bundles `o200k_base` (GPT-4o / GPT-4.1 family); switching the
// GPT count basis is a one-line change to this constant. The exact-vs-proxy
// delta is recorded in every report via `method_note()`.
const _TIKTOKEN_ENCODING = "cl100k_base";

/** Minimal structural type for the js-tiktoken encoder we rely on. */
interface _Encoder {
  encode(text: string): number[];
}

/**
 * Load the optional `js-tiktoken` encoder synchronously, returning `null` when
 * the dependency is absent or fails to initialise (graceful proxy fallback).
 * `createRequire` resolves the CJS build so the call stays synchronous even
 * though this module is ESM.
 */
function _loadEncoder(): _Encoder | null {
  try {
    const require = createRequire(import.meta.url);
    const mod = require("js-tiktoken") as {
      getEncoding(name: string): _Encoder;
    };
    return mod.getEncoding(_TIKTOKEN_ENCODING);
  } catch {
    return null;
  }
}

// Resolved once at module load. js-tiktoken's `getEncoding` is synchronous with
// bundled rank tables, so eager init is cheap and keeps `TIKTOKEN_AVAILABLE` a
// plain const (the historical API shape).
const _ENCODER: _Encoder | null = _loadEncoder();

/** True when the real tokenizer is available (exact GPT counts), else proxy. */
export const TIKTOKEN_AVAILABLE = _ENCODER !== null;

/** A single token measurement and whether it is exact or a proxy. */
export class TokenCount {
  readonly tokens: number;
  readonly exact: boolean;

  constructor(tokens: number, exact: boolean) {
    this.tokens = tokens;
    this.exact = exact;
    Object.freeze(this); // dataclass(frozen=True) parity
  }
}

/** Count Unicode code points — `len(str)` parity. */
function _len(text: string): number {
  let count = 0;
  // for..of iterates code points, so astral chars count once.
  for (const _ch of text) count += 1;
  return count;
}

/** Banker's rounding (round half to even) — proxy-path parity. */
function _python_round(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** Render a float like a Python f-string (4.0 → "4.0", 3.6 → "3.6"). */
function _py_float_repr(x: number): string {
  return Number.isInteger(x) ? `${x}.0` : `${x}`;
}

/**
 * GPT token count — EXACT via js-tiktoken (`cl100k_base`) when available,
 * otherwise the documented `chars / 4` proxy.
 */
export function gpt_tokens(text: string): TokenCount {
  if (_ENCODER !== null) {
    return new TokenCount(_ENCODER.encode(text).length, true);
  }
  return gpt_tokens_proxy(text);
}

/**
 * GPT proxy count (`chars / 4`, banker's rounding) — the fallback path,
 * exposed directly for the fallback regression guard and delta reporting.
 */
export function gpt_tokens_proxy(text: string): TokenCount {
  return new TokenCount(_python_round(_len(text) / _GPT_CHARS_PER_TOKEN), false);
}

/** Claude token count — documented offline proxy (no local Claude tokenizer). */
export function claude_tokens(text: string): TokenCount {
  return new TokenCount(
    _python_round(_len(text) / _CLAUDE_CHARS_PER_TOKEN),
    false,
  );
}

export interface Measure {
  chars: number;
  tokens_gpt: number;
  tokens_gpt_exact: boolean;
  tokens_claude: number;
  tokens_claude_exact: boolean;
}

/**
 * Return chars + per-model token counts for one text blob.
 *
 * `tokens_gpt` is exact (js-tiktoken) when available; `tokens_gpt_exact` tells
 * the report consumer which path produced it. `tokens_claude` is always the
 * proxy (no offline Claude tokenizer).
 */
export function measure(text: string): Measure {
  const g = gpt_tokens(text);
  const c = claude_tokens(text);
  return {
    chars: _len(text),
    tokens_gpt: g.tokens,
    tokens_gpt_exact: g.exact,
    tokens_claude: c.tokens,
    tokens_claude_exact: c.exact,
  };
}

/**
 * Proxy-only measure (forces the chars-based estimate for GPT regardless of
 * tokenizer availability). Use to record both the exact and the proxy count
 * and flag the delta, and as the fallback regression guard.
 */
export function measure_proxy(text: string): Measure {
  const g = gpt_tokens_proxy(text);
  const c = claude_tokens(text);
  return {
    chars: _len(text),
    tokens_gpt: g.tokens,
    tokens_gpt_exact: g.exact,
    tokens_claude: c.tokens,
    tokens_claude_exact: c.exact,
  };
}

/** Proxy-path provenance string (the fallback note). */
export function method_note_proxy(): string {
  return (
    `tokens_gpt: proxy (chars/${_py_float_repr(_GPT_CHARS_PER_TOKEN)}, tiktoken not installed); ` +
    `tokens_claude: proxy (chars/${_py_float_repr(_CLAUDE_CHARS_PER_TOKEN)})`
  );
}

/** One-line provenance of how token counts were produced (for reports). */
export function method_note(): string {
  if (TIKTOKEN_AVAILABLE) {
    return (
      `tokens_gpt: exact (tiktoken ${_TIKTOKEN_ENCODING}); ` +
      `tokens_claude: proxy (chars/${_py_float_repr(_CLAUDE_CHARS_PER_TOKEN)})`
    );
  }
  return method_note_proxy();
}
