---
complexity: lightweight
status: ready
---

# Road to reproducible artefact counts — a number a second counter cannot derive

> Candidate, not scheduled. Raised in review of
> `road-to-universal-stack-coverage`: a count gate whose definition an
> independent counter cannot reproduce is a smell for a claims-ledger culture,
> because exactly these numbers end up in READMEs, badges and reviews.

## The smell, measured

Adding one skill (`ui-apply-generic`) surfaced two facts:

- **`update_counts` does not anchor every position.** It reported "Counts
  already in sync" while `check_artefact_count_messaging` still found four
  mismatches: `docs/CLAIMS.md:327`, `docs/proof.md:53`, `docs/proof.md:104`,
  `CAPABILITIES.yaml:14`. Two were source positions needing a hand edit; the
  proof-page ones were downstream of one of them. The checker's own advice
  ("run `update_counts` for anchored positions, **or** correct the prose") is
  honest about the gap — but it means a count can drift and only a second,
  differently-implemented gate notices.
- **The scoped-projection figure is not independently derivable.** The claim at
  `CLAIMS.md:327` reads "ships 216 of 287 skills (untagged core plus
  engineering/maintainer packs)". An independent count written from that
  parenthetical produced **204**, not the published 215/216. The published
  number is right and the ad-hoc count is wrong — the real definition lives in
  the projection code and `docs/benchmark.md` — but a definition that a careful
  reader cannot re-derive from the claim's own wording is a claim that cannot be
  audited from outside.

At the time of writing neither was a live incorrectness. Both are the shape of
defect this repo's enforcement-coverage stance takes seriously: a gate that is
*nearly* mechanical.

## The trigger fired — the drift is live and compounding (2026-08-02)

The promotion condition at the bottom of this file was *"a count actually
drifts into a shipped surface"*. It has, and the drift widens on its own.

`docs/CLAIMS.md:335` claims the scoped default ships **217 of 288** skills
**"with the counting method pinned in the benchmark doc"**. The doc it names —
`docs/benchmark.md:244` — reads `| Skills projected | 286 | 215 | −71 (−25%) |`.
A reader who follows the claim to its own cited method finds different numbers.

It is not a one-off typo, it is mechanical:

- The scanner (`check_artefact_count_messaging`) matches `288 skills` in the
  claim and holds it to canonical, so a skill addition turns CI red until a
  maintainer hand-edits `288` → `289` and, by convention only, `217` → `218`.
- The projected figure `217` is matched by **no** gate at all.
- `docs/benchmark.md` is deliberately outside the scanner's surfaces (dated
  snapshots carry point-in-time counts by design), so `215/286` never moves.
- Therefore the gap between the claim and its cited method grows by one on
  every skill added. It was **1** on 2026-07-31 (`216/287` vs `215/286`) and is
  **2** today (`217/288` vs `215/286`). Nothing in the tree can observe this.

The second half of the promotion condition is met too: the scoped figure IS the
number a reader must audit — it is the headline of the default-install claim.

## What a fix would have to achieve

- [x] `update_counts` anchors **every** position `check_artefact_count_messaging`
      knows about — the two gates agree by construction, not by a maintainer
      running both and reconciling.
      <!-- Measured first: 9 of 19 count-shaped positions the scanner can flag
      were generator-blind (47%). Six were in the generated `docs/proof.md`;
      three were real sources. `anchor_coverage_gaps()` in the scanner now
      fails CI on any position it can flag that the generator cannot rewrite,
      with `GENERATED_DOWNSTREAM` the only exemption and each entry naming its
      generator. Kinds are mapped, not equated (`ANCHOR_KINDS`), so an
      active-command position can never be anchored to the raw total. -->
- [x] The scoped-projection count is emitted by the projection code itself and
      consumed by the claim, so "217 of 288" is generated rather than typed.
      <!-- `src/scripts/count_scoped_projection.ts` + the extracted
      `_lib/scoped_projection.ts`. The installer now imports the same module,
      so there is ONE predicate, not two copies. New canonical kinds
      `skills_scoped` and `commands_active`; both halves of the claim are
      anchored. Emitter reproduces 217 of 288 independently. -->
