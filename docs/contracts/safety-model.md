---
stability: beta
keep-beta-until: 2026-08-12
---

# Universal safety model

> **Status:** beta — first draft 2026-05-16 (Phase 2 Item 9 of
> `agents/roadmaps/step-15-product-refinement.md`).
>
> **Baseline:** [`docs/architecture/current-safety-behavior.md`](../architecture/current-safety-behavior.md)
> documents the pre-step-15 surface this contract replaces.

A **per-profile, per-domain safety policy** declared as a single
machine-readable table. Replaces the legacy "one autonomy switch for
everything" model documented in the baseline. Does **not** weaken the
four non-overridable floors — those keep their universal scope and
are referenced by id, not redeclared here.

## The Iron Floor

```
NO POLICY ENTRY MAY WIDEN AN EXISTING FLOOR.
ANY ENTRY THAT WOULD ALLOW A FLOOR-BLOCKED ACTION IS REJECTED AT LINT.
```

The four floors are listed in
[`current-safety-behavior § The four non-overridable floors`](../architecture/current-safety-behavior.md#the-four-non-overridable-floors):
`non-destructive-by-default`, `scope-control § git-ops`,
`commit-policy`, `security-sensitive-stop`. Floor membership is
maintained in [`kernel-membership`](kernel-membership.md); a domain
listed there cannot be set to `allow` here.

## Schema

```yaml
# .agent-src.uncompressed/profiles/<id>.yml — new top-level key
profile:
  id: <profile.id>
  # ... existing fields ...
  safety:
    domains:
      <domain-id>:
        policy: <deny | ask | allow>
        rationale: "<= 280 chars — why this policy for this profile>"
```

### Domain registry

Domains are declared in this contract, **not** invented per profile.
A profile may only reference an id from the table below.

| Domain id | What it gates | Floor reference |
|---|---|---|
| `prod_data` | Reads / writes against production data stores. | `non-destructive-by-default` |
| `prod_infra` | Terraform / k8s / cloud config touching prod. | `non-destructive-by-default` |
| `secrets` | Secret values in env, config, or output. | `security-sensitive-stop` |
| `auth_changes` | Auth, session, tenant-boundary, IAM edits. | `security-sensitive-stop` |
| `billing` | Pricing, invoicing, refund, payout logic. | `security-sensitive-stop` |
| `bulk_delete` | `rm -rf`, `DROP`, `TRUNCATE`, ≥ 5-file deletion. | `non-destructive-by-default` |
| `git_push` | `git push` to any remote. | `scope-control § git-ops` |
| `git_branch` | branch create / switch / delete. | `scope-control § git-ops` |
| `commit` | Any git commit. | `commit-policy` |
| `mcp_call_costly` | MCP / web / model call ≥ preset's `per_call_max_usd`. | — (advisory) |
| `pii_redact` | PII redaction in support / finance / recruiting / marketing outputs. | `domain-safety-pii-*` |
| `pii_log` | Logging of raw PII. | `domain-safety-logging-pii-floor` |
| `legal_advice` | Output shaped as legal advice. | `domain-safety-disclaimer-legal` |
| `medical_advice` | Output shaped as medical advice. | `domain-safety-disclaimer-medical` |
| `financial_advice` | Investment / tax / valuation positions. | `domain-safety-disclaimer-financial` |
| `pr_create` | Pull-request open / close / retarget. | `scope-control § git-ops` |
| `deploy` | Deploy / release / tag / pipeline trigger. | `non-destructive-by-default` |

### Policy semantics

| Policy | Behaviour | Floor interaction |
|---|---|---|
| `deny` | The agent refuses. Numbered-option block surfaces the refusal and the rationale field; no override path. | `deny` is the default for every floor domain — it cannot be relaxed. |
| `ask` | The agent stops and asks a single numbered question per [`user-interaction`](../../.agent-src/rules/user-interaction.md). One question per turn. | `ask` is the default for every floor domain in a profile that has not opted out — the floor remains operative even when `policy=allow` is set elsewhere. |
| `allow` | The agent proceeds without asking. Trivial-question suppression applies. | `allow` is **forbidden** on any domain whose `Floor reference` column is non-empty. Linter rejects it. |

The legacy single switch (`personal.autonomy`) is preserved as a
**fallback** for any domain a profile does not declare — keeping
existing installs functional while profiles migrate.

## Resolution

Order (last writer wins, subject to the Iron Floor):

1. Domain default = `ask` for floor domains, `allow` otherwise.
2. Profile `safety.domains.<id>.policy`.
3. Active pack's profile (if `--pack <id>` is active).
4. `.agent-settings.yml` user override under `profile.safety.domains`.

The explain command at [`explain config`](../../.agent-src/scripts/agent-config)
(Phase 1 Item 3 deliverable) surfaces the resolved policy per domain,
with the writer source per row.

## Validation

`scripts/lint_safety_model.py` (Phase 2 deliverable — not yet
shipped) fails CI on:

- Unknown domain id.
- `allow` on a floor-referenced domain.
- Missing `rationale` (≤ 280 chars, plain prose).
- Profile declaring `safety` without at least one entry.

Until the linter lands, profiles are reviewed by hand at PR time.

## What this contract does **not** do

- **Does not** introduce new safety rules. Every domain row maps to
  an existing rule or to advisory cost guidance.
- **Does not** ship the loader. `scripts/config/safety.py` is a
  Phase 2 deliverable deferred to its own step.
- **Does not** override domain-safety output floors. PII redaction
  and disclaimer rules apply regardless of `safety.domains.*` —
  `policy=allow` on `pii_redact` means "do not ask before redacting",
  not "skip redaction".
- **Does not** authorize per-tool MCP overrides. Cost caps live in
  [`config-presets`](config-presets.md).

## See also

- [`current-safety-behavior`](../architecture/current-safety-behavior.md) — pre-step-15 baseline (what this replaces)
- [`config-presets`](config-presets.md) — cost caps and enforcement
- [`profile-system`](profile-system.md) — profile axis
- [`workflow-packs`](workflow-packs.md) — pack-level overrides
- `agents/roadmaps/step-15-product-refinement.md` § Phase 2 Item 9
