---
stability: stable
---

# Stability policy for `docs/contracts/`

This directory ships the **public contract surface** of `agent-config`.
Every file here declares a stability level in YAML frontmatter:

```yaml
---
stability: stable | beta | experimental
---
```

The level dictates how the contract may be linked from the public
surface (README, AGENTS.md, `docs/architecture.md`) and what kind of
change to it requires what kind of release.

## Levels

### `stable`

- **Breaking change** requires a **SemVer-major** bump (`X.0.0`).
- README, AGENTS.md, and `docs/architecture.md` MAY link to it
  without a marker.
- Typical content: settled ADRs (decisions don't reopen without a
  successor ADR); fully released contracts that have shipped through
  one major release without breaking.

### `beta`

- **Breaking change** is allowed in a **minor-version** release
  (`1.X.0`), provided the change appears in `CHANGELOG.md` under a
  `### Breaking` heading.
- README, AGENTS.md, and `docs/architecture.md` MAY link to it,
  **provided** the link text or the surrounding sentence carries a
  visible `(beta)` marker.
- Typical content: flow contracts and recipes that are shipped and
  load-bearing, but whose surface is expected to evolve before a
  SemVer-major lock.

### `experimental`

- **Breaking change** is allowed in **any release** (including
  patches), with a CHANGELOG note.
- README, AGENTS.md, and `docs/architecture.md` MUST NOT link to
  experimental contracts. Only the index inside `docs/contracts/`
  may reference them.
- Typical content: spike artefacts, runtime modules in pilot status,
  early API drafts not yet wired into a roadmap-locked phase.

## Frontmatter requirement

Every `*.md` under `docs/contracts/` (except this `STABILITY.md` file
itself) MUST start with a YAML frontmatter block declaring `stability:`.

The link checker (`scripts/check_public_links.py`, P0.1b) reads this
frontmatter and:

- **fails CI** when README / AGENTS.md / `docs/architecture.md` links to
  a contract marked `experimental`, to a missing target, or into
  `agents/settings/contexts/` (internal surface).
- **warns** (non-fatal in default mode; fatal under `--strict`) when a
  public-surface link to a `beta` contract has no `(beta)` marker in
  the surrounding text.
- ignores `stable` links.

Run `task check-public-links` locally; `task ci` invokes the same
checker in default mode.

## Promotion path

`experimental → beta → stable`. Demotion is allowed (e.g. `stable →
beta` to permit a refactor) but appears in `CHANGELOG.md` under
`### Breaking` and gets a SemVer-major bump.

Promotion criteria:

- `experimental → beta` — at least one shipped roadmap phase has
  consumed the contract end-to-end without a breaking change.
- `beta → stable` — at least one SemVer-minor release has shipped
  with the contract unchanged, or the contract has been explicitly
  frozen as part of a roadmap step.

## Beta-review markers

Every `stability: beta` contract MUST carry exactly one of the
following frontmatter markers (audit-acceptance for the periodic beta
review; see `road-to-productization.md` § P5.4):

| Marker | Shape | Meaning |
|---|---|---|
| `promote-to: stable` | literal | Contract has been ≥ 30 days in beta, zero breaking changes in the last 14 days, ≥ 1 consumer reference. Schedule promotion in the next release. |
| `keep-beta-until: YYYY-MM-DD` | ISO date | API still moving or consumer count = 0. Date is the next review deadline (max 90 days from the last review). |
| `superseded-by: <contract-id>` | string | Replaced by a stable contract. Slated for deprecation, not deletion. |

The audit is repeated whenever the `keep-beta-until` date passes for
≥ 25 % of beta contracts, or at the start of any roadmap phase that
touches the contract surface.

### 2026-08-25 — the 25 % trigger fired at 71.1 %, and what was decided

