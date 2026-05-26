---
type: "auto"
tier: "2a"
description: "Editing a token-optimizer-cited asset (cli-output-handling, rtk-output-filtering, token-efficiency, markitdown) — sync catalog same commit"
source: package
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
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# Token Optimizer Maintenance

## Iron Law

```
EDIT A CITED ASSET → UPDATE THE TOKEN-OPTIMIZER ROW IN THE SAME COMMIT.
THE CI LINK VALIDATOR IS A BACKSTOP, NOT A SUBSTITUTE FOR CARE.
```

## When this rule fires

About to edit any of:

- `.agent-src.uncondensed/rules/cli-output-handling.md`
- `.agent-src.uncondensed/rules/token-efficiency.md`
- `.agent-src.uncondensed/rules/direct-answers.md`
- `.agent-src.uncondensed/skills/rtk-output-filtering/SKILL.md`
- `.claude/skills/agent-handoff/SKILL.md`
- Any other asset cited by
  [`token-optimizer`](../skills/token-optimizer/SKILL.md) (catalog
  table is the canonical list).

## Obligation

If the edit touches:

- **Trigger keywords** the decision tree associates with the asset, OR
- **What the asset does** (the one-line "what it does" summary), OR
- **The asset's path / location** (rename, move, deletion)

then in the same commit, update the matching row in
`.agent-src.uncondensed/skills/token-optimizer/SKILL.md` —
the catalog table AND the relevant tree leaf.

## Out of scope

- Whitespace, comment, formatting, or grammar edits in the cited
  asset → no token-optimizer update required.
- Internal restructuring that leaves trigger + summary + path
  unchanged → no update required.

## Backstop

The CI pipeline runs `scripts/check_token_optimizer_freshness.py`
after the reference checker. The validator parses the catalog,
verifies every cited path exists, and `grep`s the trigger keywords
against each target. A failure is a **drift signal**, not a
substitute for keeping the catalog correct manually.
