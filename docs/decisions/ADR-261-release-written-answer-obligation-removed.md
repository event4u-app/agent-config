---
adr: 261
status: accepted
date: 2026-09-07
decision: release-written-answer-obligation-removed
supersedes: ADR-253 (§ the response obligation only)
superseded_by: —
type: structural
reopen_policy: owner
protected_dimensions: governance
provenance:
  kind: human
  decision_makers: [owner]
  human_directed: true
evidence:
  strength: E1
  basis:
    - docs/decisions/ADR-253-per-pr-user-artifact-gate-declined.md
    - docs/contracts/CHANGELOG-conventions.md
    - src/scripts/_lib/release_highlights.ts
    - src/scripts/_lib/release_material.ts
    - src/scripts/release_publication.ts
    - src/scripts/check_release_highlights.ts
    - docs/archive/CHANGELOG-pre-14.20.0.md
review_trigger: >-
  Owner ruling only. Not reopened by a further argument that release notes would
  be more informative with a next-cycle statement in them — that argument was
  the basis of the removed obligation and is answered here. A reinstatement
  needs a mechanism that does not put a writing task between a green pipeline
  and a published version.
---

# ADR-261 — the release's written-answer obligation is removed; the mix stays measured

## Status

Accepted, owner-directed, 2026-09-07. Removes the response obligation ADR-253
attached to the release-mix measurement. ADR-253's actual decision — the
**decline** of the per-PR user-artifact gate — stands untouched, as does the
measurement itself.

## Context

ADR-253 declined an external reviewer's per-PR user-artifact gate and offered a
release-level substitute: `measure_release_mix` publishes a governance-versus-
product ratio, and when governance-only commits outnumbered consumer-only ones
the release section had to carry a **written human answer** naming the next
cycle's consumer work. A later round added a second obligation on top — the
following release had to read that promise back and report `shipped` / `did not
ship` / `withdrawn` with a reason.

By 2026-09-07 the mechanism around those two sentences was:

- four refusal sites (`guard_release_curation`, `guard_release_branch_push`,
  `check_governance_mix_response`, `check_previous_promise_readback`);
- two placeholder sentinels, a 40-character length floor, a three-word outcome
  vocabulary;
- a staging channel under `## [Unreleased]` (`staged_response`,
  `drop_staged_response`, `apply_mix_answer`, `apply_readback`) and a write seam
  through `release_env.ts` that existed only to serve it;
- an interactive prompt inside `task release`.

What it produced, measured across four consecutive releases:

- **14.18.0, 14.19.0, 14.20.0** — the obligation was discharged **by hand,
  mid-release**, after the pipeline had bumped the version and aborted. At
  14.19.0 the answer had already been staged one commit earlier and nothing
  read it, so it was moved by hand anyway.
- **14.21.0** — the staging-and-prompt mechanism built to fix that ran for the
  first time and made things worse. `staged_response` located its markers with
  an unanchored `body.indexOf(marker)` over the whole `## [Unreleased]` body, so
  it matched the **prose of the changelog entry describing itself**, cut two
  sentences out of the middle of that entry, pasted them into the 14.21.0
  release head as orphan fragments, and then prompted for the answer anyway
  because the fragments were not answers. A `task release` run corrupted both
  sections of the file it was governing.

## Decision

**The written-answer obligation is deleted, in both halves.** No release stops,
prompts, or refuses over a statement about a future cycle, and no release owes a
read-back of an earlier one. The `> **Governance mix:** …` line stays, rendered
end to end by the generator from `measure_release_mix` — a measurement, reported
because it is free and true.

The reason is the package's purpose, and it is the owner's to state:
**agent-config exists to make the maintainer's work cheaper.** A gate that halts
a green pipeline until a human types prose about work that has not happened yet
moves cost onto the person the tool is for. Four releases paid that cost; none
of them shipped differently because of it.

The corruption is evidence, not the argument. The argument is that the
obligation was never about a claim the release makes — it was about the absence
of a claim regarding a *later* release, which is a planning question and not a
publication-integrity one.

## Consequences

**Removed:** `mix_response_blockers`, `promise_readback_blockers`,
`previous_promise`, `readback_answer`, `human_answer`, `mix_response_block`,
`MIX_RESPONSE_MIN_CHARS`, `MIX_RESPONSE_PLACEHOLDER(S)`, `PROMISE_PHRASE`,
`PROMISE_READBACK_MARKER`, `PROMISE_OUTCOMES`, `staged_response`,
`drop_staged_response`, `apply_mix_answer`, `apply_readback`, `unreleased_body`,
the `write_changelog_text` / `_set_changelog_writer` seam,
`check_governance_mix_response`, `check_previous_promise_readback`, and the
interactive prompt in `guard_release_curation`. Net, measured with `git diff
--numstat` rather than estimated: **−296** lines in `release_highlights.ts`
(+19/−315), **−157** in `check_release_highlights.ts` (+0/−157), **−202** in
`release_publication.ts` (+31/−233). The first draft of this line carried three
estimated figures and a neutral review falsified all three, one of them by more
than 2×; they are re-measured here because this repository treats an ADR's own
numbers as checkable.

