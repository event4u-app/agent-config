---
stability: beta
---

# `load_context:` Budget Accounting Model

> **Audience:** maintainers of `type: "always"` rules and the budget
> linter who need a single, deterministic answer to "how many chars
> does this rule cost the always-budget?".
> **Linter:** `scripts/check_always_budget.py`
> (run via `task check-always-budget`).
> **Companion:** [`load-context-schema.md`](load-context-schema.md) —
> frontmatter contract for citing a context from a rule.
> [`STABILITY.md § Budget contracts`](STABILITY.md#budget-contracts) —
> the numeric caps this model enforces.

This contract locks the **accounting model** by which a `type: "always"`
rule's `load_context:` declarations contribute to the always-rule
budget. It resolves the "is the rule its file size or its file size
plus everything it loads?" ambiguity surfaced by Round-2 council on
`road-to-structural-optimization` (Finding 7, CRITICAL).

**Status:** internal-locked. Changes require a contract version bump
and a roadmap revision (per
`road-to-structural-optimization.md` § Definitions). The 2 % tolerance
band on the retroactive test (G3 in v3.1) is the only legal way to
adjust the model parameters without a roadmap revision; an overshoot
above the band rejects the model and escalates to the council.

## The locked model — Model (b) literal

For any rule with frontmatter `type: "always"`:

```
EffectiveSize(rule) = RawSize(rule)
                    + Σ RawSize(c) for every c in transitive_closure(rule.load_context*)
```

Where:

- `load_context*` is the union of `load_context:` (lazy) **and**
  `load_context_eager:` entries declared in frontmatter
  (per [`load-context-schema.md`](load-context-schema.md)).
- `transitive_closure` walks `load_context:` declarations on
  context files **up to depth 2** — see § Nesting cap below.
- `RawSize` is the byte size of the compressed file
  (`.agent-src/...`), measured by `os.path.getsize()`. The
  uncompressed source paths in frontmatter are mapped to their
  compressed counterparts before sizing.
- A context loaded by N always-rules counts **N times** (once per
  loading rule). Rationale: the always-budget protects context-window
  utilization at activation time; if rule A and rule B both fire on
  the same turn, the agent pays both costs.

### Why model (b) and not (a) or (c)

| Model | Definition | Why rejected |
|---|---|---|
| (a) rule chars only | `EffectiveSize = RawSize(rule)` | Ignores the cost of declared contexts. Phase-2A obligation extraction would *appear* free, allowing unbounded context bloat. |
| (b) literal *(this contract)* | `EffectiveSize = RawSize(rule) + Σ contexts` | Simplest invariant. Aligns with how the agent actually pays the cost when both rule and context fire on a turn. |
| (c) shared-divisor | `EffectiveSize = RawSize(rule) + Σ (RawSize(c) / N_loaders)` | Tempting for shared `commit-mechanics`-style contexts but breaks the "what does each rule cost in isolation" question. Reserved as the **first refinement step** if the 2 % tolerance band is exceeded. |

Council Round 3 converged A/A/A on the **separate-skills + shared-context**
extraction pattern (Q1) and the **one-rule + three-contexts** consolidation
(Q2); model (b) literal is the accounting that makes both patterns
honest about their cost.

## Load order (Q1) — file order in frontmatter

Locked by Phase 1.2 of `road-to-context-layer-maturity` (council
session `2026-05-03T17-56-21Z`, v2 lock).

When a rule declares multiple `load_context:` and / or
`load_context_eager:` entries, the agent processes them in the order
they appear in the YAML list, top to bottom. `load_context_eager:`
entries are concatenated into the active context in declaration
order; `load_context:` entries are available for lazy retrieval in
the same order, surfaced first-listed-first when the rule body cites
them in prose.

**Rejected alternatives:**

- *Citation order in prose* — non-machine-readable; would force every
  rule to embed a sort hint and the linter to parse rule body text.
- *Priority field per entry* — adds frontmatter surface area without
  observable benefit. The current rule with the most contexts
  (`autonomous-execution`, 3 contexts) reads each in declaration
  order without ambiguity.

This contract treats list order as the canonical signal. Authors
must order their `load_context:` entries from "load this first" to
"load this last" so prose citations and frontmatter agree.

## Per-rule context-count cap (Q2) — ≤ 3 contexts per rule

Locked by Phase 1.3 of `road-to-context-layer-maturity` (council
session `2026-05-03T17-56-21Z`, v2 lock). Enforced by
`scripts/check_always_budget.py` as `MAX_CONTEXTS_PER_RULE = 3`.

A rule's combined count of `load_context:` + `load_context_eager:`
top-level entries must not exceed **3**. The cap is on *declared*
entries (depth 1 from the rule), not transitive closure — depth-2
context citations are governed by the depth-2 nesting cap below.

**Rationale:**

- Empirical max in the current rule set is 3
  (`autonomous-execution`); the cap locks the ceiling without forcing
  any rewrite.
- A 4th declared context is the structural signal that the rule
  should split (one rule, one obligation surface), not load more.
- Cross-platform mechanical: a count check is O(N), no semantic
  analysis, identical observable on Augment and Claude Code.

The cap applies to **all rule types** (`always` and `auto`) — Q2 is
a structural constraint on rule shape, not a budget concern.

## Cross-rule sharing (Q3) — Model (b) literal locked

Locked by Phase 1.4 of `road-to-context-layer-maturity` (decision
3a). The accounting model in § The locked model above stands without
shared-context discount.

**Decision:** when context X is loaded by N rules, each rule pays
the full `RawSize(X)` under Model (b). No `chars(X) / N` discount.

**Rationale (3a over 3b):**

- The linter is correct as-is — `RECOVERY_BAND_ENABLED` plus the
  per-rule allowlist is already a working ratchet to drive total
  utilization below 100 %.
- 3b would require a linter rewrite plus a new failure-mode test
  family (cross-rule attribution, divisor-stability invariants).
  Phase 1.4a's 4-hour / 200-LOC feasibility cap was structured to
  reject 3b on cost; with no current shared-context patterns
  exceeding 1 loader per context (verified Phase 1.1 inventory), 3b
  has no measurable upside.
- Phase 4c (shared-context discount) becomes a no-op under 3a.
  Phase 4 leverage shifts to 4a (demote), 4b (merge), and 4d
  (hard-compress) — see `road-to-context-layer-maturity` Phase 4
  inputs gate.

**Reopener:** if a future inventory shows ≥ 3 shared-context loaders
and total utilization re-enters the 95–100 % zone after Phase 4
completes, run the Phase 1.4a feasibility spike and propose 3b via
contract version bump.

## Nesting cap — depth 2

A rule's `load_context:` may cite a context (depth 1). A context may
cite further contexts in its own frontmatter (depth 2). A depth-2
context citing a third context (depth 3) **aborts the build**.

Rationale: bounded recursion makes the linter terminate in O(N) and
prevents accidental cycles. Council Round-2 finding 9 (HIGH).

The check is enforced by `scripts/check_always_budget.py` as a
separate exit-code-1 condition (independent of the budget caps), so
that a depth violation surfaces with the violating chain, not as a
budget-cap breach.

## Known-breach allowlist (transitional)

Phase 2A targets `non-destructive-by-default` and `scope-control`
for slimming. Both rules currently exceed the **6,000-char per-rule
cap** under model (b) literal — this is expected and intentional:
Phase 0.2 lands the model and its measurement; Phase 2A brings the
breaches under the cap.

To keep CI green during the transition, the linter and the test
suite carry an explicit `KNOWN_PER_RULE_BREACHES` allowlist with the
**measured ceiling** for each entry. Each entry must:

- Be referenced by the Phase 2A roadmap step that will retire it.
- Have a documented expected-removal date or roadmap milestone.
- Fail the build the moment the breach **grows** above the recorded
  ceiling (regression guard).

Phase 2A's success criterion (`budget delta ≥ −5 %`) is the trigger
to remove entries from the allowlist. The allowlist must be **empty**
before Phase 2A is marked complete.

## Retroactive test result (Phase 0.2.3)

PR #34's `autonomous-execution` split moved mechanics into three
contexts under `contexts/execution/`. Re-measuring under model (b)
literal:

| Metric | Value | Cap | Utilization |
|---|---:|---:|---:|
| Total extended budget | 49,311 chars | 49,000 | **100.6 %** |
| Top-3 extended | 22,248 chars | 24,500 | 90.8 % |
| Per-rule breaches | 2 of 9 | 0 | `non-destructive-by-default` (7,887), `scope-control` (8,529) |

The total sits **0.6 % over** the cap — within the 2 % tolerance band
(G3) which permits parameter refinement before model rejection. Per
the contract, the model is **accepted**; the per-rule breaches are
recorded in the transitional allowlist for Phase 2A.

`autonomous-execution` itself is `type: "auto"` and does not enter
the always-budget. Its own extended size (rule 5,196 + three contexts
8,453) = 13,649 chars is reported by the linter for Phase 2B
diagnostics but does not gate the always-budget cap.

## Linter contract

`scripts/check_always_budget.py` enforces:

1. `EffectiveSize` per always-rule against the per-rule cap (with
   the transitional allowlist).
2. Sum of `EffectiveSize` across all always-rules against the total
   cap (warn at 80 %, fail at ≥ 90 % — unchanged from PR #34).
3. Top-3 sum against the top-3 cap.
4. Depth ≤ 2 on every `load_context:` chain reachable from an
   always-rule.

### Recovery band (Phase 2A → Phase 5 transitional)

Locked by AI Council session `2026-05-03T12-02-42Z` (verdict A1)
after Phase 2A was attempted and reverted: the 1:1 rule-to-context
split was uneconomical under Model (b) literal because the
frontmatter and citation-line tax on the new context file outweighed
the chars removed from the rule. Reverting Phase 2A left the budget
at 96.8 % — strictly better than the `main` baseline at 100.6 % but
inside the 90–100 % gap zone the linter rejects.

While `RECOVERY_BAND_ENABLED = True`, the linter accepts a branch in
the gap zone iff:

- `total_ext < baseline` (read from `.github/budget-baseline.txt`,
  the chars at last-green `main`), AND
- every per-rule cap holds (allowlisted entries unchanged), AND
- top-3 cap holds, AND
- depth-2 cap holds.

A branch passing only the recovery band reports
`⚠️  WARN (recovery band, baseline N)`. The band is a one-way ratchet:
once a smaller branch lands on `main`, the baseline file must be
updated to the new total in the same commit. Phase 5 of
`road-to-structural-optimization` flips `RECOVERY_BAND_ENABLED` to
`False` and removes both the band and the G3 tolerance — the gate
collapses to `total < TOTAL_CAP` strict.

Exit codes: 0 = pass (or warn, including recovery band), 1 = any cap
breach or depth violation, 3 = internal error.

## What this contract intentionally does **not** promise

- **No claim about runtime cost.** The model treats every context
  as if it were active when its rule fires. The agent may cache or
  short-circuit lazy loads at runtime; the budget is the **upper
  bound**, not the realised cost.
- **No claim about `type: "auto"` rules.** Auto rules enter the
  agent's context only when their description matches; they have
  their own per-rule LOC targets in Phase 2B (not a global budget).
- **No claim about commands or skills.** Commands and skills load
  on user invocation. Their token cost is accounted by the
  command-cluster and skill-family contracts, not here.
