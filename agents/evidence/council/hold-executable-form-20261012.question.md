<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-12, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# The hold D11 selected has a precondition this repository does not satisfy — what is its executable form?

You are deciding one question for the roadmap
`agents/roadmaps/road-to-authority-routing-mechanism.md`, blocker
`external-bootstrap-boundary-for-phases-2-3`. Answer on the evidence below.
Do not summarise the evidence back.

## What was already decided, and is NOT being reopened

On 2026-10-10 a council round (2/2 present, blind peer review) decided step
1.1. Recorded as D11:

> the hold is **(c)**: a forge-side approval administered by a separately
> authorised principal, outside the candidate branch, required before the
> first Phase 2 authority-expanding merge and covering Phase 3.

Its own record says, under "What this does NOT decide":

> Who configures the external control. The council named the shape … The act
> of turning it on is not the agent's.

D7 (owner, 2026-10-08) chose the identity mechanism:

> option (c) — the approver registry binds to a GitHub required-reviewer
> account or team, declared through the existing
> `src/config/platform-anchor.json` layer. No signing key and no app secret is
> created, so no credential sits where an agent could reach it; the forge holds
> and authenticates the identity.

**The SHAPE is not the question.** You are not asked whether a forge-side
approval outside the candidate branch is the right hold. That is decided. You
are asked what its executable form is, given a measurement neither D11 nor D7
had in front of them.

## The measurement, taken 2026-10-12 against the live forge

All values read from the GitHub API on the date above, not recalled:

1. **The ruleset.** One active branch ruleset (`17749383`, "main protection"),
   targeting `~DEFAULT_BRANCH`. Its `pull_request` rule reads:
   `required_approving_review_count: 0`, `require_code_owner_review: false`,
   `required_reviewers: []`, `dismiss_stale_reviews_on_push: true`,
   `required_review_thread_resolution: true`. `bypass_actors: []`.

2. **The collaborators.** Five accounts hold write or better:
   `matze4u` (admin — the owner, and the party that proposes and merges this
   work), `h3xa2` (maintain), `phpjob`, `0sama`, `php-jesus` (write).

3. **The only org team** reachable for this repository, `event4u-app/galawork`,
   has exactly **one** member: `matze4u`.

4. **CODEOWNERS.** `.github/CODEOWNERS` exists and maps every path to
   `@matze4u`, via a default `*` rule plus explicit sensitive-surface rules.
   None of the four Phase 2–3 files the blocker names
   (`docs/contracts/ratification-artifact.md`,
   `src/scripts/check_kernel_edit_ratified.ts`,
   `src/scripts/_lib/ratification_artifact.ts`,
   `src/config/platform-anchor.json`) has an owner other than `@matze4u`.

5. **`agent-config doctor --online --json` → `forge_protection`** reports five
   rows (`default_branch_protected`, `required_checks_present`,
   `force_push_disabled`, `auto_merge_available`, `deploy_via_pipeline_only`),
   all `satisfied`. **There is no row of any kind about required reviewers or
   about path-scoped approval.** The blocker's own `Resolved when` says it is
   resolved when *"`agent-config doctor --online --json` reports that identity
   under `forge_protection` for the Phase 2–3 paths"* — a condition the probe it
   names cannot express today, in either direction.

6. **A prior owner ruling on exactly this dimension.**
   `src/config/platform-anchor.json`, field `owner_ruling_2026_09_10`,
   quoting the owner in substance:

   > "I reset the settings deliberately. I am the only maintainer, or the main
   > one. There are others, but they are rarely active. That is why this would
   > be a blocker."

   and the package's own reading of it, committed in the same file:

   > So a mandatory approving review is not a control on this repository, it is
   > a stop. … `minimum_approving_reviews` and `require_last_push_approval` are
   > gone from this file AND from `NON_NEGOTIABLE_FLOOR`, and they are NOT
   > exemptions — a dimension outside the trust model is not a waived rule.

   The same field names what the owner's own act IS taken to be:

   > The distinguishable event is the owner's own review and merge of a
   > conspicuously labelled trust-model change — not an agent's transcription
   > of a chat message, and not a council record, which is evidence and never
   > authorization.

