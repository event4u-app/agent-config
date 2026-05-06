# Council question — `token-optimizer` skill design

## Context

`event4u/agent-config` is a governed multi-department skill suite (134
skills, 55 rules, ~63 commands) with an active token-spend reduction
posture: **always-loaded** rules (`direct-answers`, `token-efficiency`,
partial `cli-output-handling` via `tier: 2a auto`) plus a `rtk-output-filtering`
skill, a recently-adopted `markitdown` skill, an `agent-handoff` skill
(context-window management), and an in-flight Ruflo-derived
`/cost:report` command landing in Phase 1 of `road-to-ruflo-adoption.md`.

The user (Matze) wants a **standing `token-optimizer` skill** that:

1. Knows **when to use which token-saving tool** (rtk, markitdown,
   Python filtering, redirect/tail/grep, agent-handoff, compress.sh,
   targeted `view` instead of full reads).
2. Synthesizes the rules-floor (token-efficiency, cli-output-handling,
   direct-answers) into a **decision tree the agent consults at the
   moment of decision**, not just the moment of reading rules.
3. Is **continuously updated** every time a new token-saving tool, rule,
   or script lands (rtk-style filters, new conversion tools, new
   compression scripts, cost reports, etc.).

## Existing surface (cross-checked for overlap)

| Layer | Asset | Type | What it covers |
|---|---|---|---|
| Response brevity | `direct-answers` | rule (always) | no flattery, no invented facts, brevity |
| Tool-call discipline | `token-efficiency` | rule (always) | anti-loop, redirect output, no extended reasoning for trivial work |
| CLI output | `cli-output-handling` | rule (auto, tier 2a) | rtk-first, tail/grep fallback |
| CLI output detail | `rtk-output-filtering` | skill | rtk subcommands, install, project-local filter setup |
| Document conversion | `markitdown` | skill | PDF/Office/HTML → Markdown |
| Context window | `agent-handoff` | skill | fresh-chat handoff prompt |
| Source compression | `compress.sh` + `compress.py` + `check_compression.py` | scripts | `.agent-src.uncompressed/` → `.agent-src/` caveman |
| Cost metering | `/cost:report` (in-flight P1.2 of `road-to-ruflo-adoption.md`) | command | per-session JSONL + 50/75/90/100% alert ladder |

**No standing skill** ties these together as a decision tree. Today the
agent has to know all of them and pick correctly under pressure — there
is no single consult point.

## The design tension

A pure **router skill** ("when X → use Y") has known failure modes:

- **Discovery:** if the agent doesn't open the skill, it never routes.
  Mitigated only by trigger wording sharp enough to fire on "should I
  redirect this output?", "this PDF is huge", "I'm about to paste a
  20k-token tree".
- **Drift:** every new token-saving tool requires updating the skill, or
  the router silently rots into a partial map.
- **Overlap with rules:** if the skill restates `cli-output-handling`,
  it duplicates the rule and creates a dual source of truth.

## Curated short-list (ICE-scored draft)

ICE = Impact (1–10) · Confidence (1–10) · Ease (1–10), threshold:
`≥ 200` Phase 1, `100–199` Phase 2 backlog, `< 100` drop.

### Tier S — likely Phase-1 ADOPT

| # | Candidate | Sunset | I·C·E | Score |
|---|---|---|---|---|
| 1 | **`token-optimizer` skill** — decision tree by *intent* (verbose CLI / large doc / repeated tool-call / context near limit / cost concern), each leaf citing the canonical asset (rule, skill, script, command) — NOT restating it | clean ≤300 lines | 9·9·6 | **486** |
| 2 | **`token-optimizer-maintenance` rule** (auto, tier 2a) — fires on edits to `rtk-output-filtering` / `markitdown` / `cli-output-handling` / `token-efficiency` / `agent-handoff` / `compress.*` / new cost-tracking tooling, requiring `token-optimizer` to be re-reviewed in the same PR | clean ≤120 lines | 8·9·8 | **576** |

### Tier A — Phase-2 backlog

| # | Candidate | Score | Reason |
|---|---|---|---|
| 3 | **Telemetry feedback loop** — wire `/cost:report` JSONL to surface "this session would have saved $X with rtk on commands Y/Z" in the next handoff | ~280 | Depends on P1.2 of `road-to-ruflo-adoption.md` shipping; premature |
| 4 | **`token-optimizer` validator script** — CI gate that fails when the skill references an asset that doesn't exist (broken decision-tree leaf) | ~210 | Worth doing; defer to Phase 2 to ship the skill first |

### Tier C — DROP

- A standalone "tokens 101" guideline — would duplicate `direct-answers` + `token-efficiency`. Drop.

## Council question

Three clusters. **One vote per cluster.**

### Cluster 1 — Skill shape

**Q1.** Should `token-optimizer` be:
- (a) a **decision-tree skill** keyed by **intent** (verbose CLI / large doc / repeated tool-call / context near limit / cost-aware) with each leaf citing a canonical asset, OR
- (b) a **catalog skill** listing every token-saving tool with conditions, OR
- (c) a **two-section skill** — a 30-line decision tree at the top, a catalog section below for cold reading?

Pick (a), (b), or (c). One sentence justification.

### Cluster 2 — Maintenance enforcement

**Q2.** How do we ensure the skill stays current as new token-saving tooling lands?
- (a) Soft norm — a sentence in the skill's "Maintenance" section, no enforcement.
- (b) Auto-rule — `token-optimizer-maintenance` (tier 2a) fires on edits to the listed assets and requires the skill to be reviewed in the same PR. Enforced by a CI script (`scripts/check_token_optimizer_freshness.py`) that fails if `token-optimizer` wasn't touched in a PR that touched a tracked asset.
- (c) Roadmap step — a recurring P3 step in every harvest roadmap "review token-optimizer for new entries", no automation.

Pick (a), (b), or (c). One sentence justification.

### Cluster 3 — Trigger wording

**Q3.** Auto-skills compete for activation. The `token-optimizer` skill needs trigger phrasing that fires **before** the agent makes a costly tool call, not after. Options:
- (a) **Reactive triggers** — "running CLI commands", "reading large file", "repeated tool calls" — same surface as existing rules; relies on the agent re-routing through this skill.
- (b) **Proactive triggers** — "before any verbose tool call, large file read, document conversion, or near-context-limit handoff" — explicitly *anticipatory*, asks the agent to think one step ahead.
- (c) **Hybrid** — proactive at the top of the description, reactive sub-bullets, plus a one-line "consult this skill BEFORE the action, not after" Iron Law inside the skill.

Pick (a), (b), or (c). One sentence justification.

## Out-of-scope

- Modifying any existing rule. Token-optimizer **cites** them; it does not duplicate or override.
- Cost-metering implementation (lives in `road-to-ruflo-adoption.md` P1.2).
- Compression infrastructure (already covered by `scripts/compress.*` + `check_compression.py`).

## Output format requested

For each cluster, return:

```yaml
cluster: 1
choice: a|b|c
justification: <one sentence>
risk_flag: <one phrase if any, else "none">
```

Then a final synthesis: any **net-new candidate** the council sees that
isn't in the table, **or** any explicit objection to a Tier-S item.
