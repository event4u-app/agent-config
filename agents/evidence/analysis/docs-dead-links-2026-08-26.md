<!-- evidence-type: analysis -->
# Dead relative links under `docs/` — measured, split, and repaired

`road-to-contract-review-deadlines` Phase 4. The split is the deliverable, not
the total: a dead link in `docs/guidelines/` is published to consumers and is the
only half that reaches anyone, while a dead link in an internal analysis note
costs a maintainer one confused minute. One number for both invites either an
unreviewable 500-line sweep or nothing.

## Reproduce

```
./scripts-run src/scripts/measure_docs_dead_links
./scripts-run src/scripts/measure_docs_dead_links --format json
./scripts-run src/scripts/measure_docs_dead_links --list shipped|internal|py
```

`measure_*`, deliberately not `lint_*` / `check_*`: the scope decision (4.3) was
still open when this was written, and a gate landed before that decision would
have pre-empted it.

## Before → after

| bucket | before | after |
|---|---:|---:|
| **shipped** (`package.json:files[]` publishes `docs/guidelines/` plus three named contracts) | **104** | **0** |
| internal | 440 | 297 |
| `.py` target (migration leftovers; a subset of both rows, not a third bucket) | 152 | 9 |
| total | 544 | 297 |

The roadmap's step 4.1 recorded 487 / 104 / 152 at an older HEAD. The **104 and
the 152 reproduce exactly**; the total is higher because `docs/` grew between
the two measurements. Stated rather than reconciled away — the two figures
describe different trees.

## How the repair was made safe

`--fix` rewrites a dead target only when **exactly one** file in the tree matches
it, through four ordered strategies:

1. **Path tail** from a known segment (`rules/`, `skills/`, `contexts/`, …).
   Nearly every dead link points at a container that MOVED — the retired
   uncondensed source tree after ADR-051, or a wrong `../` depth. The container
   changed; the tail did not.
2. **Extension swap** for the migration class: `x.py` → `x.ts`.
3. **Test-name shape**: pytest's `test_x.py` became vitest's `x.test.ts` — a
   rename, not just a different extension.
4. **Unique basename**, last resort, for a move that changed the directory too.

Two tie-breaks, both principled rather than convenient: a tie is broken toward
`src/` (the single source of truth; every other tree is a projection or an
override), and toward the path the author literally wrote once `../` is stripped
— which is what separates `src/scripts/memory_status.ts` from
`src/agent-src/templates/scripts/memory_status.ts`.

**Anything still ambiguous is reported, never guessed.** A link silently
repointed at the wrong one of two candidates is worse than a dead link, because
a dead link is visible and a wrong one is not.

## The nine `.py` survivors, and why they are not a fixable class

These are references to files the TypeScript migration **deleted**, not renamed.
No successor exists in the tree under any name:

    docs/architecture/multi-tool-projection.md -> ../../tests/test_modern_editor_formats.py
    docs/architecture/source-projection.md -> ../../tests/test_condense_paths.py
    docs/architecture.md -> ../tests/test_canonical_distribution.py
    docs/contracts/implement-ticket-flow.md -> ../../tests/implement_ticket/test_ambiguity_coverage.py
    docs/contracts/install-layout.md -> ../../tests/test_install_layout_contract.py
    docs/contracts/install-scopes.md -> ../../tests/test_cleanup_other_scope.py
    docs/contracts/low-impact-corpus-format.md -> ../../tests/test_low_impact_corpus_robustness.py
    docs/contracts/ui-track-flow.md -> ../../tests/implement_ticket/test_ambiguity_coverage.py
    docs/decisions/ADR-095-workspace-boundary-contract.md -> ../../src/scripts/lint_workspace_boundary.py

**The finding this exposes outranks the link count, and is left open on
purpose.** Every one of these is a contract or an architecture page citing a
TEST as evidence that its rule holds. The test is gone. So the citation is not
merely a broken link — it is a **coverage claim with nothing behind it**, and
repairing the link would be impossible without first deciding whether the
coverage still exists. Six of the nine sit in `docs/contracts/`, which is the
worst place for an unbacked claim.

Not repaired here, and the reason is scope rather than effort: establishing
whether `install-layout-contract`, `cleanup_other_scope`,
`low_impact_corpus_robustness`, `ambiguity_coverage`, `condense_paths`,
`modern_editor_formats` and `canonical_distribution` still have equivalent
coverage means reading seven contracts against the current test suite. That is
its own change, and step 4.2 explicitly admits a survivor that **carries a
reason** — this is the reason.

## What the widened gate now covers (4.3)

`check_references.ts` `SCAN_DIRS` gains `docs/guidelines` — the **narrow** option
of the three step 4.3 offered, priced before choosing:

- widening to **all** of `docs/` lands ~300 findings on the next unrelated pull
  request: the flood that gets a gate waived rather than adopted, and the same
  argument Phase 0 already accepted for the beta backlog;
- widening to the **shipped** roots lands **zero**, because 4.2 repaired all 104
  first. The gate arrives green and holds the gain instead of announcing a
  backlog.

The excluded class is named in the code rather than left implicit: 297 dead
links in non-shipped `docs/`.

The three named single-file contracts in `files[]` (`persona-schema`,
`provider-lifecycle`, `settings-classes`) are **not** added — a directory scan
cannot express "these three files under a directory that is otherwise excluded",
and all three measure zero dead links today.

## What the widened scan found that a link scan could not

`check_references` reads backticked path references, not only markdown links, so
turning it on surfaced **13 findings this measurement never saw**. All were
repaired: a renamed pack directory (`src/domains/legal` → `legal-review-prep`),
four PHP pattern pages cited one directory too shallow, a rule renamed
(`capture-learnings` → `skill-improvement-trigger`), and six prose strings that
are not references at all — hypothetical filenames in advice about splitting a
README, and a consumer-side settings path this repository describes but does not
contain. Those six carry `<!-- ref-ignore -->`.

Two guideline paragraphs pointed at `rules-auto` mechanics files that exist
nowhere in the tree: each promised a content split that never happened, while the
content it named was already in the file doing the pointing. Both now say so.
