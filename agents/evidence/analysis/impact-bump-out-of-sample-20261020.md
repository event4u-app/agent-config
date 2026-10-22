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
result.** `git ls-remote --tags origin` carries no `4.0.0`, so the span has no
**upper** bound and cannot be read. (Corrected 2026-10-21: this read "no lower
bound", which is backwards — `3.3.0` exists and supplies the lower bound; the
missing tag is the endpoint itself. The exclusion is unchanged and still
pre-registered, but this sentence is the pre-registration's defence against
window-shopping, so a wrong reason in it is worth correcting even though the
decision it defends is right.) Seven majors remain scoreable: 2.0.0, 3.0.0,
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
entries = parse_name_status(git diff --name-status <prev>..<tag>)
paths   = settings_key_paths(entries)
keys    = paths.length === 0
            ? []                                   // NOT a bare `git diff --`
            : removed_setting_keys(git diff -U0 <prev>..<tag> -- <paths>)
classify_surfaces(entries, keys)
```

with the impact cell from `parse_impact_rows(BREAKING_CHANGES.md)` and the bump
from `impact_bump`. `settings_key_paths` and `removed_setting_keys` are exported
from `major_surface.ts` and covered by tests.

**Corrected twice, and the second correction is the one that mattered.** The
first form passed `SETTINGS_KEY_FILES`, an array of regular expressions, as a
`git diff --` pathspec; it was not executable, which is part of why the error
in Part 2 survived to be committed. The second form was executable and still
did not reproduce the table, which is worse, and round 2 of the review caught
it: `paths` is **empty** for three of the fourteen spans (`4.9.0..5.0.0`,
`13.0.0..14.0.0`, `15.0.0..16.0.0`), and `git diff -U0 <span> --` with an
empty pathspec is not an empty diff — it is the whole span. Run literally, it
read 9, 3 and 12 key-shaped removals in those three spans, fired
`settings-keys` on all three and flipped 14.0.0 and 16.0.0 to major,
contradicting the table above and the headline under F3.

The defect is in the written reproduction, not in the result. The same round-2
reviewer re-ran all three detectors independently, from the module's own
regexes rather than from this block, and reports the committed surfaces and
removed-key sets reproducing row for row — so the table stands and the
instructions for re-deriving it did not. That is still the one failure a
reproduction section exists to prevent: a reader who followed it got different
numbers from the author and had no way to tell which was wrong.

## Part 2 — Result

**This section was committed wrong on 2026-10-20 and is corrected here, in
place, with the error named.** The first run reported that the surface clause
changed no verdict in 14 of 14 cases. It changes two. The cause was a blind
detector, not a wrong reading: `SETTINGS_KEY_FILES` was anchored at `^config/`,
the settings template was renamed to `src/config/agent-settings.template.yml`
in the 6.0.0 span, and so the settings surface matched nothing from 6.0.0
onward — the whole window the rule is scored on. An independent R2 reviewer
found it; the record is
`agents/evidence/reviews/drain-release-says-needs-you-20261020.round1-review.md`,
committed before the repair as finding 1 of 7. The wrong reading went in because the Controls
section below controlled two surfaces of three and not the one that was wrong.

Run 2026-10-20 at `fba00aabf` with tags fetched, against the repaired detector.

### Both windows, both axes

| Major | Span | Recorded impact | Surfaces fired | Keys removed | Bump | Impact alone | FN |
|---|---|---|---|---|---|---|---|
| 2.0.0 | `1.41.2..2.0.0` | action | installer-layout | — | major | major | no |
| 3.0.0 | `2.26.0..3.0.0` | action | installer-layout | — | major | major | no |
| 5.0.0 | `4.9.0..5.0.0` | action | none | — | major | major | no |
| 6.0.0 | `5.10.1..6.0.0` | action | installer-layout, rule-or-skill-removal | — | major | major | no |
| 7.0.0 | `6.1.0..7.0.0` | action | installer-layout, rule-or-skill-removal | — | major | major | no |
| 8.0.0 | `7.5.0..8.0.0` | action | installer-layout | — | major | major | no |
| 9.0.0 | `8.13.0..9.0.0` | notice | none | — | minor | minor | no |
| 10.0.0 | `9.36.0..10.0.0` | automatic | **settings-keys** | `turn_end_gate`, `enabled`, `promissory`, `language`, `verification` | **major** | minor | no |
| 11.0.0 | `10.4.0..11.0.0` | automatic | **settings-keys** | `worktrees`, `mode` | **major** | minor | no |
| 12.0.0 | `11.0.0..12.0.0` | action | none | — | major | major | no |
| 13.0.0 | `12.1.0..13.0.0` | none | none | — | minor | minor | no |
| 14.0.0 | `13.0.0..14.0.0` | none | none | — | minor | minor | no |
| 15.0.0 | `14.23.0..15.0.0` | action | none | — | major | major | no |
| 16.0.0 | `15.0.0..16.0.0` | none | none | — | minor | minor | no |

Out-of-sample (2.0.0 → 9.0.0): **6 of 7** majors kept. In-sample
(10.0.0 → 16.0.0): **4 of 7**. Surface clause fired on **7 of 14** and was the
deciding clause on **2 of 14**. **False negatives on BREAKING: 0 of 7
out-of-sample, 0 of 14 overall.**

### Five findings

**F1 — the rule is not a blanket demoter, which the in-sample run could not
show.** Out-of-sample it keeps 6 of 7 majors; in-sample 4 of 7. The difference
is the recorded impact, not the rule: 6 of 7 early rows read `action` and 2 of
7 recent ones do. The hypothesis that 2.2's demotion rate was the rule's bias
rather than the history's is refuted by a number.

**F2 — the surface clause is live and decides two rows; the claim built on
top of it holds for ONE of them.** Narrowed 2026-10-21 after round 2 of the
review, and the narrowing is the honest part: this finding previously read
"both times it fires alone it overrides an `automatic` migration", which was
checked against the fired surface and not against what each release record
actually documents.

- **11.0.0 — the pairing is clean.** The detector reports `worktrees`/`mode`
  removed from the settings template, and the 11.0.0 row of
  `BREAKING_CHANGES.md` documents exactly `worktrees.mode`, with its migration
  recorded as **automatic — a leftover key is accepted and ignored**. Here the
  claim stands: `CONTRIBUTING.md:331` as written says *a settings key removed
  with an automatic migration is a major*, and that is a policy question for
  the owner under option (a) rather than an implementation detail.
- **10.0.0 — the pairing is wrong, and the two halves describe different
  removals.** The 10.0.0 row's recorded break is the council transport keys
  (`defaults.mode` and the per-member `mode:`), which live in `.ai-council.yml`
  — a path **no** `SETTINGS_KEY_FILES` row matches, so the detector never saw
  them. What it did see is the removal of the `turn_end_gate` block from the
  settings template, which `BREAKING_CHANGES.md` does not mention anywhere
  (`grep -c turn_end_gate` over that file returns 0). So the surface fires
  legitimately and the `automatic` note belongs to a different change; reading
  them as one claim was the error.

Two further limits on the key lists themselves, from the same round. The
reported removed-key sets include `enabled` for 10.0.0 and `mode` for 11.0.0,
and neither is gone: the 10.0.0 template still carries 11 `enabled:` keys and
the 11.0.0 template still carries 2 `mode:` keys. `removed_setting_keys` reads
the patch alone, so a key name that survives unchanged elsewhere in the same
file has no `+` line and is counted as removed — see the corrected docblock in
`major_surface.ts`. **No verdict moves on any of this:** both rows fire on a
removal that is real (`turn_end_gate` and its children; `worktrees`), so the
surface decides the same two rows either way. What shrinks is the claim the
owner was asked to act on, from two cases to one.

**F3 — 2.2's headline survives the clause it could not test.** 13.0.0, 14.0.0
and 16.0.0 are still minor with the surface axis live. No key is removed in
those spans and the template is not in two of the three diffs at all.

**F4 — `CONTRIBUTING.md:331`'s major list omits commands.** 15.0.0's break was
the removal of `/chat-history` and `/chat-history import`
(`src/domains/meta/chat-history/command.md` and its projection). The written
list names rules and skills, so the surface clause correctly did not fire; the
impact axis caught it. The list needs a fourth entry if the clause is ever to
catch a removal of this shape.

**F5 — the fourth trigger has no mechanical form at all.** "Breaking changes to
the condensed content format" is reported as a gap, never as a surface that did
not fire. Any rule wired on the strength of this measurement is wired with
three of four triggers decidable.

### Controls — including the one whose absence caused the error

A zero from a detector is worth nothing until the detector is shown to be
looking. The first version of this section proved that by omitting the
settings surface. All three are controlled now, read from git rather than from
the classifier:

**settings-keys.** Positive: `9.36.0..10.0.0` removes the `turn_end_gate` block
and `10.4.0..11.0.0` removes `worktrees: mode:`, both with no re-adding `+`
line. Negative-with-the-file-present, which is the control that matters:
`11.0.0..12.0.0` and `14.23.0..15.0.0` both **change** the template and remove
no key — so the zeros there are a reading, not a blind spot. In
`12.1.0..13.0.0`, `13.0.0..14.0.0` and `15.0.0..16.0.0` the template is absent
from the diff entirely.

**The out-of-sample half of this surface has no control at all, and one of its
zeros is a blind spot.** Added 2026-10-21 after round 2 of the review; every
span named above is 9.36.0 or later, i.e. in-sample. Two consequences, neither
of which the section admitted before:

- Across the seven out-of-sample majors the settings surface fires nowhere and
  nothing establishes that it was looking. The zeros there are unverified.
- `5.10.1..6.0.0` is worse than unverified, it is blind by construction: that
  is the span where the template was renamed (`git diff --name-status` reports
  `R093 config/agent-settings.template.yml -> src/config/…`), and
  `settings_key_paths` keeps only the new path, so a diff restricted to that
  pathspec loses the rename pairing and reports `new file mode` with zero
  removed key lines whatever the file actually did. Ground truth, checked at
  both tags, is that no key was in fact dropped — so the row is right and its
  zero is still not evidence.

This is a second, unregistered variant of risk 6 in the roadmap's register
(a path-anchored detector going blind while the measurement reports
inertness), reached through the pathspec rather than through a stale anchor.
Recorded here because the first variant was caught by review and not by these
controls, and the controls are what was supposed to catch it.

**rule-or-skill-removal.** Positive: `5.10.1..6.0.0` carries **158 additions
and 4 deletions** under the rule and skill paths. *(The first version of this
line said "162 … and 45 deletions": 162 was A+D combined and 45 was the span's
total deletions anywhere — neither is the positive control for a
deletion-only trigger, which is the 4.)* Negative: `15.0.0..16.0.0` contains
**0** deletions of any kind; `12.1.0..13.0.0` contains exactly one in the whole
span, `src/config/budget-routing.json`, which is neither a rule nor a skill.
*(Both negatives are stated **with rename detection on**, which is how they
reproduce as 0 and 1; under `--no-renames` the same spans read 3 and 6,
because a rename becomes a delete plus an add. Noted 2026-10-21 after round 2
pointed out that the next paragraph claims rename insensitivity, so a reader
cannot tell which mode these two numbers are in. The verdicts are unaffected —
all 14 spans were re-run both ways and every fired-surface set is identical —
but a control whose value depends on an unstated flag is weaker than it looks.)*

**installer-layout.** Positive: `6.1.0..7.0.0` carries
`D src/scripts/install.py` and `A src/scripts/install.ts` — the entry-point
relocation, which the first detector also missed and which the repaired table
now catches. Negative: `9.36.0..10.0.0`, `11.0.0..12.0.0`, `14.23.0..15.0.0`
and `15.0.0..16.0.0` carry **0** creations or removals under the installer
tree, its templates or its entry points. *(This control was partly unbacked
when written: the templates row of `INSTALLER_LAYOUT_PATHS` was anchored at
`^templates/` while the tree moved to `src/templates/` inside the scored
window, so "or its templates" named a path the detector could not see from
6.0.0 onward — the same stale-anchor class as the settings defect, found by
round 2 and repaired in the same change. The row now accepts both roots, and
the control is true rather than merely stated: a sweep of all 14 spans finds
zero creations or removals under `src/templates/`, so the repair moves no
row.)*

**Rename insensitivity.** All 14 spans were re-run under `--no-renames`. Every
row is identical, so no verdict here depends on git's rename heuristic or on
its similarity threshold.

### What this discharges, and what it does not

**Discharged:** the measurement exists, on a pre-registered window the rule was
not written on, on both axes, with zero false negatives on BREAKING.

**Not discharged, and the honest reading of each:**

1. The impact axis remains a consistency check. Its input and its ground truth
   are the same prose in both windows, and no reachable corpus separates them —
   no historical release carries an author-written trailer. Only future
   releases can produce that evidence.
2. The surface clause now has two decided cases, which is two more than the
   first run reported and still too few to call it accurate. What those two
   show is a **disagreement** between the written surface list and the recorded
   impact, in both cases resolved by the surface list toward the stricter
   answer. Whether that is the wanted behaviour is F2's question.
   (Corrected 2026-10-22, release finding `ee4ca201755b`: since F2 was narrowed
   on 2026-10-21, only 11.0.0 is a clean pairing — the 10.0.0 detector hit and
   the 10.0.0 recorded break describe different removals — so "both cases"
   holds for the stricter answer the surface list produced, not for a
   disagreement shown twice. The "three of the fourteen" empty pathspecs in the
   reproduction block stand: `12.1.0..13.0.0` lacks the template but its diff
   carries `src/server/schemas/settings.ts`, which `SETTINGS_KEY_FILES`
   matches, so its pathspec is not empty.)
3. Fourteen majors is the entire population, not a sample. No confidence
   interval is quoted, because none would mean anything at this size.
4. **This file was wrong once.** It was caught by an independent review and not
   by its own controls, which is evidence about the controls. The repaired
   detector carries regression tests pinning both relocated paths, and the
   `SETTINGS_KEY_FILES` table now fails a test if any row is root-anchored
   again.

Whether that clears the bar is the council's to say, not this file's. The
numbering model itself stays with the owner.
