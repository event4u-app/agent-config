# Roadmap: Skill Trigger Evaluation

> Empirical measurement of **whether our skills actually fire when they should**.
> A small Python runner plus a per-skill `evals/triggers.json` file, so every
> skill's description is proven with data instead of hoped into existence.

- **Source inspiration:** [`skills/skill-creator` in `anthropics/skills`](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md) — description-optimization loop
- **Source analysis:** [`agents/analysis/compare-anthropics-skills.md`](../analysis/compare-anthropics-skills.md) (Finding §3 ADAPT)
- **Status:** Phase 1 shipped (runner + 3 pilot triggers.json + 22 tests); Phase 2 decision gate blocked on real API run
- **Author:** Split out of `road-to-anthropic-alignment.md` on 2026-04-20 for focus
- **Last updated:** 2026-04-21 — runner landed in PR #14 with dry-run only; live runs require `ANTHROPIC_API_KEY` + `TRIGGER_EVALS_CONFIRM=1`

## Guiding principle

**Measure, don't guess.** Today every one of our 95+ skill descriptions is crafted
by hand and trusted on intuition. Nobody knows whether `laravel-validation`
actually fires when a user writes *"how do I validate a date field"* without
explicitly naming the skill. This roadmap closes that blind spot — **with a hard
budget**, so we don't accidentally build an internal QA product.

## What this roadmap is for

A `SKILL.md` has a `description` field. Claude reads it during routing to decide
whether to load the skill's body. Two failure modes:

| Failure mode | Symptom | Cost to us |
|---|---|---|
| **Undertriggering** | Description is polite/generic → Claude ignores skill even when relevant | Skill exists but is never used; invisible to the user |
| **Overtriggering** | Description is too broad → skill fires on unrelated queries | Noise; skill's content crowds out more-relevant skills |

Currently we catch neither. A user reports *"feels like the skill never runs"*
and we rewrite the description by gut. There is no pass/fail criterion.

**This roadmap builds exactly one thing:** a runner that, given a skill and a
query set, reports what fraction of should-trigger queries actually triggered,
and what fraction of should-not-trigger queries wrongly triggered. Precision +
recall, per skill, reproducible, diffable.

## What this roadmap is explicitly **not**

- **Not** a skill-drafting assistant. We write skills by hand, by humans, under
  `skill-quality` and `skill-reviewer` governance.
- **Not** content-quality evaluation. We measure **triggering**, not whether the
  skill's instructions produced correct code.
- **Not** an A/B framework between skills. Single-skill, single-description
  measurement is plenty.
- **Not** a continuous production monitor. Run on demand + on skill changes.

## Mental model — how a trigger eval works

```
query           : "how do I validate a date field in a form request?"
expected        : should-trigger=laravel-validation
available_skills: [... all 95+ skill frontmatter ...]
              │
              ▼
         Claude API
              │
              ▼
response probed : did the chosen path include `laravel-validation`? YES / NO
              │
              ▼
          runner logs result → aggregate 10 queries per skill
              │
              ▼
     precision = should-not-trigger correctly ignored
     recall    = should-trigger correctly fired
```

One skill, 10 queries, 10 API calls. Runs in minutes. Costs cents.

## Concrete example

Skill: `laravel-validation`.
File: `.agent-src.uncompressed/skills/laravel-validation/evals/triggers.json`.

```json
{
  "skill": "laravel-validation",
  "queries": [
    {"q": "how do I validate a date field in a form request?", "trigger": true},
    {"q": "add required + email validation to my LoginRequest", "trigger": true},
    {"q": "write a custom validation rule that checks if slug is unique", "trigger": true},
    {"q": "what's the best way to validate nested JSON array input?", "trigger": true},
    {"q": "how do I show validation errors in my blade template?", "trigger": true},
    {"q": "seed 1000 users with fake data for testing", "trigger": false},
    {"q": "run phpstan on my Laravel project", "trigger": false},
    {"q": "how do I write a migration for a polymorphic relationship?", "trigger": false},
    {"q": "explain how Eloquent's hasMany works", "trigger": false},
    {"q": "deploy my Laravel app to AWS Fargate", "trigger": false}
  ]
}
```

Good: concrete file paths in queries, casual user language, 5/5 split, near-miss
should-not-trigger queries that share Laravel vocabulary (`migration`, `Eloquent`,
`Laravel`) without being a validation task.
Bad: *"how do I use laravel-validation"* — leaks the skill name. Reject.

