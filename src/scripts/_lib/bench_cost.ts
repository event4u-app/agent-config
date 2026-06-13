/**
 * Cost capture helper for the bench runner.
 *
 * TypeScript twin of `src/scripts/_lib/bench_cost.py` (ADR-092, Phase 2
 * Wave 2a). Public API mirrors the Python module exactly — same exported
 * names (deliberately snake_case), same per-tier aggregation, same
 * recompute-from-rates fallback, same 6-decimal rounding, same JSON-identical
 * `cost` block shape.
 *
 * Cost capture for `scripts/bench_run.py` — step-4 Phase 2 Step 2.
 *
 * Reads Claude Code session jsonl summaries (one summary line per session)
 * from agents/cost-tracking/sessions.jsonl — produced by scripts/cost/track.mjs
 * — and aggregates totals using model rates from internal/bench/pricing.yaml.
 *
 * Returns the dict shape declared in docs/contracts/benchmark-report-schema.md
 * § JSON schema (v1) `cost`. When the source jsonl is missing, returns the
 * `unavailable` sentinel block (NEVER silently drops, per schema invariant).
 */
import * as fs from "node:fs";
import { load as yamlLoad } from "js-yaml";

export const UNKNOWN_TIER = "unknown";
export const TIER_KEYS: readonly string[] = [
  "haiku",
  "sonnet",
  "opus",
  UNKNOWN_TIER,
];

export interface TierRates {
  input: number;
  output: number;
  cache_write: number;
  cache_read: number;
}

export interface Totals {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  total_cost_usd: number;
}

export interface PerTierSlot {
  messages: number;
  cost_usd: number;
}

export type PerTier = Record<string, PerTierSlot>;

export interface CostBlock {
  source: string;
  reason?: string;
  scanned_path?: string;
  sessions_scanned: number;
  totals: Totals;
  per_tier: PerTier;
  pricing_sourced_on: string | null;
}

/** Return [{ tier: rates }, oldest_sourced_on] from internal/bench/pricing.yaml. */
export function load_pricing(
  pricingPath: string,
): [Record<string, TierRates>, string | null] {
  // Python guards `yaml is None or not pricing_path.is_file()`. js-yaml is a
  // hard dependency here, so only the file-presence guard applies.
  if (!_isFile(pricingPath)) {
    return [{}, null];
  }
  const parsed = yamlLoad(fs.readFileSync(pricingPath, "utf-8"));
  const data: Record<string, unknown> =
    parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const rates: Record<string, TierRates> = {};
  let oldest: string | null = null;
  const models = Array.isArray(data["models"]) ? (data["models"] as unknown[]) : [];
  for (const rowRaw of models) {
    if (!rowRaw || typeof rowRaw !== "object") {
      continue;
    }
    const row = rowRaw as Record<string, unknown>;
    const tier = row["tier"];
    if (!tier) {
      continue;
    }
    rates[String(tier)] = {
      input: _float(row["input"], 0.0),
      output: _float(row["output"], 0.0),
      cache_write: _float(row["cache_write"], 0.0),
      cache_read: _float(row["cache_read"], 0.0),
    };
    let sourced = row["sourced_on"];
    // YAML 1.1 parses ISO dates to a date/datetime; coerce to ISO string.
    // (js-yaml yields a Date; PyYAML yields date/datetime → isoformat().)
    if (sourced !== undefined && sourced !== null && typeof sourced !== "string") {
      sourced = _isoformat(sourced);
    }
    if (typeof sourced === "string" && (oldest === null || sourced < oldest)) {
      oldest = sourced;
    }
  }
  return [rates, oldest];
}

function _empty_totals(): Totals {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
    total_cost_usd: 0.0,
  };
}

function _empty_per_tier(): PerTier {
  const out: PerTier = {};
  for (const t of TIER_KEYS) {
    out[t] = { messages: 0, cost_usd: 0.0 };
  }
  return out;
}

/** Schema-compliant `cost` block when no session jsonl is readable. */
export function unavailable_block(
  reason: string,
  source: string,
  pricingSourcedOn: string | null,
): CostBlock {
  return {
    source: "unavailable",
    reason,
    scanned_path: source,
    sessions_scanned: 0,
    totals: _empty_totals(),
    per_tier: _empty_per_tier(),
    pricing_sourced_on: pricingSourcedOn,
  };
}

