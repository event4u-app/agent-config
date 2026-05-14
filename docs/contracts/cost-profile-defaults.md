---
stability: beta
keep-beta-until: 2026-08-13
---

# Cost-Profile Defaults — Contract

> **Status:** beta · **Owner:** package maintainer · **Last reviewed:** 2026-05-14
>
> Normative contract for the **default `cost_profile`** new installs receive.
> Profile semantics themselves are documented in
> [`docs/customization.md` § cost_profile](../customization.md) and
> [`docs/contracts/rule-router.md`](rule-router.md); this file owns only the
> **default-selection decision** and the rationale behind it.

## Decision

```
DEFAULT_PROFILE = "balanced"
```

`scripts/install.py` and `npx @event4u/agent-config init` write
`cost_profile: balanced` into `.agent-settings.yml` for fresh installs
unless the user passes `--profile=minimal` or `--profile=full`.

## Profile table

| Profile | Contents | Token footprint | Use when |
|---|---|---|---|
| `minimal` | Kernel only (9 always-loaded Iron-Law rules, ≤ 26 k chars) | Lowest | Token-constrained agents (small context windows, free-tier models) or projects that opt out of routing |
| **`balanced`** *(default)* | Kernel + tier-1 auto-rules (workflow + safety floor) | Medium | Every productized install — the documented "current behaviour superset" |
| `full` | Kernel + tier-1 + tier-2 (every rule, every guideline-cited skill) | Highest | Teams running large-context models (Opus 4, GPT-5) that want maximum guardrail coverage |
| `custom` | Ignore profile; every matrix value set explicitly | Variable | Power users tuning per-rule load decisions |

## Why `balanced`, not `minimal`

The kernel-only `minimal` profile predates the tier-1 router. It was the
correct default while tier-1 was experimental, but four signals now point
at `balanced`:

1. **Documented intent already says so.** Both
   `config/agent-settings.template.yml` (the source the installer projects
   from) and `docs/customization.md` describe `balanced` as
   "default — current behaviour superset". The code default of `minimal`
   was a drift artifact, not a deliberate stance.
2. **Productization (Level-6) demands sensible-default-out-of-the-box.**
   A fresh `npx init` followed immediately by `/work` should engage the
   full workflow guardrail set — `developer-like-execution`,
   `verify-before-complete`, `minimal-safe-diff`, `scope-control`.
   These live in tier-1, not the kernel. With `minimal`, the
   work-engine runs unanchored against most quality guardrails.
3. **Decision-engine gates assume tier-1 is present.** The P2.x gates
   (`min_confidence`, `block_on_risk`, `require_memory_hits`) are
   harmless under `minimal` but only reach their documented behaviour
   under `balanced` and above — because the confidence model and
   risk-classification rules they read live in tier-1.
4. **Opt-out is cheap, opt-in is invisible.** A team that wants the
   `minimal` floor flips one YAML value. A team that doesn't know
   tier-1 exists never finds it. The default should err toward
   guardrail coverage.

## Opt-out path

Token-budget pressure → flip in `.agent-settings.yml`:

```yaml
cost_profile: minimal
```

…or pass `--profile=minimal` to `npx @event4u/agent-config init`.
No migration is required: removing tier-1 rules from a session has no
state-machine impact because the kernel carries the Iron-Law floor.

## Drift detection

CI must keep three surfaces in sync:

- `scripts/install.py` — `DEFAULT_PROFILE` constant.
- `config/agent-settings.template.yml` — comment block on the
  `cost_profile:` key.
- `docs/customization.md` — cost-profile table default column.

Reviewer guidance: a PR that changes any one of these must touch the
other two **plus** this file's `Last reviewed:` field. The
`docs-sync` rule enforces the cross-reference check; a missing update
trips it.

## Re-review schedule

`re-review: 2026-11-14` (six months out). Triggers for earlier
re-review:

- Tier-1 rule count drops below 5 (the router would carry too little
  to justify the load cost).
- Median `npx init` token cost grows past 40 k for a fresh agent
  session (then re-evaluate `minimal` as the default).
- A consumer-project tally shows ≥ 80 % of installs override the
  default within seven days (the default is wrong for the population).

## Non-goals

- This contract does **not** dictate what tier-1 contains. That belongs
  to [`rule-router.md`](rule-router.md) and the `kernel-membership.md`
  contract.
- It does **not** add a fourth profile. `custom` covers the
  per-tenant-tuning case; no new tier needed.
- It does **not** auto-migrate existing installs. Projects already
  pinned to `minimal` keep `minimal` until a developer edits the file
  or runs `npx @event4u/agent-config migrate` (which preserves
  user-set values per [`migration/v1-to-v2.md`](../migration/v1-to-v2.md)).
