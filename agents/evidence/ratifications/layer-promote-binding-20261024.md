---
proposed_by: road-to-a-setup-that-decides-itself step 3.3 (promote after proof, never at install)
implemented_by: claude-opus-5.5 session on drain/setup-decides-itself-20261024
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 5 of 2026-10-24
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: a4fd91f350474f07ade26a721dd9ef028aee8e11b720a7b21967f0a47748ebee
---

<!-- evidence-type: ratification -->

# Ratification — binding the `layer-promote` session concern

`check_kernel_edit_ratified` gates three hook-plumbing files on this branch:
`src/config/hook-bundle-budget.json`, `src/scripts/hook_manifest.yaml` and its compiled
projection `src/scripts/hook_manifest.json`. The `subject:` digest covers all three, computed
with `./scripts-run src/scripts/ratification_subject --files $(git diff --name-only origin/main...HEAD) --base-ref origin/main`
at revision `22b0d57bf3`.

## What was ratified

- The concern `layer-promote` (`src/scripts/hooks/layer_promotion_hook.ts`, `severity: advisory`,
  `fail_closed: false`, `effect: execution`), appended to `platforms.claude.session_start` only and
  loaded from its own chunk through `LAZY_CONCERNS` (54,058 B, ceiling 56,800, `yaml` external).
  Kill switch `AGENT_CONFIG_LAYER_PROMOTE=off`.
- Its body, `src/install/layerPromotion.ts`: a thinned claude rule layer contradicted by an arrival
  record taken after the promotion is restored from the staged snapshot and demoted; a full layer is
  thinned for following sessions only while the shipped switch `src/config/layer-form-promotion.json`
  is on (it ships off; step 5.3 decides), the layer-form decision returns `thinned`, and the pass fits
  the latency budget. Only files the ownership ledger proves are the package's, byte for byte, are
  rewritten; the consequence class and the safety-floor tier stay whole; the ledger follows every
  rewrite. A `promoting` lock, created exclusively and naming its owner, spans the pass: a live owner
  is never recovered, a dead owner's pass is restored by whichever session wins one rename, and a
  pass that lost its lock records and cleans nothing.
- `max_bytes` 1,554,000 → 1,554,800 with a `raise_log` entry: +144 B for the `LAZY_CONCERNS` row and
  +793 B for the project tree's precedence rule (`projectTreeForm()`), now on the live path after the
  2/2 council design round of the same day for step 3.6. Gate reading 1,554,423 B.

Both seats said in every round that the change does not expand authority: same host, same event,
same target (the package's own stamped, ledger-recorded files under `~/.claude/rules`).

## How it got here

Five rounds, CLI subscription transport, USD 0.00. Prompts committed verbatim:
`agents/evidence/council/layer-promote-binding-ratification-r1-20261024.question.md` through
`…-r5-20261024.question.md`. In rounds 1–4 the anthropic seat ratified and the openai seat refused,
each time on a finding that was real and fixed:

- **Round 1:** a rule file the ledger does not record was eligible for thinning; a missing promotion
  record let pre-promotion arrivals trigger a demotion. Fixed: unrecorded files are kept whole; the
  boundary falls back to the thinned marker's mtime.
- **Round 2:** with the marker written before the pass, a process killed mid-pass left a layer
  recorded as thinned that no session retried or restored. Fixed: a `promoting` marker spans the pass
  and the next session restores.
- **Round 3:** that marker could not tell a concurrent live pass from an interrupted one. Fixed: an
  exclusive owner-naming lock, a rename-claimed recovery, and a post-pass ownership check.
- **Round 4:** a 30-s timeout still let a session recover under a live slow owner, and the failure
  cleanup ran before the ownership check. Fixed: liveness alone decides; cleanup only while owned.
- **Round 5, both seats ratified,** with no further finding. The openai seat named the remaining
  trade-off — a reused pid holds a dead owner's lock until that process exits, during which the
  concern acts on nothing — as a deliberate fail-safe, not a blocker, and suggested documenting the
  manual removal; `docs/installation.md` now says how.

Every fix carries a test that was red without it: `tests/install/layer_promotion.test.ts`, 14 cases.
