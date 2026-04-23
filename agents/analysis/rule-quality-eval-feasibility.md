# Feasibility: Rule & Guideline Quality Evals

> Can we measure whether **rules** and **guidelines** fire and are followed,
> the same way [`archive/road-to-trigger-evals.md`](../roadmaps/archive/road-to-trigger-evals.md)
> proposes to do for skills? Three activation shapes, three separate
> problems, three verdicts.

- **Source roadmap:** [`archive/road-to-rule-quality-research.md`](../roadmaps/archive/road-to-rule-quality-research.md) (archived 2026-04-20 on completion of this analysis)
- **Research date:** 2026-04-20
- **Budget spent:** ~0.25 person-day (analysis only, no PoC execution)
- **API spend:** $0 (runner does not exist yet — execution blocked)
- **Scope:** 3 artifacts — `commit-conventions`, `verify-before-complete`, `agent-infra/output-patterns.md`

## TL;DR

| Problem | Artifact | Verdict | One-line rationale |
|---|---|---|---|
| **1** — Auto-rule triggering | `commit-conventions` | **Conditional go** | Reuses the yet-to-build trigger-evals runner 1:1 with a rule-list system prompt. Conditional on host pinning. |
| **2** — Always-rule compliance | `verify-before-complete` | **Conditional go** | Feasible at PoC scale via scripted dialogues + judge scoring. Doesn't scale cheaply beyond ~10 rules. |
| **3** — Guideline reference usage | `output-patterns.md` | **No-go (general)**, **conditional go (narrow)** | "Was consulted" is not observable. "Matches a prescribed pattern" is, but most guidelines don't prescribe patterns. |

**Overall recommendation:** Ship Problem 1 as an extension of `road-to-trigger-evals.md` (tiny delta). Treat Problem 2 as its own roadmap (`road-to-compliance-evals.md`) only after trigger-evals PoC returns usable numbers. Close Problem 3 — narrow variant isn't enough value alone.

## Background

`road-to-trigger-evals.md` is the parent concept: build a runner that asks the model *"which artifacts would you load for this query"*, then compare against a labeled query set. Works cleanly for **skills** because skills are model-triggered: the model sees all skill descriptions in its context and decides which to consult.

Rules and guidelines are not the same shape. Three activation modes:

| Artifact | Activation mechanism | Host-independent? | Measurable as "triggering"? |
|---|---|---|---|
| Skill | Model sees all descriptions, picks some | Yes (API-level) | Yes |
| Auto-rule | Host injects description list, model picks | **Depends on host** | Yes if host-template reproducible |
| Always-rule | Host always injects full text | Yes (always on) | No — **compliance** is the question |
| Command | User types slash, host routes | Yes (deterministic) | N/A — no eval needed |
| Guideline | Referenced from rules/skills, never surfaced directly | Host-independent | No — **adherence / reference** is the question |

Three distinct measurement problems follow. This research decides which are tractable.

## Problem 1 — Auto-rule triggering (artifact: `commit-conventions`)

### Mechanism

`commit-conventions` is `type: auto` with description *"Git commit message format, branch naming, conventional commits, committing, pushing, or creating pull requests"*. Host activation path (Augment Agent):

1. Host pre-loads all auto-rule descriptions into the system prompt as `If the user prompt matches the description "<desc>", read the file located in <path>`.
2. Model reads the user message and the description list, decides which paths to open.
3. Host surfaces the rule body in-context when the model requests it.

Claude Code activates rules via `CLAUDE.md` + native rule loader — different surface, same model-side decision.

### Overlap with skill trigger-evals

The model-side decision is **identical** to skill triggering: description-match against a user query. The trigger-evals runner proposed in `road-to-trigger-evals.md` §1.3 can be reused verbatim; only the system prompt template changes (rule-list instead of skill-list, or both lists combined).

### Key assumption — the host-pinning question

Auto-rule description lists are **host-format-specific**. The runner must simulate one host's rule-injection template. Augment's format (shown above) is reverse-engineerable from any live conversation; Claude Code's `CLAUDE.md` injection is publicly documented. Measuring against both requires two templates.

Cost: +1 system-prompt template per host, ~50 lines each. Negligible.

### Cost estimate

1 rule × 10 queries × 1 model × 2 hosts = 20 API calls ≈ $0.20 at sonnet rates. Identical to a single skill eval.

### Verdict — **conditional go**

