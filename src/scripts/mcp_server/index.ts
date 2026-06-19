// MCP server for agent-config — Phase 1 MVP.
//
// mcp_scope: full — local stdio access can be extended to tool execution
// under the Phase 7 wake-up triggers in `docs/contracts/mcp-cloud-scope.md`.
// The hosted Worker (`internal/workers/mcp/`) is `mcp_scope: lite` and is
// intentionally narrower.
//
// Exposes a hand-picked subset of `dist/agent-src/skills/` as MCP `prompts`
// over stdio. Read-only and instructional per the A0 execution-safety
// boundary in `agents/roadmaps/road-to-mcp-server.md`. No `tools`
// primitive, no engine spawn, no shell execution.
//
// Stability: experimental. Contract: `docs/contracts/mcp-phase-1-scope.md`.
// Promotion to beta gated on `docs/contracts/mcp-beta-criteria.md`.
//
// TS twin of __init__.py (py2ts Phase 8). The Python package barrel exposes
// exactly two module-level names: `__version__` and `SERVER_NAME`. Mirrored
// here as `__version__` (Python wire-surface SemVer name preserved) and
// SERVER_NAME.

// Wire-surface SemVer. Hand-bumped when the MCP-side surface changes.
 
export const __version__ = '0.1.0';
export const SERVER_NAME = 'agent-config';
