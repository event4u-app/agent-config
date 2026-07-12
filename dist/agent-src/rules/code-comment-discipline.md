---
type: "auto"
tier: "2b"
alwaysApply: false
description: "Writing/editing code in any language — a comment states a WHY or a constraint the code cannot show; never restate what names/types already say; no signature-mirroring docblocks"
triggers:
  - intent: "writing or generating code"
  - intent: "adding a class / method / function"
  - intent: "refactoring code"
  - keyword: "comment"
  - keyword: "docblock"
  - keyword: "phpdoc"
  - keyword: "jsdoc"
  - keyword: "docstring"
  - keyword: "implement"
  - keyword: "class"
  - keyword: "method"
  - keyword: "refactor"
workspaces: [engineering]
packs: [engineering-base]
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
