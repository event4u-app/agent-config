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
estate_growth_exempt: "The eight new blockers are the owner-reserved items the authority-routing council record (agents/evidence/council/authority-routing-20261007.md) and this roadmap's own blocker-contract routing require: credential custody, revocation, approval expiry, merge strategy, break-glass authority, the review-attempt bound, refusal finality, and whether trunk changes may land ahead of completion review. Each is a governance decision the record explicitly withholds from both the agent and the council (record's dangerous-action test, predicates 3 and 5), so none can be resolved by writing code instead of asking — closing this roadmap's own disposition table required naming all eight in the same change rather than discovering them piecemeal across later changes."
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

- [ ] Read `agents/evidence/council/authority-routing-20261007.md` in full —
      it is the specification this roadmap executes, not a reference to
      summarise from memory.
- [ ] Read `docs/contracts/ratification-artifact.md` — the existing,
      already-shipped mechanism (verdict vocabulary, `seats:` field, provider
      diversity, platform-anchor trust layer, emergency-use procedure) this
      roadmap generalises and hardens. No phase below re-invents a verdict
      vocabulary, a provider-diversity check, or an emergency procedure the
      contract already has; each phase amends or extends it.
- [ ] Confirm `agent-config council:status` reports a configured, two-provider
      council before executing any "run the council" step below —
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

- [ ] **1.1 Run the council on the hold's mechanical form.** Does declaring,
      in `docs/contracts/ratification-artifact.md`, that every gated-surface
      commit made by Phases 2–3 below lands through the EXISTING, unchanged
      ladder (ADR-268 § 4, narrowed for the self-modification surface by
      ADR-281 § 2 where it applies) — no new bypass, no new exemption —
      satisfy this record item? Or does the scope of Phase 2's verdict-field
      split require a stronger, separate hold (e.g. a temporary CI check
      scoped to the files Phases 2–3 will touch)? Record the verdict as a
      `## Decisions` row in this file.
      verify: `grep -c '^## Decisions' agents/roadmaps/road-to-authority-routing-mechanism.md` -> /^1$/
- [ ] **1.2 Implement whichever hold 1.1 selects**, before Phase 2.3 (the
      verdict-field split) lands its first commit. A doc-only hold is
      recorded as a sentence in `docs/contracts/ratification-artifact.md`
      naming this roadmap; a CI-check hold ships with its own test.

*Exit: 1.1 is recorded and 1.2's hold is in place (doc sentence or CI check,
whichever 1.1 chose) before any Phase 2 commit lands. Rollback: revert 1.2;
the existing ADR-268/ADR-281 ladder is unchanged and still governs every
gated-surface commit, so reverting loses nothing already relied upon.*

## Phase 2 — The vocabulary: predicates, review instances, the three-way verdict

*Record, required sequencing, item 2.*

- [ ] **2.1 Run the council on the committed-contract question.** Where does
      the six-predicate dangerous-action test (record § 4) live — a new
      `docs/contracts/dangerous-action-predicates.md`, or a section appended
      to `docs/contracts/ratification-artifact.md`? Record the verdict as a
      `## Decisions` row.
- [ ] **2.2 Commit the six-predicate test verbatim**, at the location 2.1
      chose, with the "uncertainty routes to council, a council finding a
      predicate applies routes authorisation to the user" rule (record § 4)
      stated beside it.
      verify: `grep -rc 'Non-trivial loss, disclosure, expenditure' docs/contracts/` -> /^[1-9]/
