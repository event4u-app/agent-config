# ADR 0001 — JSON Schema as the frontmatter source of truth

> Area: `schema` · Status: accepted · Date: 2026-05-16 · Type: retrospective
> Roadmap: `agents/roadmaps/step-11-ruflo-parity.md` Phase 4 Step 3
> Supersedes: —

## Context

Skills, rules, commands, and personas all declare YAML frontmatter
with required and optional keys. Validation needs to be:

1. Machine-checkable on every PR (no "guideline" enforcement).
2. Diff-readable so the contract drift is visible.
3. Tool-agnostic — the same artefacts ship to Claude, Cursor, Cline,
   Windsurf, and Augment, all of which parse the same YAML.

The contract is documented for humans in
[`agents/reference/docs/frontmatter-contract.md`](../../../agents/reference/docs/frontmatter-contract.md);
the question this ADR records is **how that contract is enforced**.

## Decision

**JSON Schema (Draft-07) files in
[`scripts/schemas/`](../../../src/scripts/schemas/) are the
machine-readable source of truth.** The human contract document
defers to the schema (`$comment` in each schema file pins
`agents/reference/docs/frontmatter-contract.md` as the source).

### Schema files

| Type | Schema | Validator entry-point |
|---|---|---|
| Skill | `scripts/schemas/skill.schema.json` | `scripts/skill_linter.py` |
| Rule | `scripts/schemas/rule.schema.json` | `scripts/skill_linter.py` |
| Command | `scripts/schemas/command.schema.json` | `scripts/validate_frontmatter.py` |
| Persona | `scripts/schemas/persona.schema.json` | `scripts/validate_frontmatter.py` |

### Required-key threshold

A key is **required** (in the schema's `required:` array) if ≥ 95 %
of files in the type declare it. Everything else is optional. The
threshold is documented inline in
[`frontmatter-contract.md`](../../../agents/reference/docs/frontmatter-contract.md)
§ "Definition of required". Re-derive counts with
`python3 scripts/inventory_frontmatter.py`.

### Validation hooks

- `task lint-skills` — runs `skill_linter.py` against all skills + rules.
- `task ci` — wraps `lint-skills` plus router + smoke smokes.
- Smoke contract `scripts/smoke/schema.sh` — fast random-sample check
  for PRs touching `.agent-src.uncondensed/**` (see
  [`docs/contracts/smoke-contracts.md`](../../contracts/smoke-contracts.md)).

## Considered alternatives

### Alt 1 — Inline regex in the linter (rejected)

Hard-code shape checks in `skill_linter.py`.

**Why rejected:** the linter becomes the contract, the contract is
hidden in Python, and the artefacts can't be validated by external
tools (CI, editors, IDE plugins). Cross-tool portability is the
whole point of YAML frontmatter — the schema must be portable too.

### Alt 2 — Pydantic / dataclass models (rejected)

Validate via typed Python models.

**Why rejected:** ties validation to Python runtime, prevents
JS/TS / Node tooling from reusing the same contract, and forces a
non-trivial dependency on every consumer that wants to validate
their own artefacts. JSON Schema is the lingua franca.

### Alt 3 — JSON Schema Draft-07 (accepted)

The chosen path. One source-of-truth file per artefact type,
referenced by Python linter today, reusable by Node / VS Code /
JetBrains / any JSON-Schema-aware tool tomorrow.

## Consequences

- **Positive:** schemas are diffable; new keys land via PR with
  reviewable shape changes; non-Python tools can validate the same
  contract; the linter stays thin.
- **Negative:** Draft-07 is older than Draft-2020-12; some keyword
  niceties (`unevaluatedProperties`, conditional `then`/`else`) are
  awkward. Mitigated by `additionalProperties: false` plus
  `oneOf` / `if`-then composition where needed.
- **Reversal cost:** the linter is the only consumer today; replacing
  the schema with Pydantic models would be a one-PR swap. The choice
  is reversible without contract churn.

## References

- [`scripts/schemas/skill.schema.json`](../../../src/scripts/schemas/skill.schema.json) — skill contract.
- [`scripts/schemas/rule.schema.json`](../../../src/scripts/schemas/rule.schema.json) — rule contract.
- [`scripts/schemas/command.schema.json`](../../../src/scripts/schemas/command.schema.json) — command contract.
- [`scripts/schemas/persona.schema.json`](../../../src/scripts/schemas/persona.schema.json) — persona contract.
- [`agents/reference/docs/frontmatter-contract.md`](../../../agents/reference/docs/frontmatter-contract.md) — human-readable contract.
- [`scripts/skill_linter.py`](../../../src/scripts/skill_linter.py) — primary validator.
- [`agents/roadmaps/step-11-ruflo-parity.md`](../../../agents/roadmaps/step-11-ruflo-parity.md) Phase 4 Step 3 — origin.
