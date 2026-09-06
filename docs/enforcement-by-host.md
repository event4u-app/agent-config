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
| Augment | ✅ native rules | ⚠️ bound, verdict not honoured |

**Why we lead with compile-time, not hooks.** Runtime hooks reach only a
minority of supported hosts. Building the governance story on hooks would make
it a two-tier experience — strong on Claude, absent on Cursor/Windsurf/Copilot.
So the universal lever is the compile-time layer; runtime hooks are an opt-in
**bonus** on the hosts that can run them, never the floor.

The ADR-124 code-graph nudge is a case in point: on hook-capable hosts the
default-off `code-graph` PreToolUse hook surfaces "query the graph first" once
per session; on instruction-file hosts the same intent rides the always-loaded
[`external-code-graph-interop`](../src/rules/external-code-graph-interop.md)
rule and the [`code-intelligence`](../src/skills/code-intelligence/SKILL.md)
skill — the capability degrades gracefully, it does not disappear.

**Where MCP fits.** MCP is a *transport* surface, not a third enforcement layer.
On a host that runs MCP servers, MCP is one path by which a tool lifecycle (and
therefore the runtime-hook column above) can become available — but MCP presence
does not by itself add enforcement. Which hosts consume which surface is tracked
authoritatively, per artifact type, in
[`capability-matrix.md`](capability-matrix.md) (derived from the projection
dispatcher, drift-checked in CI) — we do not restate per-host surface facts here,
to avoid drift between two hand-maintained tables.

## Vocabulary — the enforcement ladder (glossary, not a migration)

An external "enforcement-first" architecture proposal (reviewed by AI
council 2026-07-26, road-to-self-critical; **not adopted** — disposition in
`agents/settings/contexts/enforcement-first-disposition.md`) contributed a
useful *vocabulary* for talking about how strongly a rule can be held. It
is recorded here as a glossary alongside the resolver taxonomy this repo
already measures with (`enforced_by:` → `validator` / `validator-local` /
`observer` / `none`, per
[ADR-127](decisions/ADR-127-enforcement-claims-must-resolve.md)). No
migration toward it is scheduled.

| Ladder level | Meaning | Nearest resolver tier today |
|---|---|---|
| L1 `impossible` | The violating action cannot be expressed (capability removed, API absent) | — (no per-rule tier; this is tool-grant design, see `tool-safety`) |
| L2 `blocked` | A deterministic gate rejects the action at call time | `validator` (CI-reachable), or a `fail_closed: true` hook |
| L3 `verified` | The action runs; a check detects the violation after the fact and fails a build | `validator` / `validator-local` |
| L4 `just-in-time` | The constraint is injected into context at the moment of relevance, not always-loaded | *no equivalent today* — the one genuinely new level; worth a future look (hook-capable hosts only) |
| L5 `prose` | The constraint is instructed, model-cooperatively | `observer` / `none` (honest prose, per the compile-time-first stance above) |

The ladder is descriptive vocabulary. The measured stance stands: lead
with compile-time prose everywhere, bind deterministic checks where a host
supports them, and never delete the prose from static-host projections —
that is where the measured discipline lift lives.

See also the artifact-projection view: [`capability-matrix.md`](capability-matrix.md)
(its `hooks` row already shows hooks are native to the Claude plugin only).
