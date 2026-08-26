<!-- evidence-type: analysis -->
# Canonical-terms classified inventory — 2026-08-26

The AI council's condition on `road-to-canonical-terms` 2.1, discharged. Its
wording, adopted rather than paraphrased: *a classified inventory, not a
frequency count* — every match categorised as (a) repository-authored prose
eligible for normalisation, (b) protected exact text, (c) generated or
externally synchronised content, or (d) ambiguous, needing review. *"The
migration is designed from the classification; a frequency table cannot tell (a)
from (b)."*

## How to reproduce

```
./scripts-run src/scripts/lint_canonical_terms --inventory
./scripts-run src/scripts/lint_canonical_terms --inventory --format json
```

The classifier is the gate itself (`src/scripts/lint_canonical_terms.ts`), not a
separate script. That is deliberate: a second tool with its own idea of what a
fence is would produce an inventory the gate disagrees with, and the bounded
pilot below is applied through the same classification — `--fix` can only touch
occurrences this table calls `authored-prose`.

## The pairs

Read from `src/config/canonical-terms.yml`. Eight decided pairs; the ninth
(`preflight` / `pre-flight`) carries `canonical: null` and is skipped, because a
gate that guessed a side would enforce a decision the map explicitly refused to
make.

## The table, as measured

Scope: `src/`, `docs/`, `agents/`, `dist/` — every tracked and untracked `.md`.

files scanned: 3971
occurrences:   4732

| category | occurrences | what it means |
|---|---:|---|
| authored-prose | 1343 | repository-authored prose, eligible for normalisation |
| protected-text | 21 | exact external text — licence titles, addresses, code spans |
| generated | 484 | generated or externally synchronised; a rewrite is reverted by `task sync` |
| ambiguous | 2884 | immutable record (archive, evidence, ADRs, changelog) — a human decides per file |

| pair | authored-prose | files | blast radius |
|---|---:|---:|---|
| `sub-agent` → `subagent` | 3 | 3 | small |
| `hand-off` → `handoff` | 48 | 38 | large |
| `organise` → `organize` | 2 | 2 | small |
| `grey` → `gray` | 1 | 1 | small |
| `canonicalise` → `canonicalize` | 0 | 0 | small |
| `behaviour` → `behavior` | 483 | 244 | large |
| `artefact` → `artifact` | 768 | 313 | large |
| `licence` → `license` | 38 | 23 | medium |

> The table above is the **post-pilot** state. Pre-pilot, measured on the same
> tree before `--fix` ran, the four categories were: `authored-prose` **1615**,
> `protected-text` 21, `generated` 446, `ambiguous` 2668 — 4,750 occurrences
> across 3,971 files. The pilot moved 18 of them.

## What each category means, and why the split is not cosmetic

- **(a) `authored-prose`** — prose this repository wrote and may normalise. The
  only category `--fix` can touch.
- **(b) `protected-text`** — exact external strings. Licence TITLES (`MIT
  License`, `Mozilla Public Licence`, the GNU/Apache/BSD family), URLs, link
  targets and file paths. The carve-out is **span-scoped, not line-scoped**,
  because the council was explicit: *proximity to a protected name does not
  exempt the surrounding prose*. A line reading "The Mozilla Public Licence is
  quoted here, but this licence choice is ours" produces **two** findings, one
  of each category — pinned by
  `tests/scripts/lint_canonical_terms.test.ts`.
- **(c) `generated`** — `dist/`, the per-tool projections, and `docs/proof.md`.
  Rewriting any of it is a no-op the next `task sync` / `build_proof` reverts.
  446 occurrences, i.e. **9 %** of the corpus would have been wasted edits in a
  naive tree-wide sweep.
- **(d) `ambiguous`** — immutable records: `agents/roadmaps/archive/`,
  `agents/roadmaps/skipped/`, `agents/evidence/`, `docs/decisions/`,
  `docs/archive/`, `CHANGELOG.md`. Repository-authored, but rewriting them edits
  history — an archived roadmap and a dated evidence file are what the
  repository *said*, and a sweep that changes them makes the record disagree
  with the measurement it published. **2,668 occurrences — 56 % of the corpus.**

That last number is the finding that most changes the migration's shape. A
frequency count over the tree reports ~4,750 occurrences and implies a
~4,750-line sweep. The classification says the eligible population under the
gate's own enforcing scope is **1,025**, i.e. **22 %** of it, and that the
majority of the corpus must be left alone for reasons that have nothing to do
with blast radius.

## The bounded pilot — chosen by blast radius, not by pair

The council's second condition, verbatim in intent: *a single spelling pair is
not necessarily a small pilot — the unit is changed-file count and overlap with
active work.*

Blast radius per pair, measured in the gate's enforcing scope (`src/`, `docs/`)
before the pilot:

| pair | occurrences | files | radius |
|---|---:|---:|---|
| `canonicalise` → `canonicalize` | 2 | 1 | small |
| `grey` → `gray` | 3 | 3 | small |
| `sub-agent` → `subagent` | 13 | 8 | small |
| `licence` → `license` | 17 | 12 | medium — and `semantic-care-required` |
| `hand-off` → `handoff` | 46 | 36 | large |
| `behaviour` → `behavior` | 325 | 171 | large |
| `artefact` → `artifact` | 619 | 239 | large |

**Overlap with active work: zero.** `gh pr list --state open` returned no open
pull requests at the time of the sweep, so no branch could conflict with it.

**Pilot = the three smallest radii** — `canonicalize`, `gray`, `subagent`: 18
occurrences across 12 files, 3.2 % of the eligible files. Applied with
`./scripts-run src/scripts/lint_canonical_terms --fix --pair subagent,gray,canonicalize`.
All 18 were read before the rewrite and all 18 are genuine repository-authored
prose.

`licence` is deliberately **excluded** from the pilot despite a medium radius:
the map flags it `semantic-care-required` because licence titles are protected
text, and the pilot's purpose is to validate the protected-context rules — not
to exercise them on the one pair where a mistake is hardest to see.

## What the pilot validated, and what it did not

**Validated.** The protected-context rules hold on a real corpus: 21
`protected-text` occurrences were correctly left alone, 446 generated ones were
never candidates, and the four states of the gate's own verify clause (prose,
fence, frontmatter value, quoted licence title) were each demonstrated red and
green under sabotage — see the sensitivity probes recorded in the pull request.

**Not validated.** Nothing here tests the two large-radius pairs. `artefact` at
239 files and `behaviour` at 171 are a different problem from 12 files, and the
council's blast-radius unit says so. A later wave lowers the ratchet baseline;
this inventory is what that wave is designed from.

**Still unrebutted.** One seat argued the sweep may not be worth doing at all —
no evidence of harm has been produced, and *"the prose is machine-facing, not a
published book"*. This inventory does not answer that objection. It bounds the
work; it does not justify it.

## The gate's own scope, stated plainly

`lint_canonical_terms` **enforces** over `src/` and `docs/` only — the shipped
surface the dialect was decided on. It **inventories** over `agents/` and
`dist/` as well. The two scopes differ on purpose: the British lead in the
published aggregate is produced almost entirely by `agents/`, this repository's
working prose, and judging it against a convention chosen for the shipped tree
would be enforcing a decision nobody made.
