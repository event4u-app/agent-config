# Completion review — closing and archiving the behaviour-evidence-over-pixels roadmap

**Skipped:** no code surface for this completion — the diff is one roadmap blocker resolution plus the archival move of that same roadmap, and the gate itself measures zero code paths of two changed files, scope 3525e66d7c3590253fb8414a1ccab452b5ffeac1b1002935405d94cddcf9479e, declared 2026-09-28

## Why a skip rather than a review

The change records an owner ruling on `blocker: the-lane-this-probe-runs-in` and
then moves the roadmap, now at 26/26 with no open blockers, into
`agents/roadmaps/archive/`. It ships no executable surface: no script, no hook,
no config, no test, no frontmatter field that anything reads. `check_completion_review`
classifies the diff as zero code paths of two changed files, which is the
condition this declaration covers.

## What was verified rather than assumed

- **The blocker's own absence check was re-run at HEAD, not quoted.**
  `grep -rn -i "storybook\|\.stories\." src/cli src/scripts src/agent-src src/server --include='*.ts'`
  returns exactly one line, `src/scripts/lint_archived_skills.ts:306`, and that
  line is a comment naming two skills rather than a workshop declaration. The
  2026-09-11 reading the blocker recorded therefore still holds: no workshop, no
  isolation URL, and Phase 2 against a file URL is designed behaviour.
- **The sibling's state was read rather than inferred.**
  `agents/roadmaps/archive/road-to-a-declared-component-contract.md` is archived,
  its steps 4.1 and 4.3 and its Phases 5 and 6 carry `[-]` with a
  `cancelled-by: taxonomy-reversal-is-a-second-arrival` marker dated 2026-09-21,
  and its disposition table states "Zero lanes exist". So it neither landed a
  lane nor recorded that none is needed — which is exactly why the resolution
  says so instead of claiming the `Resolved when` condition was met on its
  literal terms.
- **The archival was performed by the repository's own sweep**, not by a manual
  `git mv`: `archive_completed_roadmaps --all` was dry-run first, refused
  `road-to-the-substrate-stub-meeting-its-open-gate` for its still-open blocker
  in both passes, and moved only this roadmap.
- **Link and reference breakage was checked in both directions, and there was
  none.** Every path reference inside the moved file is repo-root absolute
  (`agents/roadmaps/archive/...`), so the extra directory level changes nothing;
  every inbound reference in the tree is a bare slug rather than a path, so
  nothing needed repointing.
- **Gates run on the final tree:** `lint_roadmap_blockers` clean over 131
  roadmaps; `check_estate_count` green with `active_roadmaps 4 → 3` and
  `open_blockers 40 → 39`, both drawdowns; `task preflight` exit 0.

## The departure this change records on purpose

The blocker's `Resolved when` names the *sibling* roadmap as the recorder. The
owner recorded the decision directly instead. The resolution states that in its
own text, gives the two reasons, and leaves the `Resolved when` wording
untouched so a reader can see what was short-circuited. That was the point of
the edit and it is not a drafting accident — a reader who disagrees with the
short-circuit can see exactly what to disagree with.

## Independence — stated plainly

**No independent review was obtained for this change.** The same agent
reproduced the evidence, wrote the resolution and ran the gates. The skip
declaration above is a statement about the diff's surface — zero code paths —
and not a claim that the prose is correct or that the departure was the right
call. Every factual claim in the resolution names the command, file or line that
decides it, so a later reader can refute any of them without trusting this
artefact or its author.
