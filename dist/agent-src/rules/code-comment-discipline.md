---
type: "auto"
tier: "2b"
alwaysApply: false
description: "Writing/editing code — a comment states a WHY or constraint the code cannot show; never restate what names/types say; no signature-mirroring docblocks"
triggers:
  - keyword: "comment"
  - keyword: "docblock"
  - keyword: "phpdoc"
  - keyword: "jsdoc"
  - keyword: "docstring"
  - keyword: "implement"
  - keyword: "class"
  - keyword: "method"
  - keyword: "refactor"
routes_to:
  - "guideline:code-clarity"
workspaces: [engineering]
packs: [engineering-base]
collision_ok:
  "refactor": "refactors churn comments — the keep/drop discipline applies"
  "implement": "fresh implementation is where over-commenting lands"
# obligation: line 5
obligation_frequency: "per-edit"
enforced_by:
  - "validator:src/scripts/lint_code_comments.ts"
  - "hook:comment-discipline"
---

# Code Comment Discipline

AI-written code over-comments: docblocks that mirror the signature, comments that narrate the next line, banner headers, change-log notes. Every redundant comment costs tokens on every future read, bloats the file, and rots into misinformation the moment the code changes. The default for any new comment is **no** — a comment must earn its place.

## The Iron Law

```
A COMMENT STATES A WHY OR A CONSTRAINT THE CODE CANNOT SHOW — NOTHING ELSE.
NEVER RESTATE WHAT THE CODE, THE NAME, OR THE TYPE ALREADY SAYS.
NO DOCBLOCK THAT ONLY MIRRORS THE NATIVE SIGNATURE.
DOCBLOCKS EARN THEIR PLACE ONLY WITH MACHINE-RELEVANT PRECISION
(GENERICS, ARRAY SHAPES, NON-TRIVIAL UNIONS) OR GENUINE WHY-CONTEXT.
WHEN IN DOUBT: NO COMMENT. SHORTER IS BETTER. NONE IS OFTEN BEST.
```

## Evidence belongs where it was asked for, never in a second copy

```
A ROADMAP THAT DEMANDS EVIDENCE NAMES WHERE THE EVIDENCE GOES.
THE ANSWER IS THE ROADMAP. NEVER A SECOND COPY IN THE SOURCE.
A COMMENT THAT EXPLAINS WHERE THE CODE CAME FROM — A ROADMAP PATH, A PHASE
AND STEP, A PROTOTYPE OR REFERENCE ARTEFACT — IS THAT COPY, AND IT IS THE ONE
IN THE WRONG PLACE.
```

The failure this closes, measured 2026-09-02: a roadmap required proof for
every checked step and said in as many words that the proof goes in its own
evidence block. The run read that as *evidence should be documented* and wrote
the measurements into the source as well — a colour-analysis report inside a
CSS file, complete with a dE2000 table, a WCAG comparison and a `Revisit-if:`
clause. The numbers were correct and the roadmap already carried them.

Two things follow, and the second is the one that gets skipped:

- **The provenance of a value is not a WHY.** *Why this threshold and not the
  obvious one* is a constraint the code cannot show. *Which document this
  value was translated from* is bookkeeping, and it goes stale the first time
  either side moves.
- **A roadmap cannot license a comment this rule forbids.** An instruction to
  document evidence is an instruction about the roadmap's own evidence block.
  Where the two appear to conflict, this rule wins and the roadmap step is the
  thing to fix.

## Activation — the keywords match the prompt, and the defect is in the write

This rule is `type: auto` on keywords like `comment`, `refactor` and
`implement`, and those match the PROMPT. A run that writes forty-five files
because the user asked for a feature matches none of them, so the rule does
not load at exactly the moment it governs — the same activation gap
[`fix-what-you-see`](fix-what-you-see.md) states for itself.

That gap is why the two `enforced_by` entries exist rather than a longer
paragraph here: `lint_code_comments` refuses at the gate on the diff, and the
`comment-discipline` concern reports on the text as it is written, both
without reading the prompt. Neither is a substitute for the discipline —
an advisory nudge can be ignored and a gate only sees what the diff carries —
but both fire where a keyword trigger cannot reach.

## What a comment is FOR

Exactly five legitimate jobs — everything else is noise:

1. **A why** — the non-obvious reason this approach was chosen over the obvious one.
2. **An invariant or constraint** the code cannot express — ordering requirements, units, concurrency assumptions, "must run before X".
3. **A warning** — a known trap, a workaround for a specific upstream bug (name it), a performance cliff.
4. **Machine-relevant type precision** the native type system cannot carry — carve-out in the guideline.
5. **A spec linkage** where an external contract defines the behavior (RFC section, protocol field) — the contract, not the ticket history.

Test before writing any comment: *would deleting it leave a future reader confused about a non-obvious constraint?* No → don't write it.

## When NOT to fire

- Prose surfaces: docs, READMEs, roadmaps, config commentary — different register, not code comments.
- The user explicitly asks for documented code / teaching examples ("erkläre im Code", "annotate this for juniors") — that turn's ask wins.
- License headers or file-level pragmas a toolchain requires.

Body migrated to [`guideline:code-clarity § Comment discipline`](../docs/guidelines/code-clarity.md#comment-discipline--state-a-constraint-not-a-narration) (per P4 of `road-to-kernel-and-router.md`) — banned-classes table, machine-relevant precision carve-out, `code_style.docblocks` public-API carve-out, per-language keep/drop tables, worked examples, scope boundary, fixtures pointer.
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## See also

- [`code-clarity.md § Comment discipline`](../docs/guidelines/code-clarity.md#comment-discipline--state-a-constraint-not-a-narration) — canonical long-form with the migrated body.
- [`minimal-safe-diff`](minimal-safe-diff.md) — diff-shape twin; no comment additions or removals on untouched code.
- [`output-discipline`](output-discipline.md) — adjacent but distinct: bans placeholder prose (`// TODO: implement`); this rule bans redundant prose.
- `docs/guidelines/php/php-coding-patterns.md` § PHPDoc — PHP-specific operationalization.
