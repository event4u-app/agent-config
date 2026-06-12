/**
 * Concern envelope helpers — read the dispatcher's stdin contract.
 *
 * TypeScript twin of `src/scripts/hooks/envelope.py` (ADR-089 —
 * Python→TS migration, Phase 6 / hooks core). Public API mirrors the
 * Python module exactly (snake_case kept deliberately — fidelity over
 * TS idiom).
 *
 * Per `docs/contracts/hook-architecture-v1.md`, the universal dispatcher
 * writes a JSON object to each concern's stdin with shape:
 *
 *     {
 *       "schema_version": 1,
 *       "platform": "augment",
 *       "event": "stop",
 *       "native_event": "Stop",
 *       "session_id": "…",
 *       "workspace_root": "/abs/path",
 *       "payload": { /* opaque, platform-native *\/ },
 *       "settings": { /* materialized .agent-settings.yml subset *\/ }
 *     }
 *
 * Concern scripts must accept BOTH the new envelope shape AND the legacy
 * "raw platform payload directly on stdin" shape — the latter is what every
 * existing trampoline produced before Phase 7.3, and direct invocations
 * (e.g. `./agent-config chat-history:hook --platform claude < event.json`)
 * are still supported during the migration window.
 *
 * `unwrap()` returns the (envelope, payload, platform) triple. When
 * called with raw platform JSON it synthesises a minimal envelope so
 * callers never need to branch.
 */

// Free-form JSON values flow through every helper here; a documented
// alias keeps the surface honest without `any` (ADR-089 § strict TS).
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export const ENVELOPE_KEYS = [
  "schema_version",
  "platform",
  "event",
  "payload",
] as const;

function _isObject(obj: unknown): obj is JsonObject {
  return typeof obj === "object" && obj !== null && !Array.isArray(obj);
}

/**
 * Heuristic — `obj` is a dispatcher envelope if it is a dict that
 * carries every required envelope key. The `payload` value itself is
 * the concern's platform-native data, so a payload that happens to
 * contain `schema_version` does NOT trigger this branch (the four
 * keys must all be at the top level).
 */
export function looks_like_envelope(obj: unknown): boolean {
  if (!_isObject(obj)) {
    return false;
  }
  return ENVELOPE_KEYS.every((key) => key in obj);
}

/**
 * Parse stdin and return [envelope, payload, platform].
 *
 * - Empty / non-JSON stdin → [{}, {}, default_platform].
 * - Raw platform JSON → synth envelope with schema_version=1,
 *   platform=default_platform, event="", payload=<raw>.
 * - Already-an-envelope → return as-is, payload extracted.
 *
 * Never raises — concerns must remain crash-safe in the agent loop.
 */
export function unwrap(
  stdin_text: string | null | undefined,
  default_platform = "generic",
): [JsonObject, JsonObject, string] {
  const text = (stdin_text ?? "").trim();
  if (!text) {
    return [{}, {}, default_platform];
  }
  let decoded: JsonValue;
  try {
    decoded = JSON.parse(text) as JsonValue;
  } catch {
    return [{}, {}, default_platform];
  }

  if (looks_like_envelope(decoded)) {
    const env = decoded as JsonObject;
    let payload = env["payload"];
    if (!payload || !_isObject(payload)) {
      payload = {};
    }
    const platRaw = env["platform"];
    const platform = String(platRaw || default_platform);
    return [env, payload, platform];
  }

  // Legacy direct-invocation path. Whatever shape the platform sent
  // is treated as the payload itself; callers fall back to their
  // pre-7.3 extraction logic.
  const payload: JsonObject = _isObject(decoded) ? decoded : {};
  return [
    {
      schema_version: 1,
      platform: default_platform,
      event: "",
      native_event: "",
      session_id: "",
      workspace_root: "",
      payload,
      settings: {},
    },
    payload,
    default_platform,
  ];
}

/**
 * Safe accessor — concerns should treat unknown / missing keys as
 * forward-compat extensions and never raise.
 */
export function envelope_field(
  envelope: JsonObject | null | undefined,
  key: string,
  defaultValue: JsonValue = "",
): JsonValue {
  if (!_isObject(envelope)) {
    return defaultValue;
  }
  const value = envelope[key];
  return value === null || value === undefined ? defaultValue : value;
}
