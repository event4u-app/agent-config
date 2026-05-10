/**
 * Deprecated tool stubs — surfaces hosted-incompatible tools as
 * discoverable-but-uncallable entries.
 *
 * Per `docs/contracts/mcp-cloud-scope.md` §A0-cloud invariant 3 and the
 * Phase 2-5 council verdict (D5):
 *   - `tools/list` returns the stubs with `_meta.deprecated: true`.
 *   - `tools/call` for either name returns JSON-RPC error -32601
 *     (method not found) — from the Worker's perspective the tool
 *     genuinely is not implemented.
 *
 * The stubs are intentionally hard-coded, not derived from content,
 * because deprecation is a Worker-runtime decision, not a content one.
 */

export type DeprecatedTool = {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, never> };
  _meta: { deprecated: true; alternative: "local-stdio" };
};

export const DEPRECATED_TOOLS: readonly DeprecatedTool[] = [
  {
    name: "lint_skills",
    description:
      "DEPRECATED — local-only. Use the local stdio MCP server (scripts/mcp_server/) for skill linting; the hosted Worker cannot execute consumer code.",
    inputSchema: { type: "object", properties: {} },
    _meta: { deprecated: true, alternative: "local-stdio" },
  },
  {
    name: "chat_history_append",
    description:
      "DEPRECATED — filesystem-bound. Use the local stdio MCP server; the hosted Worker has no consumer filesystem access.",
    inputSchema: { type: "object", properties: {} },
    _meta: { deprecated: true, alternative: "local-stdio" },
  },
] as const;

const DEPRECATED_NAMES = new Set(DEPRECATED_TOOLS.map((t) => t.name));

export function isDeprecatedTool(name: string): boolean {
  return DEPRECATED_NAMES.has(name);
}
