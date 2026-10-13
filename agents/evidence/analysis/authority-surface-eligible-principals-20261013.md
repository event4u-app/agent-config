<!-- evidence-type: analysis -->

# Who could approve an authority-surface merge — the eligible-principal set, measured

Measured 2026-10-13 against the live forge from `origin/main` @ `8cd4c1e4d`,
for the `external-bootstrap-boundary-for-phases-2-3` blocker of
`road-to-authority-routing-mechanism`.

## Why this was measured again

The blocker already carries a measurement, taken 2026-10-12, and it ends in a
flat claim:

> the separately authorised principal D11 requires does not exist on this
> repository today.

The three readings behind that sentence were the active ruleset, the
`.github/CODEOWNERS` map, and the membership of the one reachable organisation
team. Each is sound. None of the three reads the set the sentence is about.
`CODEOWNERS` names who is *required* to review, not who is *able* to; a team is
one container of principals, not the population. The repository's collaborator
list was never queried, so the claim generalised from a strict subset to the
whole and came out stronger than its evidence.

A drain re-screen is supposed to execute a blocker's condition rather than trust
its marker. Executing it here meant asking the question the earlier reading did
not: **who, on this repository today, could supply an approving review at all?**

## What the forge says

`GET /repos/event4u-app/agent-config/collaborators`, 2026-10-13:

| Login | Affiliation | Role | Commits on `main` | PRs authored |
|---|---|---|---|---|
| `matze4u` | direct | admin | 11 492 | 98 |
| `h3xa2` | outside | maintain | 4 | 0 |
| `php-jesus` | outside | write | 1 | 1 |
| `phpjob` | outside | write | 0 | 0 |
| `0sama` | outside | write | 0 | 0 |

Four accounts distinct from the proposing and merging principal hold `write` or
better. On GitHub, `write` is the threshold at which a review counts toward
`required_approving_review_count`, and an author cannot approve their own pull
request. So the eligible-reviewer set on this repository is **four, not zero**.

The ruleset reading is unchanged from 2026-10-12 and was re-run, not recalled —
ruleset `17749383`, `pull_request` rule: `required_approving_review_count: 0`,
`required_reviewers: []`, `require_code_owner_review: false`,
`dismiss_stale_reviews_on_push: true`, `bypass_actors: []`.

## What the forge also says, and it cuts the other way

Reviews on the 36 most recent merged pull requests (`#2284` … `#2326`), queried
one by one:

```
0 of 36 carry a review from any account — human or bot.
```

Not four reviews from the wrong people, and not a thin trickle. Zero. The same
shape appears in authorship: 11 492 commits against 4, 1, 0 and 0.

## What this changes, and what it does not

**It does not resolve the blocker, and it does not reopen D16.** D16's rejected
option (d) states the qualification test in the council's own words — a second
human is not executable today "for want of acceptance, availability, independent
administration and a tested enforcement path". Holding an account satisfies none
of those four. D17 went further and rejected an activity proxy explicitly, so
the review figures above are corroboration for the availability leg, never a
refutation of anything. The mechanism the lock rests on is qualification; this
measurement is about eligibility; they are different predicates, so
`decision-revisit-gate`'s mechanism-match test does not fire and no round is
owed.

**What it changes is the shape of the owner's remaining act.** Two sentences
that sound alike are not:

- *No principal exists.* Nothing to decide. The owner must first recruit a
  person, and only then configure a forge.
- *Four eligible principals exist and none has ever reviewed.* The owner's act
  is to ask one of four people who already hold access whether they accept the
  duty, and then to raise `required_approving_review_count` and name them.

The second is a smaller and more concrete ask than the first, and the blocker
was stating the first. That difference is the whole value of this file.

**It also prices the risk the record already named.** Break-glass stop
condition 6 — false rejections blocking all constitutional maintenance — reads
as hypothetical while the reviewer population is unmeasured. Against a 0-of-36
participation record it is the expected case: requiring an approval from an
account that has never reviewed converts every authority-surface merge into a
wait on a dormant third party. That is an argument for naming a liveness escape
*before* the rule is turned on, not an argument against turning it on.

## The honest limits of this reading

- **Acceptance is unmeasured and unmeasurable from here.** No API answers
  whether a person agreed to serve. Four accounts can approve; whether any
  would is not a forge fact.
- **Independent administration is unmeasured.** Whether these accounts are
  controlled separately from the owner is an organisational fact, and D17
  already recorded that no API response derives it.
- **Outside-collaborator status cuts both ways.** It argues for independence —
  these are not org members under the same administration — and against
  reachability, since an outside collaborator has no org-level obligation.
- **`CODEOWNERS` still maps every path to `@matze4u`.** Satisfying a code-owner
  requirement with any of the four would need a `CODEOWNERS` edit as well, and
  D17 put `.github/CODEOWNERS` inside the authority surface, so that edit is
  itself in scope. A plain `required_approving_review_count: 1` avoids this; a
  code-owner route does not.
