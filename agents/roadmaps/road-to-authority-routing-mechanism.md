---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-self-modification-that-a-council-must-pass
    relation: extends
    note: "open PR #2251 / ADR-281 narrows who may ratify a change to the gated self-modification surface; this roadmap generalises the same verifier, registry and verdict-vocabulary questions to the full dangerous-action test the council record defines, and hardens the existing docs/contracts/ratification-artifact.md mechanism rather than replacing it. No file this roadmap's phases touch is owned by that PR."
estate_offset_exempt: "No active roadmap could be archived, parked, or merged to offset this addition: archiving an open roadmap to make room was rejected because none of the 14 active roadmaps covers authority-routing, dangerous-action classification, or the ratification-artifact hardening this plan executes; parking an unrelated roadmap in later/ to offset a net-new scope was rejected because that would misrepresent a roadmap that is not blocked as blocked; and merging into the nearest neighbour (road-to-self-modification-that-a-council-must-pass) was rejected because that roadmap is scoped to the gated self-modification surface only, not the general six-predicate dangerous-action test this one carries."
estate_growth_exempt: "+1 open_blockers for `external-bootstrap-boundary-for-phases-2-3`. Opened 2026-10-10 by the step 1.1 council verdict, which selected neither of the two hold shapes the step anticipated: both seats rejected a doc-only sentence as a description rather than a hold, and a candidate-branch CI check as ceremony inside the write boundary the parent record's dealbreaker names. What they selected is a forge-side approval outside the candidate branch, and turning that on is an owner act under D3, so the blocker could not be avoided by writing code instead of asking. It closes no box and changes no behaviour; it makes step 1.2 read as blocked to run-continuation, which decides open-vs-blocked from the inline marker alone. The prior claim this replaces was spent on the eight blockers the authority-routing record itself required."
---

# Road to a routed authority — who may authorise what, and how it is checked

> Every dangerous-action authorisation this package's enforcement surface
> makes is routed to the authority the council record names — agent, council,
> or owner — and the verifier that checks it cannot ratify its own expansion.

## Goal

A passing authorisation record always means the authority that produced it was
the authority entitled to produce it: three authorities that are today
collapsed into one `verdict` field (technical review outcome, authority
classification, authorisation to proceed) are separated; the six-predicate
dangerous-action test and the agent/council/owner routing table from the
authority-routing council record are committed as a contract; the verifier
that checks a passing record is not itself ratifiable through the process it
enforces; and the six defects the record's own drain run surfaced each have a
disposition — fixed, council-decided-and-recorded, or a structured blocker
addressed to the owner.

## Prerequisites

- [x] Read `agents/evidence/council/authority-routing-20261007.md` in full —
      it is the specification this roadmap executes, not a reference to
      summarise from memory.
      **Done 2026-10-10**, whole file, not a summary: the owner's frame, the
      six-predicate test, the council-substitution conditions, the dealbreaker
      as given, the three collapsed authorities, the six-defect disposition
      table, the required sequencing and the break-glass section. Two steps
      that session cited it from the read rather than from memory — 1.1's
      council question quoted its sequencing item 1 and its dealbreaker
      verbatim, and 3.1 closed on its § 2 exclusion of commit-author metadata.
- [x] Read `docs/contracts/ratification-artifact.md` — the existing,
      already-shipped mechanism (verdict vocabulary, `seats:` field, provider
      diversity, platform-anchor trust layer, emergency-use procedure) this
      roadmap generalises and hardens. No phase below re-invents a verdict
      vocabulary, a provider-diversity check, or an emergency procedure the
      contract already has; each phase amends or extends it.
      **Done 2026-10-10**, all five named surfaces read: the six required
      frontmatter fields and the closed four-value verdict vocabulary; the
      `seats:` map with its derived-header check and its honest limit (the
      entries are the author's, and gitignored council responses mean no runner
      can check them); provider diversity failing closed on
      `ratification-policy.json`, which is itself gated; the three trust layers
      and the bootstrap exception that is sound exactly once; and the
      emergency-use procedure with its ADR-281 § 5 carve-out. **One thing the
      read changed:** § When the user decides condition 4 turned out to name
      this roadmap's own Phase 2 almost word for word, which is what step 1.1's
      council question was built on.
- [x] Confirm `agent-config council:status` reports a configured, two-provider
      council before executing any "run the council" step below —
      **Done 2026-10-10, BEFORE the first round rather than after it:**
      `CONFIGURED`, resolved from user-global
      `~/.event4u/agent-config/settings/.ai-council.yml`, 2 enabled members
      (anthropic, openai), transport `cli · subscription`. Both rounds run that
      day concluded 2/2 at $0.00. —
      [`council-availability`](../../src/rules/council-availability.md).

## Context

- `agents/evidence/council/authority-routing-20261007.md` — ratified, 2/2
  providers, no refusal (2026-10-07). It operationalises the owner's frame
  (take work off the user; destructive or dangerous → user; everything else →
  agent; doubt → council first, user only on genuine doubt or refusal)
  against six defects a drain run surfaced, and names a dealbreaker: the
  ratification record for a self-modifying change sits inside the same write
  boundary as the change it governs, and the host's `[Self-Modification]`
  classifier is "neither a portable control nor part of the repository's
  declared trust model."
- `docs/contracts/ratification-artifact.md` is the live mechanism the record's
  critique is actually about: its `verdict` field (`ratified` ·
  `confirmed-non-expanding` · `refused` · `non-convergent`) is exactly the
  "three authorities collapsed into one field" the record names, and its
  `check_kernel_edit_ratified.ts` / `_lib/ratification_artifact.ts` /
  `platform-anchor.json` stack is the "protected verifier" candidate Phase 3
  below hardens rather than builds from nothing.
- `road-to-self-modification-that-a-council-must-pass` (open PR #2251, ADR-281
  pending) narrows who may ratify a change to the **gated self-modification
  surface only** — the council becomes the lowest rung for that one surface.
  It does not touch the general dangerous-action test, the review-instance
  model, the approver registry, or the artifact-classification question
  (defect 3) this roadmap carries. Its merge may change the exact wording
  `ratification-artifact.md § The ratification ladder` carries by the time
  Phase 1 runs — re-read the contract at execution time, not this file's
  quoted text.

## Constraints carried from the record — read before any phase

These four points are the record's own structural findings. They are
preconditions, not optional context, and a later session must not
re-derive or re-litigate them without the evidence that would justify it
(per [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md)):

1. **The collapsed verdict field is a precondition, not a refinement.**
   `verdict` conflates the technical review outcome, the authority
   classification, and the authorisation to proceed. Phase 2 separates them
   before any later phase depends on the distinction.
2. **`refused` cannot yet express three different things.** Correctable
   objection, non-convergence, and a request for user authority are collapsed
   into one state. Phase 2 extends the vocabulary before Phase 6's
   remediation loop (record § 6) can be implemented against it.
3. **The enforcement code must not be ratifiable through the process it
   enforces.** Phase 3 resolves this with exactly one of: a protected subset
   needing higher approval, external verification, or an honest
   `instruction-only` label — never silence.
4. **Break-glass must stop, never fail open**, under the six conditions the
   record names (§ Break-glass). Phase 8's activation step is gated on this
   before the verifier may block anything.

## Phase 1 — Hold, or bootstrap-approve, before the vocabulary lands

*Record, required sequencing, item 1: "Hold authority-expanding constitutional
merges, or require an external bootstrap approval."*

- [x] **1.1 Run the council on the hold's mechanical form.** Does declaring,
      in `docs/contracts/ratification-artifact.md`, that every gated-surface
      commit made by Phases 2–3 below lands through the EXISTING, unchanged
      ladder (ADR-268 § 4, narrowed for the self-modification surface by
      ADR-281 § 2 where it applies) — no new bypass, no new exemption —
      satisfy this record item? Or does the scope of Phase 2's verdict-field
      split require a stronger, separate hold (e.g. a temporary CI check
      scoped to the files Phases 2–3 will touch)? Record the verdict as a
      `## Decisions` row in this file.
      verify: `grep -c '^## Decisions' agents/roadmaps/road-to-authority-routing-mechanism.md` -> /^1$/
- [ ] <!-- blocked-by: external-bootstrap-boundary-for-phases-2-3 | asked: no — discovered mid-drain under `/roadmap:process-full --all`; turning on a forge-side protection is an owner act the run may not perform, and it is put to the owner in that run's end report rather than halting the queue --> **1.2 Implement whichever hold 1.1 selects**, before Phase 2.3 (the
      verdict-field split) lands its first commit. **1.1 selected neither of the
      two shapes this step anticipated.** Both seats rejected a doc-only sentence
      as a description rather than a hold, and a candidate-branch CI check as
      ceremony inside the write boundary the record's dealbreaker names. The
      selected hold is a forge-side approval administered outside the candidate
      branch — the mechanism D7 already chose — and turning it on is an owner
      act, not an agent one: a protection an agent can add is one an agent can
      remove, and both seats required the protection configuration itself to stay
      subject to the higher approval.

*Exit: 1.1 is recorded and 1.2's hold is in place (doc sentence or CI check,
whichever 1.1 chose) before any Phase 2 commit lands. Rollback: revert 1.2;
the existing ADR-268/ADR-281 ladder is unchanged and still governs every
gated-surface commit, so reverting loses nothing already relied upon.*

## Phase 2 — The vocabulary: predicates, review instances, the three-way verdict

*Record, required sequencing, item 2.*

- [ ] <!-- blocked-by: external-bootstrap-boundary-for-phases-2-3 | asked: no — the owner-reserved question is already registered on this roadmap and goes to the owner in the drain run's end report; these markers record which steps share its gate and ask nothing new. RE-SCREENED 2026-10-13 against the live forge, not against this marker: the gate still binds, and D16 now records WHY it is not merely unturned-on but unsatisfiable today — the separately authorised principal it requires does not exist on this repository --> **2.1 Run the council on the committed-contract question.**
      **Round run 2026-10-10 — SPLIT 1/1, which escalates (D13).** anthropic picked
      (b) conditional on the forge blocker being resolvable; openai picked (a) with an
      atomic watch-list entry. The convergent half is recorded and binding; the
      location is not re-run, because a second round against the same evidence is
      verdict shopping and the evidence that would move either seat does not exist
      today. Record:
      `agents/evidence/council/dangerous-action-predicates-home-20261010.md`. Where does
      the six-predicate dangerous-action test (record § 4) live — a new
      `docs/contracts/dangerous-action-predicates.md`, or a section appended
      to `docs/contracts/ratification-artifact.md`? Record the verdict as a
      `## Decisions` row.
- [ ] <!-- blocked-by: external-bootstrap-boundary-for-phases-2-3 | asked: no — the owner-reserved question is already registered on this roadmap and goes to the owner in the drain run's end report; these markers record which steps share its gate and ask nothing new. RE-SCREENED 2026-10-13 against the live forge, not against this marker: the gate still binds, and D16 now records WHY it is not merely unturned-on but unsatisfiable today — the separately authorised principal it requires does not exist on this repository --> **2.2 Commit the six-predicate test verbatim**, at the location 2.1
      chose, with the "uncertainty routes to council, a council finding a
      predicate applies routes authorisation to the user" rule (record § 4)
      stated beside it.
      verify: `grep -rc 'Non-trivial loss, disclosure, expenditure' docs/contracts/` -> /^[1-9]/