Condition: `road-to-trigger-evals.md` Phase 1 lands first (runner + 1 skill evaluated). Once the runner exists, adding auto-rule evaluation is ~1 person-day of work — a new fixture type, a second system-prompt template, no new infrastructure.

**Scope preview (3 bullets, if go):**

- Extend `scripts/skill_trigger_eval.py` to accept `--artifact-type rule` with a rule-list system-prompt template (Augment + Claude Code variants).
- Ship `evals/triggers.json` alongside 3 pilot auto-rules: `commit-conventions`, `docker-commands`, `php-coding`. Same 5-should-trigger / 5-should-not-trigger shape.
- CI policy: warn on missing, error on failing — identical to skills.

## Problem 2 — Always-rule compliance (artifact: `verify-before-complete`)

### What we're measuring

`verify-before-complete` is `type: always`, `alwaysApply: true`. It is loaded into every conversation. Question: when the rule's decision point arrives — *"about to claim work is done"* — does the agent follow the Iron Law (*"NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE"*)?

**There is no triggering decision to observe.** The question is behavioral compliance at a specific decision point inside a conversation. Three candidate scoring methods:

| Method | Signal | Reliability vs. human | Cost per dialogue |
|---|---|---|---|
| (a) Regex on output — expected phrasings like *"tests green: 334 passed"*, *"I haven't run the verification command"* | Lexical | Low — phrasing varies wildly | ~$0.00 |
| (b) Judge-agent — cheap model asked *"Did the agent claim completion without fresh verification evidence in the final turn?"* | Semantic | Medium-high, if prompt is tight | ~$0.01 |
| (c) Human review | Ground truth | 1.0 by definition | ~5 min × reviewer cost |

### PoC design

3 scripted dialogue scenarios, ~20 turns total, each ending at a **forced decision point**:

1. Bug fix claim without running tests (clear FAIL if agent claims done).
2. Refactor claim with partial PHPStan output (clear PASS if agent runs full pipeline first).
3. Ambiguous "should work" phrasing (borderline — tests inter-rater agreement).

Score each via (a), (b), (c). Report agreement:

- If (a)↔(c) ≥ 80% → regex is cheap enough to run in CI on real transcripts.
- If (b)↔(c) ≥ 90% and (a)↔(c) < 80% → judge is the only viable automation.
- If both < 80% → compliance evals require humans; close as no-go.

### Hidden cost — scenario authorship

Each always-rule needs hand-crafted scenarios. Scenario quality dominates signal quality: one poorly-phrased dialogue pollutes the whole measurement. Budget: ~2 hours per rule for first-draft scenarios, plus review. With 9 always-rules today (by grep on `type: "always"`), full coverage is ~18 hours of scenario work before any measurement happens.

### Verdict — **conditional go**

Condition: Problem 1 PoC returns usable numbers first (Problem 2 depends on having *any* working eval infrastructure). Once that's true, Problem 2 is a separate roadmap with its own budget — **not** an incremental extension.

**Scope preview (3 bullets, if go):**

- Separate roadmap `road-to-compliance-evals.md`. Deliverable: `scripts/rule_compliance_eval.py` with the (a)+(b)+(c) scoring pipeline.
- Hard cap: 5 always-rules at launch (`verify-before-complete`, `scope-control`, `token-efficiency`, `language-and-tone`, `think-before-action`). Not all 8.
- No CI enforcement initially — compliance numbers are advisory, human-reviewed quarterly, until signal stabilizes across two runs.

## Problem 3 — Guideline reference usage (artifact: `agent-infra/output-patterns.md`)

### Why this is fundamentally different

Guidelines are **reference documents**. They're never in context by default. They're pulled in when a rule or skill links to them, and the model reads them if it decides the content is relevant. There is no observable activation event and no compliance checkpoint.

Two distinct sub-questions collapsed into one:

1. **"Was the guideline consulted?"** — asks about internal model state. Not observable from output alone. The model can produce guideline-shaped output without having read it; it can read it and produce different output.
2. **"Does the output match the prescribed pattern?"** — observable, but answers a different question. This is pattern adherence, not reference usage.

### Regex feasibility on `output-patterns.md`

The guideline prescribes specific patterns, e.g.:

```bash
docker compose exec -T <service> <command> 2>&1 > /tmp/<tool>-output.txt
tail -5 /tmp/<tool>-output.txt
```

