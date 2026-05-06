# ADR — Rule Kernel and Router (Roadmap Closure)

- **Status:** Accepted (2026-05-06)
- **Closes:** `agents/roadmaps/road-to-kernel-and-router.md`
- **Sibling roadmaps closed in the same window:**
  `agents/roadmaps/road-to-token-optimization.md`
  (Phase 1 shipped, Phase 2/3 deferred-with-trigger by design),
  `agents/roadmaps/road-to-package-optimization.md`
  (closed with null result per P1.1 binary acceptance gate).
- **Related ADRs:** ADR-001 (kernel-swap deferred), ADR-002
  (kernel-bucket cap raise 25k → 26k, per-rule Iron-Law overrides).

## Context

The agent rule set was an "always-loaded" surface: every conversation
paid the full 193k-char rule cost regardless of task. There was no
deterministic way to load only the policy actually relevant to the
current intent, and no mechanical guard against rule-bucket creep.

## Decision

Adopt a **Kernel + Router** loading model with three tiers and three
cost profiles, governed by a compiled router manifest and CI-enforced
size budgets.

### What shipped

- **Kernel:** 9 always-loaded Iron-Law rules (`agent-authority`,
  `ask-when-uncertain`, `commit-policy`, `direct-answers`,
  `language-and-tone`, `no-cheap-questions`,
  `non-destructive-by-default`, `scope-control`,
  `verify-before-complete`). Locked set:
  [`docs/contracts/kernel-membership.md`](../contracts/kernel-membership.md).
- **Router:** `router.json` compiled deterministically from rule
  frontmatter (`tier:`, `triggers:`, `routes_to:`) by
  `scripts/compile_router.py`. Contract:
  [`docs/contracts/rule-router.md`](../contracts/rule-router.md).
- **Cost profiles:** `minimal` = kernel only · `balanced` = kernel +
  tier-1 (default) · `full` = kernel + tier-1 + tier-2.
- **Budget gates:** `task lint-rule-budget` enforces kernel ≤ 26k chars
  and per-rule ≤ 2.5k (Iron-Law overrides up to 4.0k via ADR-002).
  Daily snapshots in `agents/.rule-budget-history.jsonl`.
- **Compression discipline:** P4.3 brought the auto-bucket from
  ~75k → 59 220 chars (under the 60k target) without behaviour drift.

### What we cut

- **P4.1 / P4.2** — auto-rule → skill / guideline migrations.
  Cancelled as scope-cut after P4.3 compression alone landed the
  auto-bucket under target. The migrations were a means, not an end.
- **road-to-package-optimization Phase 1.2 / 1.3 / Phase 2 / Phase 3**
  — cancelled per P1.1's binary acceptance gate. The prototype
  contradiction linter scanned 317 artefacts in 0.034 s and flagged
  zero cross-artefact contradictions. The artefact surface is
  empirically already well-governed on the heuristics tested; building
  a production linter for a non-existent failure mode is not honest.
- **road-to-token-optimization Phase 2 / Phase 3** — *not* cut, just
  trigger-deferred by design (telemetry threshold + `/cost:report`
  ship). Will reopen autonomously when their declared signals fire.

### What stayed

- All Iron-Law fences. SHA-verified preserved by
  `scripts/iron_law_sha.py` across the kernel compression pass.
- Behaviour parity. Golden transcripts pass under all three profiles.
- The pre-existing `auto`-tier rules; only their compressed bodies
  changed, never their obligation surface.

## Profile semantics

| Profile | Buckets loaded | Use case |
|---|---|---|
| `minimal` | kernel only | Tightly bounded automation, CLI shell-outs, "run this one command" |
| `balanced` *(default)* | kernel + tier-1 | Day-to-day engineering work; matches pre-roadmap behaviour superset |
| `full` | kernel + tier-1 + tier-2 | Architectural / cross-wing / governance sessions |

Consumer projects opt in via `personal.cost_profile` in
`.agent-settings.yml`. The install script keeps user-set values; only
the template default is `balanced`.

## Reversibility

If the Kernel + Router model needs unwinding:

1. Set every rule's frontmatter `tier:` to `kernel` and rebuild
   `router.json` — every rule loads on every turn (legacy behaviour).
2. Drop `lint-rule-budget` from `task ci`.
3. The compiled `router.json` is a derived artefact; deleting it and
   running `compile_router.py --no-router` returns the always-loaded
   model.

No data migration, no irreversible compression. Iron-Law SHA fences
mean Iron Laws can be diffed against the pre-roadmap baseline at any
point.

## Final measurements (2026-05-06)

| Metric | Pre-roadmap | Post-roadmap | Δ |
|---|---:|---:|---:|
| kernel bucket | n/a (always-loaded) | 25 590 | new gate |
| auto bucket | ~75 000 | 59 220 | −21 % |
| total rule chars | ~193 000 | 84 810 | −56 % |
| rule count | 56 | 57 (added `token-optimizer-maintenance`) | +1 |
| skills count | 134 | 135 (added `token-optimizer`) | +1 |

Kernel-bucket-check: PASS. Per-rule cap: 16 rules over 2.5k target,
all within 4.0k Iron-Law override per ADR-002. Trend snapshot
appended to `agents/.rule-budget-history.jsonl`.

## Consequences

- New rule submissions must declare `tier:` + `triggers:` + (when
  applicable) `routes_to:` in frontmatter; the router compiler
  rejects malformed entries.
- Editing Iron-Law-fenced bodies requires a fresh
  `scripts/iron_law_sha.py --update` pass; CI fails on hash drift.
- The `token-optimizer` skill is now the single consult surface for
  token-cost decisions; editing any cited asset requires a same-commit
  catalog update per `token-optimizer-maintenance` rule (CI-backstopped
  by `scripts/check_token_optimizer_freshness.py`).
- Deferred phases (token-opt P2/P3, kernel-swap from ADR-001) remain
  reopenable on their declared triggers without further roadmap work.
