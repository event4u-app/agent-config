<!-- evidence-type: analysis -->

# Publication-integrity hard fail — execution evidence, 2026-09-01

> Execution record for `agents/roadmaps/road-to-publication-integrity-hard-fail.md`.
> Base `03d61a116`, branch `drain/publication-integrity`. Every claim below was
> measured in this worktree; nothing is carried from the roadmap on trust.

## 1. The prior, checked before it was trusted

The roadmap's frontmatter claims the stub it extends has "a validated design and
no capability gap". Two halves, checked separately.

**The capability claim holds for Phases 1 and 3.** Everything those phases need
already existed: `stale_draft_labels`
(`src/scripts/_lib/release_highlights.ts:341`) already returned exactly the
offending labels; the gate already called it and discarded the result into a
warning; `extract_changelog_section` already cut a single section; and the
release drill already carried a fixture seam for `git show`
(`src/scripts/release_drill.ts`, `WorldConfig.changelog`). No new source file
was needed, as § Explicitly NOT requires.

**The measurements reproduce.** `grep -c 'rewrite before merge' CHANGELOG.md`
→ **8**; the same grep over `docs/archive/*.md` → **68**;
`grep -rh 'Curated head: fill before merge' CHANGELOG.md docs/archive/*.md | wc -l`
→ **44**, of which **2** are in the current era.

**One premise does NOT hold — see § 3.** Step 2.1 rests on a draft/released
distinction the generator does not make.

## 2. Sabotage and restore — five runs

Every guard added here was neutralised, watched go red, and restored
byte-identically against a recorded SHA-256. Two of the five are recorded
because they came back **green**, which is the finding rather than a footnote.

| # | Mechanism neutralised | Line / construct | Result |
|---|---|---|---|
| 1 | the stale-draft refusal | `return 1;` at `check_release_highlights.ts:257` deleted | **RED** — 2 of 27 tests |
| 2a | the section scoping | `parse_curated_head(section.body)` → `parse_curated_head(fs.readFileSync(changelogPath,'utf-8'))` | **GREEN — the test was insensitive** |
| 2b | the same, after the fixture was repaired | same substitution | **RED** — 1 of 27 tests |
| 3 | the annotated-tag guard | `_refuse_unpublishable(merged!.body, …, 'annotated tag');` deleted | **RED** — `marker-refuses-before-tag` |
| 4 | the resumed-push guard | `_refuse_unpublishable(staged!.body, …, 'tag push (resumed)');` deleted | **RED** — `marker-refuses-resumed-tag-push` |
| 5 | the Release-notes guard | `_refuse_unpublishable(tagged_section!.body, …, 'GitHub Release notes');` deleted | **RED** — `marker-refuses-github-release` |

Restore verification: `check_release_highlights.ts` back to
`cd6ac659cedccef12e7156f8daa80a8507e4449ffbea42e0c7fa8177d38b355b` after runs 1
and 2; `release.ts` back to
`d46a16c8caa8e00de5e95ff31caa2e2c61fe95cb70c02f1dd89abaf2ba9fe9d0` after 3, 4
and 5. Each restore re-ran green before the next sabotage.

### 2a — the run that stayed green, and what it caught

```
SABOTAGE 2: neutralise the SCOPING — read the whole changelog, not the cut section
scoping neutralised
 Test Files  1 passed (1)
      Tests  26 passed (26)
```

The § 1.3 test asserted that a marker-bearing **historical** section does not
block a clean **target** section — and it passed with the scoping removed.

**Why.** `parse_curated_head` matches each label with a `^…$` regex under the
`m` flag and takes the **first** match. The first fixture put the target section
first, which is the newest-first order a real changelog happens to have, so a
whole-file read still found the target's line first. The test proved that the
target sorts first, not that the read is scoped.

**The repair.** The fixture now places the marker-bearing historical section
**above** the target — the state an era split, a patch cut on an older line, or
any hand reordering produces. Re-running the identical sabotage then reds
exactly one case:

```
 × § 1.3 — the read is scoped to the section under release >
   a marker-bearing historical section ABOVE the target does not block it
      Tests  1 failed | 26 passed (27)
```

Both orderings are now pinned, and the newest-first one carries a comment saying
it is **not** the sensitive case, so a later reader does not cite it as scope
evidence.

## 3. FORK — Phase 2 cannot be executed as written, and needs a decision

**The premise is false.** Step 2.1 says the instruction comment "is correct in
the `Unreleased` draft and wrong the moment the section is cut". There is no
`Unreleased` draft in the generator. `render_release_head`
(`src/scripts/release.ts:317`) has exactly one caller,
`render_changelog_entry:549`, which always writes a **versioned** heading
(`:514-521`). The string `Unreleased` appears nowhere in `release.ts`,
`_lib/release_material.ts` or `_lib/changelog_eras.ts`; the `## [Unreleased]`
at `CHANGELOG.md:17` is hand-maintained and predates this pipeline (`032a244a3`).

So verify half (a) — *"a unit test on the writer asserts the comment is present
in an `Unreleased` draft section and absent from a released one"* — has no
subject. Half (b), the grep reading 0, is satisfiable by simply not writing the
comment.

**2.2 is coupled to 2.1 and cannot land first.** If the gate reds on the
instruction comment in the target section while the generator still writes that
comment into every section it cuts, **every release PR is red on its first
run** — Risk 1 of this roadmap, exactly. The order is forced.

