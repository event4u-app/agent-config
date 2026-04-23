# Roadmap: frontmatter JSON-Schema validation

> Formalize the frontmatter contract of every agent artefact type with a
> JSON-Schema per type, validated in CI. Sharpens what the skill linter
> already does today — no behaviour change for authors, a much clearer
> error surface for contributors.
>
> - **Created:** 2026-04-23
> - **Status:** complete
> - **Author note:** small, self-contained roadmap. One schema per
>   artefact type, one linter hook, one CI gate. No architectural
>   change, no new runtime behaviour.

## Context — why this, why now

The skill linter (`scripts/skill_linter.py`) already checks frontmatter
keys and sections ad-hoc with hand-rolled regex and section aliases.
That works, but:

- Required vs. optional fields are **implicit** in linter code — new
  contributors can't read the contract in one place.
- Error messages describe the symptom (`"missing_section"`) rather
  than the schema rule that was violated.
- A missing key in one artefact type sometimes slips through because
  the linter only errors on the narrow set it already checks.

A JSON-Schema per artefact type is the smallest step that makes the
contract inspectable, versionable, and reviewable — without adding a
runtime, a resolver, or any new layer.

This came up as one of two genuinely actionable points from an
external PR #18 code review (the other — README scope clarity — landed
as a direct README edit). The larger review suggestions (execution
engine, skill resolver, state / memory layer, observability) are
category errors for a content-layer package and are **not** in scope
of this roadmap.

## Guiding principles

- **stdlib-only** stays the install contract. No runtime dependency on
  `jsonschema` in the install pipeline. Either implement the needed
  Draft-07 subset in stdlib, or scope validation as a contributor-only
  step that runs inside `task ci` with a venv-installed dependency.
- **One schema per artefact type.** No inheritance tricks; duplication
  over cleverness for 4 files.
- **No author-visible change** in the happy path. A well-formed skill
  today must stay valid tomorrow.
- **Error messages must be better**, not just different — point at
  the violated rule in the schema and the offending line.

## Prerequisites

- [x] Skill linter exists and runs in CI (`task lint-skills`).
- [x] Four artefact types with frontmatter have stable shapes in
      `.agent-src.uncompressed/`: skills, rules, commands, personas.
- [x] Guidelines have no frontmatter — scope of this roadmap is
      explicitly skills / rules / commands / personas only.

## Phase 1 — inventory + contract extraction

Produce the actual contract as data before writing any schema.

- [x] For each artefact type, enumerate every frontmatter key that
      appears in `.agent-src.uncompressed/**`. Count occurrences.
- [x] Mark each key as *required* (present in ≥ 95 % of files) vs.
      *optional*.
- [x] For each required key, capture the value shape: string, list,
      enum, regex constraint. Cite three real examples per type.
- [x] Document findings in `agents/docs/frontmatter-contract.md`
      as a human-readable reference (no schemas yet).
- [x] Acceptance: a new contributor can read the doc and write a
      valid skill / rule / command / persona without opening the linter.

## Phase 2 — schemas authored

- [x] Write `scripts/schemas/skill.schema.json`,
      `rule.schema.json`, `command.schema.json`, `persona.schema.json`
      — Draft-07, `additionalProperties: false` where safe.
- [x] Encode the contract from J1: required keys, enums (e.g.
      `type: always|auto|manual|model_decision` on rules), regex for
      `name`, list-of-strings for `personas:`, etc.
- [x] For each schema, add a `$comment` block that points back to the
      J1 contract doc so drift is visible on review.
- [x] Acceptance: schemas validate against all existing artefacts with
      zero errors (schema matches reality, not aspiration).

## Phase 3 — linter integration

- [x] Add `scripts/validate_frontmatter.py` — stdlib-only Draft-07
      subset validator sufficient for our schemas (type / required /
      enum / pattern / items). No `jsonschema` import if possible; if
      a subset is insufficient for one rule, document the gap and
      decide case-by-case.
- [x] Wire the validator into `skill_linter.py` as an additional
      check. Keep existing checks; the schema catches *contract*
      violations, the linter keeps catching *quality* ones (vague
      validation, missing procedure, etc.).
- [x] Error format: `file:line – schema.rule.path – human message`.
- [x] Acceptance: deleting a required key from one skill fixture fails
      the linter with a message that names the schema rule.

## Phase 4 — CI gate + docs

- [x] Add `task validate-schema` target (or fold into `task lint-skills`
      if noise stays low).
- [x] Wire into `task ci` so PRs fail on schema violation.
- [x] Link the schemas from `skill-quality` and `size-enforcement`
      rules as the canonical contract.
- [x] Add a three-line note to the README's "What this package is"
      section pointing at the schemas as an example of what *is* in
      scope (contract validation) vs. what isn't (runtime validation).
- [x] Acceptance: `task ci` stays green on `main`; a deliberately
      broken artefact in a feature branch fails the schema gate with
      a clear message.

## Out of scope — explicit non-goals

To keep the roadmap small and the review feedback from sprawling:

- **Runtime validation** of frontmatter inside a live agent session —
  host tools consume the compressed files as given.
- **Migration tooling** to auto-fix existing artefacts — J2 requires
  schemas to match reality, so no migration is needed.
- **Web UI, dashboard, or cross-tool observability** — not a
  content-layer responsibility.
- **Skill resolver / execution engine** — out of scope by design
  (see README "What this package is — and what it isn't").

## Acceptance criteria — roadmap level

- [ ] All four phases shipped as separate commits.
- [x] Four schemas under `scripts/schemas/` plus one contract doc.
- [x] `task ci` green; deliberate-break fixture fails with a clear
      schema error.
- [x] `stdlib-only` install guarantee preserved.

## Open questions

- Q1: Is the stdlib-only validator realistic for Draft-07 subset, or
  do we accept `jsonschema` as a contributor-only dev dependency
  (in `requirements-dev.txt`, not in the install pipeline)? Decide
  in J3 before writing the validator.
- Q2: Do we version the schemas (e.g. `skill.v1.schema.json`) from
  day one, or add versioning only when a breaking change lands?
  Default: no version suffix until the first break.
