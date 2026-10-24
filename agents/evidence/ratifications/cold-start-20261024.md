---
proposed_by: road-to-a-cold-start-paid-once step 2.5, owner directives D16, D17 and D18 of 2026-10-24
implemented_by: claude-opus-5.5 session on drain/cold-start-20261024
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), rounds 8 and 11 of 2026-10-24
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: 06864a9b871a1fec33038eb14b1d5887e5dee83b9cc175f26d13127e2884d8d3
---

<!-- evidence-type: ratification -->

# Ratification — the user's own instruction layer in the subagent-constraints digest

`check_kernel_edit_ratified` gates four hook-plumbing files on this branch:
`src/scripts/hook_manifest.yaml`, its compiled `src/scripts/hook_manifest.json`,
`src/config/hook-bundle-budget.json` and `src/config/hook-token-budget.json`. The `subject:` digest
covers all four, computed with
`./scripts-run src/scripts/ratification_subject --files $(git diff --name-only origin/main...HEAD) --base-ref origin/main`
at revision `1d68436d65`. Round 8 ratified the change at `63bf410d65`; the branch then merged
`origin/main`, which had changed two gated files, so the digest moved and rounds 9 to 11 reviewed
the merged content of all four files; round 11 ratified it, and no gated file changed after it. The header
is the output of `ratification_header --seat anthropic=ratified --seat openai=ratified`.

## What was ratified

- **`subagent-constraints` extended to the user layer, as authority-expanding in scope.** For a
  subagent whose definition sets `omitClaudeMd: true`, the digest now also carries
  `<config dir>/CLAUDE.md`, the files it imports one level deep (each read once, by real path), and
  each rule under `<config dir>/rules/` by its Iron Law blocks. A user file can permit as well as
  forbid; the concern grants no tool, file or process permission and writes nothing, so
  `effect: context` stands. Both seats classified the change that way and approved it.
- **Priority.** The first law block of each rule in the concern's floor list (the three safety-floor rules,
  then the consequence-class rules alphabetically; owner decisions D17 and D18), placed whole or left
  out, later blocks not carried and marked; then the project files nearest first; then the user
  files; then every other rule. Only a count-only inventory is reserved ahead of the floor laws;
  every left-out floor rule is named while the cap allows, and counted after that. Below the size of
  the header and inventory the digest is a short diagnostic, or nothing.
- **Budgets.** The per-injection row rises 4,096 → 9,728 bytes, below the host's 10,000-character
  `additionalContext` line. The lazy chunk's ceiling rises 12,500 → 24,500 bytes (measured 23,843)
  with one `raise_log` entry. The dispatch bundle is unchanged.

## How it got here

Eleven rounds, CLI subscription seats (`anthropic/claude-sonnet-4-5`, `openai/codex-default`), USD
0.00. Questions committed verbatim as
`agents/evidence/council/cold-start-user-layer-ratification-r{1..11}-20261024.question.md`, each
written before its run and not edited after it. Every fix below landed with a test seen red first.

- **Round 1, first attempt, no seat answered:** the council's local CLI call counter read
  exhausted; it was reset and the same question re-run unchanged.
- **Round 1, refused 2/2:** floor rules classified by basename; the file limit could miss a floor
  rule; an import named by two paths was read twice. Fixed.
- **Round 2, refused 2/2:** the user-file inventory was cut mid-entry. Fixed.
- **Round 3, refused 2/2:** labels shortened at 160 bytes. Fixed.
- **Round 4, refused 2/2:** later floor law blocks ranked below project and user files. Fixed.
- **Round 5, split (confirmed-non-expanding / refused):** named inventories reserved ahead of the
  floor laws (fixed); the floor overflow named as an owner choice, decided as D17 ("2").
- **Round 6, split (confirmed-non-expanding / refused):** a first block could be cut mid-text with
  no distinct state. Fixed.
- **Round 7, refused 2/2:** the naming claim was stronger than what the code enforced (fixed); the
  precedence when first blocks themselves overflow was classified owner-reserved by both seats and
  decided as D18 ("1").
- **Round 8, ratified 2/2.**
- **Round 9 (merge re-bind), split:** one seat ratified; the other refused because the compiled
  manifest was left out and `max_bytes_derivation` still called the 1,550,500 raise "the last
  `raise_log` entry". The sentence now names the entry by its value.
