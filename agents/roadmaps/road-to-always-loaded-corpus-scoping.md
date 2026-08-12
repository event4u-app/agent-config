---
complexity: standard
status: ready
---

# Roadmap: Scope the always-loaded rule corpus

> The token-regression gate was re-anchored 101,670 → 106,704 because a 707-token
> rule edit met a cliff that main had already spent 4,327 tokens of. The anchor
> bought room; it did not fix the shape. This roadmap answers whether `paths:`
> scoping can shrink the always-loaded corpus **on the hosts that actually load
> it** — and is pre-registered to accept "no" as a result.

## Context

Two gates measure the same corpus from different ends and both are strained:

- `check_token_regression` / `eager_rule_load` — 106,704 exact-BPE tokens of
  projected rule prose. Every non-trivial rule edit competes for a 5% allowance
  against inherited growth, so the contributor who happens to cross the line pays
  a condensation round for reasons unrelated to their change. That is the failure
  this roadmap addresses; the re-anchor only moved when it next happens.
- `check_standing_rule_delivery` — red on maintainer machines at ~185,000–192,000
  tokens against a 110,000 cap, because Claude Code loads `~/.claude/rules/` and
  `<project>/.claude/rules/` **both**, user layer first, with no dedup. The
  installer's `--layer` gate addresses the doubling; it does not reduce either
  layer's own size.

The two are independent: layer suppression halves a doubled corpus, scoping
shrinks the corpus itself. Doing only the first leaves ~107,000 tokens standing.

### What is already settled, and must not be re-litigated

**Thin projection is measured and did not ship.** Replacing non-kernel rule
bodies with pointers reduced eager rule load 78,513 → 13,881 GPT-tokens
(~65.6% on the whole always-loaded projection) and **failed the quality gate** —
thin win-rate 36.2% against a required 48%. It un-defers only behind
`discipline_profile: essential`. See `docs/proof.md` and
`internal/bench/reports/token-baseline.json`.

`paths:` scoping is a **different mechanism** and that verdict does not transit
to it: thin projection removes the body from every context; scoping keeps the
full body and changes *which sessions receive it*. A rule that does reach a
session reaches it intact, so the quality mechanism the thin arm broke is not the
one under test here. Phase 3 measures scoping on its own evidence — and if it
fails, it fails for its own reasons, recorded separately.

### The risk that decides whether this is buildable at all

**No host runs the tier-2 rule router.** Rules are projected to the host rule
directories and loaded from there; the `triggers:` blocks in rule frontmatter
have no runtime consumer on Claude Code. If `paths:` is likewise inert at load
time — i.e. the host loads every file in `~/.claude/rules/` regardless of what
its frontmatter declares — then scoping cannot reduce what a session receives,
and the only lever left is **which files get projected in the first place**.

That is the most likely outcome and Phase 1 exists to establish it before any
rule is touched. A roadmap that starts by editing rules and discovers this in
Phase 3 has spent its budget on the wrong layer.

## Prerequisites

- [ ] Read `AGENTS.md`, `docs/contracts/rule-router.md`, and
  `docs/contracts/kernel-membership.md`.
- [ ] Read the `standing_rule_delivery` derivation in `src/config/budgets.yml`
  and the topology evidence it cites.
- [ ] Confirm the current numbers rather than trusting this file: run
  `./scripts-run src/scripts/check_token_regression` and
  `./scripts-run src/scripts/check_standing_rule_delivery`.

## Phase 1: Establish whether scoping can reach the load path at all

- [ ] Determine, from `compile_router.ts` and `condense.ts`, exactly which rule
  set is written to each host rule directory, and whether any frontmatter field
  (`paths:`, `triggers:`, `type:`) narrows that set or is projection-inert.
- [ ] Determine what the host does at load time with a `paths:`-carrying rule —
  read the host's own documented contract, not this package's intent. Record the
  citation; an inference is not an answer here.
- [ ] Write the verdict to `agents/evidence/analysis/` as one page: **can a
  declared scope reduce what a session receives, yes or no, with the mechanism
  named.**
- [ ] If NO — record it and stop the roadmap here. The finding redirects the work
  to projection-set selection, which is a different roadmap and a different
  decision; converting this one in place would hide that the original hypothesis
  was refuted.

## Phase 2: Inventory — what could legitimately be scoped

- [ ] Produce a per-rule token cost table for the projected corpus (exact BPE via
  `src/scripts/_lib/token_count.ts`), sorted by cost.
- [ ] For each rule above the median, classify: **universal** (fires regardless of
  stack or surface), **surface-scoped** (only meaningful for a file class this
  package can name), or **pack-scoped** (already gated by an installed pack).
- [ ] Record the honest count of universal rules and their summed cost. If the
  universal set alone exceeds a useful ceiling, scoping has a hard floor and the
  roadmap says so rather than proposing a cut it cannot deliver.
- [ ] Kernel rules are out of scope for narrowing — their membership is a
  contract decision, not a token decision (`docs/contracts/kernel-membership.md`).

## Phase 3: Pilot on a bounded set, measured before and after

- [ ] Pick the smallest set of clearly surface-scoped rules that together carry a
  measurable share of the corpus. Declare the set and the expected token delta
  **before** editing anything.
- [ ] Apply `paths:` to that set only. Regenerate the projections.
- [ ] Measure: `eager_rule_load`, `standing_rule_delivery`, and — the part that
  decides adoption — whether a session in a matching directory still receives the
  rule and a session outside it does not. A token win with an unchanged delivered
  corpus is not a win.
- [ ] Run the routing-matrix eval for every touched rule; a scoped rule that stops
  reaching its own positives is a regression regardless of its token saving.

## Phase 4: Decide and record

- [ ] Adopt, adopt-partially, or reject on the Phase 3 evidence against the
  Phase 3 declaration. No re-cutting the target after seeing the number.
- [ ] Record the decision as an ADR — including a rejection, which is the outcome
  the Phase 1 risk makes likely and which is worth as much as an adoption.
- [ ] If adopted: re-anchor `token-baseline.json` deliberately, with the
  itemised note the file's convention requires.
- [ ] If rejected: state plainly in the ADR what the remaining lever is, so the
  next contributor meeting the cliff finds the answer instead of re-deriving it.

## Acceptance criteria

- The Phase 1 verdict exists as a citable page and names the mechanism, whichever
  way it goes.
- No rule's routing-matrix positives regress.
- Any token claim is measured with the exact tokenizer, before and after, on the
  same machine.
- An honest null is a completed roadmap, not an abandoned one.

## Risks

| Risk | Type | Mitigation |
|---|---|---|
| `paths:` is projection-inert on the hosts that matter, so scoping cannot reduce delivered tokens | implementation | Phase 1 establishes this first and is authorised to end the roadmap |
| A scoped rule silently stops firing where it should | implementation | Routing-matrix eval per touched rule in Phase 3; a positive that stops matching blocks adoption |
| The thin-projection null is read as covering this work | product | Named and distinguished in Context; the mechanism-match difference is stated before Phase 1 |
| Scoping shrinks the corpus but the doubled-layer topology keeps delivery over cap | implementation | The two are measured separately in Phase 3; neither result is reported as the other |
