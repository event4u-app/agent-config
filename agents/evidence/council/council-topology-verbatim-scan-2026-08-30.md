<!-- evidence-type: analysis -->

# Council-topology harvest — the verbatim scan, and what it could not reach

`road-to-inbox-harvest-2026-08-e-council-topology-evidence` step 0.4, executed
2026-08-30 under the resolution its blocker records: **option (c)** — publish
unreachability as the finding and scope the scan to prose this tree can diff
(AI council 2026-08-28).

## The finding that has to come first

**Upstream provenance was not reachable, and no run of this step can make it
reachable.** Establishing the licence state of a remote source needs the source
fetched at a pinned revision; this execution was offline. So this file does
**not** claim that the harvest sources carry no licence, and it does not claim
they carry one.

The blocker's own wording was corrected before it was acted on, and that
correction governs here: it originally said *"confirm no LICENSE → **no grant
exists**"*, which is too categorical — a grant may sit in file headers, package
metadata, accompanying terms, or another document in the same repository. The
defensible statement is *"no licence grant was located in the inspected
material"*, and the inspected material here is **this tree**, not the sources.

Source names stay anonymized, per `source-confidentiality`. The harvest rows
they correspond to are `council-topology-three-stage-shape`,
`council-advisor-lens-framing` and `council-cli-first-packaging` in
`provenance/harvests.jsonl`, each carrying an `opaque:` `source_ref`.

## What was scanned

| file | sha256 (12) | lines |
|---|---|---|
| `src/agent-src/personas/advisors/contrarian.md` | `7107310d15d9` | 95 |
| `src/agent-src/personas/advisors/executor.md` | `2f3478b7417c` | 99 |
| `src/agent-src/personas/advisors/expansionist.md` | `1b2c956ff4ce` | 98 |
| `src/agent-src/personas/advisors/first-principles.md` | `9e11d7e3c171` | 104 |
| `src/agent-src/personas/advisors/outsider.md` | `985a6516d995` | 102 |
| `src/scripts/ai_council/prompts.ts` | `d17619993629` | 886 |
| `src/scripts/ai_council/blind_review.ts` | `7f9c795aaf74` | 212 |

That is the corpus the step names — the advisor persona files plus the
peer-review and synthesis prompts — at the digests above, so a re-run can say
whether it read the same bytes.

## Commits read

The full authoring history of each file, not a sample:

| file | commits |
|---|---|
| the five advisor personas | `778898812`, `1307f804b`, `54de5a853`, and `084c220f0` (first-principles only) |
| `prompts.ts` | `4ec6f07c5`, `c65885e4b`, `b07b7229c`, `067175a04`, `474b1c68b`, `37103c3e6`, `02c786c28`, `30328d881`, `6ed729612` |
| `blind_review.ts` | `560a024b2`, `6f5db06f5` |

The harvest rows these are scanned against were added by `6e37584a1`
(step 0.3).

## Method — and why it is a proxy, said plainly

With no source text on disk, a phrase-diff has nothing on its other side. What
IS decidable offline is whether **this tree** carries prose bearing the marks of
lifted text. Three checks, each mechanical:

1. **Markdown blockquotes over 15 words** in the advisor prose. Fifteen is not
   arbitrary — it is `content-quoting-floor`'s own ceiling for a verbatim quote,
   so the scan uses the standard this repository already applies to quoting.
2. **Attribution markers** anywhere in the corpus — `as X puts it`,
   `quoted from`, `verbatim from`, `adapted from`, `borrowed from`,
   `taken from`, `per the original`. Prose that was lifted and left honest says
   so; this finds that case.
3. **Prose lines repeated verbatim between two advisor files** at ≥ 12 words.
   Five personas written from one source would share its phrasing; five written
   independently to a house template share the template's structure and not its
   sentences.

## Result

| check | hits |
|---|---|
| blockquotes > 15 words | **0** |
| attribution markers | **0** |
| verbatim prose lines shared between advisor files | **0** |

**Nothing was rewritten, because nothing matched.** That is a real result and
not an absence of effort — but it is a result about the three proxies above, and
it is worth being exact about what it does and does not license.

**What it supports:** no prose in the scanned corpus presents itself as quoted,
and the five advisor personas do not share sentences with each other.

**What it does not support:** it is not a similarity scan against the sources,
and it cannot be one offline. A passage rewritten closely enough to avoid these
three marks would not appear here. This is the same honesty boundary
`code-provenance` states for its own ledger — `lint_provenance` validates the
records, and "cannot see a claim nobody recorded".

## What remains for a maintainer

The half this execution could not do: fetch each harvest source at a pinned
revision, record its licence state, and — if no grant is located — run a real
phrase-diff against the fetched text. That is the follow-up the blocker's
resolution names, and it needs network access and the un-anonymized source
list, both of which sit with the maintainer rather than in this tree.
