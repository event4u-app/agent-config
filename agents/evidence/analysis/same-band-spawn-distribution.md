# Same-band spawn distribution — what the dispatch record already knew

> `road-to-inbox-harvest-2026-08-d-top-band-model-economy` Step 1.2, run
> 2026-08-15 over the full `agents/runtime/state/audit/` corpus (2026-07 and
> 2026-08). The maintainer gated the ADR-035 band question on this reading
> rather than answering it in the abstract; this page is that reading.

## The corpus

| Measure | Value |
|---|---:|
| Dispatch records | **313** |
| …carrying a named model family | **40** |
| …carrying none | **273** (87.2 %) |

**The 273 are fully explained and are not a blind spot.** Every one is an
async launch acknowledgement, which by design carries no usage object and
therefore no model id — the hook records the dispatch and fabricates nothing.
That is the intended shape, not a measurement failure.

## The distribution

Over the 40 records where the host reported a model:

| Family | Dispatches | Share |
|---|---:|---:|
| `opus` | 35 | 87.5 % |
| `fable` | **2** | 5.0 % |
| `haiku` | 2 | 5.0 % |
| `sonnet` | 1 | 2.5 % |

Read plainly: **almost every dispatch that reported a model ran at or above the
top mapped tier.** One ran on `haiku`, one on `sonnet`; the downshift the
routing policy describes is, in this corpus, close to theoretical.

## The finding — the two vocabularies disagree, in the tree

This is the part the maintainer's decision was waiting for, and it needed no
new instrument:

| Vocabulary | Contents | Count |
|---|---|---:|
| `MODEL_FAMILIES` (`orchestration_record_hook.ts:158`) | `haiku`, `sonnet`, `opus`, **`fable`** | **4** |
| `TIER_TO_CLAUDE_MODEL` (`_lib/model_tier.ts:28-32`) | `high→opus`, `medium→sonnet`, `lite→haiku` | **3** |

The telemetry layer already recognises a fourth model family and has been
recording dispatches against it. The tier layer — the vocabulary every
`model_tier:` declaration, every `inherit` resolution and the judge ladder are
written in — has three bands and no name for it.

**ADR-035's reopen condition reads: *"reopen if a vendor ships a band the three
tiers cannot express without a fourth"*.** That condition is now satisfiable
from the tree rather than from a cost impression: a fourth family is enumerated
in shipped code, and 2 dispatches are recorded against it.

Three limits, stated rather than glossed:

- **n = 2 for the fourth band.** Two dispatches is an existence proof, not a
  rate. It establishes that the band is reachable and used; it says nothing
  about how much spend rides on it.
- **One machine, one operator.** The corpus is this developer's own runtime
  state, not a fleet.
- **`MODEL_FAMILIES` is a detection list, not a ranking.** It proves the tree
  can *name* the family. Nothing in it asserts the band sits above `opus` —
  that ordering is still an operator claim, and the decision below rests on it.

## What this does not settle

The distribution cannot say how often `inherit` resolved to a top band, because
the record carries no session tier: `session_tier` exists in the schema and the
hook never fills it. The 87.5 % `opus` share is the share of *dispatches*, not
proof that any of them inherited rather than declared.

Step 1.1 addressed an adjacent gap — an unmapped model id and an unreported one
used to produce identical records — and the honest reading of this corpus is
that **the gap never fired here**: all 273 tier-less records are async acks, and
every reporting record matched a known family. 1.1 closed a real hole in the
instrument; this corpus shows it was a latent one, not an active loss.

## Consequence for the band decision

The reopen condition is **satisfiable on tree evidence**, and the tier
vocabulary is measurably one band short of the telemetry vocabulary that ships
beside it. Whether to open ADR-035 remains the maintainer's call — the ordering
claim (that the fourth band is *above* the top mapped tier) is still theirs, not
this page's. What has changed is that the question no longer rests on an
impression: the asymmetry is two constants in two files, and it is quotable.