## Success criteria

| Signal | Target |
|---|---|
| PoC runs on 3 skills | ✅ |
| Runner LoC | ≤500 Python |
| Full-suite cost | ≤$5 per run |
| Runtime | ≤3 person-days total |
| Discovery of at least one real triggering defect | required for rollout |
| Reproducibility across runs | ±5% precision/recall |

If any of the first four slip, **stop and write a findings note**. Do not
continue to rollout.

## Prerequisites

- [x] [`road-to-anthropic-alignment.md`](road-to-anthropic-alignment.md) Phase 2
      landed — pushy-description pattern in `skill-quality` rule, audit tool in
      place, **6 descriptions rewritten** (the 3 pilots + `developer-like-execution`,
      `git-workflow`, `conventional-commits-writing`) so the pilot evals measure
      post-rewrite routing.
- [ ] Claude API key with prepaid budget available (target: $50 ceiling across
      all PoC + rollout runs combined). **Blocker for Phase 2 decision gate.**
- [ ] Confirm current pricing of whichever model runs our sessions; use that
      exact model for trigger measurements (undertriggering is model-specific).
      *Default in runner: `claude-sonnet-4-5`; override with `--model`.*
- [x] Branch off current feature branch (`feat/pushy-descriptions`, PR #14).
      Originally said "off main after 1.7.1 merges" — working stacked instead to
      keep pattern + runner in one release.

## Phase 1 — Proof of Concept (3 skills only) ✅ shipped (wiring)

Shipped in PR #14 on `feat/pushy-descriptions`. Execution against the live
API is deferred until Phase 2 — the runner has a `--dry-run` mode that uses
a `MockRouter` for wiring validation.

### 1.1 Pick the 3 target skills ✅

Chose: `php-coder`, `eloquent`, `skill-writing` (per roadmap recommendation).

Rationale:
- `php-coder` — generic, broad description, likely to overtrigger. Tests precision.
- `eloquent` — narrow domain, specific vocabulary. Tests recall.
- `skill-writing` — meta-skill, activation only on agent-infrastructure work.
  Tests whether meta-skills route cleanly.

### 1.2 Author `evals/triggers.json` per skill ✅

Shipped:
- [`.agent-src.uncompressed/skills/php-coder/evals/triggers.json`](../../.agent-src.uncompressed/skills/php-coder/evals/triggers.json)
- [`.agent-src.uncompressed/skills/eloquent/evals/triggers.json`](../../.agent-src.uncompressed/skills/eloquent/evals/triggers.json)
- [`.agent-src.uncompressed/skills/skill-writing/evals/triggers.json`](../../.agent-src.uncompressed/skills/skill-writing/evals/triggers.json)

Each carries 5 should-trigger + 5 should-not-trigger queries, first-person,
single-sentence, no skill-name leakage, near-miss should-not-trigger queries
share domain vocabulary (Laravel, SQL, skill, SKILL.md) without being the
actual task.

### 1.3 Build `scripts/skill_trigger_eval.py` ✅

Shipped [`scripts/skill_trigger_eval.py`](../../scripts/skill_trigger_eval.py)
(~420 LoC, stdlib + optional `anthropic` SDK):

- **Routers:** `TriggerRouter` Protocol with two implementations —
  `MockRouter` (injectable `decide(query, skills) -> list[str]`) and
  `AnthropicRouter` (wraps SDK, prompt sends the full 100-skill catalogue
  and asks for `{"would_load": [...]}` structured JSON).
- **Input:** `--skill <name>` + optional `--triggers <path>` (default:
  `.agent-src.uncompressed/skills/<name>/evals/triggers.json`).
- **Output:** `evals/last-run.json` — timestamp, model, router (mock vs
  anthropic), per-query `{q, expected, observed, loaded_skills, passed}`,
  aggregate metrics (TP/FP/TN/FN + precision + recall), token counts,
  cost estimate.
- **CLI summary:** skill / router / pass-fail count / precision / recall /
  token totals / per-failure lines (FP or FN flagged).
- **Dry-run:** `--dry-run` uses a self-confirming `MockRouter`; output is
  labelled `router: mock` so no one mistakes it for a real eval.
- **No HTML viewer, no dashboard.** JSON is the product.
- **Tests:** [`tests/test_skill_trigger_eval.py`](../../tests/test_skill_trigger_eval.py)
  — 22 tests (frontmatter parsing, metrics math, cost estimate, MockRouter,
  AnthropicRouter with injected fake client, code-fence tolerance, CLI smoke
  run, exit codes). All green.
- **Taskfile:** `task test-triggers -- <skill>` for dry-run;
  `task test-triggers-live -- <skill>` refuses to launch unless
  `TRIGGER_EVALS_CONFIRM=1` is set. Both documented inline.
- **Gitignore:** `**/evals/last-run.json` — run outputs are not committed.

## Phase 2 — Decision Gate

Proceed to rollout **only if all** of these are true:

- PoC stayed within LoC + cost + time budget
- Runs found at least one **real** triggering problem on one of the 3 skills
- Output is reproducible: two consecutive runs differ by ≤5% precision/recall
- The problem found could be fixed by a description rewrite alone (not by
  architecture change)

If any fails: **write findings into `agents/docs/trigger-evals-poc-findings.md`**
and stop. Do not expand scope.

## Phase 3 — Rollout (conditional, bounded)

### 3.1 Tooling integration

- Add `evals/triggers.json` as optional file in the new-skill scaffold
  (`.agent-src.uncompressed/templates/skill.md` neighborhood)
- `task test-triggers -- <skill>` runs the eval for one skill
- `task test-triggers-all` runs the full set (cost-gated by default;
  requires `TRIGGER_EVALS_CONFIRM=1` env var)

### 3.2 CI policy

- **Warning**, not error, if a changed skill has no `evals/triggers.json`
- **Error** if an existing `evals/triggers.json` fails (recall <0.8 or
  precision <0.9) — forces either description fix or test fix
- CI does **not** run the API-calling eval — too expensive, too flaky. CI
  only validates the queries.json shape + existence. Actual runs are manual
  or in a nightly workflow with explicit budget cap.

### 3.3 Target coverage: top-20 only

- Pick the 20 most-invoked skills (measurable via Augment/Claude Code session
  logs if available, or by subjective user feedback)
- Author evals for all 20 in small batches (3-5 per PR)
- **Stop at 20.** Not 95. Diminishing returns past the top decile.

### 3.4 Documentation

- New section in [`skill-quality` rule](../../.agent-src.uncompressed/rules/skill-quality.md):
  "If your skill has `evals/triggers.json`, it must pass before merge."
- New section in [`skill-writing` guideline](../../.agent-src.uncompressed/guidelines/skill-writing.md):
  one canonical example (one good query, one bad query, one near-miss).

## Explicitly rejected

| Pattern from skill-creator | Why rejected here |
|---|---|
| HTML eval viewer (`generate_review.py`) | Too much UI. CLI + JSON suffices. |
| Subagent-based parallel runs | Claude-Code-infrastructure-specific; not portable. |
| Baseline-vs-skill A/B benchmarking | Trigger rate is a single-call measure, not a paired observation. |
| Blind comparison with independent judge | Overkill for our scale (95 skills, one human reviewer). |
| Full interactive skill-creator workflow | We maintain skills by hand under explicit governance. |
| Automated description rewriting by Claude (the `run_loop.py` optimizer) | Keeps humans in the loop. Claude may propose — a human approves. |
| Coverage of all 95+ skills | Hard cap at 20. Maintenance cost compounds. |

## Open questions

1. **Which model do we pin for evals?** The Augment-side and the Claude-Code-side
   may route differently. If both matter, we may need two eval profiles.
2. **Do queries age?** User vocabulary shifts over time. Should queries have
   a `added_on` field and a quarterly review cycle?
3. **How do we avoid overfitting?** If we rewrite descriptions until evals pass,
   we may optimize against our own queries and still miss real-world phrasings.
   Mitigation: 60% train / 40% held-out test split from day one (stolen from
   skill-creator verbatim — this part is worth copying).

## Related

- [`road-to-anthropic-alignment.md`](road-to-anthropic-alignment.md) — parent roadmap (Phases 1-2: marketplace + pushy descriptions)
- [`archive/road-to-9.md`](archive/road-to-9.md) — archived sibling (runtime depth, closed 2026-04-21)
- [`archive/road-to-mcp.md`](archive/road-to-mcp.md) — archived sibling (MCP config generation, closed 2026-04-21)
- [`agents/analysis/compare-anthropics-skills.md`](../analysis/compare-anthropics-skills.md) — origin finding
