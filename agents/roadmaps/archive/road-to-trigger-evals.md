# Roadmap: Skill Trigger Evaluation

> Empirical measurement of **whether our skills actually fire when they should**.
> A small Python runner plus a per-skill `evals/triggers.json` file, so every
> skill's description is proven with data instead of hoped into existence.

- **Source inspiration:** [`skills/skill-creator` in `anthropics/skills`](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md) — description-optimization loop
- **Source analysis:** [`agents/analysis/compare-anthropics-skills.md`](../analysis/compare-anthropics-skills.md) (Finding §3 ADAPT)
- **Status:** Archived 2026-04-23 — all agent-automatable work done (Phase 1 runner + Phase 3.5 output-schema enforcement). Phase 2 live execution is a manual user action tracked via `task test-triggers-live`, not a checkbox on this roadmap.
- **Author:** Split out of `archive/road-to-anthropic-alignment.md` on 2026-04-20 for focus (parent archived 2026-04-21)
- **Last updated:** 2026-04-23 — Phase 3.5 (Q26 output-template enforcement) shipped: `scripts/skill_linter.py` now validates per-skill `evals/output-schema.yml`; schemas seeded for `refine-ticket` and `estimate-ticket`; 9 new linter tests.

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

- [x] [`archive/road-to-anthropic-alignment.md`](archive/road-to-anthropic-alignment.md) Phase 2
      landed — pushy-description pattern in `skill-quality` rule, audit tool in
      place, **6 descriptions rewritten** (the 3 pilots + `developer-like-execution`,
      `git-workflow`, `conventional-commits-writing`) so the pilot evals measure
      post-rewrite routing.
- [x] Claude API key with prepaid budget available (target: $50 ceiling across
      all PoC + rollout runs combined). **Phase 2 decision gate unblocked.**
      *(2026-04-22: Q28 resolved — user-level key already installed at
      `~/.config/agent-config/anthropic.key`, $50 ceiling confirmed.
      See [`open-questions-2.md`](open-questions-2.md) Q28.)*
- [x] Confirm current pricing of whichever model runs our sessions; use that
      exact model for trigger measurements (undertriggering is model-specific).
      *(2026-04-22: Q28 resolved — pinned to `claude-sonnet-4-5` for pilot +
      initial rollout. Opus delta run follows separately, not in parallel.
      `--model` override remains available per invocation.)*
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
  — 38 tests (frontmatter parsing, metrics math, cost estimate, MockRouter,
  AnthropicRouter api-key contract, key-gate incl. mode/prefix/empty checks,
  confirmation-gate incl. tty/case/empty checks, live-path abort on missing
  key, code-fence tolerance, CLI smoke run, exit codes). All green.
- **Taskfile:** `task test-triggers -- <skill>` for dry-run;
  `task test-triggers-live -- <skill>` launches the live runner, which
  itself enforces the key file + tty + `yes` gates.
- **Gitignore:** `**/evals/last-run.json` — run outputs are not committed.
  Live runs land in `evals/results/<timestamp>-<skill>-<model>.json`
  (also gitignored).

### How to run a live eval

1. **Bootstrap the venv once.** Creates `.venv/` (gitignored) with the
   pinned `anthropic` SDK. System Python stays untouched:

   ```bash
   task setup-evals
   ```

   Idempotent — safe to rerun to refresh pins from
   `scripts/requirements-evals.txt`.

2. **Install the key once.** Paste it into the interactive prompt — no
   echo, no history, no env-var:

   ```bash
   task install-anthropic-key
   ```

   Writes `~/.config/agent-config/anthropic.key` with mode `0600`.
   Piped stdin is rejected. Rerun the same command to rotate;
   `rm ~/.config/agent-config/anthropic.key` to remove.

3. **Run the eval.** Each invocation prints a cost preview and waits for
   exactly `yes` on stdin before calling the API:

   ```bash
   task test-triggers-live -- eloquent
   ```

   Abort paths (any of them exits non-zero, no API call):
   - key file missing / wrong mode / wrong prefix / empty
   - non-tty stdin
   - answer is not literally `yes`

