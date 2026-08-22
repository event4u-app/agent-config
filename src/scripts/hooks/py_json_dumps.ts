/**
 * `json.dumps(obj, indent=n)` byte-for-byte, extracted from `dispatch_hook.ts`.
 *
 * Pure and self-contained: it recurses into itself and calls nothing else, which
 * is what made it safe to move out of a dispatcher that runs on every tool call.
 * Extracted because dispatch_hook.ts sits at the 1500-line source ceiling.
 *
 * For anyone tempted to share it: mcp_telemetry_store, mcp_telemetry_query and
 * mcp_telemetry_health each define their OWN `_py_json_dumps`. They were left
 * alone — unifying four copies is a change with its own risk, not a merge-time
 * side effect.
 */
// Python json.dumps(record, indent=2) byte-for-byte (ensure_ascii=True).
export function _py_json_dumps(value: unknown, indent: number): string {
  const pad = " ".repeat(indent);
  const escapeString = (s: string): string => {
    let out = '"';
    for (const ch of s) {
      const code = ch.codePointAt(0) as number;
      switch (ch) {
        case '"':
          out += '\\"';
          break;
        case "\\":
          out += "\\\\";
          break;
        case "\n":
          out += "\\n";
          break;
        case "\r":
          out += "\\r";
          break;
        case "\t":
          out += "\\t";
          break;
        case "\b":
          out += "\\b";
          break;
        case "\f":
          out += "\\f";
          break;
        default:
          if (code < 0x20 || code > 0x7e) {
            if (code > 0xffff) {
              const c = code - 0x10000;
              const hi = 0xd800 + (c >> 10);
              const lo = 0xdc00 + (c & 0x3ff);
              out +=
                "\\u" +
                hi.toString(16).padStart(4, "0") +
                "\\u" +
                lo.toString(16).padStart(4, "0");
            } else {
              out += "\\u" + code.toString(16).padStart(4, "0");
            }
          } else {
            out += ch;
          }
      }
    }
    return out + '"';
  };
  const render = (v: unknown, depth: number): string => {
    if (v === null || v === undefined) return "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") {
      if (!Number.isFinite(v)) {
        if (Number.isNaN(v)) return "NaN";
        return v > 0 ? "Infinity" : "-Infinity";
      }
      return String(v);
    }
    if (typeof v === "string") return escapeString(v);
    const curPad = pad.repeat(depth + 1);
    const closePad = pad.repeat(depth);
    if (Array.isArray(v)) {
      if (v.length === 0) return "[]";
      return (
        "[\n" +
        v.map((item) => curPad + render(item, depth + 1)).join(",\n") +
        "\n" +
        closePad +
        "]"
      );
    }
    if (typeof v === "object") {
      const obj = v as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 0) return "{}";
      return (
        "{\n" +
        keys
          .map((k) => curPad + escapeString(k) + ": " + render(obj[k], depth + 1))
          .join(",\n") +
        "\n" +
        closePad +
        "}"
      );
    }
    throw new TypeError(`Object of type ${typeof v} is not JSON serializable`);
  };
  return render(value, 0);
}
