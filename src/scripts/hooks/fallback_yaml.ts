/**
 * The dependency-free YAML-subset reader, extracted from `dispatch_hook.ts`.
 *
 * Pure and self-recursive, like the JSON writer beside it. Moved for headroom
 * rather than for the ceiling itself: two extractions clear the gate but land the
 * file at exactly 1500, back on the cliff where the next added line reds it.
 */
import type { JsonObject } from './dispatch_hook.js';

/**
 * Indent-aware mini-parser for the manifest's flat shape only.
 * Handles: scalars, `key: null`, `key: true/false`, `key: [a, b]`.
 * Drops comments + blank lines. Two-space indent assumed.
 *
 * Ported verbatim from the Python `_fallback_yaml` so the parser unit
 * tests have an exact twin; runtime prefers `_load_yaml` above.
 */
export function _fallback_yaml(text: string): JsonObject {
  const root: JsonObject = {};
  const stack: Array<[number, JsonObject]> = [[-1, root]];
  for (const raw of text.split("\n")) {
    const line = raw.split("#", 1)[0]!.replace(/\s+$/, "");
    if (!line.trim()) {
      continue;
    }
    const indent = line.length - line.replace(/^ +/, "").length;
    while (stack.length > 0 && stack[stack.length - 1]![0] >= indent) {
      stack.pop();
    }
    const parent = stack.length > 0 ? stack[stack.length - 1]![1] : root;
    const body = line.trim();
    if (!body.includes(":")) {
      continue;
    }
    const idx = body.indexOf(":");
    const key = body.slice(0, idx).trim();
    const val = body.slice(idx + 1).trim();
    if (!val) {
      const newObj: JsonObject = {};
      parent[key] = newObj;
      stack.push([indent, newObj]);
    } else {
      const lower = val.toLowerCase();
      if (lower === "null" || lower === "~" || lower === "") {
        parent[key] = null;
      } else if (lower === "true") {
        parent[key] = true;
      } else if (lower === "false") {
        parent[key] = false;
      } else if (val.startsWith("[") && val.endsWith("]")) {
        const inner = val.slice(1, -1).trim();
        parent[key] = inner
          ? inner
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s)
          : [];
      } else if (/^-?\d+$/.test(val)) {
        parent[key] = parseInt(val, 10);
      } else {
        parent[key] = val.replace(/^['"]+|['"]+$/g, "");
      }
    }
  }
  return root;
}