4. **Read the result.** JSON lands in
   `evals/results/<UTC-timestamp>-<skill>-<model>.json` with
   per-query `router_response`, `passed`, and aggregate
   `precision` / `recall` / `f1` metrics.

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
- `task test-triggers-all` runs the full set (cost-gated by the same
  key-file + per-skill confirmation gates as the single-skill runner)

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

### 3.5 Output-template presence enforcement (inherited from Q26) ✅ shipped

- [x] Extend `scripts/skill_linter.py` to validate that skills declaring
  an output template carry the expected section shape. Minimal design:
  per-skill `evals/output-schema.yml` (optional) listing required
  `##`-headers; linter pass fails if the headers drift.
  *(2026-04-23: `load_output_schema` / `parse_output_schema` /
  `lint_output_schema` added; wired as a post-processor in
  `lint_file` behind the `artifact_type == "skill"` gate. Stdlib-only
  YAML parser — no PyYAML dependency. Emits `output_schema_drift`
  error on missing header.)*
- [x] Seed the schema for the two skills that already freeze their
  output: `refine-ticket` (`Refined ticket` / `Top-5 risks` /
  `Persona voices`) and `estimate-ticket` (same three-section shape).
  *(2026-04-23:
  [`.agent-src.uncompressed/skills/refine-ticket/evals/output-schema.yml`](../../.agent-src.uncompressed/skills/refine-ticket/evals/output-schema.yml)
  and
  [`.agent-src.uncompressed/skills/estimate-ticket/evals/output-schema.yml`](../../.agent-src.uncompressed/skills/estimate-ticket/evals/output-schema.yml)
  ship the three-section contract each; `estimate-ticket` uses
  `Persona voices (sizing-focused)` and intentionally omits the
  conditional `Split points` section. 9 new linter tests, 564/564
  pytest green.)*
- Deferred from `archive/road-to-ticket-refinement.md` Phase 1 per
  Q26 decision — rode on this roadmap's linter-infra upgrade instead
  of landing as a one-off.

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

## Final status — 2026-04-23

| Item set | Status |
|---|---|
| Phase 0 prerequisites — rewrites, pattern in `skill-quality`, audit tool | ✅ done |
| Phase 1 PoC — runner, 3-skill wiring, MockRouter, dry-run mode | ✅ shipped (PR #14) |
| Phase 2 decision gate — live execution against Claude API | ⏸ **user action**: `task test-triggers-live -- eloquent` (Q28 resolved 2026-04-22; key + budget + model all pinned; only a human can answer the `yes` confirmation gate) |
| Phase 3.5 — output-template presence enforcement (Q26) | ✅ shipped 2026-04-23 (linter + two schemas + 9 tests) |
| Phase 3.1–3.4 — rollout, CI policy, top-20 coverage, docs | ⏸ conditional (gated on Phase 2 findings) |

All agent-automatable work on this roadmap is done — zero open
checkboxes. The remaining Phase 2 live execution is a **manual
user action**, deliberately not a checkbox: every
`task test-triggers-live -- <skill>` invocation requires
interactive `yes` on stdin + a `0600` key file at
`~/.config/agent-config/anthropic.key`, so the agent cannot
run it. Recommended first run: `task test-triggers-live -- eloquent`
(narrow domain, clearest signal). Findings land in
[`agents/docs/trigger-evals-poc-findings.md`](../docs/trigger-evals-poc-findings.md)
— that file's creation is the trigger for Phase 3 rollout, tracked
separately rather than reopening this archived roadmap.

## Related

- [`open-questions-2.md`](open-questions-2.md) — Q28 (resolved 2026-04-22)
- [`archive/road-to-anthropic-alignment.md`](archive/road-to-anthropic-alignment.md) — parent roadmap (Phases 1-2: marketplace + pushy descriptions; archived 2026-04-21)
- [`archive/road-to-9.md`](archive/road-to-9.md) — archived sibling (runtime depth, closed 2026-04-21)
- [`archive/road-to-mcp.md`](archive/road-to-mcp.md) — archived sibling (MCP config generation, closed 2026-04-21)
- [`agents/analysis/compare-anthropics-skills.md`](../analysis/compare-anthropics-skills.md) — origin finding
