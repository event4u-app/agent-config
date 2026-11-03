---
slug: code-review
archived_on: 2026-11-03
last_seen_count: 0
reason: superseded
replacement: code-review-lens
last_known_callers:
  - "none detected — every reference in src/ was moved to code-review-lens in the same change"
---

# code-review

## Why archived

Renamed, not removed: a host already ships a built-in `code-review` command, so the package's skill under that name collided with it. Roadmap `road-to-a-name-no-host-already-owns`
moved the skill to a name no host owns.

## What replaces it

[`code-review-lens`](../../../src/skills/code-review-lens/SKILL.md) is the same skill under a new
directory name: body, triggers and trigger corpus moved with it, so every trigger
phrase the old name answered is answered by the new one.

## Last-known callers

None left: the rename updated every rule, skill, command and test that named
`code-review` in the same change, and `check-refs` passes on the result.
