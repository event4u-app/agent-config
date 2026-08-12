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

**And in this repository the first is not available at all.** `ADR-226` records
why: the global layer is a superset of the project layer except for
`source-of-truth.md`, which only the project layer carries, so `--layer=global`
buys tokens by dropping the rule that protects every generated projection in the
one repository that has them. Layer suppression stays a consumer remedy. That
makes corpus size the only lever here, which is what raises this roadmap from
nice-to-have to the sole open path.

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

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-13 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | `paths:` is projection-inert on the hosts that matter | implementation | No host runs the tier-2 rule router, so `triggers:` already has no runtime consumer. If `paths:` is likewise ignored at load time, scoping cannot reduce what a session receives and the entire premise is void — discovering that in Phase 3 means the budget went to the wrong layer | Phase 1 establishes it before any rule is touched, from the host's own documented contract rather than from this package's intent, and is explicitly authorised to end the roadmap on a NO | Phase 1: Establish whether scoping can reach the load path at all |
| 2 | A scoped rule silently stops firing where it should | implementation | A rule that saves tokens by no longer reaching its own trigger surface is not a saving, it is a lost obligation — and the loss is invisible, because nothing fails when a rule quietly does not load | Routing-matrix eval for every touched rule in Phase 3; a positive that stops matching blocks adoption regardless of the token win | Phase 3: Pilot on a bounded set, measured before and after |
| 3 | The thin-projection null is read as covering this work | product | Thin projection measured −65.6% and failed the quality gate at 36.2% vs 48% required. Someone reading only the headline may close this roadmap as already-answered, or conversely re-run the failed arm under a new name | Context names the null explicitly and states the mechanism-match difference — scoping keeps the body intact for sessions that receive it, so the mechanism the thin arm broke is not under test — before Phase 1 begins | Context |
| 4 | Scoping succeeds but delivery stays over cap | implementation | The doubled-layer topology and the corpus size are independent problems. A real scoping win could still leave `check_standing_rule_delivery` red, and reporting either result as the other would overstate the outcome | Phase 3 measures `eager_rule_load` and `standing_rule_delivery` separately and requires both numbers in the Phase 4 decision | Phase 3: Pilot on a bounded set, measured before and after |
| 5 | The target is re-cut after the number lands | product | The honest-null outcome is the likely one, and the temptation at Phase 4 is to redefine success to match whatever was measured — the exact goalpost-shift this package's pre-registration convention exists to prevent | Phase 3 requires the target set and expected delta to be declared before editing; Phase 4 decides against that declaration and records a rejection as an ADR with equal standing to an adoption | Phase 4: Decide and record |
