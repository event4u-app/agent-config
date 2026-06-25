# Enforcement by host — how governance is applied, per tool

Governance in this package is applied two ways, and which one a host gets
depends on what that host exposes. We say so plainly rather than imply
"deterministic everywhere".

- **Compile-time (every host).** Rules and Iron Laws are compiled into each
  host's native instruction format at projection time (`.cursorrules`,
  `.windsurfrules`, `copilot-instructions.md`, `GEMINI.md`, Claude/Augment
  native rule dirs). This is the universal layer — it works on all projection
  targets. It is **model-cooperative**: the agent is instructed, strongly, but
  the host does not hard-block the call.
- **Runtime hooks (hook-capable hosts only).** On hosts that expose a tool
  lifecycle (`PreToolUse` / `PostToolUse` / `Stop`), a small set of guards can
  **deterministically block** a call (e.g. `block_no_verify`). This is a
  superset on top of the compile-time layer, not a replacement.

| Host | Compile-time rules | Runtime hook enforcement |
|---|---|---|
| Claude Code (plugin) | ✅ | ✅ native hooks |
| Cline (MCP) | ✅ | ✅ where the MCP host exposes lifecycle |
| Cursor | ✅ `.cursorrules` | — static only |
| Windsurf | ✅ `.windsurfrules` | — static only |
| Copilot | ✅ `copilot-instructions.md` | — static only |
| Gemini | ✅ `GEMINI.md` | — static only |
| Augment | ✅ native rules | — no public hook API |

**Why we lead with compile-time, not hooks.** Runtime hooks reach only a
minority of supported hosts. Building the governance story on hooks would make
it a two-tier experience — strong on Claude, absent on Cursor/Windsurf/Copilot.
So the universal lever is the compile-time layer; runtime hooks are an opt-in
**bonus** on the hosts that can run them, never the floor.

**Where MCP fits.** MCP is a *transport* surface, not a third enforcement layer.
On a host that runs MCP servers, MCP is one path by which a tool lifecycle (and
therefore the runtime-hook column above) can become available — but MCP presence
does not by itself add enforcement. Which hosts consume which surface is tracked
authoritatively, per artifact type, in
[`capability-matrix.md`](capability-matrix.md) (derived from the projection
dispatcher, drift-checked in CI) — we do not restate per-host surface facts here,
to avoid drift between two hand-maintained tables.

See also the artifact-projection view: [`capability-matrix.md`](capability-matrix.md)
(its `hooks` row already shows hooks are native to the Claude plugin only).
