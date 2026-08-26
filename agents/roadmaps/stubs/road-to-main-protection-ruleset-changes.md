---
complexity: lightweight
review_by: 2026-09-25
---

# Stub: road to the `main` protection-ruleset changes (required checks + merge queue)

> **Stub — not active work.** Holds the two repo-admin transfers made out of
> [`road-to-inbox-harvest-2026-08-b-ci-economy.md`](../road-to-inbox-harvest-2026-08-b-ci-economy.md)
> Phase 4 by the autonomous drain run of 2026-08-20. Both were decided
> **B — transferred** by the AI council (2/2, anthropic + openai) under its
> categorical Rule 3: a repository-administration setting is externally
> visible and irreversible, so such work may only be transferred, never
> recorded as decided-and-done. Record:
> [`agents/evidence/council/drain-blocker-dispositions-b.md`](../../evidence/council/drain-blocker-dispositions-b.md).
> Cited as a resolved link, not a forward reference: PR #1463 merged while this
> transfer was being written, so the record is on `main` and the `ref-ignore`
> marker this line briefly carried would now suppress a check that passes.

## Why one stub and not two

Both transfers are writes to the **same object** — branch ruleset `17749383`
on `event4u-app/agent-config` — by the **same producer**, gated on the **same
single gap**: repo-admin authority held by a human, which no category-level
grant lifts (`non-destructive-by-default` Hard Floor). That is one evidence
gap wearing two names, which is the council's own merge criterion.

The decisive argument is the **ordering hazard between them**, which is
itself the shared content. A merge queue must not be enabled until every
required check declares a `merge_group` trigger, because the queue treats
never-reported as never-satisfied and `main` blocks permanently with no red X
to explain it. Which checks are required is decided by the *other* transfer.
Two stubs would put that hard constraint across a document boundary with
nothing to enforce it — exactly the failure the source roadmap records.

What one stub does **not** mean: the two are still **independent decisions**.
Either may be taken alone and neither implies the other. Only the *order* is
fixed, and only if both are taken. The two transfer records below therefore
keep their own criteria, their own moved-step lists and their own probes.

## Promotion gates

The shared promotion criteria in [`README.md`](README.md) § Promotion criteria
— a recruited first customer and a funded security audit — **do not govern a
drain-run transfer** and are not gates here. They exist for the org-mode
surface stubs (SSO, central policy, connectors), which introduce new product
capability for an external tenant. These two transfers introduce no capability;
they are settings writes on this repository, already decided, waiting only on
the one thing the tree cannot supply.

The single gate for both is: **the named producer below exercises repo-admin
authority, with a this-turn approval naming the exact object.**

## Live state, measured 2026-08-20

Read, not described — `gh api repos/event4u-app/agent-config/rulesets/17749383`:

| Reading | Value today |
|---|---|
| Rulesets on the repo | exactly **1** — id `17749383`, name `main protection`, target `branch`, enforcement `active` |
| Rule types present | `deletion` · `non_fast_forward` · `pull_request` · `required_status_checks` |
| `required_status_checks` entries | **1** — `Sync + Generate Tools Consistency` |
| `strict_required_status_checks_policy` | `true` |
| Ruleset entries of type `merge_queue` | **0** |
| Files under `.github/` declaring `merge_group` | **0** |

These are the before-values a future reader diffs against, so movement is
distinguishable from noise.

## Transfer 1 — `required-check-set-change`

**Disposition:** B — transferred. **Outcome state:** transferred.

**Original `Resolved when` criterion, verbatim from the source roadmap:**

> ADR-223 is accepted and the ruleset's `required_status_checks` list matches
> the matrix in `branch-protection-policy.md`, with `ci-green-floor.md` and
> `release-pr-gating.md` updated in the same change.

Its first leg is already **discharged in the tree**:
`docs/decisions/ADR-223-no-required-check-demotion-on-cost-grounds.md:3` reads
`status: accepted`. What remains of the criterion is the ruleset write and the
policy-document synchronisation, and those are what move here.

**Dependent steps moved — the complete list:**