- [ ] **2.3 Separate the collapsed verdict into three fields** in the same
      contract: `technical_outcome` (did the proposed change do what it
      claims), `authority_class` (dangerous / non-dangerous, per 2.2's test),
      `authorisation` (may it proceed — only ever set by the authority 2.2
      routes to). Every existing `verdict:` consumer
      (`check_kernel_edit_ratified.ts`, `_lib/ratification_artifact.ts`) is
      listed with whether it reads the old field, the new fields, or both
      during migration — this step documents the mapping, it does not change
      the consumers.
      verify: `grep -c 'authority_class' docs/contracts/ratification-artifact.md` -> /^[1-9]/
- [ ] **2.4 Extend the `refused` vocabulary** to distinguish
      `refused-correctable` (names a concrete in-scope defect or asks for
      obtainable evidence — record § 6, "the agent remediates and
      re-submits"), `refused-non-convergent` (the existing `non-convergent`
      state), and `refused-escalate` (compliance would require a dangerous
      action, expanded authority, or user-owned intent — record § 6's
      escalation list). Each review-instance revision that remediates a
      `refused-correctable` retains the prior objection and shows its
      disposition (record § 6).
      verify: `grep -c 'refused-correctable' docs/contracts/ratification-artifact.md` -> /^[1-9]/
- [ ] **2.5 Define the review-instance model**: a stable identity across
      revisions of the same proposal, carrying its full history of prior
      objections and dispositions, so a remediation is provably the same
      review continuing rather than a fresh one laundering a prior refusal.
      verify: `grep -c 'review.instance' docs/contracts/ratification-artifact.md` -> /^[1-9]/

*Exit: 2.2–2.5 are committed and `check_references` is clean against the new
contract paths. Rollback: revert the contract commit(s) — nothing downstream
depends on them yet, because no consumer is wired until Phase 3.*

## Phase 3 — The approver registry and the protected verifier

*Record, required sequencing, item 3. The seven owner-reserved blockers below
(`credential-custody-for-approver-registry` through
`refusal-finality-policy`) gate specific steps in this phase — read their
`Blocks:` fields before assuming 3.2 can ship a working registry rather than
a stub.*

- [ ] **3.1 Run the council on the approver-registry identity mechanism**,
      explicitly excluding commit author/committer metadata and a
      `~/.gitconfig` comparison (record § 2 — "an agent able to run Git can
      generally set those values"). Candidates to evaluate: a signed
      attestation bound to {repository, review-instance id, subject digest,
      base revision, verdict, policy version, approver identity, timestamp,
      prior-refusal references}; or binding to the existing platform-anchor
      layer (`check_platform_anchor`, `src/config/platform-anchor.json`) that
      `ratification-artifact.md` already trusts for branch integrity. Record
      the verdict as a `## Decisions` row.
- [ ] **3.2 Implement the registry** per 3.1's verdict, as an additive layer
      beside the existing platform-anchor trust stack — never a replacement
      for it without its own ratification (the contract's own rule: "a later
      change that removes the deny needs its own ratification and cannot cite
      this one").
      verify: `test -f src/config/approver-registry.json` -> 0
- [ ] **3.3 Build the verifier** that checks a ratification record's bound
      attestation against the registry from 3.2, read from the BASE revision
      only — mirroring `check_kernel_edit_ratified.ts`'s existing defence
      against a candidate diff supplying the code that judges it.
      verify: `npx vitest run tests/scripts/check_approver_registry.test.ts` -> 0
- [ ] **3.4 Close the dealbreaker.** Choose exactly one, and record which:
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

- [ ] **4.1 Run the council on cross-file blocker-id semantics.** What legal
      states can a blocker id referenced from a file other than the roadmap
      that declared it have — unresolved-local-only, resolved-elsewhere,
      orphaned, superseded? `lint_roadmap_blockers` has no notion of this
      today. Record the verdict as a `## Decisions` row.
- [ ] **4.2 Encode the chosen semantics** in `lint_roadmap_blockers` (or the
      contract it reads, `templates/roadmaps.md` rule 20), with a regression
      test for each new legal state.
      verify: `npx vitest run tests/scripts/lint_roadmap_blockers.test.ts` -> 0
- [ ] **4.3 Fix the vacuous-clean report** (record defect 1 — agent-owned,
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

- [ ] **5.1 Run the council on the contract question**: should the
      `*.review-input/roadmap.md` snapshots' positional exemption from
      `check_agent_artifact_location` (currently an accidental side effect of
      `check-refs`'s two-line skip header pushing the frontmatter fence off
      byte offset 0 — see `REVIEW_INPUT_ROADMAP_HEADER` in
      `dispatch_r2_reviewer.ts` and the `FM_RE` docstring in
      `check_agent_artifact_location.ts`) become a DECLARED convention
      (an explicit allowlist, a dedicated marker the gate reads on purpose) —
      or is the documented accident, with its regression test, a sufficient
      discharge on its own? Record the verdict as a `## Decisions` row.
- [ ] **5.2 Implement the council's chosen mechanism** before any future
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
half of defect 3; it does not decide 5.1's contract question.

## Phase 6 — Stable review instances and merge serialisation, before completion review relies on them

*Record, required sequencing, item 6. Disposition: defect 4 (council) — "review
hashing without serialisation still reviews a head that is no longer the
merge candidate."*

- [ ] **6.1 Run the council on the merge-serialisation mechanism** for
      `check_completion_review.ts` / `dispatch_r2_reviewer.ts`'s review-scope
      hash: how does a review instance (Phase 2.5) stay bound to the actual
      merge candidate across a same-day re-review, given concurrent
      in-flight branches (including `road-to-self-modification-that-a-council
      -must-pass`, which touches adjacent files)? Record the verdict.
- [ ] **6.2 Implement stable review-instance identity** (Phase 2.5's model,
      now wired) and the chosen serialisation mechanism from 6.1.
      verify: `npx vitest run tests/scripts/check_completion_review.test.ts` -> 0
- [ ] **6.3 Wire `check_completion_review` to express a same-day re-review**
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

- [ ] **8.1 Shadow-run the Phase 3 verifier** against the last N merged PRs
      (N decided by the council in 8.2) without gating anything — collect a
      false-positive / false-negative report comparing its verdicts against
      what actually happened.
      verify: `test -f agents/evidence/analysis/authority-verifier-shadow-run.md` -> 0
- [ ] **8.2 Run the council on the shadow-run's acceptance bar** — what
      false-positive / false-negative rate, over what N, justifies
      activation. Record the verdict.
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

*Exit: 8.3's six conditions each have a passing test and the bootstrap
authorisation blocker is resolved. Rollback: the verifier stays shadow-only —
reverting 8.3 alone (never 8.1–8.2's evidence) is sufficient, since nothing
before 8.3 gates anything.*

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-07 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Verdict-field split breaks existing consumers | implementation | Separating `verdict` into three fields (step 2.3) can silently desynchronise `check_kernel_edit_ratified.ts` / `_lib/ratification_artifact.ts` if the migration mapping is wrong, reopening the exact "false record" failure `ratification-artifact.md` was written to prevent. | Step 2.3 requires listing every existing consumer and its read-mode BEFORE any schema change lands; the verifier is built and shadow-run (step 8.1) before anything is gated on the new fields. | Phase 2, Phase 8 |
| 2 | Concurrent work on the same contract surface | implementation | `road-to-self-modification-that-a-council-must-pass` (PR #2251) amends `docs/contracts/ratification-artifact.md`'s ladder section concurrently with this roadmap's Phase 1–3 work; a Phase 1 or Phase 2 step written against today's text can conflict with that merge. | `relates:` declares the `extends` relation; the Context and Prerequisites sections instruct re-reading the live contract at execution time rather than trusting this file's quoted text. | Phase 1, Phase 2 |
| 3 | Activation without the full break-glass set | product | Flipping the verifier to a required gate (step 8.3) before all six break-glass stop conditions are implemented would recreate the dealbreaker the whole roadmap exists to close — a silent-fail-open path. | Step 8.3's own checklist names all six conditions and requires a passing test per condition before activation; the break-glass blocker is a structured, owner-routed gate, not a step the agent can self-clear. | Phase 8 |

## Blockers

### blocker: defect-5-merges-ahead-of-completion-review
- **Status:** open
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
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 3 — 3.2 (approver registry implementation)
<!-- Class: 3 -->
- **Recommendation:** Decide who holds the signing credential (or equivalent platform identity) the registry in Phase 3.1/3.2 binds to, and how it is stored — this is custody of a real credential, which the dangerous-action test's predicate 5 (recovery needs a privileged credential) routes to you.
- **If you do nothing:** Phase 3.2 cannot choose a concrete registry implementation; it stays a design sketch.
- **What to do:**
  1. Name the credential type — (a) a signing key, (b) a platform app identity, or (c) a required-reviewer group bound via the existing `platform-anchor.json` layer — and where it lives.
- **Resolved when:** This blocker's `Status:` is `resolved` with the custody decision recorded.

### blocker: approver-credential-revocation-policy
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 3 — 3.2
<!-- Class: 3 -->
- **Recommendation:** Define how an approver credential is revoked (departure, compromise, role change) and how fast the registry must reflect it — a revocation policy is a standing authority decision, not a technical default the agent should pick.
- **If you do nothing:** The registry ships with no revocation path, so a compromised or stale credential stays valid indefinitely.
- **What to do:**
  1. Name the revocation trigger — (a) departure, (b) credential compromise, or (c) role change — and the maximum propagation delay.
- **Resolved when:** This blocker's `Status:` is `resolved` with the policy recorded.

### blocker: ratification-approval-expiry-window
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 2 — 2.3 / Phase 3 — 3.3
<!-- Class: 3 -->
- **Recommendation:** Set the `effective_after` / approval-expiry window a passing authorisation stays valid for before it must be re-derived against a changed subject — a staleness window is a risk-appetite call.
- **If you do nothing:** The existing `effective_after` field (merge, or an ISO-8601 instant) stays the only expiry notion; Phase 2's three-way split has no window to attach the new `authorisation` field to.
- **What to do:**
  1. State the default expiry window, and whether it may vary by `authority_class`.
- **Resolved when:** This blocker's `Status:` is `resolved` with the window recorded.

### blocker: supported-merge-strategies-for-ratified-changes
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 6 — 6.1 (merge-serialisation design)
<!-- Class: 3 -->
- **Recommendation:** Name which merge strategies (merge commit, squash, rebase) a ratified change may land through — squash and rebase both risk destroying the provenance the break-glass section (record, and Phase 8.3) depends on, so this is a standing policy choice, not a per-PR one.
- **If you do nothing:** Phase 6.1's council round has no fixed constraint to design the serialisation mechanism against, and squash/rebase-induced provenance loss (one of the six break-glass stop conditions) has no policy backing it.
- **What to do:**
  1. Name the allowed strategy or strategies for any PR carrying a ratification artifact, and record it in a new `## Supported merge strategies` section of `docs/contracts/ratification-artifact.md`.
- **Resolved when:** This blocker's `Status:` is `resolved` with the policy recorded.

### blocker: break-glass-authority-and-bootstrap-approval
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 1 — 1.1 (interim hold/bootstrap form) and Phase 8 — 8.3 (activation)
<!-- Class: 3 -->
- **Recommendation:** Name who may exercise the break-glass / external-bootstrap-approval path once the verifier is a required gate, and under what evidence — this is the Hard-Floor-adjacent authority the record's break-glass section reserves explicitly ("never let an agent select the older permissive path").
- **If you do nothing:** Phase 8.3 has no authority to activate against and stays blocked indefinitely, which is the safe default but leaves the whole mechanism shadow-only.
- **What to do:**
  1. Name the break-glass authority (yourself, a named role, a specific credential) and the minimum evidence a bypass must record, and add it to the `docs/contracts/ratification-artifact.md` § Emergency use procedure as the named authority for this mechanism.
- **Resolved when:** This blocker's `Status:` is `resolved` with the authority and evidence bar recorded.

### blocker: review-attempt-bound
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 2 — 2.4 (refused-vocabulary remediation loop)
<!-- Class: 3 -->
- **Recommendation:** Set the bounded number of materially-changed remediation attempts (record § 6: "the council is non-convergent after a bounded number of materially changed attempts") before a `refused-correctable` escalates to `refused-escalate` — an unbounded loop risks review shopping in the other direction (never escalating).
- **If you do nothing:** Phase 2.4 ships the three-way `refused` split with no numeric bound, so "a bounded number of attempts" stays undefined and unenforceable.
- **What to do:**
  1. State the bound (a number, or a rule for deriving one), and record it as a `max_remediation_attempts` field in `docs/contracts/ratification-artifact.md`.
- **Resolved when:** This blocker's `Status:` is `resolved` with the bound recorded.

### blocker: refusal-finality-policy
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 2 — 2.4
<!-- Class: 3 -->
- **Recommendation:** State whether a `refused-escalate` verdict is provisional (a later council round may revisit it, per [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md)) or final once the owner rules on it — the record names this as open and owner-owned ("not an indefinite veto unless the user adopts it as final").
- **If you do nothing:** Every owner-level refusal is treated as provisional by default (per the cited rule's general stance), which may not be the right default for every refusal class.
- **What to do:**
  1. State the default (provisional / final) and any exception classes, and record it as a `refused-escalate` finality note in `docs/contracts/ratification-artifact.md`.
- **Resolved when:** This blocker's `Status:` is `resolved` with the policy recorded.

## Acceptance Criteria

- [ ] AC-1 — Every one of the six defects the authority-routing record
      surfaced has a disposition traceable to a specific phase step or
      blocker in this file (agent-fixed, council-decided-and-recorded, or an
      owner-routed blocker resolved).
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
- [ ] AC-5 — `task lint-roadmap-blockers`, `task lint-roadmap-complexity`,
      and `task lint-plan-risk-register` (or their direct `./scripts-run`
      equivalents) pass against this file.
