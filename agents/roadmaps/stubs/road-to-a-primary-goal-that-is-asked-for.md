---
complexity: lightweight
review_by: 2026-11-11
---

# Stub: road to a primary goal that is asked for

> **Stub — not active work, and the decision it feeds is not the agent's.**
> Created 2026-09-11 by the drain run holding
> `road-to-delivery-on-hook-hosts`, which was blocked by
> `docs/contracts/release-sizing.md` lapsing its `keep-beta-until` date. It
> records **evidence for the owner**, not a disposition: per
> [`road-to-fresh-beta-lapses-2026-09.md`](road-to-fresh-beta-lapses-2026-09.md),
> all four legal actions on a beta marker — promote, extend, supersede, accept
> the lapse — are public statements about what consumers may rely on, and
> `decision-revisit-gate`'s reserved set puts those out of agent reach in either
> direction.

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

**That is advice, and it is recorded as advice.** The council cannot take the
decision: this is the same reserved class on which a council already declined
twice on 2026-09-06
(`agents/evidence/analysis/rdp-beta-window-lapse-accepted-2026-09-06.md`), and
agreement between seats does not convert an owner-reserved transition into a
council-decidable one.

## What would close the mechanism question

If the owner chooses the instrumented window, two pieces close it:

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

## Current state — the lapse is live and blocks every PR

`check_beta_review_markers` reports the lapse as **FRESH**, so it is not in the
frozen baseline and the baseline may not grow to absorb it. The check is
required, which means it blocks unrelated PRs across the repository until the
owner acts. That cost is stated here because it is the part that does not wait:

```bash
./scripts-run src/scripts/check_beta_review_markers --horizon 14 | tail -8
./scripts-run src/scripts/check_beta_review_markers > /dev/null; echo "exit=$?"
```
