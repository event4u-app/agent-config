# Release-PR review mode — design

> Design artifact for `road-to-feedback-9.2.0-followups` Phase 3. Implemented
> in `src/scripts/self_review_gate.ts` (`detectReleaseVersion`,
> `pickPreviousTag`, and the release branch in `buildPlan`); tested in
> `src/scripts/self_review_gate.test.ts`.

## Why this exists — the reproduction case

The self-review gate (`.github/workflows/self-review-gate.yml`,
`src/scripts/self_review_gate.ts`) analyzes `${baseRef}...HEAD` — the diff
between the PR's base branch and its head. That is the right base for a
feature PR. It is the **wrong** base for a release PR: a release branch is
cut from `main` *after* the feature PRs it packages have already merged, so
the only content left in `release-branch...main` is the release-cut commit
itself (changelog entry + version bump). Every feature the release is
actually shipping reads, to a diff-only reviewer, as absent.

This is not a hypothetical failure mode. It is documented, verbatim, against
a real PR. The external review of Release 9.2.0
(`agents/tmp.old/feedback-9.2.0-1.txt` — a local-only inbox archive, quoted
here so this note stands alone) recorded the automated review comment on
**PR #957** (the 9.2.0 release PR) reporting three false findings:

```text
Der automatisierte Review-Kommentar zu PR #957 meldet unter anderem:

* die neue Regel sei „nicht im Diff",
* ADR-122 sei „nicht im Diff",
* die Testzahl sei nicht durch neue Testdateien erklärbar.
```

In English: (1) *"the new rule [`cross-source-consistency`] is not in the
diff"*, (2) *"ADR-122 [is] referenced but not in the diff"*, (3) *"+27 tests
[vs. 9.1.0] but no new test files in the diff"* — restated in the same
document's adversarial-bot section:

```text
### Adversarial Bot: "ADR-122 referenced but not in the diff"

Das ist der gleiche Finding wie in PR #921 bei der branch-protection.md
— ein Dokument wird referenziert das nicht im Diff sichtbar ist. In diesem
Fall liegt ADR-122 vermutlich in den Commits von 9.0.0 oder 9.1.0 und wurde
nicht neu im 9.2.0-Diff committed. Das ist erklärbar aber für externe
Reviewer undurchsichtig.

### Test-Delta: "+27 from 9.1.0, but no new test files in the diff"

Der adversariale Bot hat das korrekt bemerkt: +27 Tests ohne neue
Test-Dateien im Diff. Die Tests wurden in bestehende Test-Files
integriert.
```

All three findings are **false advisories** in the sense that matters here:
the rule, the ADR, and the test additions were all real and already present
on `main` — the bot was diffing the wrong base, not missing real gaps. The
reviewer's own diagnosis is exact:

```text
Das Review-System betrachtet damit offenbar primär:

    release branch → main diff

nicht:

    9.1.0 tag → 9.2.0 release candidate

Für Release-PRs ist das die falsche Vergleichsbasis.
```

And the requested fix, which this design follows (in English: detect the
version from the PR title or changelog; resolve the previous tag; analyze
`previous_tag...release_head`; treat the release-PR diff only as an
additional packaging diff; validate claims against the full release commit
range):

```text
1. Version aus PR-Titel oder Changelog erkennen.
2. vorherigen Tag bestimmen.
3. previous_tag...release_head analysieren.
4. Release-PR-Diff nur zusätzlich als Packaging-Diff prüfen.
5. Claims gegen den vollständigen Release-Commitbereich validieren.
```

## Root cause

