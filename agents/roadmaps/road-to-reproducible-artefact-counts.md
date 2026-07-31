---
complexity: contained
status: draft
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

Neither is a live incorrectness. Both are the shape of defect this repo's
enforcement-coverage stance takes seriously: a gate that is *nearly* mechanical.

## What a fix would have to achieve

- [ ] `update_counts` anchors **every** position `check_artefact_count_messaging`
      knows about — the two gates agree by construction, not by a maintainer
      running both and reconciling.
- [ ] The scoped-projection count is emitted by the projection code itself and
      consumed by the claim, so "216 of 287" is generated rather than typed.
- [ ] The definition behind it is stated where the claim is, precisely enough
      that an independent counter reproduces it — or the claim cites the emitter
      instead of restating a rule in prose.
- [ ] A regression witness: add a skill in a fixture and assert both gates move
      together.

## Non-goals

- **Not a new counting mechanism.** The canonical numbers are already correct;
  this is about making one derivation the single source and the other stop
  hand-typing.
- **Not a rewrite of the claims ledger.** One claim's number becomes generated;
  the ledger's shape is untouched.

## Why this is `draft`

Nothing is wrong in the tree today, and the cost of the wrong fix — a second
counting path that disagrees with the first — is worse than the smell. Promote
to `ready` when a count actually drifts into a shipped surface, or when the
scoped figure is needed somewhere a reader must audit it.