1. Source-roadmap step **4.2** ("Demote the macOS leg and/or the `npm audit` PR
   gate"). ADR-223's own decision is *not to demote*, and neither the macOS
   legs nor the `npm audit` gate is in the required set today (the set has one
   member), so the executable content of 4.2 is the *arming* write below.
2. The `required_status_checks` write on ruleset `17749383` — the seven
   additions recommended at `docs/contracts/branch-protection-policy.md:163`
   (`Smoke — kernel` · `Smoke — router` · `Smoke — schema` · `Smoke — skills` ·
   `Static Checks (ESLint · typecheck · prepack)` · `skill-lint` ·
   `Rule backstops`), keeping the existing `Sync + Generate Tools Consistency`.
3. Synchronising `docs/contracts/branch-protection-policy.md` — its
   "**(the only required one)**" annotation at `:59` becomes false the moment
   the set is enlarged.
4. Synchronising `docs/contracts/ci-green-floor.md` — the Blocking/Advisory
   table (`:31-32`) and the "summary for `main`" (`:44`) both describe the
   required set.
5. Synchronising `docs/contracts/release-pr-gating.md` — the release-PR
   required-check floor (`:103`) claims equivalence to the PR floor, which the
   enlargement changes.

Items 3-5 are tree edits an agent *could* make, and are moved deliberately
rather than done early: a document describing an armed set that is not armed
is a false claim, and the criterion says "in the same change" for that reason.

**Named re-entry producer:** the repository owner **`matze4u`
(m.berg@galawork.de)**, the account this run authenticated as, verified to hold
admin on the repository today — `gh api repos/event4u-app/agent-config --jq
.permissions.admin` returns `true`. Not "a maintainer": that account is the one
principal in this repository that can perform the write.

**Detection probe** (re-entry has happened when the count moves off 1):

~~~bash
gh api repos/event4u-app/agent-config/rulesets/17749383 \
  --jq '[.rules[] | select(.type=="required_status_checks")
         | .parameters.required_status_checks[].context]'
# 2026-08-20: ["Sync + Generate Tools Consistency"]  → length 1
# re-entry:   length 8, equal to the :163 set plus the existing entry
~~~

**Procedure, rollback and the two silent-failure traps** are already written
out step by step in the source roadmap's own blocker entry, and are not copied
here — a second copy is a second thing to drift.

## Transfer 2 — `merge-queue-enablement`

**Disposition:** B — transferred. **Outcome state:** transferred.

**Original `Resolved when` criterion, verbatim from the source roadmap:**

> the merge queue is enabled on `main` and at least one workflow declares a
> `merge_group` trigger (currently zero across `.github/`).

**Dependent steps moved — the complete list:**

1. Source-roadmap step **4.3** ("Enable a GitHub merge queue").
2. Adding `merge_group:` to the trigger block of every workflow that is, or is
   about to become, a required check. This is agent-executable in isolation and
   is still moved: the council's disposition names "workflow trigger addition"
   explicitly, and the source roadmap records why — the trigger is inert until
   the queue exists, and it must land in the same small PR as the enablement so
   the ordering above is verifiable in one diff.
3. Enabling "Require merge queue" on ruleset `17749383` — **strictly after**
   step 2 lands.
4. Live validation inside the queue: one test merge-group run in which every
   required check reports. Nothing outside the queue can prove this, which is
   why it cannot be pre-verified here.

**Named re-entry producer:** the same account as Transfer 1 — **`matze4u`
(m.berg@galawork.de)**, verified `admin: true` today.

**Detection probe** (two readings; re-entry is both moving, in this order):

~~~bash
grep -rl 'merge_group' .github/workflows/ | wc -l
# 2026-08-20: 0 files   → re-entry: >= 1, covering every required check

gh api repos/event4u-app/agent-config/rulesets/17749383 \
  --jq '[.rules[] | select(.type=="merge_queue")] | length'
# 2026-08-20: 0         → re-entry: 1
~~~

Reading the second as `1` while the first is still `0` is not re-entry — it is
the permanent-block failure mode in progress, and the correct response is to
disable the queue rather than to promote this stub.

## What promotion looks like

Promotion is **not** moving this file up a directory. Neither transfer needs an
active roadmap: each is one settings write plus, for Transfer 1, three
document edits. When a producer performs either, close it by recording the
before/after ruleset artefacts against the probe above and striking that
transfer from this file. The stub is deleted when both are struck.
