<!-- evidence-type: analysis -->
<!-- analyzed: 2026-09-07 | commit: 27c7d4051 | files: 1 -->

# Structured-ask capability — first host observation

The `structured_ask` field added by `road-to-asked-not-parked` Phase 2.1 carries
one registry row. This is that row's evidence, recorded under
[`host-capability-manifest.md` § Observation protocol](../../../src/agent-src/contexts/execution/host-capability-manifest.md),
whose criterion for this field is the host's **delivered tool surface in a real
session** — never a vendor's documentation, and never another host by analogy.

## The observation

| Part | Value |
|---|---|
| Host | `claude` (Claude Code) |
| Host version | 2.1.263 (`claude --version`, 2026-09-07) |
| Session | Opus 5 (1M context), model id `claude-opus-5[1m]`, autonomous roadmap-drain run, 2026-09-07 |
| Result | **`structured_ask: false` — observed absent** |

The host delivers the session's tool surface at session start. That surface
carried `Agent`, `Artifact`, `Bash`, `Edit`, `Read`, `Skill`, `ToolSearch`,
`Write`, plus a deferred set (`EnterWorktree`, `ExitWorktree`, `Monitor`,
`NotebookEdit`, `SendMessage`, `TaskStop`, `WebFetch`, `WebSearch`) and the
connected MCP servers' tools. No entry in it matches
`STRUCTURED_ASK_TOOL_NAME_RE` in `src/scripts/_lib/structured_ask.ts`, and no
per-host shape is recorded for `claude` in `STRUCTURED_ASK_SHAPES`.

## What this row does and does not claim

It claims that on this host, at this version, in this session, the agent had no
structured-ask tool to call — so the ask degrades to text, which is what the
safe default already did. Writing the `false` explicitly is what makes it
distinguishable from the seven hosts that carry no row at all: those record
"never looked", this records "checked, absent". The protocol names that
distinction as the reason the field is written rather than omitted.

It does **not** claim that the vendor ships no such tool anywhere, that another
Claude Code version behaves the same way, or that any other host is `false`. A
later session that observes a picker writes the `true` row over this one, with
its own four-part citation.

## Consequence for the roadmap

`road-to-asked-not-parked` Phase 2.2 ships zero `structured_ask: true` rows on
purpose, and that is unchanged: an observed `false` is not a `true` row. The
`first-structured-ask-observation` blocker asked for **at least one host
carrying an observed (not assumed) row with provenance recorded** — this is it,
for one host. Every other host in `hook_manifest.yaml`'s platform list remains
unreachable from this session for the reason already recorded in
`host_capability.ts` (a different editor host, no session available to the
running agent), so their rows stay absent rather than being filled by analogy.

Because the observed value is `false`, no per-host ask-block rewrite becomes
available on `claude` either. The capability field is now a recorded fact
instead of an assumption; it is not yet a capability anyone can use.
