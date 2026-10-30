---
adr: 300
status: accepted
date: 2026-10-24
decision: consumer-impact-binds-the-bump
supersedes: —
superseded_by: —
phase: road-to-a-release-that-says-whether-it-needs-you · blocker impact-numbering-model
type: structural
reopen_policy: owner
protected_dimensions: none
provenance:
  kind: human
  decision_makers: [owner]
  human_directed: true
evidence:
  strength: E1
  basis:
    - agents/evidence/owner-directives/2026-10-24-impact-numbering-model.md
    - agents/evidence/council/owner-blocker-routing-20261016.md
    - agents/evidence/council/resolve-blockers-batch-20261019.md
    - agents/evidence/analysis/impact-bump-out-of-sample-20261020.md
    - agents/evidence/council/adr-300-exception-at-the-cut-20261024.md
    - agents/roadmaps/archive/road-to-a-release-that-says-whether-it-needs-you.md
    - CONTRIBUTING.md
    - BREAKING_CHANGES.md
review_trigger: >-
  Reopened if a release numbered by this rule is found to have shipped a
  consumer action as a minor or a patch, or if two consecutive releases are
  cut with an explicit bump override against the rule's verdict.
---

# ADR-300 — The Consumer-Impact trailer binds the version bump

## Status

Accepted 2026-10-24. Decided by the repository owner (answer "1" to the
`impact-numbering-model` blocker, option (a) with a migration exception).
Resolves that blocker. The AI council had decided option (b) on 2026-10-16 and
routed (a) to the owner as a change to a public compatibility commitment; this
record is that ruling.

## Context

`release.ts` made every release carrying a `!` or `BREAKING CHANGE` subject a
major, whatever it touched. `CONTRIBUTING.md` § Versioning policy calls CI
changes and internal refactors a patch, and 5 of the 7 majors from 10.0.0 to
16.0.0 needed no consumer action. Since #2421 each commit can declare its cost
in a `Consumer-Impact:` trailer (`none | automatic | notice | action`), recorded
as experimental metadata that numbered nothing. The out-of-sample measurement
of 2026-10-20 scored the impact-driven rule with zero false negatives on a
breaking release over fourteen majors, and found that the major list, read
literally, makes a settings key removed with an automatic migration a major
(10.0.0, 11.0.0) and does not name commands (15.0.0's break).

## Decision

1. The `Consumer-Impact` trailer binds the bump. A release is a **major** when a
   commit in its span declares `action`, or when its diff touches a surface the
   versioning policy lists as major; a breaking commit declaring `none`,
   `automatic` or `notice` makes it a **minor**.
2. A settings key removed or renamed with an **automatic migration** is not a
   major. `CONTRIBUTING.md`'s major row and its settings-keys paragraph say so.
3. Command removal joins the major list, so the surface clause covers 15.0.0's
   shape (strengthening the list; recorded here because it ships with 1).

Two readings the agent took when implementing the order, conservative on
purpose and reopenable without reopening the order:

- A breaking commit with **no** valid trailer is still a major. An absent or
  invalid declaration carries no information, and turning it into a downgrade
  is the one error a consumer cannot recover trust from.
- The settings-key exception applies only when the span's strongest declared
  impact is `automatic`. A span that declares nothing, `none` or `notice`
  beside a removed key is still a major.

## Consequences

`infer_bump` in `src/scripts/release.ts` calls `span_bump`
(`src/scripts/_lib/impact_bump.ts`) with the span's commits and the surfaces
`classify_surfaces` reads from `git diff <last-tag>..HEAD`. An explicit
`--bump` override still wins. `settings_key_paths` now returns YAML files only,
closing the over-match recorded on it, because a deleted TypeScript property
would otherwise number a release. The `BREAKING_CHANGES.md` disclaimer that
called the column non-normative is replaced.

At the cut, the exception is carried by blocker `adr-300-exception-at-the-cut`,
decided by the AI council on 2026-10-24 (2/2, option (b)): a rename whose
`RENAMED_KEYS` alias carries the consumer's value needs no proof below a major
when the release declares `Consumer-Impact: automatic`; a `REMOVED_KEYS`
tombstone discards the value and still needs its proof or a major. The rule
sentence (`SETTINGS_REMOVAL_RULE`) is amended in all eight places. A
conversion-module migration that is not a rename counts only once a
test-backed registry for it exists.

## Alternatives considered

- **(b)** keep the trailer advisory and the punctuation rule — decided by the
  council as the interim and superseded by this ruling.
- **(c)** reject both — declined by both council seats.
- **(a) without the exception** — would keep 10.0.0- and 11.0.0-shaped
  releases majors although their own records say the migration was automatic.

## Not reopened

Phase 1's trailer grammar, the `agentConfig.impact` map, the comparator and the
classifier are unchanged by this record.

## Evidence

The owner directive file names the order. The council records hold the
routing; the out-of-sample analysis holds the measurement the owner decided on,
including its stated limit that the impact axis is a consistency check, since
no historical release carried an author-written trailer.

## Amendment 2026-10-30 — the installer surface fires on a removal only

Owner ruling (`agents/evidence/owner-directives/2026-10-30-major-only-on-a-break.md`):
a major is a breaking change. `installer-layout` had fired on any file created
or removed under the installer tree, its templates or its entry points, so the
span `19.0.0..main` numbered itself 20.0.0 on one new internal module,
`src/install/hostConfigMerge.ts`, with no breaking commit and no `action`
trailer. From this amendment the surface fires only when a consumer-facing
installer path is removed — the templates tree, `bin/`, the install entry-point
script — and installer source code (`src/install/`, `packages/core/installer/`)
is no surface at all; a break it carries is declared with
`Consumer-Impact: action`. The historical majors the out-of-sample analysis
lists under `installer-layout` (2.0.0, 3.0.0, 6.0.0, 7.0.0, 8.0.0) each also
declared `action`, so they replay as majors unchanged.

## References

- `CONTRIBUTING.md` § Versioning policy, `BREAKING_CHANGES.md`.
- `src/scripts/_lib/impact_bump.ts`, `src/scripts/_lib/major_surface.ts`,
  `src/scripts/release.ts`.
