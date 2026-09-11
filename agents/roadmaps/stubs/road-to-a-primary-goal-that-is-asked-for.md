---
complexity: lightweight
review_by: 2026-11-11
---

# Stub: road to a primary goal that is asked for

> **Stub — not active work.** Created 2026-09-11 by the drain run holding
> `road-to-delivery-on-hook-hosts`, which was blocked by
> `docs/contracts/release-sizing.md` lapsing its `keep-beta-until` date.
>
> **The disposition it fed has since been taken, and the sequence matters.**
> This file first recorded evidence only, because per
> [`road-to-fresh-beta-lapses-2026-09.md`](road-to-fresh-beta-lapses-2026-09.md)
> all four legal actions on a beta marker are public statements about what
> consumers may rely on, which `decision-revisit-gate` reserves to the owner —
> a class on which a council had already declined twice on 2026-09-06. An AI
> council converged on a split (2/2, 2026-09-11) and that verdict was recorded
> as advice and **not** executed. The owner then instructed execution in the
> same session, and the split landed: `release-sizing.md` promoted to
> `stability: stable` for its enforced half,
> [`release-primary-goal.md`](../../../docs/contracts/release-primary-goal.md)
> created in beta for the declaration half. Council agreement did not convert
> the reserved transition; the owner's instruction did.
>
> **What stays open is this stub's own subject:** the mechanism that would make
> the new window measure anything.

## What was measured, and it is new

`release-sizing.md` asks every minor release PR body to carry one literal line:

```
Primary-Goal: <one sentence>
```

Compliance across the whole 2026-07-10 → 2026-09-10 beta window, read from the
release PR bodies on 2026-09-11:

| PR | Release | `Primary-Goal:` line |
|---|---|---|
| 2002 | 15.0.0 | none |
| 1967 | 14.23.0 | none |
| 1943 | 14.22.0 | none |
| 1913 | 14.21.0 | none |
| 1900 | 14.20.0 | none |
| 1886 | 14.19.0 | none |

**Zero of six.** Five are minor releases and squarely in scope; 15.0.0 is a
major, listed for completeness rather than counted against the literal wording.
Not partial and not in spirit — the line appears in none of them.

Reproduce it:

```bash
gh pr list --state merged --limit 6 --search 'release' --json number,title,body \
  | python3 -c "import json,sys,re; [print(p['number'], p['title'][:40], '->', (re.search(r'^Primary-Goal:.*$', p.get('body') or '', re.M) or ['NO LINE'])[0]) for p in json.load(sys.stdin)]"
```

The same contract's **other** obligation is enforced and green:
`lint_changelog_rollback.ts` cites it as its normative source and exits 0. So
one document carries two obligations whose records point in opposite
directions — that asymmetry is the finding, and it was not available to the
2026-09-06 rounds.

## Why the zero does not interpret itself

Two readings fit it, and the window that produced it cannot separate them:

- **Value** — naming one primary goal is not worth doing, so nobody does it.
- **Mechanism** — nothing in the repository ever *asks*. No release PR template
  carries the line and no check reads it, so a maintainer cutting a release
  never meets the obligation at the moment it applies.

An AI council was asked on 2026-09-11 (2 seats, blind peer review,
subscription transport, $0.0000 billed) and both seats converged on **splitting
the contract** — promote the enforced rollback half, keep the declaration half
in beta — while splitting on the declaration's fate: anthropic read the zero as
the value answer and would retire the obligation; openai read it as an invalid
test, *"because nothing surfaced or enforced the required declaration"*, and
would run one instrumented window.

**That was advice when it was given, and the owner turned it into the
disposition.** The council could not take it: the same reserved class had
already seen a council decline twice on 2026-09-06
(`agents/evidence/analysis/rdp-beta-window-lapse-accepted-2026-09-06.md`), and
agreement between seats does not convert an owner-reserved transition into a
council-decidable one. The owner instructed execution, so the split is in the
tree and the window it opened runs to 2026-11-11.

## What closes the mechanism question — the open part

The new window measures nothing until the mechanism exists, and its contract
says so: **if this stub has not landed by 2026-11-11, the disposition is
`supersede`, not another extension.** Two pieces close it:

1. **A release PR template field** carrying the `Primary-Goal:` line, so the
   obligation is visible while cutting rather than only in a contract.
2. **A check that reads it on a release-shaped PR** — release-shape detection
   already exists in `docs/contracts/release-pr-gating.md`, so this binds there
   rather than inventing a second notion of "is this a release".

Scope note, because it is the obvious objection: the 2026-07-10 council
REJECTED a mechanical **subsystem-count** lint on the release PR, and that
rejection stands. This is not that. Checking that one declared line is present
carries no file→subsystem map and is no proxy for scope; it asserts only that
the judgment the contract already asks for was written down.

## Current state — cleared, and the next four are four days out

The lapse was **FRESH**, so the frozen 2026-08-25 baseline could not absorb it,
and the check is required — it reds every PR in the repository, not only the one
that found it. `check_beta_review_markers` now exits **0** on the split.

That clears today and not the week. Four more contracts go fresh on **2026-09-15**
— `harness-expectations`, `install-layout`, `install-scopes`, `surface-tiers` —
and each will red the same required check on its date, under the same
owner-reserved rule. They are named here rather than acted on, because naming a
dated blocker four days ahead is the whole point of the horizon report:

```bash
./scripts-run src/scripts/check_beta_review_markers --horizon 21 | tail -14
./scripts-run src/scripts/check_beta_review_markers > /dev/null; echo "exit=$?"
```
