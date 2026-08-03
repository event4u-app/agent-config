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