- **Round 10, split:** one seat ratified; the other refused on evidence alone (final YAML block,
  binding and token row not shown). No tree change.
- **Round 11, ratified 2/2** on the merged content, with the excerpts shown.

## Seat answers, pinned

SHA-256 of each seat's full answer text, as returned:

| Round | Seat | Verdict | SHA-256 |
|---|---|---|---|
| 1 (attempt) | anthropic | no answer | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (empty) |
| 1 (attempt) | openai | no answer | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (empty) |
| 1 | anthropic | refused | `205c6c1f87847ea104e559abb0af228e4e3a7d2366547e3fccceb248684ba29c` |
| 1 | openai | refused | `e1c25aa06e5b427c8b431cbc6c6edf383db690faeb6a35dc466459463f124b45` |
| 2 | anthropic | refused | `58b21ca5e51ec5cb9be9e252e2b5b7369ca9210fdecbc88a73b018d0ba73a538` |
| 2 | openai | refused | `ce64aff2a211fac8c39b741763d833e0f81a57fb1cc236c25240d1802904cacf` |
| 3 | anthropic | refused | `36606ba48d8fb0c795f92630442086200b99dc105be418024c1ed8bfb70a67f7` |
| 3 | openai | refused | `ec8c7a94ebb32f19385e915c6027810b1e38b58a11b2be8b414abfaef0c0e259` |
| 4 | anthropic | refused | `bc00dc6e520358c3173add3ebd49ce52c04daf847e568f6016278ee25aa584c8` |
| 4 | openai | refused | `954e6ab5c132fde54c9b0207b21c2a6b7a5b378789047c65404fce872fc499ae` |
| 5 | anthropic | confirmed-non-expanding | `1c900dc18e8aef3ad0ef461b40c893b5c70305518874ba4428f8f8c290557199` |
| 5 | openai | refused | `518953f61bd9a6abae3e885e6e3695cd27f97d61b71549882e7b41fef0e92f49` |
| 6 | anthropic | confirmed-non-expanding | `f9100903be44689c276745ad7b513c5d3211db501f40b69f0aac783a9b2160f4` |
| 6 | openai | refused | `5d5178ecfa2efe065e649c9f616cec566f642ab79e020bd12801eeedf93f265e` |
| 7 | anthropic | refused | `7eb647d117ab8a97b680175d020664613acd22c3be39a140f60cb17990e7e81d` |
| 7 | openai | refused | `76cd7c93b7effaf50f46e99bcb0fc364bd5e78e6c601f0e6f3bf35cacb58c56b` |
| 8 | anthropic | ratified | `f30acf59ef8b332a74b4c5ba0c50f72f3333e8d555b24d012e89bd8f236c639a` |
| 8 | openai | ratified | `6403e8ff272500c3b371e07de51161a62f933d34813055524fcdcf2823180074` |
| 9 | anthropic | ratified | `361cb0f5b3dbd59ede444e314b63108dd681986b4f75ec09c38fcb54fdafa732` |
| 9 | openai | refused | `762d62a012ab335b4c8000b7fed8742cd1a8f5589b47499259ef86d3c06a455e` |
| 10 | anthropic | ratified | `31181305a2a8def73aa507c13a60e88cbcc8f0509233e9d84d7e22925c8579b7` |
| 10 | openai | refused | `e54672f6aad8561f01906d493943c8781b2542a6fb769cf7aa88b582088ad211` |
| 11 | anthropic | ratified | `8519e4716130afc4c4458629f042ffb88627fd4d2d1165c713a9ee3d1d337afa` |
| 11 | openai | ratified | `f73cdcf22035938335b3fbeafd74c99b15f13830ce2e60184b664aa73c1e77db` |

## Residuals the seats named, non-blocking

The rules walk stops at 500 files without saying so: files past it are neither carried nor counted.
Both seats called a "scan limited" marker a follow-up, not a condition. One seat also suggested a
live host test at the 10,000-character line; the byte cap bounds the characters from above.

Round 11: the dispatch bundle sits 218 bytes under its ceiling after the merge (measured by the base change); both seats called that bundle maintenance for a later change.