**Measured**, pinned at `AC_AS_OF=2026-08-25` and reproducible: **86 of the 121
`stability: beta` contracts had passed `keep-beta-until` — 71.1 %**, nearly three
times the trigger above. 35 carried a future date; **none lacked the marker**, so
the *presence* half of this convention was healthy and the *date* half was not.

**Why nobody noticed.** `check_beta_review_markers.ts` compared
`keep-beta-until` only against `today + 90 days` and errored when the date was
too far in the **future**. There was no floor, so a date arbitrarily far in the
**past** passed and the gate printed *"All beta contracts carry a valid review
marker"* over 86 lapsed ones. The trigger above had fired and the only mechanism
that could have observed it was measuring the opposite direction.

**The backlog is a cohort, not 86 lapses of discipline.** 44 of the 86 lapsed on
**one day** (2026-08-12), 64 within a four-day band, and the whole population
spanned 2–13 days of age. That is one past session's uniform window expiring at
once. It does **not** establish that the 90-day cadence is unsustainable — a
question this record deliberately leaves open.

**Decision — a frozen, no-growth baseline ratchet.** AI council 2/2 (2026-08-25,
`anthropic/claude-sonnet-4-5` + `openai/codex-default`, 3 rounds, blind chairman)
under the maintainer's standing delegation, choosing this over both a flat report
and a flat error:

- The **86 contracts inventoried on 2026-08-25** are frozen in
  `src/config/lapsed-beta-baseline.json`. A lapse among them **warns**.
- **Any lapsed beta contract not in that list is an ERROR**, immediately. Fresh
  work is enforced today; the cohort does not red an arbitrary future PR whose
  author caused none of it.
- **The list may not grow and an entry may not be re-added.** Both fall out of the
  rule above rather than needing a separate check: anything absent errors.
- **An entry leaves only because the contract's own state changed** — promoted,
  recorded unmaintained, superseded, or given a reviewed new deadline. Never by
  editing the file to make a red disappear. A seat asked for this qualification
  explicitly: an allowlist whose entries can simply be deleted is cosmetic.
- **Promotion condition:** when the list is empty and a pinned run reports zero
  lapsed contracts, the **same change** deletes the file and makes every lapse an
  error. The gate already treats an absent file as *no inherited debt*, so the
  deletion is the flip.
- **Clear by 2026-11-23.** Not a soft target: if the list is not empty by then,
  the 90-day cadence itself is reassessed on measured workload from the first
  complete post-migration cycle, rather than the migration being silently
  extended.
- **The cadence is unchanged at 90 days.** The cohort shows clustering, not a
  steady-state failure rate, so there is no evidence here that the window is too
  short.

**This decision closes the fired 25 % trigger.** The trigger's purpose was to
force a re-audit; the re-audit happened, produced the inventory at
`agents/evidence/analysis/lapsed-beta-inventory-2026-08-25.md` (49 extend / 36
promote / 1 unmaintained / 0 supersede), and produced the mechanism above. Once
enforcement is unconditional, a percentage-based lapse trigger is redundant —
every lapse already fails.

**Revisit-if:** the baseline is not cleared by 2026-11-23; or measured review
workload during the first complete post-migration cycle shows the 90-day window
cannot be sustained.

## Current contracts

See the file headers themselves for current levels. The frontmatter is
the authoritative source — this list is illustrative, not load-bearing,
and is generated by `scripts/check_public_links.py --list`.

## Budget contracts

Numeric caps on the always-active rule surface. These are **load-bearing
constants** — every reply the agent emits pays the always-rule cost, so
the budget is part of the public contract, not an implementation detail.

The accounting model since Phase 0.2 of `road-to-structural-optimization`
is **Model (b) literal** — a rule's effective size is its own char count
plus every context it loads (transitively, depth ≤ 2). See
[`load-context-budget-model.md`](load-context-budget-model.md) (beta)
for the contract and the transitional allowlist.

