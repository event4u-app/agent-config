---
type: "auto"
tier: "2a"
description: "Editing a token-optimizer-cited asset — sync the catalog row in the same commit"
triggers:
  - keyword: "cli-output-handling"
  - keyword: "rtk-output-filtering"
  - keyword: "token-efficiency"
  - keyword: "agent-handoff"
  - keyword: "markitdown"
  - keyword: "token-optimizer"
routes_to:
  - "skill:token-optimizer"
validator_ignore:
  - type: "substring"
    pattern: ".agent-src.uncondensed/"
    reason: "Rule lists the authoring-tree paths that must stay in sync with the catalog."
workspaces: [agent-config-maintainer]
packs: [meta]
enforced_by:
  - "validator:src/scripts/check_token_optimizer_freshness.ts"
# obligation: line 29
obligation_frequency: "per-commit"
---

# Token Optimizer Maintenance

## Iron Law

```
EDIT A CITED ASSET → UPDATE THE TOKEN-OPTIMIZER ROW IN THE SAME COMMIT.
THE CI LINK VALIDATOR IS A BACKSTOP, NOT A SUBSTITUTE FOR CARE.
```

## When this rule fires

About to edit any of:

- `src/rules/cli-output-handling.md`
- `src/rules/token-efficiency.md`
- `src/rules/direct-answers.md`
- `src/skills/rtk-output-filtering/SKILL.md`
- `src/domains/meta/agent-handoff/command.md`
- Any other asset cited by
  [`token-optimizer`](../skills/token-optimizer/SKILL.md) (catalog
  table is the canonical list).

## Obligation

If the edit touches:

- **Trigger keywords** the decision tree associates with the asset, OR
- **What the asset does** (the one-line "what it does" summary), OR
- **The asset's path / location** (rename, move, deletion)

then in the same commit, update the matching row in
`src/skills/token-optimizer/SKILL.md` —
the catalog table AND the relevant tree leaf.

## Out of scope

- Whitespace, comment, formatting, or grammar edits in the cited
  asset → no token-optimizer update required.
- Internal restructuring that leaves trigger + summary + path
  unchanged → no update required.

## Backstop

The CI pipeline runs `scripts/check_token_optimizer_freshness.ts`
after the reference checker. The validator parses the catalog,
verifies every cited path exists, and `grep`s the trigger keywords
against each target. A failure is a **drift signal**, not a
substitute for keeping the catalog correct manually.