- [x] The definition behind it is stated where the claim is, precisely enough
      that an independent counter reproduces it — or the claim cites the emitter
      instead of restating a rule in prose.
      <!-- Cites the emitter (the council's C1). The lossy parenthetical is
      no longer load-bearing; `evidence:` moved from a substring-existence
      pointer at the benchmark doc to `exec:update_counts --check -> 0`, whose
      exit code IS the verdict. `docs/benchmark.md` now declares itself a
      2026-07-27 snapshot and points at the emitter for the live figure. -->
- [x] A regression witness: add a skill in a fixture and assert both gates move
      together.
      <!-- `tests/scripts/reproducible_artefact_counts.test.ts`, 12 tests:
      coverage has no gaps; an unanchored sentence IS reported and an anchored
      one is NOT (both halves, so the gate is falsifiable); untagged fixture
      skill moves total AND projection, inactive-pack skill moves total only;
      the runtime overlay flips the pruned one back in. -->

## What this fixed on the way (it was not hypothetical)

`check_command_count_messaging` was **red on `main`** when this branch opened:
the README Commands badge said 191 and `docs/getting-started.md` said 191,
against a canonical 192. Both positions had been deliberately left out of
`update_counts.TARGETS` to "avoid double-ownership" with that checker — so
nothing generated them, and they drifted exactly there. That is this roadmap's
thesis reproduced live, not a coincidence: the carve-out *was* the gap.

Anchoring them to the new `commands_active` kind fixed the red. Generator
writes, checker verifies — that is the ownership split the scanner's own header
describes, and it is not a conflict.

## Council — 2026-08-02 (deep, 3 rounds, 2 members, $0.08 actual)

**Decision 1 (how the gates come to agree): A2, both members.** Derive the
generator's positions from the scanner's patterns (A1/A3) is *unsafe*: one
prose kind maps to several canonical numbers — "N commands" in prose means
ACTIVE (total minus shims), and the scoped sentence carries the projected
count beside the catalog total. A naive unification would silently rewrite a
position to the wrong number. Adopted, with the members' `context`
refinement implemented as `ANCHOR_KINDS`.

**Decision 3 (may a dated snapshot contradict a live claim it is cited by):
C1, both members.** The claim names the emitter; the benchmark table declares
its date. Their added content-hashing of frozen snapshots was **not** adopted —
a new mechanism outside this roadmap's scope, and the second member argued
against the added complexity in the same session.

**Decision 2 (the scoped figure): SPLIT — B1 adopted over the B3 variant.**
One member proposed replacing the count with a tolerance-banded percentage and
demoting "217 of 288" to dated documentation that "can drift by 1-2 without
failing CI". That is precisely the status quo that produced this defect — the
observed drift *was* 2 — so the proposal reproduces the bug it was asked to
fix, and a ±3% band is weaker falsifiability than an exact derived number.
Its three stated risks were checked against the tree rather than accepted:
the **circular-dependency** risk is false here (the projection predicate never
reads canonical counts — verified); "projection changes break the count gate"
is the *intended* property, not a defect; and a projection bug corrupts only
the projected kind, which is equally true of the percentage it proposed. The
legitimate half of the objection — *no silent rewrite* — is honoured:
`update_counts --check` fails loudly in CI with the old and new numbers.

## Non-goals

- **Not a new counting mechanism.** The canonical numbers are already correct;
  this is about making one derivation the single source and the other stop
  hand-typing.
- **Not a rewrite of the claims ledger.** One claim's number becomes generated;
  the ledger's shape is untouched.

## Why this was `draft`, and why it is now `ready`

The original gate read: *"Nothing is wrong in the tree today, and the cost of
the wrong fix — a second counting path that disagrees with the first — is worse
than the smell. Promote to `ready` when a count actually drifts into a shipped
surface, or when the scoped figure is needed somewhere a reader must audit it."*

Promoted 2026-08-02 because **both** halves of that condition are now met (see
§ The trigger fired). The lock's own condition fired; this is not a
re-litigation of the deferral.

The lock's stated cost — a second counting path that disagrees with the first —
remains binding and is carried into the non-goals below: the fix adds no new
counting mechanism, it removes the hand-typing.