- [ ] <!-- blocked-by: external-bootstrap-boundary-for-phases-2-3 | asked: no — the owner-reserved question is already registered on this roadmap and goes to the owner in the drain run's end report; these markers record which steps share its gate and ask nothing new. RE-SCREENED 2026-10-13 against the live forge, not against this marker: the gate still binds, and D16 now records WHY it is not merely unturned-on but unsatisfiable today — the separately authorised principal it requires does not exist on this repository --> **2.3 Separate the collapsed verdict into three fields** in the same
      contract: `technical_outcome` (did the proposed change do what it
      claims), `authority_class` (dangerous / non-dangerous, per 2.2's test),
      `authorisation` (may it proceed — only ever set by the authority 2.2
      routes to). Every existing `verdict:` consumer
      (`check_kernel_edit_ratified.ts`, `_lib/ratification_artifact.ts`) is
      listed with whether it reads the old field, the new fields, or both
      during migration — this step documents the mapping, it does not change
      the consumers.
      verify: `grep -c 'authority_class' docs/contracts/ratification-artifact.md` -> /^[1-9]/
- [ ] <!-- blocked-by: external-bootstrap-boundary-for-phases-2-3 | asked: no — the owner-reserved question is already registered on this roadmap and goes to the owner in the drain run's end report; these markers record which steps share its gate and ask nothing new. RE-SCREENED 2026-10-13 against the live forge, not against this marker: the gate still binds, and D16 now records WHY it is not merely unturned-on but unsatisfiable today — the separately authorised principal it requires does not exist on this repository --> **2.4 Extend the `refused` vocabulary** to distinguish
      `refused-correctable` (names a concrete in-scope defect or asks for
      obtainable evidence — record § 6, "the agent remediates and
      re-submits"), `refused-non-convergent` (the existing `non-convergent`
      state), and `refused-escalate` (compliance would require a dangerous
      action, expanded authority, or user-owned intent — record § 6's
      escalation list). Each review-instance revision that remediates a
      `refused-correctable` retains the prior objection and shows its
      disposition (record § 6).
      verify: `grep -c 'refused-correctable' docs/contracts/ratification-artifact.md` -> /^[1-9]/
- [ ] <!-- blocked-by: external-bootstrap-boundary-for-phases-2-3 | asked: no — the owner-reserved question is already registered on this roadmap and goes to the owner in the drain run's end report; these markers record which steps share its gate and ask nothing new. RE-SCREENED 2026-10-13 against the live forge, not against this marker: the gate still binds, and D16 now records WHY it is not merely unturned-on but unsatisfiable today — the separately authorised principal it requires does not exist on this repository --> **2.5 Define the review-instance model**: a stable identity across
      revisions of the same proposal, carrying its full history of prior
      objections and dispositions, so a remediation is provably the same
      review continuing rather than a fresh one laundering a prior refusal.
      verify: `grep -c 'review.instance' docs/contracts/ratification-artifact.md` -> /^[1-9]/

*Exit: 2.2–2.5 are committed and `check_references` is clean against the new
contract paths. Rollback: revert the contract commit(s) — nothing downstream
depends on them yet, because no consumer is wired until Phase 3.*

## Phase 3 — The approver registry and the protected verifier

> **Note, 2026-10-15** — `road-to-a-danger-gate-that-sees-what-governs`
> Phase 1 now hands every pull request touching the gated surface, the
> reviewer's trust chain or an owner-reserved ADR to the owner (`needs-owner`)
> instead of letting a council clearance merge it, because the amended ADR-281
> makes that clearance advisory until an authenticated owner authorisation is
> bound to the digest. The authorisation this phase builds is what may later
> let such a change route `needs-council` again (that roadmap's decision D2).

*Record, required sequencing, item 3. The seven owner-reserved blockers below
(`credential-custody-for-approver-registry` through
`refusal-finality-policy`) gate specific steps in this phase — read their
`Blocks:` fields before assuming 3.2 can ship a working registry rather than
a stub.*

- [x] **3.1 Run the council on the approver-registry identity mechanism**,
      **Closed 2026-10-10 without a round: D7 already answers it.** The owner
      chose on 2026-10-08, via `/roadmap:resolve-blockers`, exactly one of the two
      candidates this step names — binding to the existing platform-anchor layer,
      as a GitHub required-reviewer account or team declared through
      `src/config/platform-anchor.json`, so no credential sits where an agent
      could reach it. Running a council on a question the owner has decided would
      re-litigate an owner call, which `decision-revisit-gate`'s owner-reserved
      table forbids. The excluded candidates stay excluded: commit author metadata
      and a `~/.gitconfig` comparison were rejected by the record and are not
      reopened here. Original text:
      explicitly excluding commit author/committer metadata and a
      `~/.gitconfig` comparison (record § 2 — "an agent able to run Git can
      generally set those values"). Candidates to evaluate: a signed
      attestation bound to {repository, review-instance id, subject digest,
      base revision, verdict, policy version, approver identity, timestamp,
      prior-refusal references}; or binding to the existing platform-anchor
      layer (`check_platform_anchor`, `src/config/platform-anchor.json`) that
      `ratification-artifact.md` already trusts for branch integrity. Record
      the verdict as a `## Decisions` row.
- [ ] <!-- blocked-by: external-bootstrap-boundary-for-phases-2-3 | asked: no — the owner-reserved question is already registered on this roadmap and goes to the owner in the drain run's end report; these markers record which steps share its gate and ask nothing new. RE-SCREENED 2026-10-13 against the live forge, not against this marker: the gate still binds, and D16 now records WHY it is not merely unturned-on but unsatisfiable today — the separately authorised principal it requires does not exist on this repository --> **3.2 Implement the registry** per 3.1's verdict, as an additive layer
      beside the existing platform-anchor trust stack — never a replacement
      for it without its own ratification (the contract's own rule: "a later
      change that removes the deny needs its own ratification and cannot cite
      this one").
      verify: `test -f src/config/approver-registry.json` -> 0
- [ ] <!-- blocked-by: external-bootstrap-boundary-for-phases-2-3 | asked: no — the owner-reserved question is already registered on this roadmap and goes to the owner in the drain run's end report; these markers record which steps share its gate and ask nothing new. RE-SCREENED 2026-10-13 against the live forge, not against this marker: the gate still binds, and D16 now records WHY it is not merely unturned-on but unsatisfiable today — the separately authorised principal it requires does not exist on this repository --> **3.3 Build the verifier** that checks a ratification record's bound
      attestation against the registry from 3.2, read from the BASE revision
      only — mirroring `check_kernel_edit_ratified.ts`'s existing defence
      against a candidate diff supplying the code that judges it.
      verify: `npx vitest run tests/scripts/check_approver_registry.test.ts` -> 0
- [ ] <!-- blocked-by: external-bootstrap-boundary-for-phases-2-3 | asked: no — the owner-reserved question is already registered on this roadmap and goes to the owner in the drain run's end report; these markers record which steps share its gate and ask nothing new. RE-SCREENED 2026-10-13 against the live forge, not against this marker: the gate still binds, and D16 now records WHY it is not merely unturned-on but unsatisfiable today — the separately authorised principal it requires does not exist on this repository --> **3.4 Close the dealbreaker.** Choose exactly one, and record which:
      (a) the verifier and registry from 3.2–3.3 sit in a protected subset of
      the gated surface, needing the higher approval 2.1/3.1's council work
      defines; (b) they are externally verified (a mechanism outside this
      repository's own write boundary); or (c) their current guarantee is
      honestly labelled `instruction-only` in `ratification-artifact.md`
      until (a) or (b) is true. **(c) is the only answer that may ship without
      further implementation** — it is a documentation change, never a
      silent gap.
      verify: `grep -c 'the enforcement code must not be ratifiable' docs/contracts/ratification-artifact.md` -> /^[1-9]/

*Exit: 3.4 is recorded and, if (a) or (b) was chosen, 3.2–3.3 pass their
tests against a fixture registry. Rollback: the verifier ships inert — Phase 8
is what activates it — so reverting 3.2–3.4 removes dead code, nothing live.*

## Phase 4 — Cross-file blocker semantics, before broadening blocker detection

*Record, required sequencing, item 4. Disposition: defect 2 (council)
sequenced before defect 1 (agent) — "fixing defect 1 first turns hidden
markers into illegal ones."*

- [x] **4.1 Run the council on cross-file blocker-id semantics.** What legal
      states can a blocker id referenced from a file other than the roadmap
      that declared it have — unresolved-local-only, resolved-elsewhere,
      orphaned, superseded? `lint_roadmap_blockers` has no notion of this
      today. Record the verdict as a `## Decisions` row.
- [x] **4.2 Encode the chosen semantics** in `lint_roadmap_blockers` (or the
      contract it reads, `templates/roadmaps.md` rule 20), with a regression
      test for each new legal state.
      verify: `npx vitest run tests/scripts/lint_roadmap_blockers.test.ts` -> 0
- [x] **4.3 Fix the vacuous-clean report** (record defect 1 — agent-owned,
      sequenced here per the record): `lint_roadmap_blockers` reports clean
      over input it is not actually checking. Add a regression test using a
      previously-invisible-but-now-illegal marker from 4.2's new semantics,
      proven red before the fix lands.
      verify: `npx vitest run tests/scripts/lint_roadmap_blockers.test.ts` -> 0

*Exit: 4.2 and 4.3 are green and `lint_roadmap_blockers`'s self-test case
count has grown by at least the number of new legal states from 4.1.
Rollback: revert 4.2–4.3; the vacuous-clean report returns but nothing else
regresses, since no consumer depends on the new semantics yet.*

## Phase 5 — Artifact-classification semantics, before removing the accidental comments

*Record, required sequencing, item 5. Disposition: defect 3 — agent owns the
documentation half (shipped separately from this roadmap, see "Companion
change" below); council owns the contract question this phase carries.*

- [x] **5.1 Run the council on the contract question**: should the
      `*.review-input/roadmap.md` snapshots' positional exemption from
      `check_agent_artifact_location` (currently an accidental side effect of
      `check-refs`'s two-line skip header pushing the frontmatter fence off
      byte offset 0 — see `REVIEW_INPUT_ROADMAP_HEADER` in
      `dispatch_r2_reviewer.ts` and the `FM_RE` docstring in
      `check_agent_artifact_location.ts`) become a DECLARED convention
      (an explicit allowlist, a dedicated marker the gate reads on purpose) —
      or is the documented accident, with its regression test, a sufficient
      discharge on its own? Record the verdict as a `## Decisions` row.
- [x] **5.2 Implement the council's chosen mechanism** before any future
      change removes or reorders the two-line header — never the reverse
      order.
      verify: `npx vitest run tests/scripts/check_agent_artifact_location.test.ts` -> 0

*Exit: 5.1 recorded; 5.2 implemented only if the verdict required code
(a documented-accident verdict closes this phase with 5.1 alone). Rollback:
revert 5.2; the accidental exemption and its regression test (committed in
the companion change below) continue to hold either way.*

**Companion change (already shipped, outside this roadmap's execution):** the
positional dependency is documented at both ends
(`check_agent_artifact_location.ts`'s `FM_RE` docstring,
`dispatch_r2_reviewer.ts`'s `REVIEW_INPUT_ROADMAP_HEADER` constant) and
regression-tested in `tests/scripts/check_agent_artifact_location.test.ts`
(describe: "review-input snapshot convention — the positional dependency this
gate incidentally relies on"). That change is the agent-routed documentation
half of defect 3; it does not decide 5.1's contract question. Superseded by
5.2 (D2): the exemption is now declared by path, and both docstrings and the
describe block were rewritten to say so.

## Phase 6 — Stable review instances and merge serialisation, before completion review relies on them

*Record, required sequencing, item 6. Disposition: defect 4 (council) — "review
hashing without serialisation still reviews a head that is no longer the
merge candidate."*

- [x] **6.1 Run the council on the merge-serialisation mechanism** for
      `check_completion_review.ts` / `dispatch_r2_reviewer.ts`'s review-scope
      hash: how does a review instance (Phase 2.5) stay bound to the actual
      merge candidate across a same-day re-review, given concurrent
      in-flight branches (including `road-to-self-modification-that-a-council
      -must-pass`, which touches adjacent files)? Record the verdict.
      **Done 2026-10-10 — convergent, recorded as D15.** The predicate is a
      TARGET-ENTRY FINGERPRINT over the touched files: the attempt records each
      touched file's blob hash ON THE TARGET at review time, and a CI-side check
      re-reads them at merge time. Any differs -> stale, a new attempt under the
      same instance; all match -> valid even though the target advanced
      elsewhere. That is precisely the separation the three-dot scope hash
      cannot make on its own. First-valid-wins ordering, no owner decision in
      the common path, and the check never runs as the agent — the party gaining
      the merge does not attest that its own review still binds. Record:
      `agents/evidence/council/merge-serialisation-20261010.md`.
      **The verdict is recorded and the box is NOT ticked, and the reason is a
      second instance of the defect this very step is about.**
      `lint_plan_risk_register` marks a plan stale when its `reviewed:` stamp
      "predates the last substantial change", and the baseline it compares
      against is the commit that INTRODUCED the current stamp value. The stamp
      already reads `2026-10-10` — set earlier today by the Phase 7 change — so
      a second substantive change on the same date cannot be re-stamped: the
      grammar is date-only (`\d{4}-\d{2}-\d{2}`), `reviewer` is not part of the
      comparison, and moving the date forward would be back-dating into the
      future. Measured, not inferred: reverting ONLY the two checkbox flips and
      keeping every note and decision turns the gate green, so it is closing a
      step — not recording a verdict — that it forbids.
      **The gate was deliberately NOT patched.** The obvious fix, treating a
      same-day stamp as fresh, cannot tell a re-reviewed same-day change from an
      un-reviewed one — which is the silent weakening this roadmap exists to
      prevent, and exactly what review-instance identity (2.5) plus 6.3 are for.
      So this is a THIRD data point for defect 4, in a sibling gate:
      `check_completion_review` cannot express a same-day re-review, and neither
      can `lint_plan_risk_register`. The box ticks on the next calendar day, or
      when 6.3 ships identity.
      **Ticked 2026-10-12 on the first of those two conditions — the calendar,
      not a fix.** The stamp moved from `2026-10-10` to `2026-10-12` because
      two days passed, so the gate can tell this re-review from the one it
      already had. Defect 4 is UNCHANGED by that: `check_completion_review` and
      `lint_plan_risk_register` still cannot express a same-day re-review, and
      6.3 is still the step that closes it. Reading this box as evidence the
      defect is handled would be exactly the silent weakening the step refused
      to patch into the gate.
- [ ] <!-- blocked-by: external-bootstrap-boundary-for-phases-2-3 | asked: no — the owner-reserved question is already registered on this roadmap and goes to the owner in the drain run's end report; this marker records which step it shares its gate with and asks nothing new. RE-SCREENED 2026-10-13 against the live forge, not against this marker: the gate still binds, and D16 now records WHY it is not merely unturned-on but unsatisfiable today — the separately authorised principal it requires does not exist on this repository --> **6.2 Implement stable review-instance identity** (Phase 2.5's model,
      now wired) and the chosen serialisation mechanism from 6.1.
      verify: `npx vitest run tests/scripts/check_completion_review.test.ts` -> 0
- [ ] <!-- blocked-by: external-bootstrap-boundary-for-phases-2-3 | asked: no — the owner-reserved question is already registered on this roadmap and goes to the owner in the drain run's end report; this marker records which step it shares its gate with and asks nothing new. RE-SCREENED 2026-10-13 against the live forge, not against this marker: the gate still binds, and D16 now records WHY it is not merely unturned-on but unsatisfiable today — the separately authorised principal it requires does not exist on this repository --> **6.3 Wire `check_completion_review` to express a same-day re-review**
      (record defect 4) using 6.2's review-instance identity and 2.4's
      extended `refused` vocabulary — never by widening what counts as "the
      same review" without the identity check.
      verify: `npx vitest run tests/scripts/check_completion_review.test.ts` -> 0

*Exit: 6.2–6.3 pass against a fixture series of same-day revisions. Rollback:
revert 6.2–6.3; `check_completion_review` keeps its current (defect-4-bearing)
behaviour, which is the status quo, not a regression.*

## Phase 7 — Classify live-tree checks before restoring them as required gates

*Record, required sequencing, item 7. Disposition: defect 6 (council) —
"whether these are invariants, snapshots, tolerances or observations changes
what the gate attests."*

- [ ] **7.1 Run the council to classify each live-tree measurement check**
      **Round run 2026-10-10 — 13 of 16 classified identically by both seats,
      3 honest abstentions, and BOTH SEATS WITHHOLD GREENLIGHT on the step. It
      therefore stays open.** The population was measured rather than recalled:
      every `check_*`/`lint_*` run against a clean `origin/main` worktree, the
      first sweep DISCARDED (macOS ships no `timeout(1)`, so exit 127 on all
      ~300 meant nothing had run), two controls used to prove the harness, then
      the projections built — which moved three checks green and identified them
      as worktree artefacts. Ten more were excluded as called-wrong (a usage
      line) and eight as build-order reds. **16 are genuinely red on the trunk.**
      Verdict: **1 governed snapshot** (`check_gate_completeness`, 237 against a
      baseline of 214), **12 invariants**, **3 unclassified**
      (`check_council_layout`, `check_knowledge_cards`, `check_composite_arming`),
      **zero tolerances and zero observations** — a tolerance needs a stated
      bound AND a named party accepting the risk, and none has either.
      **Why it does not close:** both seats refuse to let a check's semantics be
      derived from its observed failure, because that grants the classifier
      discretion exactly when a red trunk creates pressure to weaken enforcement.
      They want a stable per-check contract first. Two findings neither was asked
      for: the step's own taxonomy contradicts the record (*"refresh clearly
      observational data"* vs observations being the NON-refreshable class), and
      classification is not gate membership — a decision this round did not take.
      Record: `agents/evidence/council/live-tree-check-classification-20261010.md`
      and its `.question.md`.
      **Screened 2026-10-12 and deliberately NOT re-run.** What the seats asked
      for is named in D14's own `revisit if`: a per-check contract registry from
      which class, prerequisites, gate membership and refresh authority derive
      mechanically. No such registry exists in the tree, so a second round would
      put the same question to the same seats with no new substance behind it —
      verdict shopping under `evaluator-independence`, not rigour. The registry
      is the work this step is actually waiting on, it is larger than a step of
      this phase, and it is named here rather than built so that the next run
      sees a stated prerequisite instead of an open box that looks runnable.
      **Re-screened 2026-10-13 against the tree, and the prerequisite is now
      LOCATED rather than merely absent.** `src/config/gate-coverage.yml` is a
      per-check registry that already exists and is already CI-enforced: 113
      rows keyed by script stem, each carrying `argv`, `min_scanned`, `corpus`,
      `status`, and optionally `ci_invocation` and `canary`. All four Phase 7
      checks the round named — `check_gate_completeness` and the three
      unclassified ones — resolve against it, and `check_gate_completeness`
      carries a row (`min_scanned: 180`, corpus stated, `status: enforced`).
      What it does NOT carry is the four fields D14's `revisit if` asks for:
      class, prerequisites, gate membership and refresh authority. So the
      prerequisite is not "build a registry from nothing" — it is **four fields
      on an existing one**, plus the honest denominator problem that file
      already states about itself: 113 of 354 gate scripts, 31.9 %, so a class
      field added there would classify under a third of the population and the
      round's own 16 would need the rest of the rows first. That is the shape of
      the work, and naming it is what this screen adds over the previous one.
      **Re-screened 2026-10-13 by running the greps rather than reading the
      screen above, and two of its claims do not hold (D21).** *"All four Phase 7
      checks the round named resolve against it"* is **one of four**:
      `check_gate_completeness` has a row at line 820, and
      `check_council_layout`, `check_knowledge_cards` and `check_composite_arming`
      — the three abstentions D14's `revisit if` names first — have none. Across
      all 16 checks the round classified, **2 have rows**, not 16. So the
      prerequisite is four new fields **and fourteen new rows**, which is a
      different size of job from the one the previous screen costed. **What the
      re-screen adds beyond the correction** is a test of the phrase the
      prerequisite actually turns on — `derive mechanically`. A registry in which
      an author types `class: invariant` is 354 assertions with a schema around
      them, and it reinstates the discretion both seats refused. One candidate
      derivation was measured and **refuted**: *reads a committed baseline ->
      snapshot* produced four counter-examples, and reading the hits rather than
      counting them left exactly two checks that read a committed baseline — one
      snapshot and one invariant. What survived is the repaired predicate: a
      baseline that can move in the **permissive** direction is a governed
      snapshot; no baseline, or a shrink-only one, is an invariant. It separates
      16 of 16 here, it was repaired after seeing its counter-examples so that is
      a fit rather than a prediction, and it derives ONE of D14's four fields.
      Measurement: `agents/evidence/analysis/gate-class-derivation-20261013.md`.
      **The predicate was then put to the council the same day, and BOTH SEATS
      PLUS THE CHAIRMAN WITHHELD GREENLIGHT AGAIN — the step stays open (D22).**
      The round defines a mechanism to satisfy D14's revisit condition; it does
      not satisfy it. The predicate is **not** an acceptable derivation: it
      reaches 2 of 4 classes, *"permissive"* is a semantic reading rather than a
      fact, and it was fitted after seeing its own counter-examples. The seats
      audited the asking agent's measurement before answering and found the
      overclaim named above; it was corrected to 13/16 in the same change. The
      four fields belong in a **separate `gate-classification.yml`**, because a
      `min_scanned` bump must not travel the same approval surface as
      `class: invariant -> snapshot`. The still-required list is in D22, and its
      order is load-bearing — schema, baseline contracts, all 16 registered,
      rollback criteria, and only then may a class change anything. Record:
      `agents/evidence/council/gate-contract-registry-shape-20261013.md`.
      **Re-measured 2026-10-17 on `6abb887d7`, still open (D23).** 9 of the 16
      are green now and 7 stay red. That includes two of the three abstentions,
      but a green says nothing about what a check means, so it resolves neither
      abstention. No item on D22's still-required list has landed. No council
      round was run, because the inputs D22 named have not changed.
      Measurement: `agents/evidence/analysis/live-tree-check-remeasure-20261017.md`.
      **Screened 2026-10-18 on `6194e2769`, still open, no round run.** AC-3
      does not put Phase 7 behind the blocked Phases 2, 3 or 6. Its only
      ordering clause is that Phase 7 must come before live-tree checks are
      restored as required gates. So the step is not held by
      `external-bootstrap-boundary-for-phases-2-3`. It is held by D22's ordered
      list, and the first item on that list has not landed:
      `git ls-files src/config | grep -c gate-classification` returns 0. That
      first item, the schema, cannot be written yet. It needs the TWO-objects
      taxonomy choice D22 left open (multi-valued class, aspect-level rows, or
      splitting the check), and that is a design question. No active or stub
      roadmap owns D22's list: `grep -rl gate-classification agents/roadmaps`
      matches only this file. Re-running 7.1 without it would be the verdict
      shopping the 2026-10-12 screen ruled out. 7.2 follows from 7.1, and its
      demotions weaken gates, so it does not start either.
      currently pinned red on the trunk: invariant (must always hold),
      snapshot (a point-in-time reading, refreshable), tolerance (a bounded
      range with an accepted-risk waiver, per `ratification-artifact.md`'s
      own `strict_required_status_checks` precedent), or observation
      (informational, never blocking). Record the verdict per check.
- [ ] **7.2 Implement the classification**: an invariant stays a required
      gate; a snapshot is refreshed by the agent per 7.1's rule, never
      silently; an observation is demoted to non-blocking. No check is
      silently weakened — a demotion is recorded with its reason, inline,
      per [`active-remediation`](../../src/rules/active-remediation.md).
      verify: `npx vitest run tests/scripts/check_persistence_classification.test.ts` -> 0

*Exit: every live-tree check pinned red at Phase 7 start carries a
classification in 7.1's record. Rollback: revert 7.2; checks stay in their
current (unclassified, red) state — no check gets silently un-demoted.*

## Phase 8 — Shadow-run the verifier, then activate it through bootstrap authorisation

*Record, required sequencing, item 8.*

- [ ] <!-- blocked-by: external-bootstrap-boundary-for-phases-2-3 | asked: no — the owner-reserved question is already registered on this roadmap and goes to the owner in the drain run's end report; this marker records which step it shares its gate with and asks nothing new. RE-SCREENED 2026-10-13 against the live forge, not against this marker: the gate still binds, and D16 now records WHY it is not merely unturned-on but unsatisfiable today — the separately authorised principal it requires does not exist on this repository --> **8.1 Shadow-run the Phase 3 verifier** against the last N merged PRs
      (N decided by the council in 8.2) without gating anything — collect a
      false-positive / false-negative report comparing its verdicts against
      what actually happened.
      verify: `test -f agents/evidence/analysis/authority-verifier-shadow-run.md` -> 0
      **Two defects in this step's own text, found 2026-10-13 by the 8.2 round
      and recorded in D18 rather than patched here.** FIRST, it is circular with
      8.2 as written: this step takes its N *"decided by the council in 8.2"*
      while 8.2 reads as an assessment of this step's report. The repaired order
      is D18's nine-step sequence — freeze the surface, define the label
      protocol, register the numbers, THEN run. SECOND, and sharper:
      *"comparing its verdicts against what actually happened"* treats merged-PR
      outcomes as ground truth, and they are observational and censored — a
      merged PR with no reported incident may carry a latent defect, a near-miss,
      or an issue another control caught. openai's hardest pushback of the round:
      *"Increasing N cannot cure systematically incorrect or censored labels; it
      merely produces a more precise measurement of the wrong thing."* The step
      needs an observation window, a reference-label protocol with indeterminate
      outcomes preserved, and independent adjudication before its report means
      anything. Rewriting the step text is held for the same same-day stamp
      reason recorded at 8.2.
- [ ] <!-- blocked-by: external-bootstrap-boundary-for-phases-2-3 | asked: no — the owner-reserved question is already registered on this roadmap; this marker records that the 2026-10-13 round added this step to the gate's reach, and asks nothing new --> **8.2 Run the council on the shadow-run's acceptance bar** — what
      false-positive / false-negative rate, over what N, justifies
      activation. Record the verdict.
      **Round run 2026-10-13 — convergent 2/2, and BOTH SEATS WITHHOLD
      GREENLIGHT on the step. It therefore stays open.** The step demands a
      false-positive rate, a false-negative rate and an N; none of the three has
      a stable referent while the decision surface (2.3–2.5) is undefined, so a
      number set now would be unfalsifiable. **The option that looked like
      progress was rejected by both:** pre-registering the FORM of the bar and
      deferring the numbers does not close this step, it rewrites it —
      *"Closing it without those values rewrites the requirement rather than
      fulfilling it"* (openai); *"a new preparatory step, not a redefinition of
      8.2's completion criteria"* (anthropic). The 7.1 precedent was put to them
      explicitly and held: an acceptance bar is the same kind of thing as a
      classification, and both need stable semantics first.
      **Hold is NOT "wait for the data" — the opposite.** Once the surface is
      frozen, the numbers are registered BEFORE corpus labels or verifier
      outputs are disclosed. Record, with the repaired nine-step sequence, the
      eight disqualifiers that no rate can trade away, the sealed-report
      contents and the kill switch:
      `agents/evidence/council/activation-bar-20261013.md`. Recorded as D18.
      **The step is now marked blocked** on `external-bootstrap-boundary-for-phases-2-3`
      per anthropic's finding 6, which went further than its peer: with one
      active maintainer who is also the sole proposer and the only member of the
      only reachable team, *"'independent review' is not achievable through role
      separation or process design"* — so the independent adjudicator step 8.2's
      own bar requires does not exist either.
      **The non-closing predecessor both seats asked for is NOT in this change,
      and the reason is this roadmap's own defect 4 for the third time.** Adding
      a step adds a checkbox, `lint_plan_risk_register` counts checkboxes
      file-wide as a substantial change, and the `reviewed:` stamp already reads
      today's date — set earlier today by the D13 repair — so it cannot be
      re-stamped to express a second same-day review. Measured, not inferred:
      the same wall step 6.1 documented and the D13 repair waited two days for.
      The predecessor is owed on the next calendar day; its content is fully
      specified in D18's record, so nothing is lost but a day.
- [ ] **8.3 Activate the verifier as a required gate ONLY through the
      external bootstrap authorisation this roadmap's break-glass blocker
      (`break-glass-authority-and-bootstrap-approval`) names** — never
      silently, never on the agent's own determination that the shadow run
      looked good. Confirm, before flipping the gate required, that all six
      break-glass stop conditions (record § Break-glass) are implemented and
      tested: replay against different content/policy, proposer/implementer
      exercising the credential, registry/verifier weakened without
      equivalent authorisation, squash/rebase destroying provenance,
      identity verification unavailable beyond a declared duration, false
      rejections blocking all constitutional maintenance.
      verify: `npx vitest run tests/scripts/break_glass_stop_conditions.test.ts` -> 0
      **D19, 2026-10-13: AC-4 as written protects the INITIAL activation only,
      and 8.3's six conditions do not close that gap.** Both seats of the
      activation-bar round found it unprompted: nothing in AC-4 prevents the
      gate being weakened after it is live — the verifier changed, the rule
      removed, a bypass introduced. An approval must therefore bind IMMUTABLE
      VERSIONS — verifier, decision contract, configuration, corpus protocol,
      enforcement mechanism — rather than an act in time, and a kill switch with
      automatic suspension triggers must exist BEFORE activation, with the
      authority to suspend held separately from the authority to reactivate.
      **The AC-4 text is deliberately NOT edited here.** Its body sits inside
      `## Acceptance Criteria`, which `lint_plan_risk_register` hashes, and
      today's stamp was already spent on the D13 repair — the same same-day wall
      recorded at 8.2 and 6.1. The finding is binding from D19 and the AC
      sentence is owed on the next calendar day; recording it here rather than
      silently widening AC-4 later is the point.
      **The wall was TESTED on 2026-10-13, not inherited — and it binds. This is
      the fourth data point for defect 4, and the first one measured by running
      the gate against a committed change rather than reasoning about the gate.**
      A drain re-screen is supposed to execute a condition rather than trust the
      note that records it, so the widened AC-4 sentence was written in full and
      committed. Two readings, and the first one is a trap worth naming: run
      against the WORKING TREE the gate reports clean, because
      `lint_plan_risk_register.hasUncommittedChanges` **skips the staleness check
      entirely** while the file is modified — it judges committed history, and
      with uncommitted edits there is no committed history to judge. So a local
      green over an unstaged AC edit proves nothing. Committed, the same edit
      reports `stale_review`: *"`reviewed: 2026-10-13` predates the last
      substantial change"*. The edit was then reverted and the gate re-measured
      clean. **The three ways out were each refused on their own terms:**
      back-dating the stamp to 2026-10-14 is writing a review date into the
      future, which 6.1 already refused; teaching the gate to treat a same-day
      stamp as fresh is the silent weakening 6.1 refused to patch in, because it
      cannot tell a re-reviewed same-day change from an un-reviewed one; and
      landing the widening anyway would ship a red gate. The sentence is still
      owed on the next calendar day, and it now sits here in full so that
      landing it is a copy rather than a re-derivation.

*Exit: 8.3's six conditions each have a passing test and the bootstrap
authorisation blocker is resolved. Rollback: the verifier stays shadow-only —
reverting 8.3 alone (never 8.1–8.2's evidence) is sufficient, since nothing
before 8.3 gates anything.*


> **Repaired 2026-10-13 — the `D13` collision is gone, and the calendar is what
> released it, not a fix to the gate.** Two decisions shared the id: PR #2293
> numbered the Phase 7 classification `D13`, which PR #2286 had already used for
> the 2.1 split. The rows were **not** byte-identical, so deduplicating on the
> assumption they were copies would have deleted a real record. The repair was,
> as planned, a one-row rename — the Phase 7 row is now `D14`, the id left free
> for exactly this — plus its two inbound references: the one inside
> `## Acceptance Criteria`, and step 7.1's own back-reference to the row carrying
> its `revisit if`. Nothing was merged and nothing was dropped.
>
> **Why it could not land on 2026-10-10 and can now.** One of those references
> sits inside the Acceptance Criteria body, which `lint_plan_risk_register`
> hashes; editing it is a substantial change, and the baseline the gate compares
> against is the commit that INTRODUCED the current `reviewed:` value. While the
> stamp read the same calendar day as the repair, re-stamping produced no new
> value, the run of commits carrying it extended backwards, and the gate reported
> stale against a plan that had just been reviewed. The stamp now moves
> `2026-10-12` → `2026-10-13`, which breaks that run at this commit — so the
> baseline is this commit, and the comparison is against the content actually
> reviewed.
>
> **The defect that caused the wait is UNCHANGED, and reading this repair as
> evidence otherwise would be the silent weakening step 6.1 refused to patch
> in.** `lint_plan_risk_register` still cannot express a same-day re-review, and
> neither can `check_completion_review`. Both wait on review-instance identity —
> steps 2.5 and 6.3 — not on a date. This is the second held item the calendar
> has released rather than the mechanism (step 6.1 was the first), which is
> itself the measurement: a governance gate whose only exit is "wait a day" is
> one the identity work has not reached yet.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | council:2026-10-07 design, 2/2 present | 4.1 — cross-file blocker ids use an explicitly qualified `<roadmap-stem>#<id>` marker. A bare id keeps same-file resolution. Legal: the named active roadmap or stub declares the id open. Hard findings: target resolved (stale — remove the marker), id or file missing, target only in `later/`/`archive/`/`skipped/`, a stem in both the active tree and stubs, a self-qualified reference, an unparseable marker, a `#` inside a blocker id. "Superseded" is not a state, because the format has no replacement pointer. No estate-wide id uniqueness. | AI council 2026-10-07, design mode, `anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds, 2/2 present, $0.00 subscription transport. Both seats chose the qualified form and both refused estate-wide bare lookup. They split on `later/` as a source scope, which this gate does not scan, and on estate-wide uniqueness. The narrower reading (openai) was taken. Measured before landing: 23 markers in scope, 3 on continuation lines, 0 cross-file, 0 stale, so the new rules fire on nothing. | a programme needs a `later/` roadmap to hold active work, or `run-continuation` starts reading marker payloads |
| D2 | reversible-technical | council:2026-10-07 design, 2/2 present, split resolved by measurement | 5.1 — the review-input snapshot exemption becomes declared: `check_agent_artifact_location` skips the exact path `agents/evidence/**/<slug>.review-input/roadmap.md` by name. The header no longer decides anything. A marker any author could type was refused. | AI council 2026-10-07, same members and transport, 2/2 present. Both seats refused the documented accident. They split between a path allowlist (openai) and a marker outside the roadmap root (anthropic). anthropic's stated condition for refusing the path option was "if you expect multiple writers". Measured: with leading HTML-comment headers stripped, 102 files outside `agents/roadmaps/` are roadmap-shaped, and all 102 are review-input snapshots matching the path. There is one writer, so that condition did not hold. | a second writer emits roadmap-shaped documents outside the root |
| D3 | destructive-owned | owner | Break-glass / bootstrap-approval authority for the ratification verifier: the owner alone, exercised as the owner's own forge bypass (consistent with ADR-281 § 5). Minimum evidence a bypass records: reason, subject digest, time, commit; a council review after the fact is mandatory. Step 1.1 writes this into `docs/contracts/ratification-artifact.md` § Emergency use procedure. | owner answer 2026-10-07, `/roadmap:resolve-blockers` | a second person gains merge authority on the repository, or a place only a person writes comes to exist (ADR-281 review trigger) |
| D4 | business-owned | owner | Ratification approval expiry: one uniform window of 48 h from authorisation issuance for every `authority_class`, provisional, on top of the subject-digest binding. Expiry is full invalidation followed by fresh ratification of the unchanged subject against the then-current base, rules and authority requirements. The owner chose a uniform window (7 days proposed, shorter for AI-paced work) and delegated the length to the council. | Measured 2026-10-08: PR open→merge over 200 PRs p50 0.87 h, p90 7.5 h, p99 38.9 h, max 87.3 h; ~18 first-parent merges/day. AI council 2026-10-08, 2/2 present, $0.00: both rejected 7 days; split anthropic 72 h / openai 48 h on an unmeasurable fact (authorisation age at merge). Owner picked 48 h. | more than 5 % of merge-ready changes need expiry-driven re-derivation (lengthen), or a stale-context incident occurs within 48 h (shorten or bind more context digests); measure authorisation age, not PR lifetime |
| D5 | business-owned | owner | Review-attempt bound: `max_remediation_attempts` = 3 materially changed attempts after a `refused-correctable` verdict; the next refusal escalates as `refused-escalate`. Step 2.4 records the field in `docs/contracts/ratification-artifact.md`. | owner answer 2026-10-08, `/roadmap:resolve-blockers`; matches the package's existing fix-loop bound of 3 | escalations cluster on changes a fourth attempt would have passed, or agents exhaust the bound with cosmetic changes the "materially changed" test does not catch |
| D6 | business-owned | owner | Refusal finality: a `refused-escalate` verdict the owner has ruled on is provisional, but reopens only when a premise of the ruling has demonstrably changed, per `decision-revisit-gate`; resubmitting the same change, or the same change reworded, reopens nothing. No exception classes. Step 2.4 records this as the `refused-escalate` finality note in `docs/contracts/ratification-artifact.md`. | owner answer 2026-10-08, `/roadmap:resolve-blockers` | a reopened refusal is later shown to have rested on a premise change that was asserted rather than evidenced, or the owner wants a class of refusals made final |
| D7 | destructive-owned | owner | Approver credential custody: option (c) — the approver registry binds to a GitHub required-reviewer account or team, declared through the existing `src/config/platform-anchor.json` layer. No signing key and no app secret is created, so no credential sits where an agent could reach it; the forge holds and authenticates the identity. Consistent with D3 (break-glass runs through the owner's forge account). | owner answer 2026-10-08, `/roadmap:resolve-blockers` | the repository moves off GitHub, a second approver joins who must be distinguishable below the team level, or an approval must be verifiable offline |
| D8 | destructive-owned | owner | Approver revocation: triggers are departure, credential compromise and role change. Revocation means removing the account or team from the required reviewers on the forge (per D7). The verifier reads that membership live from the forge at merge time, so a revoked identity can never approve again and propagation delay is zero; `src/config/platform-anchor.json` is brought in line the same day. What the verifier does when the live read is unavailable is not decided here; step 3.2 surfaces it. | owner answer 2026-10-08, `/roadmap:resolve-blockers` | the live forge read proves too slow or rate-limited at merge time, or D7's revisit condition fires |
| D9 | contested-technical | council:2026-10-08 resolve-blockers-batch | `defect-5-merges-ahead-of-completion-review` (a): a trunk change never lands without a completed completion review; Phase 6.3 implements a hard merge-block on an incomplete review, with a failure message naming what must complete first. | AI council 2026-10-08, anthropic + openai, 2/2 present, both (a), $0.00; both found (a) not owner-reserved because it strengthens a floor (one seat noted (b)/(c) would be owner-reserved only if pre-merge review were already a recorded floor). | the hard block demonstrably stalls an emergency fix the break-glass path (D3) does not cover |
| D10 | contested-technical | council:2026-10-08 resolve-blockers-batch | `supported-merge-strategies-for-ratified-changes` (a): a PR carrying a ratification artifact lands by merge commit only; every other PR keeps the repository's current strategies. 6.1 designs serialisation against this constraint and documents when a PR carries an artifact. Recorded in `docs/contracts/ratification-artifact.md` § Supported merge strategies when 6.1 lands. | AI council 2026-10-08, anthropic + openai, 2/2 present, both (a), $0.00. Both: (c) accepting provenance loss would be owner-reserved; (b) only council-decidable if re-derivation keeps the authorisation valid for the exact resulting tree. | a deterministic, auditable post-squash re-derivation is shown to preserve provenance with no information loss |
| D11 | destructive-owned | council:2026-10-10 design, 2/2 present, peer review | 1.1 — the hold is **(c)**: a forge-side approval administered by a separately authorised principal, outside the candidate branch, required before the first Phase 2 authority-expanding merge and covering Phase 3. Neither shape the step anticipated was selected: a doc-only sentence is a description, not a hold, and a candidate-branch CI check is inside the write boundary the record's dealbreaker names. Condition 4 of `ratification-artifact.md` routes **Phase 2** to the owner (both seats) but does **not** conclusively reach Phase 3's verifier or approver registry (both seats) — the enumeration names computing a subject, writing a record, asking questions and deriving a verdict, and a verifier checks an attestation instead. | AI council 2026-10-10, `anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds, peer review, 2/2 present, $0.00 subscription transport. Record and prompt: `agents/evidence/council/authority-routing-hold-form-20261010.md` and its `.question.md`. Split on scope: anthropic anchors Phase 3 only (Phase 2 already condition-4 routed, conf. 0.85); openai anchors both (Phase 2 defines the semantics Phase 3 will later bind, conf. 0.91). The stronger reading was taken on the parent record's own precedent — condition 4 routes a decision to a person, it does not prevent a merge. | condition 4's enumeration is amended to reach verification machinery explicitly, or the external control proves to block all constitutional maintenance |
| D12 | reversible-technical | council:2026-10-10, same run | Phase 3 does not begin until the external approval path is **active and tested against an attempted bypass**. Designing or documenting it does not unblock implementation. | openai, unprompted and not in step 1.1's text; anthropic's § what-it-does-not-guarantee reaches the same place from the audit side | the bypass test proves unconstructible without production credentials |
| D13 | contested-technical | council:2026-10-10 design, 2/2 present, peer review — **SPLIT, escalates** | 2.1 — the LOCATION of the six-predicate test is **not decided**: anthropic (b), a section of `ratification-artifact.md`, conditional on the forge blocker being resolvable (conf. 0.78); openai (a), a new `docs/contracts/dangerous-action-predicates.md` added atomically to the gate's watch list (conf. 0.88). What IS decided, both seats: whichever file holds the predicates **joins the gate's watch list in the same change**, references point at one canonical file and no second document restates them, and the sequence is contract-plus-watch-list-entry atomically → negative regression test that weakening it without a record is caught → only then may downstream routing depend on it. Fail closed: a trusted gate that cannot load the file or establish its comparison base stops authority routing; there is no temporarily-unwatched state. | AI council 2026-10-10, `anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds, peer review, 2/2, $0.00. Record and prompt: `agents/evidence/council/dangerous-action-predicates-home-20261010.md` and its `.question.md`. openai's unrefuted pushback: being on the watch list is not yet a security boundary, because the evidence shows the file is watched and not that the watcher runs from a revision the candidate cannot alter — the contract says the same ("THE GATE ADDS A REFUSAL. IT DOES NOT ADD AN ANCHOR"). Both seats' conditions reduce to `external-bootstrap-boundary-for-phases-2-3`. | the blocker is shown permanent (moves anthropic to (a)), a second consumer needs versioned independence (same), or trusted forge-side tooling is shown able to validate only an embedded definition atomically (moves openai to (b)) | <!-- ref-ignore -->
| D14 | contested-technical | council:2026-10-10 design, 2/2 present, peer review — **classification convergent, step completion WITHHELD** | 7.1 — of the 16 checks genuinely red on the trunk: `check_gate_completeness` is a **governed snapshot** (refresh only on a reviewed change to population, scope, counting semantics or partition that makes the old count non-comparable; the agent may calculate and propose, a gate-policy CODEOWNER or the authority-record owner approves, never the agent that calculated it; refreshing because violations rose is forbidden, and it is blocked NOW until the 23 new violations are enumerated by rule); **12 are invariants**; **3 are unclassified** pending their predicates. **Zero tolerances, zero observations.** | AI council 2026-10-10, `anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds, peer review, 2/2, $0.00. Both tables agree on all 16. Population measured at `bbe5b73be` after a first sweep was discarded for a harness fault (no `timeout(1)` on macOS) and two controls proved the rerun. Record and prompt: `agents/evidence/council/live-tree-check-classification-20261010.md`. openai's dissent: #1 holds TWO objects — the numeric baseline is a snapshot, the prohibition on unjustified new debt is an invariant, and one class field cannot carry both. anthropic's dissent: the step conflates classification with gate membership. | the three abstentions gain their predicates, or a per-check contract registry exists from which class, prerequisites, gate membership and refresh authority derive mechanically |
| D15 | contested-technical | council:2026-10-10 design, 2/2 present, peer review — convergent | 6.1 — a review instance is stable per branch; an ATTEMPT is immutable and records the scope hash, the target sha and, per touched file, that file's blob hash ON THE TARGET. At merge time a CI-side check re-reads those fingerprints: any differs -> **stale**, a new attempt under the same instance carrying unresolved objections forward; all match -> **valid**, even if the target advanced on other files. Ordering is **first-valid-wins** — non-overlapping branches retry mechanically, overlapping ones go stale. No owner decision in the common path, and the check is never run by the agent. openai adds, undisputed: a compare-and-swap on a sole protected writer, a policy hash per attempt so changing exclusions / diff flags / merge strategy / reviewer authorization / validator code revokes affected attempts mechanically, and fail-closed criteria when attestation, branch protection or lease history cannot be confirmed. | AI council 2026-10-10, anthropic + openai, 2 rounds, peer review, 2/2, $0.00. Record and prompt: `agents/evidence/council/merge-serialisation-20261010.md`. **The limit is recorded as a limit, not a caveat** — openai: "This mechanism establishes atomic, SYNTACTIC continuity of an explicitly defined review projection. It does not prove semantic equivalence, and the architecture must not describe it as doing so." Out of reach: semantic conflicts between non-overlapping changes, anything inside the configured exclusions, generated state, environment-dependent merge behaviour, an administrator bypass. anthropic's dissent: the instance/attempt split adds complexity justified only by Phase 2.5's objection retention, and the mechanism must fail closed when branch protection is disabled. | objection retention proves unnecessary (a flat attempt model then suffices), or a normalized review projection is defined that the landing authority can reconstruct from the prospective result |
| D16 | contested-technical | council:2026-10-13 design, 2/2 present, peer review — convergent | The hold D11 selected is **dormant-but-declared** (option a). Its precondition — a separately authorised principal — measurably does not exist here, so the requirement is DECLARED and REPORTED, never activated: `forge_protection` carries a sixth row, `authority_surface_external_approval`, reporting `unsatisfied` while no forge-side approval requirement covers the default branch, and Phases 2–3 stay blocked. Both seats stated in their own words that this **makes the blocker checkable and does not resolve it**. Four properties keep it from being theatre: an explicit machine-readable `unsatisfied`; it blocks only authority-expanding changes; it cannot be flipped from the candidate branch; it is described as an unmet precondition, never an active control. anthropic adds a fifth, kept: the status must not be flippable by the owner acting alone. **Rejected:** (b) owner break-glass as bootstrap — both seats, as the parent record's own circularity ("a well-recorded violation remains a violation"); (c) an App or bot — contradicts D7 and buys no independence; (d) recruit a second human — **the intended activation path**, not executable today for want of acceptance, availability, independent administration and a tested enforcement path. The path-scoped narrowing does **not** rescue the requirement from `owner_ruling_2026_09_10`, which is about availability rather than scope. | AI council 2026-10-13, anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds, blind peer review, 2/2, $0.00. Record and verbatim prompt: `agents/evidence/council/hold-executable-form-20261012.md`. Confidence anthropic 0.75, openai 0.93. **anthropic's residual uncertainty is recorded rather than resolved:** whether this is council-decidable governance-APPLICABILITY (a decided control whose precondition is unmet) or owner-reserved governance SELF-AMENDMENT. Neither seat declared it reserved, so it was taken as decided; anthropic would defer to an owner ruling the other way. A time-boxed escape hatch was proposed in peer review and deliberately NOT adopted — choosing when a declared authority requirement may be relaxed is the self-amendment dimension anthropic had just flagged. | an owner rules the applicability question the other way; or a live test PR shows a named second principal accepted the duty and is forge-enforced across the whole trusted surface while the owner cannot self-satisfy or bypass |
| D17 | reversible-technical | council:2026-10-13, same run, raised unprompted by openai | The authority surface is **larger than the four files** the blocker named. It also includes `.github/CODEOWNERS`, the `doctor` implementation and its output semantics, the workflows invoking or gating on the verifier, the configuration identifying the default branch or ruleset, and the ruleset itself — *"if those surfaces are mutable without the external approval, the protected four-file boundary can be disabled indirectly."* Three assertions stay separated and only ONE is forge-readable: declared intent (candidate-controlled unless read from a trusted base), observed forge state (what the row reads), principal qualification (partly organizational, derivable from no API response). The shipped row therefore says in its own detail line what it does not establish. | AI council 2026-10-13, same run; openai raised it unprompted and corrected its peer for overclaiming that a diagnostic can show an identity is "administered independently". openai also rejected an activity-based availability proxy ("one PR merge in 90 days") as proving neither acceptance, independent control, nor response capacity — no such test is adopted. | the forge exposes a path-scoped approval primitive that does not route through `CODEOWNERS`, which would move part of assertion 1 into assertion 2 |
| D18 | contested-technical | council:2026-10-13 design, 2/2 present, peer review — convergent, **step completion WITHHELD** | 8.2 — the activation bar is **held** (option c), and the option that looked like progress was refused: pre-registering the FORM of the bar while deferring the numbers does not close 8.2, it rewrites it. A false-positive rate, a false-negative rate and an N have no stable referent while the decision surface (2.3–2.5) is undefined. **Hold is not "wait for the data":** once the surface is frozen, the numbers are registered BEFORE corpus labels or verifier outputs are disclosed. Repaired nine-step sequence: freeze the decision surface incl. abstention and missing-evidence behaviour → define the reference-label protocol and observation window → pre-register sampling, N, thresholds, confidence, severity weighting, exclusions → freeze verifier and contract hashes → select and independently label the corpus → run and seal the report → independently adjudicate → obtain the separate external authorisation → activate only the evaluated versions. **Disqualifying regardless of rate:** an authorisation or security-critical fail-open; treating absent, unverifiable or malformed evidence as a pass; nondeterminism on identical frozen inputs; evaluation-data leakage into verifier development; any unregistered post-freeze change to code, contract, labels, corpus or exclusions; an irreproducible verdict or missing audit evidence; an unaudited bypass; no genuinely independent activation authority. **The trust boundary is control, not readership** — the builder MAY read the sealed report and challenge factual errors, and may NOT select or exclude cases after seeing outputs, assign or resolve reference labels, be sole interpreter, change the evaluated verifier, or authorise activation. **Steps 8.1 and 8.2 are circular as written**, and 8.1's "compare against what actually happened" treats merged-PR outcomes as ground truth when they are observational and censored. | AI council 2026-10-13, anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds, blind peer review, 2/2, $0.00. Record and verbatim prompt: `agents/evidence/council/activation-bar-20261013.md`. openai: confidence high, greenlight blocked. The 7.1 precedent was put to the seats explicitly and HELD — an acceptance bar needs stable semantics exactly as a classification does. **One proposed disqualifier was rejected as too broad and the rejection is kept:** "blocks without cause" — a conservative verifier may intentionally block or abstain where evidence is insufficient, so "passes without sufficient evidence" is categorically dangerous while "blocks a case later judged safe" is a measured false positive, not automatically fatal. The non-closing predecessor both seats asked for is specified here and NOT added in the recording change: a new step adds a checkbox, which `lint_plan_risk_register` counts as substantial, and the stamp was already spent on the D13 repair the same day. | the decision surface is frozen (2.3–2.5 land), at which point the numeric round is owed BEFORE any corpus or output is exposed; or a versioned historical corpus is independently labelled under a documented observation window with indeterminate outcomes preserved and inter-reviewer agreement demonstrated, which openai named as the one thing that would move it |
| D19 | reversible-technical | council:2026-10-13, same run, raised unprompted by both seats | AC-4 protects the **initial activation only**. Nothing in it prevents the gate being weakened once live — the verifier changed, the rule removed, a bypass introduced. An approval must bind IMMUTABLE VERSIONS (verifier, decision contract, configuration, corpus protocol, enforcement mechanism) rather than an act in time, and a kill switch must exist before activation: automatic suspension on any critical false negative, fail-open path, evidence-integrity loss, contract or version drift, or sustained operational failure beyond registered limits; emergency suspension may be immediate but is logged, time-bounded, and held SEPARATELY from the authority to reactivate; reactivation needs a fresh evaluation whenever the validated artifact or the decision surface materially changes. | AI council 2026-10-13, same run; both seats reached it independently of the question asked. Recorded at step 8.3 as well, where the six break-glass conditions sit. | the AC-4 sentence is widened to name version binding and the kill switch, which is owed on the next calendar day after 2026-10-13 — the AC body is hashed by `lint_plan_risk_register` and this date's stamp was spent on the D13 repair |
| D20 | deterministic | evidence | The blocker's premise that *"the separately authorised principal D11 requires does not exist on this repository today"* is **too strong, and the lock is unchanged.** The 2026-10-12 reading queried the ruleset, `CODEOWNERS` and the one reachable org team and generalised from that subset; the collaborator list answers that four accounts distinct from the proposing and merging principal hold `write` or better, and `write` is the threshold at which a review counts toward `required_approving_review_count`. **Eligible principals exist and there are four.** What does not exist is a QUALIFIED one on D16's own four-part test — acceptance, availability, independent administration, a tested enforcement path — none of which an account satisfies. The owner's remaining act is therefore smaller and more concrete than the blocker stated: ask one of four people already holding access, not recruit a person. | Measured 2026-10-13 from `origin/main` @ `8cd4c1e4d`: `GET /repos/event4u-app/agent-config/collaborators` -> `matze4u` admin, `h3xa2` maintain, `php-jesus`/`phpjob`/`0sama` write, the last four all outside collaborators; ruleset `17749383` re-read unchanged; reviews on the 36 most recent merged PRs (#2284...#2326) queried one by one -> **0 of 36 carry a review from any account**. Record: `agents/evidence/analysis/authority-surface-eligible-principals-20261013.md`. No council round was run and none is owed: the lock rests on qualification, this measures eligibility, so `decision-revisit-gate`'s mechanism-match test does not fire, and D17 had already rejected activity as a qualification proxy. | one of the four accepts the duty and is named on the ruleset, which moves D16's revisit condition from unmet to testable; or a reading shows `write` is not in fact sufficient to satisfy the approval rule this repository would configure |
| D21 | deterministic | evidence | Step 7.1's named prerequisite is **larger and sharper** than its own 2026-10-13 screen states. Larger: *"all four Phase 7 checks resolve against `gate-coverage.yml`"* is one of four — the three abstentions have no row — and 2 of the round's 16 checks have rows, so the gap is four new fields AND fourteen new rows. Sharper: D14 asks the four fields to **derive mechanically**, and a typed `class:` field is an assertion, not a derivation. The candidate derivation *reads a committed baseline -> snapshot* is **refuted** (four counter-examples). The repaired predicate is DIRECTION, not presence: a committed baseline that can move in the **permissive** direction is a governed snapshot; no baseline, or a shrink-only ratchet, is an invariant. It also dissolves openai's D14 dissent that check #1 "holds TWO objects" — those are the baseline's direction of travel and the gate's finding set, two fields rather than two meanings of one. | Measured 2026-10-13 from `origin/main` @ `8cd4c1e4d`. Detector `grep -cE 'baseline|ratchet|golden'` over all 16 scripts, positive control run first (`check_gate_completeness` -> 5 hits, the one known snapshot). 5 of 16 non-zero; hits then READ, not counted: `check_token_quality_golden` (golden corpus, no numeric baseline), `check_rule_invariants` (a mutation-selftest message), `check_trigger_evals` (a comment about another gate's ratchet) are false positives; `lint_rule_enforcement_declaration` is a real shrink-only ratchet over `src/config/rule-enforcement-baseline.json` and is an invariant. Record: `agents/evidence/analysis/gate-class-derivation-20261013.md`. **Stated limits:** one corpus, no holdout, repaired after seeing its counter-examples; it derives one of four fields; gate membership is a decision no file property derives; the three abstentions stay abstentions, because answering them by default is the refused discretion in a mechanical coat. | the predicate is run against the other 338 scripts and mis-sorts any of them; or a snapshot is found whose baseline is shrink-only, which would refute direction as the discriminator |
| D22 | contested-technical | council:2026-10-13 design, 2/2 present, blind peer review — convergent, **step completion WITHHELD** | 7.1's prerequisite — **the round defines a mechanism to satisfy D14's revisit condition and does not satisfy it; Phase 1 of 3.** (Q1) D21's repaired predicate is **NOT an acceptable derivation**, on five grounds: it covers 2 of 4 classes (zero tolerances and zero observations exist, and neither depends on a baseline); *"permissive"* is a semantic reading, since raising a minimum floor and raising a maximum-allowed-failures count both weaken; it was fitted after seeing its counter-examples, so zero predictive power; it does not dissolve the TWO-objects dissent; and its 16/16 headline contradicted the corpus. (Q2) The four fields go in a **separate `gate-classification.yml`**, not in `gate-coverage.yml` — merging them is a governance leak, because a `min_scanned` bump would travel the same approval surface as `class: invariant -> snapshot`. (Q3) `gate_membership` and `refresh_authority` **cannot derive**; `prerequisites` is underspecified until the kind of dependency is named; an explicitly asserted field carrying `asserted_by`/`asserted_on`/`reasoning`/`reviewed_by` **is acceptable** under the reading that *mechanical* means rule-following with recorded inputs rather than zero human input — a reading the round flags as unconfirmed. (Q4) 31.9 % does not block; **2 of 16 does**, and if 113 were registered while 14 of the 16 were not, the classification round ran without consulting the registry, which makes the revisit condition circular. (Q5) Still required: baseline contracts declaring their own weakening direction, all 16 registered, the 3 abstentions resolved, holdout validation, explicit tolerance/observation handling, the TWO-objects dissent resolved in the schema, rollback and kill-switch criteria, a registry-modification procedure, effective-vs-required reconciliation, and re-classification FROM the contracts rather than copying D14 forward. | AI council 2026-10-13, anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds, blind peer review, 2/2, $0.00. Record and verbatim prompt: `agents/evidence/council/gate-contract-registry-shape-20261013.md` and its `.question.md`. Chairman confidence 0.77. **The seats audited the asking agent's own measurement first and found an overclaim** — *"a measurement claiming 100 % success while admitting 19 % gaps should not be trusted"* — and the evidence file was corrected to 13/16 in the same change. **The TWO-objects repair D21 proposed was rejected as understating the problem:** it is a taxonomy problem, not a schema one, and two fields do not change which of the two the `class` field reports; the live options are a multi-valued class, aspect-level rows, or splitting the check. Raised unprompted: gate membership splits into `effective_gate` (derivable from CI config) and `required_gate` / `blocking_on_failure` (decisions), with any mismatch failing CI. Sequencing is an order, not a list — schema, then baseline contracts, then all 16 registered, then rollback, and only then may a class change anything, because *"landing a weaker class before the controls exist creates a window where enforcement can be bypassed"*. | the D14 seats confirm that *derive mechanically* means rule-following with recorded inputs rather than computation, which validates the whole Q3 answer; or a demonstration that every check fits exactly one of the four classes with no loss, which would rescue the single-valued `class` field |
| D23 | deterministic | evidence | 7.1 stays open. Re-measured on `origin/main` @ `6abb887d7`, **9 of the 16 checks D14 classified are green and 7 stay red**: `check_gate_completeness` (240 against 214, up from 237), `check_rule_invariants` (a kernel clause was reworded, not dropped), `check_trigger_evals` (51 stamps older than 90 days), `lint_rule_enforcement_declaration`, `lint_agents_layout`, `lint_eval_freshness` and `check_composite_arming`. Two of the three abstentions (`check_council_layout`, `check_knowledge_cards`) are green, and that resolves neither, because a pass is observed behaviour and D14 refused to read class off it. Two inputs for the next round, offered as readings and not as classifications: `check_composite_arming` reports that evidence is missing ("not measured yet"), not that a property holds. And two checks go red as the calendar moves with no tree change, which the four single-valued classes cannot express. That is a concrete instance of the TWO-objects problem. No council round was run, because none of D22's inputs has changed. | `agents/evidence/analysis/live-tree-check-remeasure-20261017.md`: one run per check, 240 s timeout, every log read. Controls: 7 checks exit 1 with a concrete finding, and every exit-0 log prints its scanned count. | any item on D22's still-required list lands, which makes a classification round against the registry possible |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-13 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Verdict-field split breaks existing consumers | implementation | Separating `verdict` into three fields (step 2.3) can silently desynchronise `check_kernel_edit_ratified.ts` / `_lib/ratification_artifact.ts` if the migration mapping is wrong, reopening the exact "false record" failure `ratification-artifact.md` was written to prevent. | Step 2.3 requires listing every existing consumer and its read-mode BEFORE any schema change lands; the verifier is built and shadow-run (step 8.1) before anything is gated on the new fields. | Phase 2, Phase 8 |
| 2 | Concurrent work on the same contract surface | implementation | **This fired on 2026-10-12.** PR #2313 (`road-to-self-modification-that-a-council-must-pass` steps 1.4/1.5) rewrote the ladder section of `docs/contracts/ratification-artifact.md` — the council is now the review and the owner the approval, and the section gained an ADR-282 sentence — and added a dated paragraph to § Honest enforcement. Any Phase 1 or Phase 2 step here quoting the old ladder text is now quoting a revision that no longer exists. | `relates:` declares the `extends` relation; the Context and Prerequisites sections instruct re-reading the live contract at execution time rather than trusting this file's quoted text. | Phase 1, Phase 2 |
| 3 | Activation without the full break-glass set | product | Flipping the verifier to a required gate (step 8.3) before all six break-glass stop conditions are implemented would recreate the dealbreaker the whole roadmap exists to close — a silent-fail-open path. | Step 8.3's own checklist names all six conditions and requires a passing test per condition before activation; the break-glass blocker is a structured, owner-routed gate, not a step the agent can self-clear. | Phase 8 |

## Blockers

### blocker: external-bootstrap-boundary-for-phases-2-3

- **Status:** open — re-checked 2026-10-18, still unmet: `agent-config doctor --online --json` reports `authority_surface_external_approval: unsatisfied — no covering ruleset requires an approving review`, and ruleset `17749383` still reads `required_approving_review_count: 0`, `require_code_owner_review: false`, `required_reviewers: []`. Owner-reserved by D11/D16/D20 (the council has already ruled; this needs a forge setting and a qualified second principal only the owner can supply). Opened 2026-10-10 by the step 1.1 council verdict (D11). The hold that verdict selected is a forge-side approval outside the candidate branch; the agent may prepare everything around it and may not turn it on
- **Owner:** owner — D3 reserves bootstrap approval to the owner, and both seats required the protection configuration itself to stay subject to that same higher approval. A protection an agent can add is one an agent can remove, which is not a boundary
- **Class:** 3
- **Ownership:** destructive-owned
- **Blocks:** step 1.2, and through it every Phase 2 and Phase 3 step — 2.3 is the first commit the hold must precede
- **What to do:** on the forge, require review from an approver identity that is NOT the proposing/merging principal (a GitHub account or team, declared through `src/config/platform-anchor.json` per D7) for merges touching the authority surface. That surface is **larger than the four files this blocker first named**, per D17: `docs/contracts/ratification-artifact.md`, `src/scripts/check_kernel_edit_ratified.ts`, `src/scripts/_lib/ratification_artifact.ts`, `src/config/platform-anchor.json`, **plus** `.github/CODEOWNERS`, the `doctor` implementation and output semantics, the workflows that invoke or gate on the verifier, and the ruleset configuration itself. Then run a disposable test PR proving all four properties D16 lists, and say so here. Branch protection on this repository is a **ruleset**, not classic protection — the control is a ruleset rule, not a branch-protection setting.
- **Resolved when:** a trusted, candidate-independent invocation of `agent-config doctor --online --json` reports `authority_surface_external_approval: satisfied`; at least one accepted reviewer distinct from the proposing/merging principal is eligible to satisfy it; owner self-approval and configured bypass cannot satisfy it; stale approval is dismissed after a relevant push; and live positive AND negative test PRs have demonstrated those properties. **The row alone is not the condition** — it reads the forge half, and D16 records in both seats' own words that making the blocker checkable does not resolve it. Rewritten 2026-10-13 per D16: the prior wording named a probe that had no row able to answer it in either direction, so the condition could not be run.
- **Measured 2026-10-12, and the result is why the condition above changed.** Live forge: the one active ruleset (`17749383`) carries `required_approving_review_count: 0`, `require_code_owner_review: false`, `required_reviewers: []`, `bypass_actors: []`; `.github/CODEOWNERS` maps every path — all four original Phase 2–3 files included — to `@matze4u`, who is also the only active proposer; the only reachable org team has one member, `@matze4u`. GitHub does not let an author approve their own PR, so **the separately authorised principal D11 requires does not exist on this repository today.** `src/config/platform-anchor.json`'s `owner_ruling_2026_09_10` had already ruled on the same availability fact. The agent-side half is now shipped: `forge_protection` carries a sixth row, `authority_surface_external_approval`, which reports `unsatisfied` against the live forge and distinguishes that from `unread` (an unqueried forge is never a confirmed absence).
- **Re-measured 2026-10-13, and the bolded sentence above is too strong — the condition below is unchanged (D20).** The 2026-10-12 reading queried the ruleset, `CODEOWNERS` and the one reachable org team, then generalised from that strict subset to the whole eligible-reviewer set. The collaborator list was never asked. It answers: four accounts distinct from the proposing and merging principal hold `write` or better — `h3xa2` (maintain), `php-jesus`, `phpjob`, `0sama`, all outside collaborators — and `write` is the threshold at which a review counts toward `required_approving_review_count`. So **eligible principals exist, and there are four of them.** What does not exist is a QUALIFIED one: D16's rejected option (d) names the test as acceptance, availability, independent administration and a tested enforcement path, and holding an account satisfies none of the four. The lock therefore stands on its own stated mechanism and nothing is reopened — this is a correction to a premise, not new evidence against the verdict. Corroborating the availability leg, and measured rather than assumed: **0 of the 36 most recent merged PRs (#2284…#2326) carry a review from any account.** D17 already rejected activity as a qualification proxy, so that figure argues nothing about eligibility; what it does price is break-glass stop condition 6, which reads as hypothetical against an unmeasured population and as the expected case against a 0-of-36 one. Measurement: `agents/evidence/analysis/authority-surface-eligible-principals-20261013.md`.
- **Recommendation:** turn it on before Phase 2.3 rather than before Phase 3. anthropic held that condition 4 already routes Phase 2 to the owner and that only Phase 3 needs the anchor; openai held that Phase 2 defines the semantics Phase 3 will later bind, so letting them bootstrap under the old boundary leaves Phase 3 binding an internally authorised constitutional change. The stronger reading was taken because condition 4 routes a *decision* to a person — it does not prevent a *merge*. If anthropic is right the extra coverage costs nothing; if openai is right and it was skipped, the gap is invisible until the verifier is already binding it.
- **The remaining act, as the 2026-10-13 measurement leaves it:** ask one of the four accounts that already hold `write` or better — `h3xa2`, `php-jesus`, `phpjob`, `0sama` — whether they accept the duty, then raise `required_approving_review_count` on ruleset `17749383` and name the one who accepted. Two sentences that sound alike are not the same ask: *no principal exists* means recruit a person first, *four eligible principals exist and none has ever reviewed* means ask people who are already here. The earlier wording stated the first. Prefer a plain approving-review requirement over a code-owner route: a code-owner route also needs a `.github/CODEOWNERS` edit, and D17 put that file inside the authority surface, so that edit would itself be in scope. Name a liveness escape in the same act — against a 0-of-36 review record, requiring an approval from a dormant account is break-glass stop condition 6 by construction, and D3's owner bypass is the only path out of it today.
- **If you do nothing:** step 1.2 stays open and Phases 2 through 8 stay unstartable, which is the safe default and is exactly what the record's required-sequencing item 1 asks for. Nothing degrades; the whole mechanism simply stays unbuilt, and `check_kernel_edit_ratified` keeps running beside `block_kernel_rule_writes` as it does today.

### blocker: defect-5-merges-ahead-of-completion-review
- **Status:** resolved 2026-10-08 — option (a): no trunk change lands without a completed completion review; Phase 6.3 implements the hard merge-block (council 2026-10-08, anthropic + openai, 2/2, $0.00, both (a), owner-reserved: no — it strengthens a floor; D9)
- **Owner:** user
- **Blocks:** Phase 6 — Stable review instances and merge serialisation
- **Question:** May trunk changes land without a completed completion review, ever — and if so, under what conditions?
<!-- Class: 3 -->
- **Recommendation:** No — require completion review to finish before merge, with the Phase 6 serialisation mechanism as the technical enabler; this is the governance rule the record names as predicate-4-tripping (grants/persists/widens agent authority over what lands), so it is yours to set, not the council's to infer.
- **If you do nothing:** Merges continue landing ahead of their completion review, which is the live state the record's drain run found — Phase 6's serialisation work has no governance rule to enforce once it exists.
- **What to do:**
  1. Answer the question above (yes/no, and any conditions) in this roadmap's `## Decisions` table or directly in this blocker's `Resolved when:` field.
  2. If "no, never" — Phase 6.3 implements a hard merge-block on an incomplete review; if conditional, name the conditions so Phase 6.1's council round can design around them.
- **Resolved when:** This blocker's `Status:` is flipped to `resolved` with the owner's answer recorded inline.

### blocker: credential-custody-for-approver-registry
- **Status:** resolved 2026-10-08 — option (c): the approver identity is a GitHub required-reviewer account or team, bound through the existing `src/config/platform-anchor.json` layer; no new secret is created, the forge holds the identity (owner, via `/roadmap:resolve-blockers`; D7)
- **Owner:** user
- **Blocks:** Phase 3 — 3.2 (approver registry implementation)
<!-- Class: 3 -->
- **Recommendation:** Decide who holds the signing credential (or equivalent platform identity) the registry in Phase 3.1/3.2 binds to, and how it is stored — this is custody of a real credential, which the dangerous-action test's predicate 5 (recovery needs a privileged credential) routes to you.
- **If you do nothing:** Phase 3.2 cannot choose a concrete registry implementation; it stays a design sketch.
- **What to do:**
  1. Name the credential type — (a) a signing key, (b) a platform app identity, or (c) a required-reviewer group bound via the existing `platform-anchor.json` layer — and where it lives.
- **Resolved when:** This blocker's `Status:` is `resolved` with the custody decision recorded.

### blocker: approver-credential-revocation-policy
- **Status:** resolved 2026-10-08 — revocation on departure, compromise or role change; the verifier checks required-reviewer membership live against the forge at merge time, so propagation delay is zero, and `platform-anchor.json` is updated the same day (owner, via `/roadmap:resolve-blockers`; D8)
- **Owner:** user
- **Blocks:** Phase 3 — 3.2
<!-- Class: 3 -->
- **Recommendation:** Define how an approver credential is revoked (departure, compromise, role change) and how fast the registry must reflect it — a revocation policy is a standing authority decision, not a technical default the agent should pick.
- **If you do nothing:** The registry ships with no revocation path, so a compromised or stale credential stays valid indefinitely.
- **What to do:**
  1. Name the revocation trigger — (a) departure, (b) credential compromise, or (c) role change — and the maximum propagation delay.
- **Resolved when:** This blocker's `Status:` is `resolved` with the policy recorded.

### blocker: ratification-approval-expiry-window
- **Status:** resolved 2026-10-08 — one uniform window of 48 h from authorisation issuance, provisional, on top of the subject-digest binding; expiry means full invalidation and fresh ratification against the then-current base (owner, after a split council round; D4)
- **Owner:** user
- **Blocks:** Phase 2 — 2.3 / Phase 3 — 3.3
<!-- Class: 3 -->
- **Recommendation:** Set the `effective_after` / approval-expiry window a passing authorisation stays valid for before it must be re-derived against a changed subject — a staleness window is a risk-appetite call.
- **If you do nothing:** The existing `effective_after` field (merge, or an ISO-8601 instant) stays the only expiry notion; Phase 2's three-way split has no window to attach the new `authorisation` field to.
- **What to do:**
  1. State the default expiry window, and whether it may vary by `authority_class`.
- **Resolved when:** This blocker's `Status:` is `resolved` with the window recorded.

### blocker: supported-merge-strategies-for-ratified-changes
- **Status:** resolved 2026-10-08 — option (a): a PR carrying a ratification artifact lands by merge commit only; other PRs are unchanged (council 2026-10-08, anthropic + openai, 2/2, $0.00, both (a), owner-reserved: no for (a); D10)
- **Owner:** user
- **Blocks:** Phase 6 — 6.1 (merge-serialisation design)
<!-- Class: 3 -->
- **Recommendation:** Name which merge strategies (merge commit, squash, rebase) a ratified change may land through — squash and rebase both risk destroying the provenance the break-glass section (record, and Phase 8.3) depends on, so this is a standing policy choice, not a per-PR one.
- **If you do nothing:** Phase 6.1's council round has no fixed constraint to design the serialisation mechanism against, and squash/rebase-induced provenance loss (one of the six break-glass stop conditions) has no policy backing it.
- **What to do:**
  1. Name the allowed strategy or strategies for any PR carrying a ratification artifact, and record it in a new `## Supported merge strategies` section of `docs/contracts/ratification-artifact.md`.
- **Resolved when:** This blocker's `Status:` is `resolved` with the policy recorded.

### blocker: break-glass-authority-and-bootstrap-approval
- **Status:** resolved 2026-10-07 — the owner alone holds break-glass / bootstrap-approval authority, exercised as the owner's own bypass on the forge; a bypass records reason, subject digest, time and commit, and a council review after the fact is mandatory (owner, via `/roadmap:resolve-blockers`; D3)
- **Owner:** user
- **Blocks:** Phase 1 — 1.1 (interim hold/bootstrap form) and Phase 8 — 8.3 (activation)
<!-- Class: 3 -->
- **Recommendation:** Name who may exercise the break-glass / external-bootstrap-approval path once the verifier is a required gate, and under what evidence — this is the Hard-Floor-adjacent authority the record's break-glass section reserves explicitly ("never let an agent select the older permissive path").
- **If you do nothing:** Phase 8.3 has no authority to activate against and stays blocked indefinitely, which is the safe default but leaves the whole mechanism shadow-only.
- **What to do:**
  1. Name the break-glass authority (yourself, a named role, a specific credential) and the minimum evidence a bypass must record, and add it to the `docs/contracts/ratification-artifact.md` § Emergency use procedure as the named authority for this mechanism.
- **Resolved when:** This blocker's `Status:` is `resolved` with the authority and evidence bar recorded.

### blocker: review-attempt-bound
- **Status:** resolved 2026-10-08 — `max_remediation_attempts: 3` materially changed attempts, then `refused-correctable` becomes `refused-escalate` (owner, via `/roadmap:resolve-blockers`; D5)
- **Owner:** user
- **Blocks:** Phase 2 — 2.4 (refused-vocabulary remediation loop)
<!-- Class: 3 -->
- **Recommendation:** Set the bounded number of materially-changed remediation attempts (record § 6: "the council is non-convergent after a bounded number of materially changed attempts") before a `refused-correctable` escalates to `refused-escalate` — an unbounded loop risks review shopping in the other direction (never escalating).
- **If you do nothing:** Phase 2.4 ships the three-way `refused` split with no numeric bound, so "a bounded number of attempts" stays undefined and unenforceable.
- **What to do:**
  1. State the bound (a number, or a rule for deriving one), and record it as a `max_remediation_attempts` field in `docs/contracts/ratification-artifact.md`.
- **Resolved when:** This blocker's `Status:` is `resolved` with the bound recorded.

### blocker: refusal-finality-policy
- **Status:** resolved 2026-10-08 — a `refused-escalate` the owner has ruled on is provisional only against new evidence: it reopens when a premise of the ruling demonstrably changed (decision-revisit-gate), never on resubmission of the same change (owner, via `/roadmap:resolve-blockers`; D6)
- **Owner:** user
- **Blocks:** Phase 2 — 2.4
<!-- Class: 3 -->
- **Recommendation:** State whether a `refused-escalate` verdict is provisional (a later council round may revisit it, per [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md)) or final once the owner rules on it — the record names this as open and owner-owned ("not an indefinite veto unless the user adopts it as final").
- **If you do nothing:** Every owner-level refusal is treated as provisional by default (per the cited rule's general stance), which may not be the right default for every refusal class.
- **What to do:**
  1. State the default (provisional / final) and any exception classes, and record it as a `refused-escalate` finality note in `docs/contracts/ratification-artifact.md`.
- **Resolved when:** This blocker's `Status:` is `resolved` with the policy recorded.

> **AC-1 ticked 2026-10-12, and the tick is a STATE FLIP with no edit to the
> criterion's body — deliberately.** Its text already names the single
> outstanding item and the exact condition that closes it: *"Defect 4 is the one
> outstanding … Step 6.1 is that round. The criterion closes when 6.1 records its
> verdict; nothing else is missing."* 6.1 is now `[x]` and its verdict is recorded
> as D15, with its evidence committed at
> `agents/evidence/council/merge-serialisation-20261010.md`, so defect 4 now has
> the disposition the criterion asks for — council-decided-and-recorded.
> **Why no sentence was added inside the criterion:** `lint_plan_risk_register`
> hashes the Acceptance Criteria body and normalises checkbox STATE out of that
> hash, so a flip is free while a one-line note is a substantial change that
> would demand a re-stamp this calendar day cannot express — the same defect-4
> instance step 6.1 documents at length. The note therefore sits here, outside
> the hashed body, rather than being skipped or smuggled in.

## Acceptance Criteria

- [x] AC-1 — Every one of the six defects the authority-routing record
      surfaced has a disposition traceable to a specific phase step or
      blocker in this file (agent-fixed, council-decided-and-recorded, or an
      owner-routed blocker resolved).
      **Measured 2026-10-10 — 5 of 6, and the sixth is one council round away.**
      Each defect was traced to its named disposition rather than counted:
      defect 1 → step 4.3 `[x]`, agent-fixed; defect 2 → D1,
      council-decided-and-recorded; defect 3 → steps 5.1/5.2 `[x]` plus D2, both
      forms; defect 5 → blocker `defect-5-merges-ahead-of-completion-review`,
      **resolved** 2026-10-08 by the owner, plus D9; defect 6 → D14, recorded
      this date by the Phase 7 round.
      **Defect 4 is the one outstanding.** It is routed to Phase 6 — the file
      names it at the phase header and again at step 6.3 — but routing is not a
      disposition in any of the three forms this criterion lists, and no council
      has decided it. **Step 6.1 is that round.** The criterion closes when 6.1
      records its verdict; nothing else is missing.
- [ ] AC-2 — The three collapsed authorities (technical outcome, authority
      classification, authorisation to proceed) exist as separated,
      committed fields before Phase 3's verifier is built against them.
- [ ] AC-3 — No phase begins before its record-required predecessor's exit
      criteria are met — Phase 1 before Phase 2; Phase 2 before Phase 3;
      Phase 4 before broadening blocker detection; Phase 5 before removing
      the accidental comments; Phase 6 before completion review relies on
      review-instance identity; Phase 7 before live-tree checks are restored
      as required gates; Phase 8 last.
- [ ] AC-4 — The Phase 3 verifier is never activated as a required gate
      except through the `break-glass-authority-and-bootstrap-approval`
      blocker's resolution (Phase 8.3) — never on the agent's own
      determination that a shadow run "looked good enough".
- [x] AC-5 — `task lint-roadmap-blockers`, `task lint-roadmap-complexity`,
      and `task lint-plan-risk-register` (or their direct `./scripts-run`
      equivalents) pass against this file.