/** Read agents/cost-tracking/sessions.jsonl and aggregate per-tier totals. */
export function aggregate_sessions(
  sessionsJsonl: string,
  pricingPath: string,
): CostBlock {
  const [rates, pricingSourcedOn] = load_pricing(pricingPath);
  if (!_isFile(sessionsJsonl)) {
    return unavailable_block(
      "sessions_jsonl_missing",
      sessionsJsonl,
      pricingSourcedOn,
    );
  }

  const totals = _empty_totals();
  const per_tier = _empty_per_tier();
  let sessions_scanned = 0;

  const text = fs.readFileSync(sessionsJsonl, "utf-8");
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    let summary: unknown;
    try {
      summary = JSON.parse(line);
    } catch {
      continue;
    }
    sessions_scanned += 1;
    const byModel =
      summary && typeof summary === "object"
        ? (summary as Record<string, unknown>)["byModel"]
        : undefined;
    const models =
      byModel && typeof byModel === "object" && !Array.isArray(byModel)
        ? (byModel as Record<string, unknown>)
        : {};
    for (const slotRaw of Object.values(models)) {
      const slot: Record<string, unknown> =
        slotRaw && typeof slotRaw === "object"
          ? (slotRaw as Record<string, unknown>)
          : {};
      let tier = _slotStr(slot["tier"], UNKNOWN_TIER);
      if (!(tier in per_tier)) {
        tier = UNKNOWN_TIER;
      }
      totals.input_tokens += _int(slot["input_tokens"], 0);
      totals.output_tokens += _int(slot["output_tokens"], 0);
      totals.cache_read_input_tokens += _int(slot["cache_read_input_tokens"], 0);
      totals.cache_creation_input_tokens += _int(
        slot["cache_creation_input_tokens"],
        0,
      );
      let cost = _float(slot["cost_usd"], 0.0);
      // Recompute from rates if upstream cost is zero AND we have rates;
      // otherwise trust the upstream attribution (it priced at capture time).
      if (cost === 0.0 && tier in rates) {
        const r = rates[tier]!;
        cost =
          (_int(slot["input_tokens"], 0) / 1e6) * r.input +
          (_int(slot["output_tokens"], 0) / 1e6) * r.output +
          (_int(slot["cache_creation_input_tokens"], 0) / 1e6) * r.cache_write +
          (_int(slot["cache_read_input_tokens"], 0) / 1e6) * r.cache_read;
      }
      const slotAgg = per_tier[tier]!;
      slotAgg.messages += _int(slot["messages"], 0);
      slotAgg.cost_usd += cost;
      totals.total_cost_usd += cost;
    }
  }

  // Round currency to 6 decimals for stable diffs.
  totals.total_cost_usd = _round6(totals.total_cost_usd);
  for (const t of Object.values(per_tier)) {
    t.cost_usd = _round6(t.cost_usd);
  }

  return {
    source: sessionsJsonl,
    sessions_scanned,
    totals,
    per_tier,
    pricing_sourced_on: pricingSourcedOn,
  };
}

// ─── helpers ────────────────────────────────────────────────────────────────

