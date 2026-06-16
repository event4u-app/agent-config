# Corpus refresh runbook — trigger-eval recording (ADR-061 §6 DoD)

How to refresh a corpus-backed skill (`design-intelligence`, and any future
SHA-pinned corpus) and keep its trigger-eval provenance current. This is the
**corpus-refresh Definition of Done**: a refresh that bumps the upstream SHA or
edits the routing description is not done until a live trigger-eval has been
re-run and recorded against the new pin.

> **Scope.** Applies to a skill whose `data/manifest.json` has an
> `upstream` block with a real `sha`. Original-authored corpora (`upstream:
> null`, e.g. `brand`) have no SHA to pin an eval to and are out of scope —
> `lint_eval_freshness.py` skips them.

## When a refresh fires

- The upstream SHA is bumped (new corpus content adopted), OR
- The skill's `description` (its routing trigger surface) is edited, OR
- The quarterly refresh cadence in the manifest comes due.

Any of these can change which queries the description fires on, so the recorded
recall/precision must be re-measured.

## The refresh steps

1. **Bump the pin / edit the corpus** in `src/skills/<skill>/data/` and update
   `upstream.sha` + `upstream.last_checked` in the manifest.

2. **Run the live trigger-eval** (token spend — interactive, gated):

   ```bash
   task setup-evals            # once: bootstrap .venv with the pinned anthropic SDK
   task install-anthropic-key  # once: install ~/.event4u/agent-config/anthropic.key
   .venv/bin/python3 src/scripts/skill_trigger_eval.py \
     --skill <skill> --output /tmp/<skill>-eval.json
   ```

   The runner enforces a tty + an explicit `yes` at the cost preview. It writes
   the `EvalResult` JSON (router, model, metrics) to `--output`.

3. **Record the result into the manifest:**

   ```bash
   agent-config eval:record \
     --eval-json /tmp/<skill>-eval.json \
     --manifest src/skills/<skill>/data/manifest.json
   ```

   This stamps `upstream.last_eval` with the measured precision/recall, the
   `sha_at_eval` (= the current `upstream.sha`), the domain-specific floor, and
   `passed`. Exit codes: `0` pass · `1` recorded-but-floor-missed · `2`
   integrity error (nothing written). A `--dry-run` / MockRouter result is
   refused unless `--allow-mock` (plumbing only) — a mock number is never
   provenance.

4. **Re-condense + commit** the manifest change through the normal `src/` →
   `/condense` flow.

## Definition of Done

A corpus-refresh PR does **not** merge unless, for every in-scope skill it
touches:

- `upstream.last_eval.passed: true`, AND
- `upstream.last_eval.sha_at_eval == upstream.sha`.

`src/scripts/lint_eval_freshness.py` (deterministic, no token spend) enforces
this. It is run standalone today (`task lint-eval-freshness`); it moves into the
blocking `task ci-fast` aggregate once the in-scope corpora carry a recorded
`last_eval` (the one-time live backfill below).

## One-time backfill

Every already-shipped, SHA-pinned corpus skill needs its first recording. Run
steps 2–3 once per skill — `design-intelligence` first, then any other
SHA-pinned corpus that ships `evals/triggers.json`. Because step 2 is a live,
spend-bearing run, do the backfill as a deliberate, confirmed pass — not
autonomously.

## See also

- [`recordTriggerEval.ts`](../../src/cli/commands/recordTriggerEval.ts) — the `eval:record` implementation + domain-specific floors.
- [`lint_eval_freshness.py`](../../src/scripts/lint_eval_freshness.py) — the deterministic freshness gate.
- [`corpus-grounding`](../../src/skills/corpus-grounding/SKILL.md) + [ADR-061](../decisions/ADR-061-corpus-grounding-layer.md) §6 — the provenance discipline this DoD enforces.
