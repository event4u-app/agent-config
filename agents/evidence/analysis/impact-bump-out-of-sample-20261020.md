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

Appended after Part 1 was committed. See the commit before this one.

<!-- result: pending -->
