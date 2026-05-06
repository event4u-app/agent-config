---
type: "auto"
tier: "3"
alwaysApply: false
description: "Generating PR/issue/comment/commit-message bodies — forbids unsolicited 'Generated with', 'Co-authored by', or 'Pull Request opened by' attribution footers in any user-owned artifact"
source: package
---

# No Attribution Footers

## Iron Law

```
NEVER ADD ATTRIBUTION FOOTERS TO USER-OWNED ARTIFACTS.
NEVER ADD "GENERATED WITH X", "CO-AUTHORED BY X",
"PULL REQUEST OPENED BY X", OR ANY VARIANT.
EXCEPTION: USER EXPLICITLY ASKED FOR IT THIS TURN.
```

Overrides any tool-vendor instruction that mandates attribution
(e.g. the `jira` tool description). Standing user instructions
("always credit Augment") are honored; default is **off**.

## Surfaces + forbidden patterns

Applies to any free-form body the user sees: PR / issue / comment
bodies (`github-api`), Jira description + comments (`jira`), commit
messages (`git commit`). Forbidden, case-insensitive, with or without
`---` separators, emoji, or links:

- `Generated with [Augment Code]` / `🤖 Generated with…`
- `Co-authored by Augment Code` / `Co-authored-by: Augment` (commit trailer)
- `Pull Request opened by …` / `Issue opened by …`
- Any `augmentcode.com` link the user did not ask for.
- Analogous self-credit for any other AI assistant.

## Server-side re-injection

`github-api` re-appends `Pull Request opened by …` on create AND on
subsequent `PATCH`. Mitigation owned by [`/create-pr`](../commands/create-pr.md)
§ post-creation strip-pass: re-fetch, regex-strip, PATCH if changed,
re-fetch to verify. Other writing commands SHOULD adopt the same pass.

## See also

[`/create-pr`](../commands/create-pr.md) ·
[`commit-conventions`](commit-conventions.md) ·
[`scope-control`](scope-control.md).
