<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-22, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence). Not edited after the run. -->

# Does the 2026-10-16 typeface-lock amendment need owner authorization, and does any exist?

Repository: event4u/agent-config, a governed skill/rule/command suite published to npm.
Release under preparation: 17.0.0. A release review raised the item below, and a
two-seat release council ruled it must be closed before the cut, with the reason:
"Weakening an owner-reserved licensing commitment without demonstrated
authorization is a governance blocker despite adequate packaging checks."

## The governance rule that applies

The repository's `decision-revisit-gate` routes a reopened decision to the AI
council by default, and reserves to the OWNER any transition that "creates /
removes / weakens a legal, regulatory, contractual, licensing, compatibility, or
public commitment". It also says: "Venue comes from the proposed transition ...
never from who decided originally." A split, abstention or a transition that
cannot be bounded from evidence escalates to the owner.

## The facts

1. A 2026-06-28 decision ("no typeface bundler") exists in the tree only as a
   citation inside roadmaps. No tracked record of it exists; its original
   decision-maker is not recorded.
2. On 2026-10-16 a two-seat council (anthropic, openai; 2/2) amended it, in an
   analysis record (`agents/evidence/council/benchmark-fixture-fonts-20261016.md`),
   not an ADR. Amendment text: "The 2026-06-28 no-typeface-bundler lock binds
   published artefacts. No typeface binary may reach a consumer through any
   distribution channel. It does not bind repository-only benchmark fixtures,
   which are bounded by four conditions": (1) a check inspects the produced
   npm tarball, not the configuration; (2) the carve-out covers typeface
   fixtures for one reconstruction benchmark only; (3) each added family needs
   an explicit decision; (4) only OSI-approved SPDX licences, each licence text
   committed beside the family and listed in `docs/THIRD-PARTY-NOTICES.md`.
3. The blocker's `Owner:` line read "council (maintainer if the council splits —
   it did not split)". No owner statement covering this transition is in the tree.
   The record does not state whether the council judged the transition
   non-weakening, or why it was not routed to the owner.
4. Condition 1 is implemented: `tests/scripts/typeface_fixture_bound.test.ts`
   runs `npm pack --dry-run --json` and asserts no `.ttf/.otf/.woff/.woff2/.ttc`
   path is in the tarball; it also asserts every committed font file is listed
   in a manifest with an allowed SPDX id, a licence file and a sha256.
5. The committed fonts are repository-only under `tests/fixtures/fonts/`
   (outside `package.json#files`), under OFL-1.1 or similar OSI licences.

## The question

Classify the 2026-10-16 transition, then state the disposition.

- (A) NOT owner-reserved: the commitment to consumers ("no typeface binary in
  any published artefact") is unchanged and now mechanically checked; what
  changed is the repository's own internal storage of OSI-licensed test
  fixtures, which creates no new licensing obligation on consumers. The
  disposition is to record this classification and its reasoning in the
  2026-10-16 record so the routing is shown.
- (B) Owner-reserved: committing third-party font binaries to a public
  repository is itself a licensing commitment (redistribution of the binaries
  through the git repository), so narrowing the lock is a weakening the council
  could not take. The disposition is to suspend the amendment's effect — remove
  the committed fixture binaries and revert to fetch-by-checksum (option (b) of
  the original blocker) — until the owner authorizes it, and record that.
- (C) Something else; state it.

Answer with one letter, a one-sentence decisive reason, and, for (A) or (C), the
exact sentence the record should carry. Do not assume an outcome in either
direction; no answer is preferred.
