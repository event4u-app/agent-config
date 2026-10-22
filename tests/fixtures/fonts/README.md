# Typeface fixtures — repository-only, bounded

> **Suspended since 2026-10-22.** The amendment below narrowed a licensing lock,
> which `decision-revisit-gate` may reserve to the owner; the 2026-10-22 council
> split on whether it did (`agents/evidence/council/typeface-lock-amendment-routing-20261022.md`), and a split
> escalates. Until an owner record is named in `fixtures.json` →
> `suspended.lifted_by`, the typeface binaries are NOT in the tree: only each
> family's license text and its pinned upstream path and SHA-256 remain, and
> `tests/scripts/typeface_fixture_bound.test.ts` refuses a binary that
> reappears. Lifting restores the exact files from the pinned commit.

These files are the held-out truth for the type-reconstruction benchmark
(`internal/bench/type-reconstruction-PREREG.md`). They exist under an
amendment the AI council made on 2026-10-16
(`agents/evidence/council/benchmark-fixture-fonts-20261016.md`): the
2026-06-28 no-typeface-bundler lock binds **published artefacts**, not the
repository.

## The bound

1. **Typeface families for this benchmark, and nothing else.** The amendment
   does not admit any other binary class — no audio samples, no image sets, no
   typeface used for any other purpose.
2. **A family joins by an explicit decision, never drive-by.** Each entry in
   `fixtures.json` names the decision that admitted it. A family without an
   entry fails the check.
3. **"Openly licensed" means an OSI-approved SPDX identifier.** Each family
   carries its license text beside it, its identifier in `fixtures.json`, and a
   record in `docs/THIRD-PARTY-NOTICES.md` (generated from
   `provenance/borrows.jsonl`). An identifier outside the OSI-approved set is
   refused by the same check that inspects the published archive.
4. **Nothing here is published.** `tests/` is outside `package.json#files` and
   export-ignored in `.gitattributes`; the check reads the produced npm tarball
   and the produced `git archive`, not the configuration that is meant to
   produce them.

The files are byte-identical to their upstream (pinned commit and SHA-256 in
`fixtures.json`); no outline, table or name is changed, so no Reserved Font
Name clause is engaged.

Check: `tests/scripts/typeface_fixture_bound.test.ts`.
