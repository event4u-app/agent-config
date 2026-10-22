<!-- evidence-type: analysis -->

# The 2026-06-28 typeface lock covers shipped artefacts — (a), as an explicit amendment

**Date:** 2026-10-16 · **Members:** `anthropic`, `openai`
**Mode:** prompt, 2 rounds, peer review, blind chairman · **Cost:** $0.00 (subscription transport)
**Quorum:** 2/2 concluded · **Verdict: `(a)` — convergent, against the roadmap's own recommendation**

Closes the `benchmark-fixture-fonts` blocker on `road-to-type-with-a-witness`
and rewrites its step 5.8. The question: does the 2026-06-28 no-typeface-bundler
lock cover shipped artefacts only, or the whole repository?

**The roadmap recommended (b).** Both seats picked (a). That reversal is the
reason the round was run rather than the recommendation taken, and it is
recorded here rather than smoothed over.

| Seat | Pick | Decisive reason |
|---|---|---|
| `anthropic` | `(a)` | committed evidence is the right durability for a benchmark baseline |
| `openai` | `(a)` | a checksum authenticates a retrieved file; it cannot make an unavailable file retrievable |

## What both seats held

**The lock's original scope was npm distribution.** It was written while
deciding what the published package contains. Repository-only benchmark
evidence sits outside that scope.

**The deciding principle is reproducibility of a public claim.** This benchmark
is the only run permitted to put a reconstruction claim into `docs/CLAIMS.md`.
A first-class claim should meet the bar other first-class claims meet: it is
re-derivable from the tree. Under (b), an upstream source disappearing leaves
the repository carrying a claim nobody can reproduce.

**The lock is amended, never quietly reinterpreted.** Both seats insisted on
this independently. openai: narrowing "bundles" to mean published artefacts
*"changes or narrows the textual rule; it does not preserve every plausible
literal reading. That is acceptable, but it should be described honestly as an
amendment."* The roadmap's own phrasing — that (b) "keeps the lock literal" —
is therefore the honest half, and (a) is chosen in full knowledge that it
narrows the text.

**This record is where the amendment lives.** A search of
`agents/evidence/council/` returns no tracked record of the 2026-06-28 lock: it
exists in this tree only as a citation inside roadmaps. The amendment is stated
below because there is no prior record to amend.

## The amendment, stated

> The 2026-06-28 no-typeface-bundler lock binds **published artefacts**. No
> typeface binary may reach a consumer through any distribution channel. It
> does **not** bind repository-only benchmark fixtures, which are bounded by
> the four conditions below.

## The four conditions the verdict is bounded by

**1. Verification inspects the produced archive, not the configuration.**
Excluding fixtures from `package.json#files` is necessary and not sufficient. A
CI check examines the generated tarball (`npm pack --dry-run`), and the bound
extends to release archives, container build contexts, provenance bundles and
any future packaging route. Any typeface binary inside a published tarball is a
plain miss, whatever fraction of the size it is.

**2. The exception is bounded to typeface fixtures for this benchmark.**
anthropic raised the precedent directly and it is adopted: without a stated
bound, "non-shipped binary fixtures" becomes a category that drifts — audio
samples for a transcription benchmark, image sets for a vision test. The
amendment covers typeface families for the reconstruction benchmark and nothing
else.

**3. Fixture additions are approved, never drive-by.** A later family joins the
set by an explicit decision, so the carve-out does not become the path of least
resistance.

**4. "Openly licensed" is concrete.** The set is bounded to OSI-approved SPDX
identifiers, with each licence text committed beside the family and recorded in
`docs/THIRD-PARTY-NOTICES.md`.

## One condition that is about the benchmark, not the lock

The evaluated skill receives **only the rendered image**. Fixture names, paths,
metadata and repository access would contaminate the held-out comparison, and
committing the fixtures makes that contamination easier to reach by accident
than fetching them would have. Raw measurements, the frozen thresholds and the
fixture identities are retained alongside the verdict.

## Revisit-if

- A typeface binary is found in any published artefact — the amendment's single
  bright line.
- Licence review of the fixture set becomes a recurring chore. This is the real
  trigger; the family counts and megabyte figures floated in round one are
  unsupported and are not adopted.
- The exception is cited to admit a binary class other than typeface fixtures
  for this benchmark.

## Suspension — 2026-10-22 (release finding `341079d844b6`)

This record does not show why the amendment was not routed to the owner,
although `decision-revisit-gate` reserves a weakened licensing commitment to the
owner whatever the original lock's author. Asked directly on 2026-10-22
(`typeface-lock-amendment-routing-20261022.md`), the council split: `anthropic`
held the transition council-routable (the consumer-facing prohibition is
unchanged and checked), `openai` held it owner-reserved (committing the binaries
is public git redistribution). A split escalates, so the classification is an
open owner decision. Until the owner decides, the amendment's effect is
suspended fail-closed: the three binaries are removed from the tree, the
manifest records the suspension, and the bound test refuses their return. The
four conditions above stay in force for the day it is lifted.

