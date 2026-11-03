/**
 * The env switch for `suggest_skill_for_task`'s inline top body
 * (road-to-routing-assurance-live-floors 4.4). Shared because two layers read
 * it: the lite stdio server, which honours it, and the routing measurement
 * arm, which sets it in the `.mcp.json` it builds. Unset means off, and it
 * stays off by default until the 4.2 parity gate passes on the inline arm.
 */
export const INLINE_TOP_BODY_ENV = 'AGENT_CONFIG_MCP_INLINE_TOP_BODY';