Wrong diff base for one PR shape. `self_review_gate.ts` always analyzes
`baseRef...HEAD` (the PR's own base branch → its head). For a normal feature
PR that is correct — the feature's commits are exactly what changed. For a
release PR, `baseRef` (`main`) and `HEAD` (the release branch) share the same
merge-base as the release branch's tip *minus* the release-cut commit, because
the release branch was cut from `main` after every packaged feature already
landed there. The diff collapses to "changelog + version bump", and any claim
about a feature/ADR/test-delta introduced earlier in the release cycle reads
as unsubstantiated.

## Design

### 1. Deterministic release-PR detection

A PR is a release PR when its diff (`baseRef...HEAD`, scoped to
`CHANGELOG.md` + `package.json`) contains **both**:

- an added line matching the repo's changelog heading shape
  (`## [X.Y.Z](...)`, e.g. `## [9.2.0](https://github.com/.../compare/9.1.0...9.2.0) (2026-07-14)`
  — verified against the actual `CHANGELOG.md` heading format used since
  9.2.0), and
- an added `"version": "X.Y.Z"` line in `package.json`,

with the **same** `X.Y.Z` in both. Requiring both, and requiring they agree,
keeps the detector conservative: a changelog-only edit or an unrelated
version-string match elsewhere never misfires as a release PR.

`detectReleaseVersion(patchText)` is a **pure** function over the unified
diff text (no git call) so it is unit-testable directly with synthetic patch
strings. `detectReleaseVersionFromGit(baseRef, cwd)` is the thin impure
wrapper that collects the patch via `git diff --  CHANGELOG.md package.json`
and hands it to the pure function.

### 2. Previous-tag resolution

Given the detected release version, `pickPreviousTag(version, tags)` picks
the highest semver-shaped tag strictly below it (also pure, over a
`string[]` of tag names — the repo's own tag list is plain `9.2.0`, `9.1.0`,
… with no `v` prefix, verified via `git tag`, but the parser tolerates an
optional `v` prefix since that convention varies by consumer repo). Non-
semver tags (e.g. `backup/pre-rebase-...`) are ignored rather than crashing
the detector. `resolvePreviousTagFromGit(version, cwd)` is the impure
wrapper (`git tag`).

If no lower tag resolves (first release, or a tag naming mismatch), the gate
falls back to the normal `baseRef` base and emits a `::notice::` line — it
never throws and never silently misclassifies.

### 3. Analysis range

When release mode is detected, `buildPlan()` analyzes the **feature range**
`previousTag...HEAD` for `changedFiles` / `diffText` / `changedLineCount` —
this is the range that actually contains the release's shipped feature
commits — instead of `baseRef...HEAD`. The original `baseRef...HEAD`
diff (the packaging diff — changelog + version bump) is still computed and
surfaced, but only as a note, never as the analysis scope. The live-review
system prompt gets an explicit instruction naming the feature range and the
packaging-diff file list, plus the direct anti-pattern instruction: *"Do NOT
report a feature as 'not in the diff' when it is present in the release
range."* This directly targets the PR #957 shape — a reviewer that reads
`previousTag...HEAD` will see the rule, the ADR, and the test additions
without needing them re-committed inside the packaging diff.

Non-release PRs are unaffected: `detectReleaseVersion` returns `null`, and
`buildPlan()` uses the exact same `baseRef...HEAD` path it always has —
byte-identical behavior, including dry-run stdout (no `mode:` line is
printed unless release mode was detected).

### 4. Claim validation

The gate's claim-affecting escalation heuristic (`escalationReasons`) already
runs over `changedLineCount`/`files` for whichever base was actually
analyzed, so under release mode it evaluates the full feature-range diff (not
just the packaging diff) — satisfying "validate claims against the full
release commit range" without a separate code path.

## Tag availability in CI

`self-review-gate.yml` already checks out with `fetch-depth: 0` on both jobs.
`actions/checkout@v4` with `fetch-depth: 0` fetches the full history **and**
all tags by default (it is not a shallow, single-branch fetch) — so
`git tag` inside the workflow sees every release tag without a separate
`git fetch --tags` step. **No workflow YAML change is required for this
phase.**

## What this does NOT do

- It does not change the workflow's advisory/enforce posture — release mode
  only changes *what* is analyzed, not whether the gate blocks.
- It does not attempt release-note / semver-bump *validation* (e.g. "is this
  really a minor bump") — only detection of a release PR shape, for the sole
  purpose of picking the right diff base.
- It does not touch `escalationReasons`'s thresholds or `classifyBlocking` —
  those are orthogonal to which base is analyzed.