**The real lifecycle, and why it is not the one the step describes.** The
comment is written into `CHANGELOG.md` on the release branch, is useful there
(the releaser reads it in the PR), and is harmful the moment that branch merges.
Nothing rewrites the file between those two states, so there is no seam where a
"released" rendering could differ from a "draft" one.

### The two defensible designs

**A — do not write the comment into the changelog at all.** Delete it from
`render_release_head`. If the reminder is still wanted, it goes into the release
**PR body** (`pr_body_from_section`, `_lib/release_material.ts:72`), a GitHub
artefact that is never published to npm.
*For:* satisfies half (b) trivially; no dead code path; the instruction still
reaches its only audience at the only moment it matters.
*Against:* half (a) as literally written is still unsatisfiable — the spirit
(present pre-merge, absent when published) is met, the letter is not. Changes
the PR body's shape, which is a surface `check_release_surface_equality`
compares against the changelog.

**B — give `render_release_head` a `draft` parameter.** Comment present when
`draft: true`, absent otherwise.
*For:* satisfies half (a) word for word.
*Against:* **no production caller would ever pass `true`.** It is a code path
policing a population of zero, and it asserts a draft mode the pipeline does not
have. This run was explicitly told not to add one of those.

**A third option worth naming so it is not rediscovered:** strip the comment
from the merged `CHANGELOG.md` at tag time. Rejected without needing a decision
— it means an extra commit to `main` mid-release, on the irreversible path,
which is strictly more risk than either A or B for the same outcome.

**Not decided here.** The choice changes a published surface and, in variant A,
the PR-body contract; and the step's own verify clause cannot be satisfied by
either without a re-scope, which this run is forbidden to perform. Phase 2 is
left entirely open — 2.1 and 2.2 both `[ ]` — and AC-2 with it.

**Phase 3 was built marker-only because of this.** `publication_blockers`
(`src/scripts/_lib/release_highlights.ts:329`) deliberately does **not** check
the instruction comment, and says so in its own docstring: refusing on it today
would red every release for the same Risk-1 reason.

## 4. AC-5 — the escape-hatch question, answered: none, with its reason

Risk 2 asks whether a hard fail leaves a genuine emergency release unshippable.
Measured, it does not, and the discriminating fact is **where the gate runs**.

`check_release_highlights` is invoked from exactly one place:
`.github/workflows/release-validation.yml:266`, inside a job gated on
`startsWith(github.head_ref, 'release/')` (`:269` for the sibling job; the whole
workflow is release-PR-only per its own header at `:3-5`). It fires on the
release **pull request** — before the merge, before the tag, before publication.

The action that clears it is rewriting a head line in `CHANGELOG.md` on the
branch the releaser is already authoring. **There is no state in which reaching
for a bypass flag is cheaper than editing the line the flag would let you ship.**
So a flag would have no legitimate use; it would be a supported way to publish
the defect deliberately.

The publish-side guards refuse on a narrower condition still: they read the
MERGED section, which the PR gate already passed. A refusal there means the
merged content differs from what was validated — a desync, which is exactly when
a release should stop.

Recorded in the tree at `docs/contracts/CHANGELOG-conventions.md` § No escape
hatch, with the reopening trigger: a real release blocked in a state where
rewriting the section is genuinely impossible.

**Stated as a decision taken, not as a fact discovered.** The roadmap authorised
either branch. This run took the conservative one — adding a bypass to a safety
guard is the weakening direction and would need authority this run does not
have, while declining to add one needs none.

## 5. Defect-pattern sweep

The exact wrong construct: **a detection result computed and then discarded into
a warning while the exit code stays 0.**

| Search | Result |
|---|---|
| production call sites of `stale_draft_labels` outside its definition | **1** — `check_release_highlights.ts:245`, the one fixed. All other hits are the definition, tests, or comments. |
| duplicate definitions of the marker literal | **0** — `DERIVED_MARKER` is defined once at `_lib/release_highlights.ts:64`; every consumer imports it, including the new drill fixture. |
| the literal string `advisory, not blocking` under `src/` | **0** after the change (was 1). |
| other warn-only publication defects in the release path (`⚠️` in `release.ts`, the gate, and the two libs) | **4**, all reviewed and all correctly advisory: three are the test-count probe (`release.ts:637,645,652`), whose footer is explicitly never a release blocker, and one is a post-publish workflow-dispatch failure (`:1513`) that fires after the release already exists. **None is a publication-integrity defect.** |
| stale prose asserting the old contract | **2 found and fixed** — `check_release_highlights.ts:145-150` (the `main` docstring) and `docs/contracts/CHANGELOG-conventions.md:52-54, 119-124`. |

Zero is a real answer in rows 2 and 3, and is reported as one.

## 6. What was NOT done, and why

- **Phase 2 (2.1, 2.2) and AC-2** — the fork in § 3. Not attempted rather than
  attempted-and-fudged.
- **AC-6 / `blocker: b-retro-curation-scope`** — untouched and still open, which
  is the criterion's own "or standing" branch. The editorial prose is
  owner-reserved by two prior council rulings recorded in the blocker.
- **Step 1.4's verify names the pull request** as the place the sabotage
  transcript is recorded. This run does not open the PR. The transcript is
  § 2 above, committed to the tree, which is more durable than a PR body but is
  **not** literally what the clause says. Flagged rather than claimed.
