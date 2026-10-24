<!-- evidence-type: analysis -->

# CONVERGED 2/2 on (a), ROUTED TO THE OWNER — retiring `projection.rule_packs`

**Date:** 2026-10-24 · **Members:** `anthropic`, `openai` · **Present: 2 of 2** · two rounds, blind
chairman, CLI, $0.00 · **Prompt:** `setup-rule-packs-key-20261024.question.md` beside this file.

```
A CONVERGED OPTION ON AN OWNER-RESERVED TRANSITION IS A RECOMMENDATION, NOT A DECISION.
```

| Point | `anthropic` | `openai` |
|---|---|---|
| Option | (a) — a step retiring the key, deriving the pack axis from the active-pack set (today's `auto`), tombstone, one-window read, next major | (a) |
| For | completes AC-1; a domain floor that says it activates only with its pack should not ship without it (measured: 8 rules / 8,110 tokens) | one source of truth for pack scope |
| Against | must first audit that all 8 rules are correctly pack-scoped; a carve-out (c) would add a second AC-1 exception | incomplete pack detection could silently drop a rule a consumer relied on under the `[]` default |
| Conditions | specify the one-window handling of `[]`, explicit lists and `auto` | legacy explicit values win during the window, `doctor` reports the difference from the derived set; test `[]`, `auto` and explicit lists; audit the eight rules; next major only |
| Routing | **owner-reserved** — removing a documented public settings key changes a compatibility commitment (`BREAKING_CHANGES.md`), even in a major | **owner-reserved** — same reason |
| Reopens if | the audit shows one of the eight applies regardless of pack | derivation cannot retain every rule a consumer's capabilities or safety need |

Not implemented. The owner decides whether AC-1 gains the retirement step (a) or the carve-out (c).