function _isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Mirror Python `float(x or default)` semantics used via `.get(k, 0)` + float(). */
function _float(value: unknown, fallback: number): number {
  if (value === undefined || value === null) {
    return fallback;
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isNaN(n) ? fallback : n;
}

/** Mirror Python `int(slot.get(k, 0))` — truncates toward zero. */
function _int(value: unknown, fallback: number): number {
  if (value === undefined || value === null) {
    return fallback;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) {
    return fallback;
  }
  return Math.trunc(n);
}

/** Mirror Python `slot.get("tier", default)` — only substitutes a missing key. */
function _slotStr(value: unknown, fallback: string): string {
  if (value === undefined) {
    return fallback;
  }
  return String(value);
}

/**
 * Round to 6 decimals to match Python `round(x, 6)` (banker's rounding).
 * Python uses round-half-to-even; replicate it so the 6-decimal currency
 * diffs are byte-identical.
 */
function _round6(x: number): number {
  return _roundHalfEven(x, 6);
}

/**
 * Replicate CPython `round(float, ndigits)`: round the *exact* decimal value of
 * the IEEE-754 double to `ndigits` places, ties-to-even. CPython uses
 * correctly-rounded dtoa, so the operative value is the double's full decimal
 * expansion — not `value * 1e6` (which introduces its own rounding error and
 * diverges on tie-adjacent inputs).
 *
 * Strategy: render the double's *exact* decimal expansion to enough places
 * (`toFixed(20)` — far beyond the 6 we round to, capturing the true binary
 * value), then perform decimal half-even rounding on that string. Using the
 * exact expansion (not the shortest round-trippable repr) is what makes the
 * tie-adjacent cases match CPython, whose `round` operates on the exact value.
 */
function _roundHalfEven(value: number, ndigits: number): number {
  if (!Number.isFinite(value)) {
    return value;
  }
  if (value === 0) {
    return 0;
  }
  const neg = value < 0;
  const abs = Math.abs(value);
  // toFixed caps at 100 fractional digits; 20 is well past double precision and
  // captures the exact binary value to the granularity that matters at 6 dp.
  const fixed = abs.toFixed(20);
  const dot = fixed.indexOf(".");
  if (dot === -1) {
    return value; // integer, nothing to round
  }
  const intPart = fixed.slice(0, dot);
  const fracPart = fixed.slice(dot + 1);
  if (fracPart.length <= ndigits) {
    return value; // already within precision
  }
  const keep = fracPart.slice(0, ndigits);
  const rest = fracPart.slice(ndigits);
  // Build the kept-digit integer string (intPart + keep), then decide round-up.
  const digits = (intPart + keep).split("");
  const roundUp = _decideRoundUp(digits, rest);
  let arr = digits;
  if (roundUp) {
    arr = _incrementDecimalDigits(digits);
  }
  // Reassemble: the last `ndigits` digits are the fraction.
  const joined = arr.join("");
  const fracLen = ndigits;
  const intLen = joined.length - fracLen;
  const newInt = joined.slice(0, intLen) || "0";
  const newFrac = joined.slice(intLen);
  const numStr = newFrac.length > 0 ? `${newInt}.${newFrac}` : newInt;
  const result = Number(numStr);
  return neg ? -result : result;
}

/** Decide round-up under ties-to-even, given the kept digits and the dropped tail. */
function _decideRoundUp(keptDigits: string[], rest: string): boolean {
  const firstDropped = rest.charCodeAt(0) - 48; // '0' = 48
  if (firstDropped < 5) {
    return false;
  }
  if (firstDropped > 5) {
    return true;
  }
  // firstDropped === 5: if any nonzero digit follows, it's > .5 → round up.
  for (let i = 1; i < rest.length; i++) {
    if (rest[i] !== "0") {
      return true;
    }
  }
  // Exact tie → round to even: up only if the last kept digit is odd.
  const lastKept = keptDigits[keptDigits.length - 1]!.charCodeAt(0) - 48;
  return lastKept % 2 === 1;
}

/** Increment a base-10 digit array by 1, handling carry (may grow the array). */
function _incrementDecimalDigits(digits: string[]): string[] {
  const arr = digits.slice();
  let i = arr.length - 1;
  while (i >= 0) {
    const d = arr[i]!.charCodeAt(0) - 48 + 1;
    if (d < 10) {
      arr[i] = String(d);
      return arr;
    }
    arr[i] = "0";
    i--;
  }
  arr.unshift("1");
  return arr;
}

/**
 * Mirror Python `date.isoformat()` / `datetime.isoformat()` for a value that
 * js-yaml parsed from a bare YAML timestamp into a `Date`.
 *
 * PyYAML maps a bare `YYYY-MM-DD` to `datetime.date` → `"YYYY-MM-DD"`, and a
 * `YYYY-MM-DD HH:MM:SS` to `datetime.datetime` → `"YYYY-MM-DDTHH:MM:SS"`
 * (no trailing `Z`, no fractional seconds when none were given). js-yaml loses
 * the lexical form, so reconstruct from the UTC components: a midnight-UTC
 * Date is treated as a date-only value; otherwise emit the datetime form.
 */
function _isoformat(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getUTCFullYear().toString().padStart(4, "0");
    const mo = (value.getUTCMonth() + 1).toString().padStart(2, "0");
    const d = value.getUTCDate().toString().padStart(2, "0");
    const h = value.getUTCHours();
    const mi = value.getUTCMinutes();
    const s = value.getUTCSeconds();
    const ms = value.getUTCMilliseconds();
    if (h === 0 && mi === 0 && s === 0 && ms === 0) {
      return `${y}-${mo}-${d}`;
    }
    const hh = h.toString().padStart(2, "0");
    const mm = mi.toString().padStart(2, "0");
    const ss = s.toString().padStart(2, "0");
    return `${y}-${mo}-${d}T${hh}:${mm}:${ss}`;
  }
  // Anything else: Python falls back to str(...) when isoformat is absent.
  return String(value);
}