Measurable via regex on agent output: *did the agent use the `redirect → tail → grep` three-step pattern?* Yes/no is a binary signal. But:

- **False negatives are high.** Agent may use `head`, `grep -c`, `| awk 'NR==NF'` — all equally good, none matching the documented three-step pattern.
- **False positives are possible.** Agent might produce the three-step pattern by habit without consulting the guideline.
- **Signal degrades on paraphrase.** Any generalization of the pattern to a table of allowed variants collapses the measurement to subjective review.

### The narrow variant that could work

If a guideline prescribes a **unique, non-reinventable** output shape (e.g., a specific ASCII table header, a mandatory command-prefix, a documented JSON schema), regex adherence checks are cheap and meaningful. Most guidelines in this repo prescribe *philosophies* (separation of concerns, early return, targeted testing) — not fingerprint-shaped patterns.

### Verdict — **no-go (general case)**, **conditional go (narrow)**

**General-case no-go:** "Guideline reference usage" is not observable from output, and "guideline adherence" is only useful when the prescribed pattern is fingerprint-shaped. Most of our 34 guidelines aren't.

**Narrow conditional go:** A guideline-adherence linter (not eval) for the ≤3 guidelines that prescribe fingerprint-shaped patterns (`output-patterns.md` CLI three-step, `markdown-safe-codeblocks.md` quadruple-backtick rule, `git.md` commit-message regex). That's a static check on transcripts, not a Claude-API eval. Value per guideline is low; aggregate value probably below maintenance cost.

**Condition to flip general verdict:** A published research technique for detecting "document-consultation" from model output with >70% precision appears. None exists today in the literature we've surveyed.

## Hard bounds — actuals vs. targets

| Dimension | Limit | Actual |
|---|---|---|
| Duration | ≤2 person-days | ~0.25 (analysis only — no runner → no PoC possible) |
| API spend | ≤$3 | $0 |
| Scenarios per problem | ≤3 | Problem 1: N/A (design-only); Problem 2: 3 sketched; Problem 3: 1 worked example |
| Artifacts | 3 total | 3 (`commit-conventions`, `verify-before-complete`, `output-patterns.md`) |
| New code | 0 | 0 |

**Why the 0.25-day actual:** We hit the bound that short-circuits the rest — `scripts/skill_trigger_eval.py` doesn't exist, so no PoC can run. The roadmap's explicit fallback *"else shell scripts + manual scoring"* is sound for Problem 2, but Problem 1 PoC literally requires the trigger-evals runner.

## Next actions

1. **Sequence dependency recognized.** Do **not** start any rule-evals roadmap before `road-to-trigger-evals.md` Phase 1 returns a working runner + one green skill eval.
2. **Problem 1 is cheap to graft on.** When the trigger-evals runner lands, add auto-rule evaluation as a Phase 1.5 — estimated ~1 person-day, $0.50, no new infrastructure.
3. **Problem 2 earns its own roadmap only after Problem 1 signal is real.** `road-to-compliance-evals.md` is blocked on a green Problem 1 result and on one maintainer committing 16 hours to scenario authorship for 5 always-rules.
4. **Problem 3 is closed.** Narrow variant is out of proportion to value. If the research landscape changes (published doc-consultation detector), re-open this document with the citation.

## Explicitly not in this research

- Which host (Augment / Claude Code / Copilot) routes rules more accurately. Measuring cross-host is Problem 1's follow-up roadmap, not this one.
- Whether descriptions in this repo are currently well-phrased. That's `road-to-trigger-evals.md`'s job to surface empirically.
- Any recommendation to rewrite rules. Evidence must come first.
- Integration with any dashboard, metrics store, or CI gate. All premature until a single eval produces usable data.

## Related

- [`archive/road-to-trigger-evals.md`](../roadmaps/archive/road-to-trigger-evals.md) — parent, Problem 1 extends it (archived 2026-04-23)
- [`archive/road-to-rule-quality-research.md`](../roadmaps/archive/road-to-rule-quality-research.md) — originating roadmap (archived)
- [`rule-type-governance.md`](../../.agent-src.uncompressed/rules/rule-type-governance.md) — the auto/always classification this research depends on
- [`archive/road-to-drafting-protocol.md`](../roadmaps/archive/road-to-drafting-protocol.md) — would benefit from Problem 1 data if both ship (archived 2026-04-21)
