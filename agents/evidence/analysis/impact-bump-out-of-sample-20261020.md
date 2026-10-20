<!-- evidence-type: analysis -->

# The impact bump rule, scored on the window it was not written on

**Date:** 2026-10-20 · **Tree:** `fba00aabf` · **Subject:** `impact_bump`
(`src/scripts/_lib/impact_bump.ts`), frozen as it stands on `main`.

This discharges the precondition the AI council attached to the
`impact-numbering-model` blocker on 2026-10-19: *"(a) returns to the owner only
after the frozen classifier is scored on a pre-registered window it was not
written on, on both axes, with zero false negatives on BREAKING. No owner
question is put until that measurement exists."* Record of that verdict:
`agents/evidence/council/resolve-blockers-batch-20261019.md`.

It decides nothing. The numbering model stays the owner's.

## Part 1 — Pre-registration

Written and committed before any span was diffed. The surface-axis result did
not exist when this half was fixed; the git history of this file is the check.

### The window is forced, not chosen

Step 2.2 scored the seven majors 10.0.0 → 16.0.0. Everything else in
`BREAKING_CHANGES.md`'s by-major table is therefore out-of-sample, and that is
the whole of it: **2.0.0 → 9.0.0**, eight majors. 1.0.0 is excluded as
degenerate — it is the initial public release and its own row reads "no prior
consumer-facing break". There is no second candidate window, so there is no
window-shopping to disclose.

**4.0.0 is excluded in advance, for a reason that has nothing to do with its
result.** `git ls-remote --tags origin` carries no `4.0.0`; the span has no
lower bound and cannot be read. Seven majors remain scoreable: 2.0.0, 3.0.0,
5.0.0, 6.0.0, 7.0.0, 8.0.0, 9.0.0.

### The span of a major

The greatest tag strictly below it in version order, to the major's own tag —
the same rule `release.ts`'s `latest_tag()` applies at cut time. Resolved:

| Major | Span |
|---|---|
| 2.0.0 | `1.41.2..2.0.0` |
| 3.0.0 | `2.26.0..3.0.0` |
| 5.0.0 | `4.9.0..5.0.0` |
| 6.0.0 | `5.10.1..6.0.0` |
| 7.0.0 | `6.1.0..7.0.0` |
| 8.0.0 | `7.5.0..8.0.0` |
| 9.0.0 | `8.13.0..9.0.0` |

### Axis 1 — impact

The row's `Consumer impact` cell, read by `parse_impact_rows`. Where a version
carries two rows, the strongest by `IMPACT_RANK`, which is what `replay_majors`
already does.

### Axis 2 — surface

`classify_surfaces(parse_name_status(git diff --name-status <span>), removed_keys)`
from `src/scripts/_lib/major_surface.ts`, added in the same commit as this
pre-registration. Three of `CONTRIBUTING.md:331`'s four triggers are decided:
`installer-layout` (an `A` or `D` under the installer tree, its templates, or
its entry points), `rule-or-skill-removal` (a `D` under `src/rules/`,
`src/skills/` or either projection), `settings-keys` (a removed `key:` line in
the settings template or its schema, within the span).

The fourth, "breaking changes to the condensed content format", is declared
**underivable** and is reported as a gap. It is a property of the emitted
content; the only mechanical proxy available is the condenser's filename, which
fires on every wording fix to that script. A surface that cannot be decided is
not a surface that did not fire, and scoring it as the latter would overstate
what the rule covers.

A rename counts as neither a creation nor a removal. That under-reports, and
under-reporting this axis cannot hide a consumer-visible break: the surface
clause only ever **adds** a major, so a false negative on BREAKING can only come
from the impact axis.

### What is measured, and the one threshold that was ever stated

Per major: the recorded impact, the surfaces fired, the bump `impact_bump`
returns, and whether that bump is a **false negative on BREAKING** — a row whose
recorded impact is `action` scored as anything but major.

- **Hard requirement, registered:** zero false negatives on `action`. This is
  the blocker's own bar, in its own words: *"a missed breaking change is the one
  error consumers cannot recover trust from."*
- **No threshold is registered for the surface axis.** None was ever stated.
  Its fire rate is reported as a number and read, not graded against a bar
  invented after the fact.

### Two disclosures, made before the result

