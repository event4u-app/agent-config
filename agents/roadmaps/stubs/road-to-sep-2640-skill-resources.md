---
complexity: lightweight
---

# Stub: SEP-2640 (`skill://` resources) — a quarterly date carrier

> **Stub — not active work, and not deferred work either.** A **date carrier**,
> like [`road-to-adr-134-expiry.md`](road-to-adr-134-expiry.md): there is no step
> to promote, only a recurring external check that must stay reachable by grep
> from the active estate. Transferred out of
> `agents/roadmaps/archive/road-to-skill-delivery-over-mcp.md` Phase 5 by the autonomous
> drain run of 2026-08-23, because a *quarterly* obligation cannot be discharged
> by finishing one roadmap.

## The criterion, verbatim

> **5.1 Re-verify SEP-2640's status quarterly** (pending as of the 2026-06-18
> AAIF post; not re-verified on 2026-08-22). When it merges *and* a second host
> implements Resources-based skill discovery, add a `skill://index.json` resource
> to the lite server that mirrors `skill-tiers.json` Tier B. Until then, the
> existing `prompts/` + `resources/` surface is the same content under a
> different name, and renaming it for a pending spec would be an unmeasured
> change.
> verify: a dated line in this file per check; the step's checkbox can only be
> ticked with a spec URL that says "merged".

## Check log

| Checked | Status | Source |
|---|---|---|
| 2026-06-18 | pending | AAIF Skills-over-MCP working-group post (as recorded by the parent roadmap) |
| 2026-08-23 | **open — NOT merged** | `modelcontextprotocol/modelcontextprotocol` PR **#2640** "SEP-2640: Skills Extension", `state: open`, last updated `2026-08-23T02:00:42Z`. Read via `gh api search/issues`, not from memory. |

Next check due: **2026-11-23**.

Reproduce the check in one command:

```bash
gh api "search/issues?q=repo:modelcontextprotocol/modelcontextprotocol+SEP-2640" \
  --jq '.items[] | select(.number == 2640) | {state, title, html_url, updated_at}'
```

## Why this is a carrier and not a step

The parent's own verify makes the checkbox unreachable while the spec is open, so
leaving it in an active roadmap would either block that roadmap indefinitely or
invite someone to tick it on a technicality. Both conditions for acting are
**external and conjunctive** — the spec must merge **and** a second host must
implement Resources-based skill discovery — and neither is something this
repository can cause.

Meanwhile the capability already exists under a different name: the turnkey
server serves the same content through `prompts/` and `resources/`
(`src/cli/mcp/dispatch.ts`), plus `suggest_skill_for_task` and `read_skill` since
Phase 1.1. Renaming that surface to `skill://` for a pending spec would be an
unmeasured change to a working one — which is what the criterion itself says.

## Promotion criterion

Both must hold, and neither is satisfiable by argument:

1. PR #2640 reports `state: merged` (probe above).
2. A **second** host — not Claude Code alone — implements Resources-based skill
   discovery, named with a version.

Then the work is a `skill://index.json` resource on the lite server mirroring
`agents/runtime/state/skill-tiers.json` Tier B. Delete this file when that ships,
or when the spec is closed unmerged and the question is moot.
