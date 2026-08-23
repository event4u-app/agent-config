---
complexity: bounded
---

# Stub: road to fixture seams for the three unprovable pack gates

> **Stub — not active work.** A **drain-run transfer**, created 2026-08-23 when
> [`road-to-org-pack-fitness.md`](../archive/road-to-org-pack-fitness.md) was
> drained. That roadmap's Phase 2 assumed all six pack-fitness gates could be
> driven from a fixture tree; three cannot, and for one of them the block is a
> deliberately pinned contract. Outcome state on the parent: **transferred**.

## The probe that promotes this

```
A NARROW ADR-200 AMENDMENT AUTHORIZES AN ISOLATED-ROOT SEAM ON A PORTED GATE,
PRESERVING DEFAULT BEHAVIOUR AND SILENT ACCEPTANCE OF EXISTING ARGUMENTS.
```

That amendment is the **prerequisite, not a step**. Nothing here may be built
before it lands: `lint_pack_first_win`'s own header pins *"the CLI contract is
pinned — `main()` IGNORES argv entirely"* as a port-fidelity guarantee, so adding
`--root` to it contradicts a recorded decision rather than merely extending code.

## What is missing, per gate

| Gate | Blocker | Kind |
|---|---|---|
| `lint_pack_first_win` | pinned argv-ignoring contract (ADR-200 port fidelity) | **design-level** — needs the amendment |
| `lint_pack_dependencies` | `main()` takes no argv; pack home from `import.meta.url` | effort-level |
| `prove_pack_extractable` | `prove(pack)` resolves by name under the real `src/packs/`; two tests use that signature | effort-level |

The design/effort split is load-bearing and is carried into
`docs/contracts/pack-conformance.md` as its own column: a pack author needs to
know whether a gap is forbidden or merely unbuilt.

## Acceptance criteria — set by the council, not by this stub

The AI council that produced this transfer (2026-08-23, verdict (s), 2 of 2
convergent after a 1–1 split) named three, and all three are hard:

1. **ADR-200 authorization exists** for an isolated-root seam on a ported gate.
2. **Every corpus-derived path and dead-scope assertion is redirected — not
   merely pack discovery.** This was the refinement neither seat had in round 1
   and it is the one that makes the difference between a real seam and a false
   green: a partially-redirected root mixes fixture state with repository state,
   and the harness then reports conformance it did not measure.
3. **Six violating twins exist, each failing exactly one gate** while the other
   five pass. Three exist today (`tests/fixtures/pack-conformance/twins/`); the
   remaining three are the deliverable.

## What already ships, so this is an extension and not a restart

`src/scripts/check_pack_conformance_fixture.ts` is the harness; the fixture is
layout-neutral data under `tests/fixtures/pack-conformance/`; the generated page
is `docs/contracts/pack-conformance.md`. Adding a gate means adding a `GATES` row
with `mechanism: 'fixture-tree'`, a twin directory, and a projection function —
the shape is established, the three new seams are the work.

## Why a partial temp-tree copy is not a shortcut

Four of the six gates carry dead-scope assertions, so a skeleton root holding
only the fixture exits `2` ("scanned 0 … the scan scope is dead"), not `0`. Only
a full tree copy per twin would satisfy them — six full copies per CI run. This
was measured, not assumed, and it is why the seam has to be in the gates.

## Blocking cost — measured, and it is not zero

```yaml
blocking_cost:
  observations:
    - dimension: blocked_items
      value: 3
      source: "three of six pack-fitness invariants are CI-contract-only; a pack author cannot pre-check them"
  unknowns: [interruptions, context_tokens]
```

`blocked_items: 3` is a real measured count, not an estimate: exactly three
invariants a third party cannot verify before submitting to CI. The two unknowns
stay unknown — no third-party pack has been onboarded against this surface yet,
so nothing has been observed about how often the gap costs a round trip.
**"No cost was observed" is not "the cost is zero."**

## Reopens when

The probe above returns true, **or** ADR-200 explicitly rejects every
isolated-root seam — in which case this stub is cancelled rather than promoted,
and `docs/contracts/pack-conformance.md` becomes the permanent answer rather
than an interim one. The council named both directions deliberately: a 90-day
stall with no ADR-200 decision signals abandonment, and an explicit rejection
signals the retrofit was never viable. Either way the ambiguity ends.
