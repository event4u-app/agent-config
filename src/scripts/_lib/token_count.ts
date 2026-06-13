/**
 * Real-tokenizer counting for the budget tooling (roadmap 0B.1).
 *
 * TypeScript twin of `src/scripts/_lib/token_count.py` (ADR-094 —
 * Python→TS migration, Phase 2 / Wave 1). Public API mirrors the
 * Python module exactly (snake_case kept deliberately).
 *
 * `char != token`. Every budget in this suite is historically in
 * characters; this helper adds a token count *alongside* chars so chars
 * stay the cheap proxy and tokens become the truth where a real
 * tokenizer is available.
 *
 * Design — no silent installs, no mandatory network:
 *
 * - **GPT** — the Python original uses `tiktoken` when installed; no
 *   tokenizer dependency ships with the TS twin, so the documented
 *   `chars / 4` proxy applies, flagged `exact: false`
 *   (`TIKTOKEN_AVAILABLE` is always `false` here — matching the
 *   Python module's behaviour when tiktoken is absent).
 * - **Claude** — no offline tokenizer; documented `chars / 3.6` proxy
 *   flagged `exact: false`.
 *
 * Both proxies are intentionally conservative ratios drawn from
 * English-prose + markdown samples; they are estimates, never gates.
 *
 * Parity notes: "chars" counts Unicode code points (Python `len(str)`),
 * not UTF-16 units; rounding is banker's rounding (Python `round()`).
 */

// Proxy ratios (chars per token) for the no-tokenizer fallback. Tuned for
// English markdown rule/skill prose; deliberately conservative.
const _GPT_CHARS_PER_TOKEN = 4.0;
const _CLAUDE_CHARS_PER_TOKEN = 3.6;

const _TIKTOKEN_ENCODING = "o200k_base"; // GPT-4o / GPT-4.1 family.

// No tiktoken port ships with the TS twin — always the proxy path.
export const TIKTOKEN_AVAILABLE = false;

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

/** Count Unicode code points — Python `len(str)` parity. */
function _len(text: string): number {
  let count = 0;
  // for..of iterates code points, so astral chars count once.
  for (const _ch of text) count += 1;
  return count;
}

/** Python `round()` — round half to even (banker's rounding). */
function _python_round(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** Render a float like Python's f-string (4.0 → "4.0", 3.6 → "3.6"). */
function _py_float_repr(x: number): string {
  return Number.isInteger(x) ? `${x}.0` : `${x}`;
}

/** GPT token count — char proxy (tiktoken unavailable in the TS twin). */
export function gpt_tokens(text: string): TokenCount {
  return new TokenCount(_python_round(_len(text) / _GPT_CHARS_PER_TOKEN), false);
}

/** Claude token count — documented offline proxy (no local tokenizer). */
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
 * Keys: chars, tokens_gpt, tokens_gpt_exact, tokens_claude,
 * tokens_claude_exact. The `*_exact` booleans tell a report consumer
 * whether the number is a real tokenizer count or a proxy estimate.
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

/** One-line provenance of how token counts were produced (for reports). */
export function method_note(): string {
  if (TIKTOKEN_AVAILABLE) {
    return (
      `tokens_gpt: exact (tiktoken ${_TIKTOKEN_ENCODING}); ` +
      `tokens_claude: proxy (chars/${_py_float_repr(_CLAUDE_CHARS_PER_TOKEN)})`
    );
  }
  return (
    `tokens_gpt: proxy (chars/${_py_float_repr(_GPT_CHARS_PER_TOKEN)}, tiktoken not installed); ` +
    `tokens_claude: proxy (chars/${_py_float_repr(_CLAUDE_CHARS_PER_TOKEN)})`
  );
}
