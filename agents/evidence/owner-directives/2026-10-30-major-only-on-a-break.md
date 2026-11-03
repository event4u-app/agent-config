<!-- evidence-type: analysis -->

# Owner directive — a major is a breaking change, and only that

| Field | Value |
|---|---|
| Ordered by | the repository owner, in chat |
| Date | 2026-10-30 |
| Record amended | ADR-300 (`reopen_policy: owner`) |
| Grants by itself | the change to the `installer-layout` surface; no release |

Owner, verbatim: "MAjor soll sich nur ändern, wenn es ein breaking change ist" ("the major should change only when it is a breaking change"), and then: "dann fixe vorher die regel, erstelle einen pr und merge ihn, damit das nicht noch einmal passiert" ("then fix the rule first, open a PR and merge it, so this does not happen again"). <!-- md-language-check: ignore -->

## What prompted it

A release dispatched on 2026-10-30 for the span `19.0.0..main` numbered itself
`20.0.0`. The only major surface in the span was `installer-layout`, fired by
one created file: `src/install/hostConfigMerge.ts`, an internal module of #2743
that changes no installed path, flag or settings key. No commit carried a
breaking marker or `Consumer-Impact: action`. The run was cancelled before it
created a branch, a pull request or a tag.

## What it means

- `installer-layout` fires only when a consumer-facing installer path is
  **removed**: the templates tree, `bin/`, the install entry-point script.
- Installer source code (`src/install/`, earlier `packages/core/installer/`) is
  not a surface. A breaking behaviour change there is declared with
  `Consumer-Impact: action`, which still numbers a major.

## What it does not change

Every other major surface, the trailer axis, and the rule that a breaking
commit without a valid trailer stays a major.