1. **The impact axis is a consistency check in this window exactly as it was in
   the last one.** Its input (the backfilled column) and its ground truth (each
   row's Migration prose) are the same text, because step 2.3 derived the column
   from that prose. A different window does not make that circle wider. What the
   new window adds is a different **base rate**, which is the only thing
   10.0.0 → 16.0.0 could not supply.
2. **The column was read before the window was fixed**, so the impact half is
   not blind. It could not have been: the window is forced by what 2.2 already
   scored, and nothing about it was selected. The surface half is genuinely
   unseen at the time of writing, and that is the half that carries new
   information.

### Reproduction

For each span above, with tags fetched (`git fetch origin --tags`):

```
git diff --name-status <prev>..<tag>
git diff -U0 <prev>..<tag> -- <SETTINGS_KEY_FILES> | grep -E '^-[[:space:]]*[A-Za-z_][A-Za-z0-9_]*:'
```

fed to `parse_name_status` and `classify_surfaces`, with the impact cell from
`parse_impact_rows(BREAKING_CHANGES.md)` and the bump from `impact_bump`.

## Part 2 — Result

Run 2026-10-20 at `fba00aabf` with tags fetched. Every span was re-read a
second time under `-c diff.renameLimit=20000`, because the first pass printed
`exhaustive rename detection was skipped` on the 6.0.0 span; the two passes
returned identical surfaces, so no row below depends on a truncated rename
search.

### The out-of-sample window, both axes

| Major | Span | Recorded impact | Surfaces fired | Bump | FN on BREAKING |
|---|---|---|---|---|---|
| 2.0.0 | `1.41.2..2.0.0` | action | installer-layout | major | no |
| 3.0.0 | `2.26.0..3.0.0` | action | installer-layout | major | no |
| 5.0.0 | `4.9.0..5.0.0` | action | none | major | no |
| 6.0.0 | `5.10.1..6.0.0` | action | installer-layout, rule-or-skill-removal | major | no |
| 7.0.0 | `6.1.0..7.0.0` | action | rule-or-skill-removal | major | no |
| 8.0.0 | `7.5.0..8.0.0` | action | installer-layout | major | no |
| 9.0.0 | `8.13.0..9.0.0` | notice | none | minor | no |

**False negatives on BREAKING: 0 of 7.** The hard requirement holds on the
window the rule was not written on.

### The in-sample window, scored on the surface axis for the first time

Step 2.2 could not supply `touches_major_surface` and set it `false` for every
row. With the axis supplied, the same seven rows:

| Major | Span | Recorded impact | Surfaces fired | Bump |
|---|---|---|---|---|
| 10.0.0 | `9.36.0..10.0.0` | automatic | none | minor |
| 11.0.0 | `10.4.0..11.0.0` | automatic | none | minor |
| 12.0.0 | `11.0.0..12.0.0` | action | none | major |
| 13.0.0 | `12.1.0..13.0.0` | none | none | minor |
| 14.0.0 | `13.0.0..14.0.0` | none | none | minor |
| 15.0.0 | `14.23.0..15.0.0` | action | none | major |
| 16.0.0 | `15.0.0..16.0.0` | none | none | minor |

**2.2's headline survives the clause it could not test.** 13.0.0, 14.0.0 and
16.0.0 are still minor with the surface axis live; the clause does not rescue
them. That is the first obvious objection to 2.2 and it is now answered with a
reading rather than an argument.

### Four findings

**F1 — the rule is not a blanket demoter, which the in-sample run could not
show.** Out-of-sample it keeps **6 of 7** majors; in-sample it keeps **2 of 7**.
The difference is the recorded impact, not the rule: 6 of 7 early rows read
`action` and 2 of 7 recent ones do. A rule that demoted indiscriminately would
have demoted the early window too, and the hypothesis that 2.2's 5-of-7 was an
artefact of the rule rather than of the history is refuted by a number.

**F2 — the surface clause changed no verdict, in 14 of 14 cases.** It fires on
5 majors, all of them before 10.0.0, and every one of those was already major
on its impact alone. On this corpus the clause is inert: it adds a safety net
that never had to catch anything. That is an argument for keeping it (it costs
nothing and covers a case the trailer could miss), and it is **not** evidence
that it works, because it has never been the deciding clause.

**F3 — `CONTRIBUTING.md:331`'s major list omits commands, and that omission is
load-bearing.** 15.0.0's break was the removal of `/chat-history` and
`/chat-history import` — `src/domains/meta/chat-history/command.md` and its
projection. The written list names rules and skills, so the surface clause
correctly did not fire. The impact axis caught it. The two axes are
complements here, not redundancy, and the list needs a fourth entry if the
surface clause is ever to be the one that catches a removal of this shape.

**F4 — the fourth trigger has no mechanical form at all.** "Breaking changes to
the condensed content format" is reported as a gap, never as a surface that did
not fire. Any rule wired on the strength of this measurement is wired with
three of four triggers decidable.

### Controls — the zeros were checked before they were reported

A zero from a detector is worth nothing until the detector is shown to be
looking. Each one below was read directly from git, not from the classifier:

- `15.0.0..16.0.0` contains **0 deletions of any kind**, so
  `rule-or-skill-removal` could not have fired.
- `12.1.0..13.0.0` contains exactly **one** deletion in the whole span,
  `src/config/budget-routing.json` — not a rule, not a skill.
- `9.36.0..10.0.0`, `11.0.0..12.0.0`, `14.23.0..15.0.0` and `15.0.0..16.0.0`
  contain **0** creations or removals under the installer tree, its templates
  or its entry points.
- `5.10.1..6.0.0` contains **162** creations or removals under the rule and
  skill paths and 45 deletions, which is the positive control: the detector
  fires where the tree really moved.

### What this discharges, and what it does not

**Discharged:** the measurement the council asked for exists, on a
pre-registered window the rule was not written on, on both axes, with zero
false negatives on BREAKING.

**Not discharged, and the honest reading of each:**

1. The impact axis remains a consistency check. Its input and its ground truth
   are the same prose in both windows, and no reachable corpus separates them —
   a trailer written by a commit author at the time does not exist for any
   historical release. Only future releases can produce that evidence.
2. The surface axis is measured but **unexercised**: 14 of 14 verdicts are
   identical with the clause switched off. Its fire rate is real; its accuracy
   as a decider is untested, because nothing on this corpus tested it.
3. Fourteen majors is the entire population, not a sample. No confidence
   interval is quoted, because none would mean anything at this size.

Whether that clears the bar is the council's to say, not this file's. The
numbering model itself stays with the owner.
