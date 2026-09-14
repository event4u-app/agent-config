---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-adversarial-verification-and-long-runs
    relation: extends
    note: AC-2's independent authorship pass produced these four findings; they are about the authority implementation rather than about its tests, so that roadmap carried them here rather than folding them in
---
# Road to authority object exactness

> **Source:** the independent test-authorship and validation pass of 2026-09-14
> over `tests/e2e/adversarial-verification-fixtures.test.ts` — `anthropic` and
> `openai`, two providers, peer-reviewed, `2/2 present` after each of three runs.
> The full record, including the prompts, is
> `agents/evidence/analysis/ac2-independent-test-authorship-2026-09-14.md`.
>
> Nine findings from that pass were folded straight into the fixtures the same
> day. **These four were not, and the reason is the same for all four:** they are
> defects in the authority *implementation*, not in its tests, and every one sits
> on a surface `security-sensitive-stop` puts a threat pass in front of. A run
> whose scope was closing an acceptance criterion is not a run that should be
> quietly re-deciding how a force-push gets authorised.

## Goal

`typed_op_grant.ts` cannot be talked into treating a category, a punctuation
run, or an empty operation as the exact object a Hard-Floor confirmation must
name; and `mission_record.restore` cannot resume a mission under a grant the
ledger describes differently from the snapshot. Each of the four holds below has
a test that was red before the fix and is green after, and the threat pass that
preceded the first edit is recorded.

## Phase 1 — Threat-model before the first edit

- [ ] **1.1 Run the threat pass over the two modules, and record it.** Both are
      authorization surfaces: `typed_op_grant` decides whether a typed op
      proceeds, `mission_record.restore` decides whether a mission resumes under
      a grant. `security-sensitive-stop` puts this before the first edit rather
      than after, and the four findings below are the input, not the conclusion —
      a wider hole found here is in scope.
      verify: an `agents/evidence/analysis/` artefact naming the abuse cases, the
      missing controls and the negative tests each fix owes, dated and committed
      BEFORE any change to either module.

## Phase 2 — Make the exact object exact

- [ ] **2.1 A category can no longer pass as an object.** `objectIsExact`
      currently accepts any string of eight or more characters containing one
      non-letter, so `!!!!!!!!` and `all-branches` both pass. Both council seats
      reported this independently, and `openai` named the consequence plainly:
      the "exact object" guarantee the Hard Floor rests on is not real. Replace
      the length-and-punctuation heuristic with per-op structure — a force-push
      names a remote, a full ref and a SHA; a send names a recipient and a
      subject; a purchase names an amount and a card suffix.
      verify: a test asserting `!!!!!!!!`, `all-branches` and `category-1` are
      each refused, red before the change; and the shipped exact object for each
      typed op still grants.
- [ ] **2.2 An empty or whitespace-only `op` cannot grant.** Nothing validates
      `op` today, so a confirmed ask carrying `op: ''` and a well-formed object
      is granted. The object is checked and the verb is not, which is the half
      that names what is about to happen.
      verify: a test over `''`, `'   '` and a tab-only `op`, each refused, red
      before the change.
- [ ] **2.3 Decide whether `confirmed` can carry "this turn" at all.** The Hard
      Floor's wording is a THIS-TURN confirmation; a bare boolean cannot express
      it, so a confirmation from an earlier turn is indistinguishable from a
      fresh one. This step is deliberately a decision rather than an
      implementation: adding a turn or session identifier touches how every
      caller constructs an ask, and doing that as a side effect of a
      not-real-exactness fix is how one change becomes three.
      verify: either a turn identifier on `ExactObjectAsk` with a test that a
      prior-turn confirmation does not grant, or a recorded decision naming why
      the boolean is the right shape and what carries "this turn" instead.

## Phase 3 — The ledger's grant identity

- [ ] **3.1 A restore under a DIFFERENT grant is not a resume.** `restore` reads
      `ledger.revoked_by` and ignores `ledger.grant`, so a record carrying grant
      A and a ledger describing grant B resumes as though the two agreed. The
      one-way precedence the module already documents — the ledger may revoke,
      never revive — is correct and unaffected; what is missing is that the two
      are about the same grant before either wins.
      verify: a test where the snapshot and the ledger name different grants,
      red before the change, asserting the restore refuses rather than resumes.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-14 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A stricter exactness check refuses a legitimate object | implementation | Per-op structure is narrower than a heuristic by construction, so an op whose real object does not fit the declared shape stops being grantable at all — a Hard-Floor ask that can never be answered is worse than a loose one | Every typed op's shipped object is asserted to still grant, in the same change as the refusal cases; an op with no declared shape keeps the current behaviour rather than being refused by default | Phase 2 — Make the exact object exact |
| 2 | The threat pass is skipped because the four findings read like a complete list | process | They came from a review of the TESTS, not of the modules, so they are what an outside reader could see from the assertions — treating them as the whole population is the sampling error `downstream-changes` names | Phase 1 gates the first edit on a recorded pass whose input is the modules, and states that a wider hole found there is in scope | Phase 1 — Threat-model before the first edit |

## Acceptance Criteria

- [ ] AC-1 — a recorded threat pass over both modules predates the first edit to
      either, and names the negative tests each fix owes.
- [ ] AC-2 — `!!!!!!!!`, `all-branches`, an empty `op` and a whitespace-only `op`
      are each refused, by a test that was red before its fix.
- [ ] AC-3 — a snapshot and a ledger naming different grants do not resume, and
      the ledger's one-way revoke precedence is unchanged.
- [ ] AC-4 — "this turn" is either enforceable from the type or recorded as
      deliberately not enforced there, with what carries it instead.