**Kept, deliberately.** Every honesty control about a claim *this* release makes
is untouched: `DERIVED_MARKER` (the generator's unrewritten draft head) still
blocks, `CURATED_HEAD_INSTRUCTION` still blocks, the `_none_` contradiction check
still blocks, and the `Tests: N` footer is still required at the section level.
Those refuse an unreviewed statement about the release being published. That
distinction is the whole of this record: the release is answerable for what it
says about itself, and for nothing else.

**Historical sections keep their lines as published.** The promise and read-back
lines in 14.18.0 through 14.20.0 are release content; nothing retro-fails and
nothing is paraphrased.

**Tested as denials.** `release_material.test.ts` and
`check_release_highlights.test.ts` assert that the removed predicates and
sentinels are absent from the module surfaces, each with a positive control so a
rename cannot make the case vacuous, and that a section carrying no written
answer is publishable. A removal pinned only by the absence of its old specs is
one nothing stops from being reinstated by accident.

## Alternatives

**Fix the `indexOf` anchor and keep the obligation.** Rejected by the owner. It
repairs the corruption and leaves the cost: the fourth release in a row would
still stop a green pipeline to ask for a sentence. The bug is what made the
question urgent, not what made the answer this one.

**Downgrade the refusals to warnings.** Rejected on this tree's own measured
evidence: `check_release_highlights.ts`'s header records five consecutive
releases shipping an advisory placeholder that nobody rewrote — *"a warning that
has been ignored eighteen times is not a warning; it is a comment."* A warning
here would be the same dead line, with the machinery still in the tree.

**Keep only the read-back, drop the promise.** Incoherent — a read-back with
nothing to read back is inert, and the promise is the half that costs the
writing.

## Evidence

Every item is verifiable in the tree at the revision this record lands on.

| Claim | Where |
|---|---|
| Four refusal sites existed | `git show HEAD:src/scripts/_lib/release_highlights.ts` (`mix_response_blockers`, `promise_readback_blockers`), `HEAD:src/scripts/check_release_highlights.ts` (`check_governance_mix_response`, `check_previous_promise_readback`) |
| The obligation was discharged by hand across three releases | `docs/archive/CHANGELOG-pre-14.20.0.md:123` — *"changelog: answer the 14.18.0 next-cycle promise"* (`a9bd75d`), a released commit whose whole subject is a promise answered by hand. The `[Unreleased]` entry that also recorded this is REWRITTEN by this same change, so it is not cited: an evidence row must point at bytes the reader will actually find |
| `staged_response` matched prose, not a blockquote line | `git show HEAD:src/scripts/_lib/release_highlights.ts` — `const idx = body.indexOf(marker)` over the whole `## [Unreleased]` body, with no `^> ` anchor |
| It corrupted the 14.21.0 head and the `[Unreleased]` entry | the two orphan fragments the 14.21.0 run pasted under `> **Governance mix:**`, and the gap it left mid-bullet in the `[Unreleased]` § Fixed entry, both repaired in this change |
| A warning would be ignored | `src/scripts/check_release_highlights.ts` header § *"REVERSED 2026-09-01"* — eighteen advisory placeholder lines across five released sections |
| The removal is pinned | `tests/scripts/release_material.test.ts` § *"governance-mix line — measured, never demanded"* and `tests/scripts/check_release_highlights.test.ts` § *"no promise read-back is owed (ADR-261)"*, each with a positive control |

**What this record does not establish.** Whether the released *sections* were
worse for lacking a next-cycle statement is not measured, and no claim here rests
on it. The decision is that the cost fell on the maintainer and the owner
declines to pay it — not that the statement had no value.

## References

- [`ADR-253`](ADR-253-per-pr-user-artifact-gate-declined.md) — the decline this
  record leaves standing, and the response obligation it removes.
- [`CHANGELOG-conventions.md`](../contracts/CHANGELOG-conventions.md)
  § Governance-versus-product line — the contract, rewritten in the same change.
- [`release-runbook.md`](../release-runbook.md) § 6 — the operator-facing
  checkpoint, corrected in the same change.
