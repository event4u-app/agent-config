---
slug: mcp
archived_on: 2026-11-03
last_seen_count: 0
reason: superseded
replacement: mcp-tool-use
last_known_callers:
  - "none detected — every reference in src/ was moved to mcp-tool-use in the same change"
---

# mcp

## Why archived

Renamed, not removed: a host already ships a built-in skill named `mcp`, so the package's skill under that name was shadowed or collided on those hosts. Roadmap `road-to-a-name-no-host-already-owns`
moved the skill to a name no host owns.

## What replaces it

[`mcp-tool-use`](../../../src/skills/mcp-tool-use/SKILL.md) is the same skill under a new
directory name: body, triggers and trigger corpus moved with it, so every trigger
phrase the old name answered is answered by the new one.

## Last-known callers

None left: the rename updated every rule, skill, command and test that named
`mcp` in the same change, and `check-refs` passes on the result.
