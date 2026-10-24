<!-- evidence-type: analysis -->

<!-- A prompt for the council, written 2026-10-24 for branch drain/one-detector-20261024,
     round 1, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/one-detector-20261024, round 1 — the senders detect through `detectNormalized`

Ratification review under ADR-268 § 4. `check_kernel_edit_ratified --base origin/main`
gates exactly one file on this branch: `src/scripts/_lib/egress_normalize.ts`
(hook-plumbing source — it is in the dispatch import closure because
`knowledge_global_redaction.ts` imports `HIDDEN_UNICODE_RE` from it). Reviewed
commit `9010d6ba90`; subject digest
`7d6343157ff5ec5ee52b13ac3be5ece882591284702ca3ad1d45f5e84d45e2ab`, from
`./scripts-run src/scripts/ratification_subject --files $(git diff --name-only origin/main...HEAD) --base-ref origin/main`.

Read the delta with `git diff origin/main...drain/one-detector-20261024`. Every
file in it, not only the gated one, is in scope.

## What the branch does

Roadmap `road-to-one-detector-and-the-senders-we-own` step 2.5 built
`detectNormalized` (detection after removing invisible characters and folding
Cyrillic/Greek lookalike letters to Latin, spans mapped back to original
offsets), but no production path called it. This branch calls it from:

1. `replaceValues` in `src/scripts/_lib/egress_token.ts` and `tallyText` in
   `src/scripts/_lib/egress_text.ts` — both in the egress engine chunk the
   dispatcher loads lazily (egress stage, injection path);
2. `CouncilEgress.replace` and `CouncilEgress.check` (the final check before a
   council member call) in `src/scripts/ai_council/council_egress.ts`.

To keep the engine chunk under its 32,000-byte ceiling without a raise, the
`LATIN_TWIN` map moved out of `src/scripts/_lib/confusables.ts` (which also
carries four script regexes the chunk would otherwise include) into
`egress_normalize.ts`, encoded as a string of three-hex-digit code points aligned
with a string of Latin letters; and `normalizeForDetection` keeps one `origin`
array instead of two, computing a span's end from the original character's
length. The decoded map was checked equal to the old one (50 entries, same
pairs). The chunk measures 31,907 B (`check_hook_bundle_composition`).

Four new tests in `src/scripts/_lib/egress_normalize.test.ts`
(› `the senders read through the normalisation`) fail with the three call sites
reverted and pass with them.

## The question

Classify the change and look for defects:

- **Verdict:** `confirmed-non-expanding` (touches a gated surface, expands no
  authority), `ratified` (expands authority, and you approve), or
  `REQUEST_CHANGES` with the findings that block it.
- **Defects to look for, not limited to:** a span mapped back to the wrong
  original offsets (astral characters, a hidden character at a span edge, a
  folded letter at a span edge); a replacement extent (`through`) computed on
  the original text from a mapped span that now refuses or under-replaces; a
  final check that refuses a body it should pass, or passes one it should
  refuse; a misaligned `FOREIGN`/`LATIN` pair; anything the dispatcher now loads
  or runs that it did not before.

State which files you actually read.
