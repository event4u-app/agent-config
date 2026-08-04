---
model_tier: inherit
name: rule-compliance-audit
pack: meta
tier: 2
visibility: internal
skills: [rule-compliance-audit]
description: Audit rule trigger quality, simulate activation, detect overlaps, find never-activating rules, and replay the router matcher over recent prompts (route:audit)
suggestion:
  eligible: true
  trigger_description: "audit my rules, check rule trigger quality, routing audit — which rules fired"
  trigger_context: "maintainer working on .augment/rules/ files or questioning whether rules route"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# rule-compliance-audit

> **Intentionally a command, not a skill** (ADR-057, road-to-6.2.0 Step 7b).
> Like `review-routing`, this is a meta-tool that inspects rule-trigger quality
> — the auto-detection machinery itself. A skill reachable only by
> description-match cannot be relied on to debug a broken description-matcher.
> The explicit `/rule-compliance-audit` command is the guaranteed debug-bypass,
> independent of the routing pipeline. Skill-conversion gate **declined**.

## Instructions

### 1. Inventory all rules

Read every `.md` file in `src/rules/`. For each rule, extract:

- **Name** (filename without `.md`)
- **Type** (`always` or `auto`)
- **alwaysApply** (`true` or `false`)
- **Description** (the trigger description)

Display:

```
═══════════════════════════════════════════════
  🔍 RULE COMPLIANCE AUDIT
═══════════════════════════════════════════════

  Rules: {total} ({always_count} always, {auto_count} auto)
```

### 2. Trigger quality check (auto-rules only)

For each auto-rule, evaluate the `description` field:

**Strong trigger** ✅ — contains:
- Specific keywords a user would type (e.g., "PHPStan", "commit", "Docker")
- Concrete action verbs (e.g., "creating", "editing", "running")
- Specific file types or paths (e.g., ".augment/", "Blade views")

**Weak trigger** ⚠️ — has ANY of:
- Only abstract nouns ("quality", "best practices", "patterns")
- No concrete keywords that match user prompts
- Overlaps significantly with another rule's description
- Too broad ("when working with code")

Display per rule:

```
  ✅  {name}: "{description}" — keywords: {extracted keywords}
  ⚠️  {name}: "{description}" — WEAK: {reason}
```

### 3. Trigger simulation

For each auto-rule, generate **3 realistic user prompts** that SHOULD activate the rule.
Then check: does the description contain enough keywords to match?

Display:

```
───────────────────────────────────────────────
TRIGGER SIMULATION
───────────────────────────────────────────────

  {rule-name}:
    Description: "{description}"
    Test prompts:
      1. "{prompt}" → {✅ would match | ⚠️ might miss}
      2. "{prompt}" → {✅ would match | ⚠️ might miss}
      3. "{prompt}" → {✅ would match | ⚠️ might miss}
```

Only show rules where at least 1 prompt might miss.

### 4. Overlap detection

Compare all rule descriptions pairwise. Flag pairs where:
- >50% keyword overlap
- Same domain but different scope (one should be merged or narrowed)

```
───────────────────────────────────────────────
OVERLAP ANALYSIS
───────────────────────────────────────────────

  ⚠️  {rule-a} ↔ {rule-b}: overlapping keywords: {list}
     Recommendation: {merge | narrow scope | keep separate because...}
```

If no overlaps found: `✅  No significant overlaps detected.`

### 5. Always-rule health check

For each always-rule, check:
- **Size** — >100 lines = ⚠️ (token cost on every request)
- **Specificity** — does it apply to ALL tasks? If not, should it be auto instead?

```
───────────────────────────────────────────────
ALWAYS-RULE HEALTH
───────────────────────────────────────────────

  {name}: {line_count} lines — {✅ healthy | ⚠️ large (>100 lines) | ⚠️ could be auto}
```

### 6. Session routing audit (deterministic; the `/routing-audit` surface)

Replay the router's ONE shared matcher over the recent session — read-only,
no LLM call, deterministic:

```bash
agent-config route:audit --last 10        # matched rules per recent user prompt
agent-config route:explain "<prompt>"     # deep trace for one prompt
agent-config route:audit --weekly         # rolling 7-day recorder render
```

Render the matched-vs-should-have-matched review: for each audited prompt,
the tool prints the matched rules + triggers; flag prompts where a rule you
would expect is absent (should-have-matched is YOUR judgment as reviewer —
the tool never computes it). Every output opens with the measurement-level
header: **trigger matching only — what the host actually invoked is NOT
measured** (ADR-126). Recording (`--record`) is opt-in via
`telemetry.routing_recorder.enabled` (default off) and stores prompt digests,
never prompt text.

### 7. Summary and recommendations

```
═══════════════════════════════════════════════
  📊 AUDIT SUMMARY
═══════════════════════════════════════════════

  Total rules:        {total}
  Strong triggers:    {count} ✅
  Weak triggers:      {count} ⚠️
  Overlapping pairs:  {count}
  Large always-rules: {count}

  Recommendations:
  {numbered list of concrete actions}
```

Present recommendations as numbered options:

```
> 1. Fix weak trigger: {rule} — suggested description: "{improved}"
> 2. Narrow overlap: {rule-a} vs {rule-b} — {action}
> 3. Convert to auto: {rule} — only applies to {specific context}
> 4. No changes needed ✅
```

Wait for user to pick which recommendations to apply.

## Rules

- **Do NOT modify any files** until the user approves recommendations.
- **Do NOT run any scripts** — this is a pure analysis command. Sole
  carve-out: the read-only routing CLI in step 6 (`route:explain` /
  `route:audit`), which is deterministic and writes nothing (the opt-in
  `--record` flag is the one gated exception).
- **Be honest about uncertainty** — if a trigger might or might not match, say "might miss".
- **Always-rules are expensive** — flag any that could safely be auto.
- **Auto-rules that never activate are dead weight** — flag them clearly.
