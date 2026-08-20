# Routing-Matrix Fixtures (tier-1 rules)

One YAML file per tier-1 rule id from `dist/router.json` (`tier_1` array). Each file
pins prompts that MUST route to the rule (positives) and topically adjacent prompts
that must NOT route (near-misses). Data only — the runner is built separately.

## Schema

```yaml
rule: <rule-id>                # must equal the tier_1 entry id and the file name
positives:                     # >= 3, at least one German prompt
  - prompt: "<realistic user prompt>"
    open_files: ["<path>"]     # optional — needed for path_prefix / file_pattern triggers
    command: "/<cmd>"          # optional — needed for command triggers
near_misses:                   # >= 2, plausible real-world prompts
  - prompt: "<adjacent prompt with NO trigger substring>"
    open_files: ["<path>"]     # optional — a non-matching path is a valid near-miss probe
```

## Matching semantics (source: `src/scripts/router_telemetry.ts` — `trigger_matches`)

- `keyword` / `phrase` — case-insensitive **unanchored substring** on the prompt.
- `path_prefix` — `startsWith` over `open_files` entries.
- `file_pattern` — fnmatch over `open_files` entries (`*` matches `/` too).
- `command` — case-sensitive `startsWith` on the invoked command.

A positive must match at least one of the rule's real triggers; a near-miss must
match **zero** of them. Because keyword matching is unanchored substring, a
near-miss must not contain any trigger keyword even inside another word
(e.g. "options" contains "option", "specs" contains "ecs").

## Adding a file

1. Read the rule's triggers from `dist/router.json` (`tier_1`).
2. Create `<rule-id>.yaml` following the schema above.
3. Verify every positive matches >= 1 trigger and every near-miss matches 0,
   using the real `trigger_matches(trigger, prompt, open_files, command)` import —
   never by eyeballing the substrings.

## Rules with no matrix, and why that is correct

A matrix pins a **routing** decision: which prompts and open files activate a
path- or keyword-triggered rule, and which near-misses must stay silent. A rule
that loads **unconditionally** makes no such decision, so it has nothing for a
matrix to assert — every prompt is a positive and there are no near-misses.

Four rules moved into that category on 2026-08-20 (road-to-single-delivery Phase
5.1, ADR-236 + ADR-227): `no-roadmap-references`, `rule-type-governance`,
`skill-quality` and `source-confidentiality`. Their path triggers were removed so
they survive `/compact` once the delivery partition removes their unscoped global
twin. Their matrices were **deleted rather than emptied**, because the alternative
shapes are both worse: a matrix with zero positives fails this directory's own
`≥3 positives / ≥2 near-misses` floor, and one that keeps its old positives asserts
routing behaviour the rules no longer have — which is exactly how these four turned
red when the triggers came out. The deletion is the honest record: no routing
decision, no matrix.

If any of them regains a trigger, it needs its matrix back, positives and
near-misses both. `check_rule_activation_census` is what notices the change of
category (it pins the scoped / mixed ID sets by identity), so the pairing is not
left to memory.