| Constant | Value | Stability | Owner |
|---|---|---|---|
| Total always-rule budget | **49,000 chars** (extended) | `stable` | `tests/test_always_budget.py::test_always_rules_total_extended_within_tolerance` |
| G3 tolerance band | **2 % overshoot** (≤ 49,980 chars) | `beta` | `scripts/check_always_budget.py` · `tests/test_always_budget.py` |
| Warn threshold (CI) | **80 % (39,200 chars)** | `beta` | `scripts/check_always_budget.py` |
| Fail threshold (CI) | **90 % (44,100 chars)** below 100 %; **> 102 %** above | `beta` | `scripts/check_always_budget.py` |
| Per-rule cap | **6,000 chars** (extended) with transitional allowlist | `beta` | `tests/test_always_budget.py::test_no_unallowlisted_per_rule_breach` · `scripts/check_always_budget.py` |
| Top-3 combined cap | **24,500 chars** (extended, 50 % of total) | `beta` | `tests/test_always_budget.py::test_top3_extended_under_cap` · `scripts/check_always_budget.py` |
| `load_context:` nesting cap | **depth ≤ 2** | `beta` | `tests/test_always_budget.py::test_load_context_depth_within_cap` · `scripts/check_always_budget.py` |

**Promises a consumer can rely on:**

- The total budget will not silently grow. A bump to `TOTAL_CAP`
  requires a `### Breaking` CHANGELOG entry and a SemVer bump per the
  `stable` policy above.
- The CI gate (`task check-always-budget`, run on every PR) prevents
  drift toward the cap without a maintainer noticing — the warn/fail
  thresholds give two PR-cycles of advance notice before the wall.
- Per-rule and top-3 caps prevent a single monster rule re-emerging
  under the global cap. The current per-rule cap is `beta` because the
  numbers are still being tuned against real-world rule churn; promotion
  to `stable` follows one SemVer-minor cycle without a tightening or
  loosening change.

**What's intentionally not promised:**

- The exact composition of the top-5 set. Rules may be split, merged,
  or relocated to `contexts/` between releases as long as the global
  and per-rule caps still hold.
- The condensed-vs-uncondensed delta. The CI gate runs against the
  shipped `dist/agent-src/` (condensed) directory; the uncondensed
  source size is informational only.

## Schema versioning and structural breaking changes

The breaking-change gate is **two-layered** so it does not depend on
author discipline alone:

1. **Commit-annotation layer (`release.py`).** `infer_bump` reads the
   Conventional-Commits annotation (`<type>!:` bang or a
   `BREAKING CHANGE` line) and returns a major bump when present.
2. **Structural layer (`check_structural_breaking.py`, run in
   `task ci-fast`).** Independently of the commit message, the detector
   inspects the diff against the trunk and FAILS when a structural break
   is present *without* an annotation — forcing the annotation to exist.

A change is **structurally breaking** when either:

- a tracked artifact *source* file is **deleted or renamed** — a skill
  `SKILL.md`, a rule, a command `command.md`, a pack manifest, or a
  contract schema; or
- a contract schema under `src/scripts/schemas/` is **modified without
  bumping its `x-schemaVersion`**. The four contract schemas (`pack`,
  `skill`, `rule`, `command`) carry an `x-schemaVersion`. Bump it when an
  enum value is added or removed, a field type changes, or a validation
  rule tightens — these are breaking-for-consumers yet invisible to a
  name-status diff. Purely *additive* schema changes (a new optional
  field) do not require a bump.

Escape for an intentional break (e.g. a deprecation cycle completing):
add `ci-override: structural-breaking-ok` to a commit body. The detector
accepts ~20% false-negatives on purely *semantic* breaks (behaviour
change with no artifact/schema delta); the structural + schema + commit
cross-check reaches ~95% coverage (2026-06-16 council).

## See also

- [`docs/architecture.md`](../architecture.md) — package architecture overview
- [`rule-priority-hierarchy.md`](rule-priority-hierarchy.md) — which always-rule wins on conflict
