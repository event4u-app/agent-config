---
proposed_by: road-to-one-detector-and-the-senders-we-own step 2.5 (reopened 2026-10-23 because detectNormalized had no production importer)
implemented_by: claude-opus-5.5 session on drain/one-detector-20261024
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 2 of 2026-10-24
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: 08cea2fa47ed5542eb4301510ade1216ecf13bace3380423d6fdc3e7c57635ee
---

<!-- evidence-type: ratification -->

# Ratification — the senders detect through invisible characters and lookalike letters

`check_kernel_edit_ratified --base origin/main` gates two files on this branch:
`src/scripts/_lib/egress_normalize.ts` (hook-plumbing source: it is in the dispatch
import closure because `knowledge_global_redaction.ts` imports `HIDDEN_UNICODE_RE`
from it) and `src/config/hook-bundle-budget.json`. The `subject:` digest covers
both, computed with
`./scripts-run src/scripts/ratification_subject --files $(git diff --name-only origin/main...HEAD) --base-ref origin/main`
at revision `462aa3560f`, the commit round 2 reviewed. The commits after it touch
only tests, the roadmap and evidence files; the gated files are byte-identical.
The header is the output of
`ratification_header --seat anthropic=ratified --seat openai=ratified`.

## What was ratified

- `replaceValues` (`_lib/egress_token.ts`) and `tallyText` (`_lib/egress_text.ts`),
  both in the lazily loaded egress engine chunk, and the council's
  `CouncilEgress.replace` and final `check` (`ai_council/council_egress.ts`) detect
  through the normalisation of one-detector 2.5: invisible characters removed,
  Cyrillic and Greek lookalike letters folded to Latin, spans mapped back.
- `detectWithExtent` runs a rule's extent reader (`through`, or the council's
  `maskingEnd`) on the normalised text and maps its end back, so a key block whose
  BEGIN and END markers both carry an invisible character is removed whole.
- `LATIN_TWIN` moved from `confusables.ts` into `egress_normalize.ts` as a string
  of three-hex-digit code points aligned with a string of Latin letters (checked
  equal to the old map, 50 pairs, once by script; the existing test holds every
  key inside `CONFUSABLE_FOREIGN`).
- The engine chunk ceiling rises 32,000 -> 33,000 with a `raise_log` entry; the
  chunk measures 32,305 B. The dispatch bundle is unchanged.

## The rounds

**Round 1** — prompt
`agents/evidence/council/one-detector-normalize-wiring-ratification-20261024.question.md`,
reviewed commit `9010d6ba90` (digest `7d6343…e2ab`, one gated file). Both seats
answered the first round, but the run recorded no verdict: the second (peer)
round was refused before sending by the council's own final egress check, because
a round-1 answer quoted an example key block with an invisible character in its
markers. The answer texts were not kept. The fragment captured at the refusal
named a real defect: extent readers still searched the original text, so such a
block was refused by `replaceValues` and left its body behind in the council's
masking path. A second attempt hit the local CLI counter (51/50) and was reset per
the owner's standing CLI-only instruction; nothing in either attempt reached a
verdict.

**Round 2** — prompt
`agents/evidence/council/one-detector-normalize-wiring-ratification-r2-20261024.question.md`,
reviewed commit `462aa3560f`, run with `--rounds 1` so no answer is forwarded to
a peer round. Quorum 2/2, concluded, $0.00 (subscription CLI seats).

- **anthropic: `ratified`.** Walked `back`, `fwd` and the extent fix; found no
  offset-mapping defect; judged the raise justified. Noted, non-blocking, that
  `fwd(back(i))` need not round-trip when a hidden character sits at the boundary.
  Its answer cites a test "latin twin matches old confusables map" that does not
  exist; the equality was checked once by script, as stated above, not by a test.
- **openai: `ratified`.** Classified the change as an enforcement expansion, hence
  `ratified` rather than `confirmed-non-expanding`; no blocking defect. Named the
  multilingual false-positive boundary as the main remaining risk and asked for
  boundary tests and negative Greek/Cyrillic prose cases, and for the
  `CouncilEgress.replace` (masks through `s.end`) vs `replaceValues` (refuses) null
  policy to be confirmed intentional.

## What was done with the findings

- Offset boundaries and multilingual prose: tests added after round 2 in
  `egress_normalize.test.ts` › `offsets around hidden and astral characters` (a
  hidden character before, inside and after a value, behind an astral character,
  each mapped to an exact original slice; Greek and Cyrillic prose detects
  nothing). They change no gated file.
- The null-extent policy difference is intentional and predates this branch:
  `replaceValues` is a refusing surface, `maskingEnd` the masking surface that
  "cannot refuse", as `egress_rules.ts` documents at `maskingEnd`.