## The consequence, stated so you can refute it

On GitHub, an author cannot approve their own pull request. Every identity
CODEOWNERS can route a Phase 2–3 path to is `@matze4u`, who is also the only
active proposer. So enabling `require_code_owner_review` (or a
`required_reviewers` entry naming the one-member team) on those paths makes
that surface unmergeable by the only party who works on it — a stop, which is
the precise thing the 2026-09-10 owner ruling removed from this repository's
trust model for the repository-wide case.

The narrowing that might survive it: D11's hold is **path-scoped** (four files
plus the ruleset configuration), not repository-wide, so it is not
word-for-word the dimension the owner removed. Whether that narrowing rescues
it is part of what you are deciding.

## The options

**(a) Dormant-but-declared.** The requirement is declared now — the Phase 2–3
paths are named in a committed policy field, and a verifier reads the live
forge and reports whether a second approver identity covers them — and it
stays `unsatisfied` until a second active identity exists. Phases 2–3 stay
blocked. Nothing is turned on that would stop the owner.

**(b) Bootstrap through the owner's own recorded act.** D3 already reserves
break-glass to the owner, exercised as the owner's own forge bypass, recording
reason, subject digest, time and commit, with a mandatory after-the-fact
council review. Read D11's "separately authorised principal" as satisfied, for
the bootstrap only, by the owner acting in that recorded capacity — the
"distinguishable event" the 2026-09-10 ruling already names — so Phases 2–3
may proceed under a recorded owner act rather than a second human.

**(c) A non-human second principal.** Introduce an identity that is not the
owner and not an agent — a GitHub App or bot account held outside the
repository — as the required reviewer. Note before answering that D7
explicitly chose an option under which *"no signing key and no app secret is
created"*; an App has a secret somewhere.

**(d) Recruit a second human.** One of the four existing write/maintain
collaborators is added to CODEOWNERS for the Phase 2–3 paths and the ruleset
requires their review. The owner has stated they are rarely active.

**(e) Something none of the above names.**

## What would make each option WRONG

State which of these you believe applies, and to which option, rather than
only naming a preference.

- **(a) is wrong if** a declared-but-unsatisfiable requirement is
  indistinguishable from no requirement, so that the package ships a control
  that reads as governance and enforces nothing — and the roadmap stays
  permanently unstartable, which is a cost without a corresponding guarantee.
- **(b) is wrong if** the owner approving the owner's own authority-expanding
  change is the exact circularity the parent record's dealbreaker names, and
  calling it "break-glass" relabels the circularity rather than breaking it.
  The dealbreaker is: *"the enforcement code must not be ratifiable through the
  same process it enforces."*
- **(c) is wrong if** an App or bot whose credential the owner (or anything the
  owner can reach) holds is not a separate principal in any sense that
  survives the threat model, so it buys a ceremony and not a boundary; or if
  it contradicts D7, which is an owner decision.
- **(d) is wrong if** a reviewer who is rarely available converts a hold into
  an unbounded stall, which is operationally the same as (a) while also
  appearing to be satisfied.
- **(e) is wrong if** it requires a capability this repository is not measured
  to have.

## Two moves this question forbids by name

1. **Do not reach for "the owner decides" because the subject is governance.**
   The owner has already decided twice here (D3, D7) and ruled once on the
   availability fact (2026-09-10). What is in front of you is the gap between
   those decisions and a measurement, which is a mechanism question. Say
   explicitly if you nonetheless conclude the gap is owner-reserved, and name
   which reserved dimension it touches.
2. **Do not pick (b) because it is the option that lets work continue.** An
   option's unblocking effect is not an argument for it. If (b) is right it is
   right on the dealbreaker, not on throughput.

## What to answer

1. Which option, and the wrongness conditions you believe do and do not apply.
2. Whether the path-scoped narrowing rescues the requirement from the
   2026-09-10 owner ruling, or does not.
3. Whether the blocker's `Resolved when` should be rewritten, given that the
   probe it names has no row that could answer it — and if so, what the
   agent-side half (a readable, forge-read verification) must report for the
   condition to be checkable under the option you chose.
4. Your confidence, and the single piece of evidence that would move you.
