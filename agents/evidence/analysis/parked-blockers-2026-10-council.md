<!-- evidence-type: analysis -->

# Parked blockers — the council on the `later/` exclusion, 2026-10-07

The decision-revisit record for blocker `later-blockers-in-scope` of
`road-to-parked-blockers-that-get-asked`, beside the census in
[`parked-blockers-2026-10.md`](parked-blockers-2026-10.md).

## The run

| Field | Value |
|---|---|
| Date | 2026-10-07 |
| Members | anthropic (claude-sonnet-4-5, cli), openai (codex-default, cli) |
| Mode | `design`, 2 rounds, blind chairman |
| Quorum | 2 of 2 present, concluded |
| Cost | $0 metered (both seats on subscription transport) |
| Question | the two options (a) and (b) verbatim from the blocker, the census figures, and an explicit third answer: keep the exclusion unchanged |

The question named one claim as unmeasured — that widening the lint to all of
`later/` would surface structural findings. It stated no expected outcome.

## What each seat said

**Both seats rejected (a).** The shared reason: `/roadmap:resolve-blockers`
would put in front of the owner entries that `lint_roadmap_blockers` has never
validated, so the resolver and the lint would hold two definitions of a valid
blocker, and filtering on `Owner:` and `Status:` does not repair that.

**anthropic** leaned to (b), conditional on a measurement neither option
supplied: that the seven `later/*-carried.md` files already pass the lint. Its
revisit trigger: fewer than five of the seven pass.

**openai** chose to keep the exclusion unchanged: the census measures
inventory, not urgency, and neither option defines when a parked roadmap
becomes actionable. Its invariant: *activation implies validation; validation
does not imply activation.* It asked for report-only observability first, and
named the strongest argument against itself — owner blockers may be the very
decisions a parked roadmap needs before it can resume.

## The measurement the anthropic seat asked for

Taken after the run with `_scanBoth` from `lint_roadmap_blockers` over each
carried file:

| File | hard findings | decidability findings |
|---|---|---|
| road-to-a-release-record-that-says-what-it-reviewed-carried.md | 0 | 0 |
| road-to-a-stop-that-holds-carried.md | 0 | 0 |
| road-to-a-trunk-whose-own-gates-are-green-carried.md | 0 | 0 |
| road-to-an-obligation-row-that-names-its-writer-carried.md | 0 | 0 |
| road-to-host-claims-the-tree-contradicts-carried.md | 0 | 1 |
| road-to-learning-you-can-see-carried.md | 0 | 0 |
| road-to-touched-files-that-pass-their-own-tools-carried.md | 0 | 0 |

Seven of seven pass the hard contract; one entry would add to the
decidability ratchet. The anthropic seat's condition for (b) is met.

## Verdict

**Split — no option named by both seats.** (a) is rejected 2/2. Between (b)
and keeping the exclusion the seats disagree, and a split is an escalation
condition under the decision-revisit gate, not a council decision. The blocker
therefore moves to the owner; it is not resolved, and step 2.1 and AC-2 stay
open.

The report-only observability the openai seat asked for exists:
`./scripts-run src/scripts/report_parked_blockers` (Phase 1).

**Revisit if** a parked roadmap's trigger fires and it stays parked because a
blocker was invisible, or the carried files gain an explicit
active-deferred-obligation contract.
