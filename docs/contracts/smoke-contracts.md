---
stability: beta
keep-beta-until: 2026-08-16
---

# Smoke Contracts — Phase 3 of step-11-ruflo-parity

> **Status:** active · **Owner:** step-11 Phase 3 · **Sibling:**
> [`measurement-baseline.md`](measurement-baseline.md) (snapshot semantics)
> · [`cost-enforcement.md`](cost-enforcement.md) (cost ladder)

Per-tier smoke scripts validate the system's structural baselines on
every PR that touches the tier. Each script is **fast** (≤ 30 s wall),
**deterministic** (same input → same exit), and **measured** (baseline
numbers come from `task smoke:*` on `main` at lock-in, not from claims).

## § 1 — Runtime budget

Every `scripts/smoke/<tier>.sh` honours:

| Limit | Value | Rationale |
|---|---:|---|
| Wall time | ≤ 30 s | CI matrix slot; local dev iteration |
| External I/O | none beyond filesystem | no network, no MCP |
| Output | last line is the **baseline declaration** | parseable by CI summary |

A smoke that approaches 30 s should be split into sub-smokes, not
optimised in place.

## § 2 — Path-trigger globs

CI's `.github/workflows/smoke.yml` dispatches the right scripts based on
the paths touched in the PR:

| Tier | Globs that trigger | Script |
|---|---|---|
| kernel | `.agent-src.uncompressed/rules/**`, `.agent-src/rules/**`, `router.json`, `scripts/measure_rule_budget.py` | `scripts/smoke/kernel.sh` |
| router | `router.json`, `.agent-src.uncompressed/rules/**`, `.agent-src.uncompressed/skills/**`, `docs/contracts/**`, `docs/guidelines/**` | `scripts/smoke/router.sh` |
| schema | `.agent-src.uncompressed/skills/**`, `.agent-src.uncompressed/rules/**`, `scripts/schemas/**`, `scripts/skill_linter.py`, `scripts/validate_frontmatter.py` | `scripts/smoke/schema.sh` |
| skills | `.agent-src.uncompressed/skills/**` | `scripts/smoke/skills.sh` |

`task smoke` runs all four locally regardless of paths.

## § 3 — Baseline declarations (locked 2026-05-16)

Smoke baselines are **measured today**, not aspirational. They lock
**regression**: a smoke goes red only if the count drifts the wrong way.
Drift toward the ideal (fewer breaches, more fences) updates the
constant in the script body and the row below.

### § 3.1 — Kernel (`scripts/smoke/kernel.sh`)

```
9 kernel rules · 8 carry Iron-Law fences · 1 dispatch index · ≤ 2 budget breaches
```

- **9 kernel rules** — fixed by [`kernel-membership.md`](kernel-membership.md).
- **8 carry Iron-Law fences** — measured 2026-05-16. `agent-authority`
  is the **dispatch index** (priority table pointing at the other four
  authority rules); it is structurally exempt from the Iron-Law-fence
  requirement and listed in the script's `EXEMPT_FROM_FENCE` set.
- **≤ 2 budget breaches** — `python3 scripts/measure_rule_budget.py
  --kernel-budget-check` currently reports 2 breaches
  (`kernel-bucket > 26000`, `no-cheap-questions > 4000`). The smoke
  asserts the count does not grow; reductions update `EXPECTED_BREACHES`
  in `scripts/smoke/kernel.sh`. See
  [`road-to-kernel-and-router.md`](../../agents/roadmaps/road-to-kernel-and-router.md)
  for the path back to zero.

### § 3.2 — Router (`scripts/smoke/router.sh`)

```
75 router ids · 0 broken rule pointers · 35 routes_to refs · 2 missing contracts
```

- **75 ids** — 9 kernel + 24 tier_1 + 42 tier_2; every id resolves to
  `.agent-src/rules/<id>.md`.
- **0 broken rule pointers** — hard assertion; smoke fails on any miss.
- **35 routes_to refs** across tier_1 + tier_2; resolver honours the
  four prefixes (`skill:`, `command:`, `guideline:`, `contract:`).
- **2 missing contracts** — measured 2026-05-16:
  `contract:artifact-engagement-flow`,
  `contract:command-suggestion-flow`. Tracked separately under
  [`step-11` Phase 4 (ADR layout)](../../agents/roadmaps/step-11-ruflo-parity.md);
  smoke asserts the count is `≤ EXPECTED_MISSING_CONTRACTS=2`.

### § 3.3 — Schema (`scripts/smoke/schema.sh`)

```
438 lintable artefacts · 0 schema FAILs · ≤ 92 warns
```

- **0 FAILs** — hard assertion. `scripts/skill_linter.py --all` returns
  exit 0/1 (warns) but never 2 (fail).
- **≤ 92 warns** — measured 2026-05-16; locks regression. Warns
  trending down updates the constant.
- **v2 schema (step-5) deferred** — when
  [`step-5-schema-rigor.md`](../../agents/roadmaps/step-5-schema-rigor.md)
  Phase 1 closes, this smoke gains a `model_tier` presence assertion;
  Phase 3 adds `schema_version: "2"`. Until then, v1 schema in
  `scripts/schemas/skill.schema.json` is the contract.

### § 3.4 — Skills (`scripts/smoke/skills.sh`)

```
5/5 random skills resolve · frontmatter parses · name matches directory
```

- **5 random skills** picked deterministically (seed = epoch day) from
  `.agent-src.uncompressed/skills/*/SKILL.md` and re-validated via
  `scripts/validate_frontmatter.py`. `agent-config explain skill` is
  **not** invoked — `explain` only supports `{config,rule,route}` today
  ([`scripts/agent-config/cmd_explain.py`](../../scripts/agent-config/cmd_explain.py));
  filesystem-resolution is the contract.

## § 4 — Local invocation

```bash
task smoke            # all four
task smoke:kernel     # individual tiers
task smoke:router
task smoke:schema
task smoke:skills
```

Every script honours `SMOKE_QUIET=1` (suppresses table output, keeps
the final baseline line) for CI summary parsing.

## § 5 — Failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `kernel.sh` reports > 8 missing fences | Kernel rule lost its Iron Law block during edit | Restore the fence; update `EXEMPT_FROM_FENCE` only for new dispatch indexes |
| `router.sh` reports > 0 broken pointers | `router.json` references an id without a rule file | Add the rule or remove the route — never edit the smoke baseline up |
| `schema.sh` reports FAILs | A skill / rule lost a required field | Restore via [`scripts/schemas/skill.schema.json`](../../scripts/schemas/skill.schema.json) |
| `skills.sh` 5/5 random sample fails | Hand-edit broke frontmatter or renamed directory without updating `name:` | Restore filename ↔ slug coupling |

## § 6 — See also

- [`measurement-baseline.md`](measurement-baseline.md) — measurement substrate.
- [`cost-enforcement.md`](cost-enforcement.md) — cost ladder, sibling smoke surface.
- [`kernel-membership.md`](kernel-membership.md) — the 9-rule kernel set.
- [`rule-router.md`](rule-router.md) — router contract.
- [`road-to-kernel-and-router.md`](../../agents/roadmaps/road-to-kernel-and-router.md) — kernel budget reduction path.
